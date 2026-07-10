"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Sparkles, AlertCircle } from "lucide-react";
import { env } from "@/lib/env";
import { loadAiSettings, saveAiSettings, type AiSettings } from "@/lib/aiSettings";

type AiModel = { id: string; label: string };
type AiProviderInfo = { provider: string; models: AiModel[] };

type AiSettingsModalProps = {
  onSaved: (settings: AiSettings) => void;
  onClose: () => void;
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic (Claude)",
  openai_compatible: "OpenAI-compatible endpoint",
};

export function AiSettingsModal({ onSaved, onClose }: AiSettingsModalProps) {
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [hasSaved] = useState(() => loadAiSettings() !== null);

  const fetchModels = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(`${env.apiBaseUrl}/ai/models`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const list: AiProviderInfo[] = Array.isArray(data?.providers) ? data.providers : [];
      setProviders(list);

      // Pre-populate from saved settings when still valid in the response.
      const saved = loadAiSettings();
      const savedProviderValid =
        saved !== null && list.some((p) => p.provider === saved.provider);
      const nextProvider = savedProviderValid
        ? saved.provider
        : list[0]?.provider ?? "";
      setProvider(nextProvider);

      if (saved && savedProviderValid) {
        const models = list.find((p) => p.provider === saved.provider)?.models ?? [];
        // Empty curated list = free-text model id (openai_compatible); keep as-is.
        const modelValid = models.length === 0 || models.some((m) => m.id === saved.model);
        setModel(modelValid ? saved.model : "");
      } else {
        setModel("");
      }
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  const selectedProvider = providers.find((p) => p.provider === provider);
  const models = selectedProvider?.models ?? [];
  const canSave = status === "ready" && provider !== "" && model.trim() !== "";

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
            AI Settings
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
            <p className="ai-modal-status">Loading available models…</p>
          )}

          {status === "error" && (
            <div className="modal-field">
              <p className="ai-modal-status">
                Could not load AI models from the server. Check that the API is
                running, then try again.
              </p>
              <div>
                <button type="button" className="btn-outline-sm" onClick={fetchModels}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {status === "ready" && providers.length === 0 && (
            <p className="ai-modal-status">
              No AI provider is configured on the server. Set ANTHROPIC_API_KEY or
              OPENAI_BASE_URL in apps/api/.env.local, then restart the API.
            </p>
          )}

          {status === "ready" && providers.length > 0 && (
            <>
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
                  }}
                >
                  {providers.map((p) => (
                    <option key={p.provider} value={p.provider}>
                      {PROVIDER_LABELS[p.provider] ?? p.provider}
                    </option>
                  ))}
                </select>
              </div>

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
                    placeholder="Model id, e.g. llama3.1:8b"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </div>
            </>
          )}

          {/* Privacy disclosure */}
          <div className="usps-hint">
            <AlertCircle size={13} className="usps-hint-icon" />
            <span>
              AI features send a sample of your letter placeholders, column names,
              and up to 20 rows of mapped recipient data to the selected provider.
              Using a local (OpenAI-compatible) endpoint keeps data on your network.
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
