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

## Utilities

- Format:
```
make fmt
```

- Tests:
```
make test
```
