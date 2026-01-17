"use client";

import { useEffect, useMemo, useState } from "react";

import { env } from "@/lib/env";

type MappingRow = { placeholder_name: string; expression: string };
type ValidationResult = {
  missing_mappings_count: number;
  has_tle_config: boolean;
  has_return_address: boolean;
  errors: string[];
  warnings: string[];
};
type RunStatus = {
  status: string;
  progress: number | null;
  output_s3_key: string | null;
  output_tle_s3_key: string | null;
  error: string | null;
};

const steps = [
  "Create Job",
  "Template",
  "Spreadsheet",
  "Mapping",
  "Logo",
  "Append PDFs",
  "TLE Index Setup",
  "Validate & Preview",
  "Generate",
];

function apiUrl(path: string) {
  return `${env.apiBaseUrl}${path}`;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [jobName, setJobName] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateProfileId, setTemplateProfileId] = useState<string | null>(null);
  const [spreadsheetAssetId, setSpreadsheetAssetId] = useState<string | null>(null);
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
  const [appendAssetIds, setAppendAssetIds] = useState<string[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([
    { placeholder_name: "NAME", expression: "column('name')" },
  ]);
  const [tleInputs, setTleInputs] = useState({
    name: "column('name')",
    addr1: "column('addr1')",
    addr2: "column('addr2')",
    addr3: "column('addr3')",
    return1: "",
    return2: "",
    return3: "",
  });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAddress, setReturnAddress] = useState({
    addr1: "",
    addr2: "",
    addr3: "",
  });
  const [returnAddressStatus, setReturnAddressStatus] = useState<"pending" | "complete">(
    "pending"
  );
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [outputLinks, setOutputLinks] = useState<{ afp_url?: string; tle_url?: string } | null>(
    null
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = validation ? validation.errors.length === 0 : false;

  useEffect(() => {
    let timer: number | undefined;
    const poll = async () => {
      if (!runId) return;
      try {
        const status = await api<RunStatus>(`/runs/${runId}`);
        setRunStatus(status);
        if (status.status === "SUCCEEDED") {
          const outputs = await api<{ afp_url?: string; tle_url?: string }>(
            `/runs/${runId}/outputs`
          );
          setOutputLinks(outputs);
        } else if (status.status === "FAILED") {
          setOutputLinks(null);
        } else {
          timer = window.setTimeout(poll, 2000);
        }
      } catch (err) {
        setError(String(err));
      }
    };
    poll();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [runId]);

  const returnIndicator = returnAddressStatus === "complete" ? "✅" : "⚠️";

  const mappingCount = useMemo(() => mappings.filter((row) => row.placeholder_name.trim()).length, [
    mappings,
  ]);

  const handleCreateJob = async () => {
    if (!jobName.trim()) return;
    setBusy("job");
    setError(null);
    try {
      setActiveStep(1);
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async (
    file: File,
    assetType: string,
    onSuccess: (assetId: string) => void
  ) => {
    setBusy("upload");
    setError(null);
    try {
      const presign = await api<{ asset_id: string; s3_key: string; presigned_url: string }>(
        "/assets/presign-upload",
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            asset_type: assetType,
          }),
        }
      );
      await fetch(presign.presigned_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      await api("/assets/commit", {
        method: "POST",
        body: JSON.stringify({ asset_id: presign.asset_id }),
      });
      onSuccess(presign.asset_id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateTemplateProfile = async (assetId: string) => {
    setBusy("template");
    setError(null);
    try {
      const result = await api<{ id: string }>("/template-profiles", {
        method: "POST",
        body: JSON.stringify({ name: templateName || "Template", template_asset_id: assetId }),
      });
      setTemplateProfileId(result.id);
      if (!jobId) {
        const jobResult = await api<{ id: string }>("/jobs", {
          method: "POST",
          body: JSON.stringify({ name: jobName || "New job", template_profile_id: result.id }),
        });
        setJobId(jobResult.id);
      }
      setActiveStep(2);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveMappings = async () => {
    if (!jobId) return;
    setBusy("mappings");
    setError(null);
    try {
      await api(`/jobs/${jobId}/mappings`, {
        method: "PUT",
        body: JSON.stringify({
          mappings: mappings
            .filter((row) => row.placeholder_name.trim())
            .map((row) => ({
              placeholder_name: row.placeholder_name,
              expression_json: { value: row.expression },
            })),
        }),
      });
      setActiveStep(4);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveTle = async () => {
    if (!jobId) return;
    setBusy("tle");
    setError(null);
    try {
      await api(`/jobs/${jobId}/tle`, {
        method: "PUT",
        body: JSON.stringify({
          name_expr: tleInputs.name ? { value: tleInputs.name } : null,
          addr1_expr: tleInputs.addr1 ? { value: tleInputs.addr1 } : null,
          addr2_expr: tleInputs.addr2 ? { value: tleInputs.addr2 } : null,
          addr3_expr: tleInputs.addr3 ? { value: tleInputs.addr3 } : null,
          return_addr1_expr: tleInputs.return1 ? { value: tleInputs.return1 } : null,
          return_addr2_expr: tleInputs.return2 ? { value: tleInputs.return2 } : null,
          return_addr3_expr: tleInputs.return3 ? { value: tleInputs.return3 } : null,
        }),
      });
      setActiveStep(7);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveReturnAddress = async () => {
    if (!jobId) return;
    setBusy("return");
    setError(null);
    try {
      await api(`/jobs/${jobId}/return-address`, {
        method: "PUT",
        body: JSON.stringify({
          return_addr1: returnAddress.addr1,
          return_addr2: returnAddress.addr2 || null,
          return_addr3: returnAddress.addr3 || null,
        }),
      });
      setReturnAddressStatus(returnAddress.addr1 ? "complete" : "pending");
      setShowReturnModal(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleValidate = async () => {
    if (!jobId) return;
    setBusy("validate");
    setError(null);
    try {
      const result = await api<ValidationResult>(`/jobs/${jobId}/validate`, { method: "POST" });
      setValidation(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  const handleGenerate = async () => {
    if (!jobId) return;
    setBusy("generate");
    setError(null);
    try {
      const result = await api<{ run_id: string }>(`/jobs/${jobId}/runs`, { method: "POST" });
      setRunId(result.run_id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="wizard">
      <aside className="wizard-aside">
        <div className="brand">
          <span className="brand-mark">APS</span>
          <div>
            <h1>AdhocPrintStudio</h1>
            <p>Print flow console</p>
          </div>
        </div>
        <div className="return-indicator">
          Return Address {returnIndicator}
        </div>
        <ol className="step-list">
          {steps.map((step, index) => (
            <li
              key={step}
              className={index === activeStep ? "active" : index < activeStep ? "done" : ""}
              onClick={() => setActiveStep(index)}
            >
              <span>{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </aside>
      <main className="wizard-main">
        <header className="wizard-header">
          <div>
            <h2>{steps[activeStep]}</h2>
            <p>Step {activeStep + 1} of {steps.length}</p>
          </div>
          <button className="secondary" onClick={() => setShowReturnModal(true)}>
            Return Address
          </button>
        </header>

        {error && <div className="alert error">{error}</div>}

        {activeStep === 0 && (
          <section className="panel">
            <h3>Create a job shell</h3>
            <label>
              Job name
              <input
                value={jobName}
                onChange={(event) => setJobName(event.target.value)}
                placeholder="January mail drop"
              />
            </label>
            <button className="primary" onClick={handleCreateJob} disabled={!jobName || busy === "job"}>
              {busy === "job" ? "Creating..." : "Create Job"}
            </button>
            <p className="hint">Template profile can be attached after upload.</p>
          </section>
        )}

        {activeStep === 1 && (
          <section className="panel">
            <h3>Upload template asset</h3>
            <label>
              Template profile name
              <input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Standard TLE template"
              />
            </label>
            <label className="file">
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file, "TEMPLATE", handleCreateTemplateProfile);
                  }
                }}
              />
              <span>{templateProfileId ? "Template uploaded" : "Choose template file"}</span>
            </label>
            <button className="primary" onClick={() => setActiveStep(2)} disabled={!templateProfileId}>
              Continue
            </button>
          </section>
        )}

        {activeStep === 2 && (
          <section className="panel">
            <h3>Upload spreadsheet</h3>
            <label className="file">
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file, "SPREADSHEET", setSpreadsheetAssetId);
                  }
                }}
              />
              <span>{spreadsheetAssetId ? "Spreadsheet ready" : "Choose spreadsheet file"}</span>
            </label>
            <button className="primary" onClick={() => setActiveStep(3)} disabled={!spreadsheetAssetId}>
              Continue
            </button>
          </section>
        )}

        {activeStep === 3 && (
          <section className="panel">
            <h3>Map placeholders</h3>
            <div className="mapping-grid">
              {mappings.map((row, index) => (
                <div key={`${row.placeholder_name}-${index}`} className="mapping-row">
                  <input
                    value={row.placeholder_name}
                    onChange={(event) => {
                      const next = [...mappings];
                      next[index].placeholder_name = event.target.value;
                      setMappings(next);
                    }}
                    placeholder="PLACEHOLDER"
                  />
                  <input
                    value={row.expression}
                    onChange={(event) => {
                      const next = [...mappings];
                      next[index].expression = event.target.value;
                      setMappings(next);
                    }}
                    placeholder="column('field')"
                  />
                  <button
                    className="ghost"
                    onClick={() => setMappings(mappings.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="ghost"
                onClick={() => setMappings([...mappings, { placeholder_name: "", expression: "" }])}
              >
                + Add mapping
              </button>
            </div>
            <div className="mapping-summary">
              {mappingCount} mappings configured
            </div>
            <button className="primary" onClick={handleSaveMappings} disabled={!jobId}>
              Save mappings
            </button>
          </section>
        )}

        {activeStep === 4 && (
          <section className="panel">
            <h3>Upload or select logo</h3>
            <label className="file">
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file, "LOGO", setLogoAssetId);
                  }
                }}
              />
              <span>{logoAssetId ? "Logo uploaded" : "Choose logo file"}</span>
            </label>
            <button className="primary" onClick={() => setActiveStep(5)}>
              Continue
            </button>
          </section>
        )}

        {activeStep === 5 && (
          <section className="panel">
            <h3>Append PDFs</h3>
            <label className="file">
              <input
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file, "APPEND_PDF", (id) =>
                      setAppendAssetIds((prev) => [...prev, id])
                    );
                  }
                }}
              />
              <span>Add append PDF</span>
            </label>
            <ul className="pill-list">
              {appendAssetIds.map((id, index) => (
                <li key={id}>
                  PDF {index + 1}
                  <button
                    className="ghost"
                    onClick={() => setAppendAssetIds(appendAssetIds.filter((value) => value !== id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button className="primary" onClick={() => setActiveStep(6)}>
              Continue
            </button>
          </section>
        )}

        {activeStep === 6 && (
          <section className="panel">
            <h3>Index configuration</h3>
            <div className="grid-2">
              <label>
                Name expression
                <input
                  value={tleInputs.name}
                  onChange={(event) => setTleInputs({ ...tleInputs, name: event.target.value })}
                />
              </label>
              <label>
                Address 1 expression
                <input
                  value={tleInputs.addr1}
                  onChange={(event) => setTleInputs({ ...tleInputs, addr1: event.target.value })}
                />
              </label>
              <label>
                Address 2 expression
                <input
                  value={tleInputs.addr2}
                  onChange={(event) => setTleInputs({ ...tleInputs, addr2: event.target.value })}
                />
              </label>
              <label>
                Address 3 expression
                <input
                  value={tleInputs.addr3}
                  onChange={(event) => setTleInputs({ ...tleInputs, addr3: event.target.value })}
                />
              </label>
              <label>
                Return Addr1 expression
                <input
                  value={tleInputs.return1}
                  onChange={(event) => setTleInputs({ ...tleInputs, return1: event.target.value })}
                />
              </label>
              <label>
                Return Addr2 expression
                <input
                  value={tleInputs.return2}
                  onChange={(event) => setTleInputs({ ...tleInputs, return2: event.target.value })}
                />
              </label>
              <label>
                Return Addr3 expression
                <input
                  value={tleInputs.return3}
                  onChange={(event) => setTleInputs({ ...tleInputs, return3: event.target.value })}
                />
              </label>
            </div>
            <button className="primary" onClick={handleSaveTle} disabled={busy === "tle"}>
              Save TLE config
            </button>
          </section>
        )}

        {activeStep === 7 && (
          <section className="panel">
            <h3>Validate & preview</h3>
            <button className="primary" onClick={handleValidate} disabled={!jobId}>
              Run validation
            </button>
            {validation && (
              <div className="validation">
                <div>
                  <strong>Errors</strong>
                  <ul>
                    {validation.errors.length === 0 && <li>None</li>}
                    {validation.errors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Warnings</strong>
                  <ul>
                    {validation.warnings.length === 0 && <li>None</li>}
                    {validation.warnings.map((warn) => (
                      <li key={warn}>{warn}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <button className="primary" onClick={() => setActiveStep(8)}>
              Continue
            </button>
          </section>
        )}

        {activeStep === 8 && (
          <section className="panel">
            <h3>Generate outputs</h3>
            <button className="primary" onClick={handleGenerate} disabled={!canGenerate || !jobId}>
              {canGenerate ? "Generate run" : "Fix validation errors first"}
            </button>
            {runStatus && (
              <div className="run-status">
                <p>Status: {runStatus.status}</p>
                <p>Progress: {runStatus.progress ?? 0}%</p>
                {runStatus.error && <p className="alert error">{runStatus.error}</p>}
              </div>
            )}
            {outputLinks && (
              <div className="download-grid">
                {outputLinks.afp_url && (
                  <a className="download" href={outputLinks.afp_url} target="_blank" rel="noreferrer">
                    Download AFP
                  </a>
                )}
                {outputLinks.tle_url && (
                  <a className="download" href={outputLinks.tle_url} target="_blank" rel="noreferrer">
                    Download TLE JSON
                  </a>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {showReturnModal && (
        <div className="modal-backdrop" onClick={() => setShowReturnModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Return Address</h3>
            <label>
              Return Addr1
              <input
                value={returnAddress.addr1}
                onChange={(event) =>
                  setReturnAddress({ ...returnAddress, addr1: event.target.value })
                }
              />
            </label>
            <label>
              Return Addr2
              <input
                value={returnAddress.addr2}
                onChange={(event) =>
                  setReturnAddress({ ...returnAddress, addr2: event.target.value })
                }
              />
            </label>
            <label>
              Return Addr3
              <input
                value={returnAddress.addr3}
                onChange={(event) =>
                  setReturnAddress({ ...returnAddress, addr3: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowReturnModal(false)}>
                Cancel
              </button>
              <button className="primary" onClick={handleSaveReturnAddress} disabled={busy === "return"}>
                Save return address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
