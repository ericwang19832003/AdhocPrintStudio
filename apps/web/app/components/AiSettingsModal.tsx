"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, AlertCircle, Check, ExternalLink } from "lucide-react";
import { env } from "@/lib/env";
import { loadAiSettings, saveAiSettings, type AiSettings } from "@/lib/aiSettings";

type AiModel = { id: string; label: string };
type AiProviderInfo = { provider: string; models: AiModel[] };
type AiKeyStatus = {
  provider: string;
  configured: boolean;
  source: "env" | "app" | null;
  keyHint: string | null;
  baseUrl?: string;
};

type AiSettingsModalProps = {
  onSaved: (settings: AiSettings) => void;
  onClose: () => void;
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai_compatible: "OpenAI-compatible endpoint",
};

// "Get a key" deep links — the pattern popular agent apps (OpenClaw, Cline,
// JetBrains AI) use so users never hunt for the right console page.
const PROVIDER_KEY_HELP: Record<string, { url: string; label: string; placeholder: string }> = {
  anthropic: {
    url: "https://console.anthropic.com/settings/keys",
    label: "Get an Anthropic API key",
    placeholder: "sk-ant-…",
  },
  openai_compatible: {
    url: "https://platform.openai.com/api-keys",
    label: "Get an OpenAI API key (or use any compatible endpoint)",
    placeholder: "sk-…",
  },
};

export function AiSettingsModal({ onSaved, onClose }: AiSettingsModalProps) {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [keyStatuses, setKeyStatuses] = useState<AiKeyStatus[]>([]);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("");
  const [hasSaved] = useState(() => loadAiSettings() !== null);

  // Key entry state
  const [keyInput, setKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySavedFlash, setKeySavedFlash] = useState(false);

  const refresh = useCallback(async (preserveProvider?: string) => {
    setStatus("loading");
    try {
      const [modelsRes, keysRes] = await Promise.all([
        fetch(`${env.apiBaseUrl}/ai/models`),
        fetch(`${env.apiBaseUrl}/ai/keys`),
      ]);
      if (!modelsRes.ok || !keysRes.ok) throw new Error("HTTP error");
      const modelsData = await modelsRes.json();
      const keysData = await keysRes.json();
      const list: AiProviderInfo[] = Array.isArray(modelsData?.providers)
        ? modelsData.providers
        : [];
      setProviders(list);
      setKeyStatuses(Array.isArray(keysData?.providers) ? keysData.providers : []);

      const saved = loadAiSettings();
      const savedProviderValid =
        saved !== null && list.some((p) => p.provider === saved.provider);
      if (preserveProvider) {
        // Keep the provider the user just configured selected.
        setProvider(preserveProvider);
      } else if (savedProviderValid && saved) {
        setProvider(saved.provider);
        const models = list.find((p) => p.provider === saved.provider)?.models ?? [];
        const modelValid = models.length === 0 || models.some((m) => m.id === saved.model);
        setModel(modelValid ? saved.model : "");
      } else if (list.length > 0) {
        setProvider(list[0].provider);
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void refresh(undefined);
  }, [refresh]);

  const keyStatus = keyStatuses.find((k) => k.provider === provider);
  const isConnected = keyStatus?.configured ?? false;
  const selectedProvider = providers.find((p) => p.provider === provider);
  const models = selectedProvider?.models ?? [];
  const providerReady = providers.some((p) => p.provider === provider);
  const canSave = status === "ready" && providerReady && model.trim() !== "";
  const help = PROVIDER_KEY_HELP[provider];

  const canVerify =
    keyInput.trim() !== "" ||
    (provider === "openai_compatible" && baseUrlInput.trim() !== "");

  const verifyAndSaveKey = async () => {
    if (!canVerify || verifying) return;
    setVerifying(true);
    setKeyError(null);
    try {
      const response = await fetch(`${env.apiBaseUrl}/ai/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          api_key: keyInput.trim() || undefined,
          base_url:
            provider === "openai_compatible" && baseUrlInput.trim()
              ? baseUrlInput.trim()
              : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setKeyError(data?.detail ?? "Could not verify the key.");
        return;
      }
      setKeyInput("");
      setKeySavedFlash(true);
      setTimeout(() => setKeySavedFlash(false), 3000);
      await refresh(provider);
    } catch {
      setKeyError("Could not reach the server.");
    } finally {
      setVerifying(false);
    }
  };

  const removeKey = async () => {
    await fetch(`${env.apiBaseUrl}/ai/keys/${provider}`, { method: "DELETE" });
    await refresh(provider);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">
            <Sparkles
              size={16}
              style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }}
            />
            Settings
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {status === "loading" && (
            <p className="ai-modal-status">Loading AI configuration…</p>
          )}

          {status === "error" && (
            <div className="modal-field">
              <p className="ai-modal-status">
                Could not reach the server. Check that the app is running, then try
                again.
              </p>
              <div>
                <button type="button" className="btn-outline-sm" onClick={() => refresh()}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="settings-section-heading">
                <span>AI assistance</span>
                <p>Optional mapping and preflight suggestions.</p>
              </div>
              {/* Step 1 — provider + key */}
              <div className="modal-field">
                <label className="modal-field-label" htmlFor="ai-provider">
                  Provider
                </label>
                <select
                  id="ai-provider"
                  className="modal-field-input"
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    setModel("");
                    setKeyError(null);
                    setKeyInput("");
                  }}
                >
                  {Object.entries(PROVIDER_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {isConnected ? (
                <div className="modal-field">
                  <p className="ai-modal-status" style={{ color: "#15803d" }}>
                    <Check
                      size={13}
                      style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}
                    />
                    Connected{keyStatus?.keyHint ? ` (${keyStatus.keyHint})` : " — local endpoint, no key"}
                    {keyStatus?.keyHint
                      ? keyStatus?.source === "env"
                        ? " — using the server's environment key"
                        : " — key saved on this computer"
                      : ""}
                    {keyStatus?.baseUrl ? ` · ${keyStatus.baseUrl}` : ""}
                  </p>
                  {keyStatus?.source === "app" && (
                    <div>
                      <button type="button" className="btn-ghost-sm" onClick={removeKey}>
                        Remove key
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {provider === "openai_compatible" && (
                    <div className="modal-field">
                      <label className="modal-field-label" htmlFor="ai-base-url">
                        Endpoint URL
                      </label>
                      <input
                        id="ai-base-url"
                        type="text"
                        className="modal-field-input"
                        placeholder="https://api.openai.com · https://api.deepseek.com · http://localhost:11434"
                        value={baseUrlInput}
                        onChange={(e) => setBaseUrlInput(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="modal-field">
                    <label className="modal-field-label" htmlFor="ai-key">
                      API key
                      {provider === "openai_compatible" ? " (optional for local endpoints)" : ""}
                    </label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        id="ai-key"
                        type={showKey ? "text" : "password"}
                        className="modal-field-input"
                        style={{ flex: 1, minWidth: 0 }}
                        placeholder={help?.placeholder}
                        autoComplete="off"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && verifyAndSaveKey()}
                      />
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? "Hide" : "Show"}
                      </button>
                    </div>
                    {help && (
                      <a
                        href={help.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ai-modal-status"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 4,
                        }}
                      >
                        {help.label}
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <p className="ai-modal-status" style={{ marginTop: 4 }}>
                      Your key is verified with the provider, then stored only on the
                      computer running this app — never in the browser or the cloud.
                    </p>
                    {keyError && (
                      <p className="ai-modal-status" style={{ color: "#b91c1c" }}>
                        {keyError}
                      </p>
                    )}
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={!canVerify || verifying}
                        onClick={verifyAndSaveKey}
                      >
                        {verifying ? "Verifying…" : "Verify & save key"}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {keySavedFlash && (
                <p className="ai-modal-status" style={{ color: "#15803d" }}>
                  ✓ Key verified and saved.
                </p>
              )}

              {/* Step 2 — model */}
              {providerReady && (
                <div className="modal-field">
                  <label className="modal-field-label" htmlFor="ai-model">
                    Model
                  </label>
                  {models.length > 0 ? (
                    <select
                      id="ai-model"
                      className="modal-field-input"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    >
                      <option value="">Select a model…</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id="ai-model"
                      type="text"
                      className="modal-field-input"
                      placeholder="Model id, e.g. gpt-4o, deepseek-chat, llama3.1:8b"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* Privacy disclosure */}
          <div className="usps-hint">
            <AlertCircle size={13} className="usps-hint-icon" />
            <span>
              AI features send your letter placeholders, column names, and a small
              sample of spreadsheet rows (up to 5 full rows for auto-mapping; up to
              20 rows of mapped/mailing columns for data checks) to the selected
              provider. Using a local (OpenAI-compatible) endpoint keeps data on
              your network.
            </span>
          </div>

          {/* Actions */}
          <div className="modal-actions">
            <button type="button" className="btn-ghost-sm" onClick={onClose}>
              Cancel
            </button>
            {hasSaved && (
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => {
                  saveAiSettings(null);
                  onSaved(null);
                  onClose();
                }}
              >
                Disable AI
              </button>
            )}
            <button
              type="button"
              className="btn-accent"
              disabled={!canSave}
              onClick={() => {
                const settings = { provider, model: model.trim() };
                saveAiSettings(settings);
                onSaved(settings);
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
