# AdhocPrintStudio

Monorepo scaffold for web (Next.js), API (FastAPI), and a background worker.

## Mac setup

1) Install base tooling:
```
brew install git make jq awscli python@3.11 node
brew install libpq
brew link --force libpq
```

2) If `python@3.11` fails to install, install Xcode CLT:
```
xcode-select --install
```

## Environment files

Each app reads `.env.local` if present and falls back to `.env`.
Copy the example files and customize locally (do not commit secrets):
```
cp apps/api/.env.example apps/api/.env.local
cp apps/worker/.env.example apps/worker/.env.local
cp apps/web/.env.example apps/web/.env.local
```

## Run apps

- API:
```
make dev-api
```

- Worker:
```
make dev-worker
```

- Web:
```
make dev-web
```

## AI features

Optional, model-assisted helpers in the letter builder:

- Auto-map: suggests placeholder-to-column mappings for uploaded spreadsheets (AI button in the Data panel).
- Preflight: pre-run data checks before Generate. Deterministic checks (empty required mailing fields, blank mapped columns, ALL-CAPS names) always run — even with no AI configured. AI adds fuzzy checks (malformed addresses, test records, swapped fields).
- Provider and model are user-selectable in the AI settings modal (topbar "AI" button) and persist in the browser.

Enable by setting one or both providers in `apps/api/.env.local`, restarting the API, then picking a provider and model in the AI settings modal:
```
ANTHROPIC_API_KEY=   # Anthropic provider
OPENAI_BASE_URL=     # OpenAI-compatible provider: OpenAI, or local Ollama/vLLM/LM Studio
OPENAI_API_KEY=      # key for the OpenAI-compatible endpoint (optional for local servers)
```

With no keys set, the AI settings modal reports that nothing is configured and no AI actions appear; the core workflow is unaffected.

Privacy: AI features send letter placeholders, column names, and a small sample of spreadsheet rows to the selected provider — up to 5 full rows for auto-mapping, and up to 20 rows of mapped/mailing columns for data checks. An OpenAI-compatible local endpoint (Ollama/vLLM/LM Studio) keeps everything on-network.

Behavior notes:

- The `/ai` POST endpoints are rate-limited to 20 requests/minute per IP.
- Preflight failures never block generation — it retries with deterministic-only checks, then generates without checks.
- Preflight covers the first 5,000 data rows.
- Issue row numbers are 1-based data rows, header excluded (Excel row = data row + 1).
- Only the topbar Generate runs preflight; the merge-preview and preview-modal Generate buttons do not.

Deployment: the API has no built-in request body-size limit. When exposing it beyond localhost, put it behind a reverse proxy with a body-size cap (e.g. nginx `client_max_body_size 10m;`).

## Utilities

- Format:
```
make fmt
```

- Tests:
```
make test
```

- API tests directly (bare `pytest` fails — no conftest path setup):
```
cd apps/api && . .venv/bin/activate && python -m pytest tests/ -v
```
