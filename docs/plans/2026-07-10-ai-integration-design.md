# AI Integration — Design Document

**Date:** 2026-07-10
**Status:** Draft (pending approval)
**Scope:** `apps/api` (new AI router + provider adapter), `apps/web` (AI settings, feature UI), later `apps/worker` (visual QA rendering) and a new MCP server (Phase 4)

---

## Goal

Introduce AI assistance across four areas of AdhocPrintStudio, on one shared,
provider-agnostic foundation. **Users choose which model to use** — the app is
not hardcoded to a single AI vendor.

1. Auto-mapping + data preflight
2. Letter drafting copilot
3. Run diagnosis & visual QA
4. Operator agent (MCP over the existing API)

---

## Guiding principles

- **User-selectable model.** Provider + model are runtime settings, not code.
- **AI suggests, user confirms.** No AI output touches job config or print
  output without explicit confirmation. This system puts mail in envelopes.
- **Graceful degradation.** With no AI provider configured, all AI UI hides
  and the core build → map → validate → run workflow is unaffected.
- **Deterministic first.** Where plain code can check something (empty fields,
  missing address lines), code does it; the LLM handles only fuzzy judgment.

---

## Phase 0 — AI foundation

### Provider adapter (`apps/api/app/ai_providers.py`)

A small interface with two implementations:

```
complete(messages, model, *, json_mode=False, images=None, stream=False) -> str | dict | AsyncIterator[str]
```

| Provider | Covers | Auth |
|---|---|---|
| `anthropic` | Claude models | `ANTHROPIC_API_KEY` env |
| `openai_compatible` | OpenAI, Ollama, vLLM, LM Studio, any `/v1/chat/completions` endpoint | `OPENAI_API_KEY` + `OPENAI_BASE_URL` env |

Built on `httpx` (new dependency — the only one). No vendor SDKs, keeping the
adapter small and the vendor surface swappable.

### Model selection

- New `ai_settings` table (single row): `provider`, `model`,
  `feature_overrides` (JSONB, empty for now — reserved for per-feature model
  choice later).
- `GET /ai/models` — curated model list per configured provider; for
  OpenAI-compatible endpoints, also queries the endpoint's `/v1/models`.
- `GET/PUT /ai/settings` — read/update the selection.
- Web: **AI Settings modal** from the Topbar — provider + model dropdown,
  connection test button. API keys are never sent to or stored in the browser.

### Error handling

- Provider unreachable / rate-limited / timeout → HTTP 503 from `/ai/*` with a
  short user-safe message; web shows a toast with retry. Existing
  `sanitize_error_message` path applies.
- All `/ai/*` endpoints rate-limited via the existing slowapi limiter.

---

## Phase 1 — Auto-mapping + data preflight

### Auto-map

- `POST /ai/automap` — request: placeholder names, column headers, ~5 sample
  rows. Response: `{mapping: {placeholder: column}, tle: {name, addr1..3},
  confidence: {placeholder: high|low}}` (json_mode).
- Web: "✨ Auto-map" button in `DataPanel`. Proposed matches pre-fill the
  existing mapping dropdowns; low-confidence rows are visually flagged.
  User reviews and confirms — the button never silently applies.

### Preflight

- `POST /ai/preflight` — deterministic checks run first in Python (missing
  values in mapped columns, empty TLE address fields, field-length overflow);
  a sample of suspect rows goes to the LLM for fuzzy issues (malformed
  addresses, casing anomalies, test data). Response: list of
  `{row, field, severity, message}`.
- Web: preflight report panel shown before "Run" — warnings don't block,
  errors link to the offending rows.

---

## Phase 2 — Drafting copilot

- `POST /ai/draft` (SSE streaming) — actions: `generate`, `rewrite_tone`,
  `shorten`, `expand`. Context sent: current letter HTML, available
  placeholders, mapped data columns. Returns HTML using the same tag subset
  the Word import produces.
- Web: "AI" tab in the builder sidebar. Streamed output previews in the panel;
  "Insert" applies it to the TipTap editor **through the existing DOMPurify
  sanitize path** (same as Word import).

---

## Phase 3 — Run diagnosis & visual QA

### Diagnosis

- `POST /ai/diagnose` — input: `JobRun.error`, job config summary (template
  name, mapping, TLE config). Output: plain-language explanation + suggested
  fix. Web: "Diagnose" button on failed runs.
- Validation explainer: same endpoint reused for `/jobs/{id}/validate`
  failures.

### Visual QA

- Render N sample merged letters to PNG (reuse the worker's existing
  PDF/preview pipeline), send to the selected model with vision → findings:
  text overflow, truncated address block, block/logo collision.
- Only offered when the selected model supports vision (capability flag in
  the curated model list).

---

## Phase 4 — Operator agent (MCP)

- New MCP server (thin process, e.g. `apps/mcp/`) exposing the existing REST
  API as tools: `list_templates`, `create_job`, `set_mappings`,
  `set_tle_config`, `upload_data`, `validate_job`, `start_run`,
  `get_run_status`, `diagnose_run`.
- Tools are wrappers over HTTP calls to the API — no business logic in the
  MCP layer. Destructive/costly actions (`start_run`) are marked as requiring
  confirmation.
- Later: an in-app chat panel reuses the same tool schema via the provider's
  native tool-use API, so the operator agent works both from external agents
  (Claude Desktop/Code) and inside the product.

---

## Testing

- **Unit:** adapter tested against mocked `httpx` responses (both providers);
  golden tests for automap/preflight prompt construction; deterministic
  preflight checks tested exhaustively in plain pytest.
- **Integration:** a stub OpenAI-compatible server fixture so end-to-end flows
  run without real keys.
- **CI:** zero live AI calls.

## Dependencies

- `apps/api`: **httpx** (new — no outbound HTTP client exists in the repo).
- `apps/web`: none new.

## Rollout order

Phase 0 → 1 ship together (foundation + first visible win). Phase 2 next
(most visible feature). Phase 3 and 4 independent after that.
