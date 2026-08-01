# AI Foundation + Auto-map/Preflight Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a provider-agnostic AI layer (user-selectable model) to the FastAPI backend, then ship the first two AI features: semantic placeholder auto-mapping and pre-run data preflight.

**Architecture:** A single `ai_providers.py` adapter (Anthropic API + any OpenAI-compatible endpoint, built on the already-installed `httpx`) behind a new `/ai` router. The web app stores the user's provider/model choice in `localStorage` and sends it with each request; the server validates the model against what its configured env keys allow. **Design amendment vs. the design doc:** no `ai_settings` DB table — the app has dual model files (`models.py` + `models_local.py`) and an alembic chain, so a DB setting would triple the surface for zero benefit; client-side persistence matches the existing autosave pattern (`adhoc_letter_draft` in localStorage).

**Tech Stack:** FastAPI, httpx (already in requirements.txt — NO new dependencies), pytest + `httpx.MockTransport`, Next.js/React (existing DataPanel auto-match UI is reused).

**Repo facts the executor must know:**
- Routers live in `apps/api/app/<name>.py` as `router = APIRouter()`, registered in **both** `apps/api/app/main.py` and `apps/api/app/main_local.py`.
- `load_env()` in `app/env.py` loads `.env` / `.env.local`. AI env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`.
- Tests: `apps/api/tests/test_*.py`, run with `cd apps/api && . .venv/bin/activate && pytest tests/ -v`.
- Web calls the API via `` `${env.apiBaseUrl}/...` `` (`apps/web/src/lib/env.ts`).
- `BuilderClient.tsx:1608-1669` already computes heuristic `autoMatchSuggestions` (`{placeholder, column, confidence}`) with apply-one/apply-all handlers — the AI auto-map feeds MORE suggestions into this exact shape.
- Two files have pre-existing uncommitted edits (`apps/api/app/afp_document_generator.py`, `apps/web/app/components/TaglineLibrary.tsx`). **Never `git add -A`** — stage only files this plan touches.

---

## Task 1: Provider adapter — `ai_providers.py`

**Files:**
- Create: `apps/api/app/ai_providers.py`
- Test: `apps/api/tests/test_ai_providers.py`

**Step 1: Write the failing tests**

```python
# apps/api/tests/test_ai_providers.py
from __future__ import annotations

import json

import httpx
import pytest

from app.ai_providers import (
    AIProviderError,
    available_providers,
    complete,
    curated_models,
)


def anthropic_transport(reply_text: str) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/messages"
        assert request.headers["x-api-key"] == "test-key"
        body = json.loads(request.content)
        assert body["model"] == "claude-sonnet-5"
        assert body["max_tokens"] > 0
        return httpx.Response(
            200,
            json={"content": [{"type": "text", "text": reply_text}]},
        )

    return httpx.MockTransport(handler)


def openai_transport(reply_text: str) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/chat/completions"
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": reply_text}}]},
        )

    return httpx.MockTransport(handler)


@pytest.mark.anyio
async def test_complete_anthropic(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    result = await complete(
        provider="anthropic",
        model="claude-sonnet-5",
        messages=[{"role": "user", "content": "hi"}],
        transport=anthropic_transport("hello"),
    )
    assert result == "hello"


@pytest.mark.anyio
async def test_complete_openai_compatible(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "http://fake")
    result = await complete(
        provider="openai_compatible",
        model="gpt-test",
        messages=[{"role": "user", "content": "hi"}],
        transport=openai_transport("hello"),
    )
    assert result == "hello"


@pytest.mark.anyio
async def test_complete_json_mode_strips_fences(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    result = await complete(
        provider="anthropic",
        model="claude-sonnet-5",
        messages=[{"role": "user", "content": "hi"}],
        json_mode=True,
        transport=anthropic_transport('```json\n{"a": 1}\n```'),
    )
    assert result == {"a": 1}


@pytest.mark.anyio
async def test_complete_provider_error(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"error": "rate limited"})

    with pytest.raises(AIProviderError):
        await complete(
            provider="anthropic",
            model="claude-sonnet-5",
            messages=[{"role": "user", "content": "hi"}],
            transport=httpx.MockTransport(handler),
        )


def test_available_providers(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    assert available_providers() == []
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    assert available_providers() == ["anthropic"]


def test_curated_models_shape():
    models = curated_models("anthropic")
    assert all({"id", "label"} <= set(m) for m in models)
```

Note: `pytest.mark.anyio` needs the `anyio` pytest plugin, which ships with FastAPI/Starlette already. Add this fixture at the top of the test file so it uses asyncio only:

```python
@pytest.fixture
def anyio_backend():
    return "asyncio"
```

and pass `anyio_backend` where needed, or simpler — mark the module: `pytestmark = pytest.mark.anyio` and define the fixture. Verify with a quick run; if the plugin is unavailable, fall back to `asyncio.get_event_loop().run_until_complete(...)` wrappers in sync tests.

**Step 2: Run tests to verify they fail**

Run: `cd apps/api && . .venv/bin/activate && pytest tests/test_ai_providers.py -v`
Expected: FAIL / ERROR with `ModuleNotFoundError: No module named 'app.ai_providers'`

**Step 3: Write the implementation**

```python
# apps/api/app/ai_providers.py
"""Provider-agnostic LLM adapter.

Two providers:
- "anthropic": the Anthropic Messages API (needs ANTHROPIC_API_KEY)
- "openai_compatible": any /v1/chat/completions endpoint — OpenAI, Ollama,
  vLLM, LM Studio (needs OPENAI_BASE_URL; OPENAI_API_KEY optional for local
  servers)

No vendor SDKs; plain httpx. `transport` is injectable for tests.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

ANTHROPIC_BASE_URL = "https://api.anthropic.com"
DEFAULT_MAX_TOKENS = 4096
REQUEST_TIMEOUT = 60.0


class AIProviderError(Exception):
    """Raised when the AI provider call fails. Message is user-safe."""


CURATED_MODELS: dict[str, list[dict[str, str]]] = {
    "anthropic": [
        {"id": "claude-sonnet-5", "label": "Claude Sonnet 5 (recommended)"},
        {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5 (fast)"},
        {"id": "claude-opus-4-8", "label": "Claude Opus 4.8 (most capable)"},
    ],
    "openai_compatible": [],  # populated live from the endpoint's /v1/models
}


def available_providers() -> list[str]:
    providers: list[str] = []
    if os.getenv("ANTHROPIC_API_KEY"):
        providers.append("anthropic")
    if os.getenv("OPENAI_BASE_URL") or os.getenv("OPENAI_API_KEY"):
        providers.append("openai_compatible")
    return providers


def curated_models(provider: str) -> list[dict[str, str]]:
    return CURATED_MODELS.get(provider, [])


def _strip_code_fences(text: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()


async def _call_anthropic(
    model: str, messages: list[dict[str, str]], system: str | None,
    transport: httpx.BaseTransport | None,
) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise AIProviderError("Anthropic API key is not configured.")
    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": DEFAULT_MAX_TOKENS,
        "messages": messages,
    }
    if system:
        payload["system"] = system
    async with httpx.AsyncClient(
        base_url=ANTHROPIC_BASE_URL, transport=transport, timeout=REQUEST_TIMEOUT
    ) as client:
        response = await client.post(
            "/v1/messages",
            json=payload,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )
    if response.status_code != 200:
        raise AIProviderError(f"AI provider returned status {response.status_code}.")
    blocks = response.json().get("content", [])
    return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")


async def _call_openai_compatible(
    model: str, messages: list[dict[str, str]], system: str | None,
    transport: httpx.BaseTransport | None,
) -> str:
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com")
    headers = {}
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    full_messages = messages
    if system:
        full_messages = [{"role": "system", "content": system}, *messages]
    async with httpx.AsyncClient(
        base_url=base_url, transport=transport, timeout=REQUEST_TIMEOUT
    ) as client:
        response = await client.post(
            "/v1/chat/completions",
            json={"model": model, "messages": full_messages},
            headers=headers,
        )
    if response.status_code != 200:
        raise AIProviderError(f"AI provider returned status {response.status_code}.")
    choices = response.json().get("choices", [])
    if not choices:
        raise AIProviderError("AI provider returned no choices.")
    return choices[0]["message"]["content"] or ""


async def complete(
    *,
    provider: str,
    model: str,
    messages: list[dict[str, str]],
    system: str | None = None,
    json_mode: bool = False,
    transport: httpx.BaseTransport | None = None,
) -> str | dict | list:
    if provider == "anthropic":
        text = await _call_anthropic(model, messages, system, transport)
    elif provider == "openai_compatible":
        text = await _call_openai_compatible(model, messages, system, transport)
    else:
        raise AIProviderError(f"Unknown AI provider '{provider}'.")
    if not json_mode:
        return text
    try:
        return json.loads(_strip_code_fences(text))
    except json.JSONDecodeError as exc:
        raise AIProviderError("AI returned malformed JSON.") from exc
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_ai_providers.py -v`
Expected: all PASS

**Step 5: Commit**

```bash
git add apps/api/app/ai_providers.py apps/api/tests/test_ai_providers.py
git commit -m "feat(api): provider-agnostic AI adapter (anthropic + openai-compatible)"
```

---

## Task 2: `/ai` router — models listing + request plumbing

**Files:**
- Create: `apps/api/app/ai.py`
- Modify: `apps/api/app/main.py` (import + `app.include_router(ai_router)` next to the existing routers)
- Modify: `apps/api/app/main_local.py` (same registration — find where `print_output_router` is included and mirror it)
- Test: `apps/api/tests/test_ai_router.py`

**Step 1: Write the failing tests**

```python
# apps/api/tests/test_ai_router.py
from fastapi.testclient import TestClient

from app.main import app


def test_ai_models_no_providers(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    client = TestClient(app)
    response = client.get("/ai/models")
    assert response.status_code == 200
    assert response.json() == {"providers": []}


def test_ai_models_with_anthropic(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    client = TestClient(app)
    data = client.get("/ai/models").json()
    assert len(data["providers"]) == 1
    provider = data["providers"][0]
    assert provider["provider"] == "anthropic"
    assert any(m["id"] == "claude-sonnet-5" for m in provider["models"])
```

**Step 2: Run to verify failure** — `pytest tests/test_ai_router.py -v` → 404s / import error.

**Step 3: Implementation**

```python
# apps/api/app/ai.py
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.ai_providers import (
    AIProviderError,
    available_providers,
    complete,
    curated_models,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/models")
def list_models() -> dict[str, Any]:
    """Providers usable with the server's configured env keys, with model lists."""
    providers = []
    for provider in available_providers():
        providers.append({"provider": provider, "models": curated_models(provider)})
    return {"providers": providers}


def validate_selection(provider: str, model: str) -> None:
    if provider not in available_providers():
        raise HTTPException(
            status_code=503,
            detail="AI is not configured on the server for this provider.",
        )
    known = [m["id"] for m in curated_models(provider)]
    # openai_compatible has no curated list — accept any model id there.
    if known and model not in known:
        raise HTTPException(status_code=400, detail="Unknown model for provider.")


async def run_completion(**kwargs: Any) -> str | dict | list:
    """complete() with provider errors mapped to HTTP 503."""
    try:
        return await complete(**kwargs)
    except AIProviderError as exc:
        logger.warning("AI provider error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
```

Registration in `main.py` (mirror existing style):

```python
from app.ai import router as ai_router
...
app.include_router(ai_router)
```

Same two lines in `main_local.py` where the other routers are included (the ai module has no DB dependency, so no monkey-patching concerns).

**Step 4: Run** `pytest tests/test_ai_router.py tests/test_health.py -v` → PASS (test_health confirms main.py still imports).

**Step 5: Commit**

```bash
git add apps/api/app/ai.py apps/api/app/main.py apps/api/app/main_local.py apps/api/tests/test_ai_router.py
git commit -m "feat(api): /ai router with model listing and selection validation"
```

---

## Task 3: Auto-map endpoint — `POST /ai/automap`

**Files:**
- Modify: `apps/api/app/ai.py`
- Test: `apps/api/tests/test_ai_automap.py`

**Step 1: Failing tests**

```python
# apps/api/tests/test_ai_automap.py
import json

import httpx
from fastapi.testclient import TestClient

from app import ai as ai_module
from app.main import app

CANNED = {
    "mapping": {"[FirstName]": {"column": "fname", "confidence": "high"}},
    "tle": {"mailing_name": "fname", "mailing_addr1": "addr1"},
}


def install_mock(monkeypatch, reply: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": json.dumps(reply)}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))


def test_automap(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(monkeypatch, CANNED)
    client = TestClient(app)
    response = client.post(
        "/ai/automap",
        json={
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "placeholders": ["[FirstName]"],
            "columns": ["fname", "addr1"],
            "sample_rows": [{"fname": "Ann", "addr1": "1 Main St"}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mapping"]["[FirstName]"]["column"] == "fname"
    assert body["tle"]["mailing_name"] == "fname"


def test_automap_rejects_hallucinated_column(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {"mapping": {"[FirstName]": {"column": "NOT_A_COLUMN", "confidence": "high"}},
         "tle": {}},
    )
    client = TestClient(app)
    body = client.post(
        "/ai/automap",
        json={
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "placeholders": ["[FirstName]"],
            "columns": ["fname"],
            "sample_rows": [],
        },
    ).json()
    assert body["mapping"] == {}  # hallucinated column filtered out
```

The `_test_transport` module attribute is the injection point: `ai.py` defines `_test_transport: httpx.BaseTransport | None = None` and passes it to `run_completion(transport=_test_transport, ...)`. In production it stays `None` (real HTTP).

**Step 2: Run** → 404 FAIL.

**Step 3: Implementation** — add to `apps/api/app/ai.py`:

```python
from pydantic import BaseModel
import httpx

_test_transport: httpx.BaseTransport | None = None

TLE_KEYS = ["mailing_name", "mailing_addr1", "mailing_addr2", "mailing_addr3"]

AUTOMAP_SYSTEM = (
    "You map mail-merge placeholders to spreadsheet columns for a print shop. "
    "Respond with JSON only, no prose: "
    '{"mapping": {"<placeholder>": {"column": "<col>", "confidence": "high|low"}}, '
    '"tle": {"mailing_name": "<col>", "mailing_addr1": "<col>", '
    '"mailing_addr2": "<col or null>", "mailing_addr3": "<col>"}}. '
    "Only use columns that exist. Omit placeholders you cannot map. "
    "tle fields are the recipient mailing address block; use null when no column fits."
)


class AutomapRequest(BaseModel):
    provider: str
    model: str
    placeholders: list[str]
    columns: list[str]
    sample_rows: list[dict[str, str]] = []


def build_automap_prompt(req: AutomapRequest) -> str:
    lines = [
        f"Placeholders: {json.dumps(req.placeholders)}",
        f"Columns: {json.dumps(req.columns)}",
        f"Sample rows (up to 5): {json.dumps(req.sample_rows[:5])}",
    ]
    return "\n".join(lines)


@router.post("/automap")
async def automap(payload: AutomapRequest) -> dict[str, Any]:
    validate_selection(payload.provider, payload.model)
    result = await run_completion(
        provider=payload.provider,
        model=payload.model,
        system=AUTOMAP_SYSTEM,
        messages=[{"role": "user", "content": build_automap_prompt(payload)}],
        json_mode=True,
        transport=_test_transport,
    )
    if not isinstance(result, dict):
        raise HTTPException(status_code=503, detail="AI returned an unexpected shape.")
    columns = set(payload.columns)
    mapping = {
        ph: entry
        for ph, entry in (result.get("mapping") or {}).items()
        if ph in payload.placeholders
        and isinstance(entry, dict)
        and entry.get("column") in columns
    }
    tle = {
        key: col
        for key, col in (result.get("tle") or {}).items()
        if key in TLE_KEYS and col in columns
    }
    return {"mapping": mapping, "tle": tle}
```

(Also add `import json` to the imports.) Guardrail note: the endpoint **filters** anything the model invents — placeholders not in the request, columns not in the file.

**Step 4: Run** `pytest tests/test_ai_automap.py -v` → PASS. Then full suite: `pytest tests/ -v`.

**Step 5: Commit**

```bash
git add apps/api/app/ai.py apps/api/tests/test_ai_automap.py
git commit -m "feat(api): POST /ai/automap — semantic placeholder + TLE mapping"
```

---

## Task 4: Deterministic preflight checks — `preflight.py`

Pure functions, no AI. This is most of preflight's value.

**Files:**
- Create: `apps/api/app/preflight.py`
- Test: `apps/api/tests/test_preflight.py`

**Step 1: Failing tests**

```python
# apps/api/tests/test_preflight.py
from app.preflight import run_checks


def test_missing_mapped_value_flagged():
    issues = run_checks(
        rows=[{"fname": "Ann"}, {"fname": ""}],
        mapped_columns=["fname"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(
        i["row"] == 2 and i["field"] == "fname" and i["severity"] == "warning"
        for i in issues
    )


def test_missing_tle_address_is_error():
    issues = run_checks(
        rows=[{"addr1": ""}],
        mapped_columns=[],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(i["severity"] == "error" and i["field"] == "addr1" for i in issues)


def test_all_caps_name_warning():
    issues = run_checks(
        rows=[{"name": "JOHN SMITH"}],
        mapped_columns=["name"],
        tle_columns={"mailing_name": "name"},
    )
    assert any("caps" in i["message"].lower() for i in issues)


def test_clean_data_no_issues():
    issues = run_checks(
        rows=[{"name": "Ann Lee", "addr1": "1 Main St"}],
        mapped_columns=["name"],
        tle_columns={"mailing_name": "name", "mailing_addr1": "addr1"},
    )
    assert issues == []
```

**Step 2: Run** → import error FAIL.

**Step 3: Implementation**

```python
# apps/api/app/preflight.py
"""Deterministic pre-run data checks. No AI involved.

Row numbers in issues are 1-based (matching what users see in a spreadsheet).
"""
from __future__ import annotations

from typing import Any

# TLE fields the inserter hardware requires to route mail.
REQUIRED_TLE = {"mailing_name", "mailing_addr1", "mailing_addr3"}

MAX_REPORTED_PER_CHECK = 50


def run_checks(
    *,
    rows: list[dict[str, str]],
    mapped_columns: list[str],
    tle_columns: dict[str, str],
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    required_cols = {
        tle_columns[k] for k in REQUIRED_TLE if tle_columns.get(k)
    }
    name_col = tle_columns.get("mailing_name")

    empty_counts: dict[str, int] = {}
    for index, row in enumerate(rows, start=1):
        for col in required_cols:
            if not (row.get(col) or "").strip():
                if empty_counts.get(col, 0) < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": col,
                            "severity": "error",
                            "message": f"Required mailing field '{col}' is empty.",
                        }
                    )
                empty_counts[col] = empty_counts.get(col, 0) + 1
        for col in mapped_columns:
            if col in required_cols:
                continue
            if not (row.get(col) or "").strip():
                if empty_counts.get(col, 0) < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": col,
                            "severity": "warning",
                            "message": f"Mapped column '{col}' is empty — the letter will have a blank.",
                        }
                    )
                empty_counts[col] = empty_counts.get(col, 0) + 1
        if name_col:
            value = (row.get(name_col) or "").strip()
            if len(value) > 3 and value.isupper():
                issues.append(
                    {
                        "row": index,
                        "field": name_col,
                        "severity": "warning",
                        "message": "Recipient name is in ALL CAPS.",
                    }
                )
    return issues
```

**Step 4: Run** `pytest tests/test_preflight.py -v` → PASS.

**Step 5: Commit**

```bash
git add apps/api/app/preflight.py apps/api/tests/test_preflight.py
git commit -m "feat(api): deterministic preflight data checks"
```

---

## Task 5: Preflight endpoint — `POST /ai/preflight`

Deterministic checks always run; the LLM fuzzy pass (malformed addresses, test data) runs only when a provider/model is supplied, and its findings are appended with `"source": "ai"`.

**Files:**
- Modify: `apps/api/app/ai.py`
- Test: `apps/api/tests/test_ai_preflight.py`

**Step 1: Failing tests**

```python
# apps/api/tests/test_ai_preflight.py
import json

import httpx
from fastapi.testclient import TestClient

from app import ai as ai_module
from app.main import app


def test_preflight_deterministic_only(monkeypatch):
    # No provider configured — deterministic checks still work.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json={
            "rows": [{"name": "", "addr1": "1 Main St"}],
            "mapped_columns": [],
            "tle_columns": {"mailing_name": "name", "mailing_addr1": "addr1"},
        },
    )
    assert response.status_code == 200
    issues = response.json()["issues"]
    assert any(i["severity"] == "error" for i in issues)
    assert all(i.get("source") != "ai" for i in issues)


def test_preflight_with_ai_pass(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    ai_reply = {
        "issues": [
            {"row": 1, "field": "addr1", "severity": "warning",
             "message": "Address looks incomplete (no street number)."}
        ]
    }

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": json.dumps(ai_reply)}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json={
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "rows": [{"name": "Ann Lee", "addr1": "Main St"}],
            "mapped_columns": [],
            "tle_columns": {"mailing_name": "name", "mailing_addr1": "addr1",
                            "mailing_addr3": "addr1"},
        },
    )
    issues = response.json()["issues"]
    assert any(i.get("source") == "ai" for i in issues)
```

**Step 2: Run** → 404 FAIL.

**Step 3: Implementation** — add to `ai.py`:

```python
from app.preflight import run_checks

PREFLIGHT_SYSTEM = (
    "You review mail-merge recipient data before a print run. "
    "Flag ONLY genuine data problems: malformed or incomplete street addresses, "
    "obviously fake/test records, swapped fields. Do not flag stylistic issues. "
    'Respond with JSON only: {"issues": [{"row": <1-based int>, "field": "<col>", '
    '"severity": "warning", "message": "<short user-facing sentence>"}]}. '
    "Return {\"issues\": []} when the data looks fine."
)

PREFLIGHT_AI_SAMPLE = 20


class PreflightRequest(BaseModel):
    provider: str | None = None
    model: str | None = None
    rows: list[dict[str, str]]
    mapped_columns: list[str] = []
    tle_columns: dict[str, str | None] = {}


@router.post("/preflight")
async def preflight(payload: PreflightRequest) -> dict[str, Any]:
    tle_columns = {k: v for k, v in payload.tle_columns.items() if v}
    issues = run_checks(
        rows=payload.rows,
        mapped_columns=payload.mapped_columns,
        tle_columns=tle_columns,
    )
    if payload.provider and payload.model:
        validate_selection(payload.provider, payload.model)
        relevant = sorted(set(payload.mapped_columns) | set(tle_columns.values()))
        sample = [
            {col: row.get(col, "") for col in relevant}
            for row in payload.rows[:PREFLIGHT_AI_SAMPLE]
        ]
        result = await run_completion(
            provider=payload.provider,
            model=payload.model,
            system=PREFLIGHT_SYSTEM,
            messages=[{"role": "user", "content": json.dumps(sample)}],
            json_mode=True,
            transport=_test_transport,
        )
        if isinstance(result, dict):
            max_row = len(payload.rows)
            for issue in result.get("issues", []):
                if (
                    isinstance(issue, dict)
                    and isinstance(issue.get("row"), int)
                    and 1 <= issue["row"] <= max_row
                ):
                    issues.append({**issue, "severity": "warning", "source": "ai"})
    return {"issues": issues}
```

Guardrails: AI issues are always downgraded to `warning` (only deterministic checks can block-level `error`), row numbers outside the file are dropped, and only the columns in use are sent to the provider (data minimization).

**Step 4: Run** `pytest tests/ -v` → all PASS.

**Step 5: Commit**

```bash
git add apps/api/app/ai.py apps/api/tests/test_ai_preflight.py
git commit -m "feat(api): POST /ai/preflight — deterministic + AI data checks"
```

---

## Task 6: Web — AI settings modal (provider/model picker)

**Files:**
- Create: `apps/web/app/components/AiSettingsModal.tsx`
- Create: `apps/web/src/lib/aiSettings.ts`
- Modify: `apps/web/app/components/Topbar.tsx` (add an "AI" ghost button next to "Manage library", prop `onAiSettings?: () => void`)
- Modify: `apps/web/app/BuilderClient.tsx` (state `aiSettingsOpen`, render modal, pass handler to Topbar)
- Modify: `apps/web/app/globals.css` (reuse existing modal classes — check how `ReturnAddressModal.tsx` is styled and mirror it; only add new classes if none fit)

**Step 1: `aiSettings.ts` — typed localStorage helper**

```typescript
// apps/web/src/lib/aiSettings.ts
export type AiSettings = {
  provider: string;
  model: string;
} | null;

const KEY = "adhoc_ai_settings";

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.provider === "string" && typeof parsed?.model === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (settings) localStorage.setItem(KEY, JSON.stringify(settings));
  else localStorage.removeItem(KEY);
}
```

**Step 2: Modal component** — follow the structure of `ReturnAddressModal.tsx` (read it first for the modal scaffold/classes). Behavior:
- On open, `fetch(`${env.apiBaseUrl}/ai/models`)`.
- Empty `providers` → message: "No AI provider is configured on the server. Set ANTHROPIC_API_KEY or OPENAI_BASE_URL in apps/api/.env.local."
- Otherwise: provider radio/select → model select (curated list; for `openai_compatible` with empty list, a free-text model id input).
- Save → `saveAiSettings(...)`, close, toast "AI model updated".
- "Disable AI" button → `saveAiSettings(null)`.

**Step 3: Wire into Topbar + BuilderClient.** Modal state lives in BuilderClient like the other modals (search for `ReturnAddressModal` usage as the pattern). AI feature buttons elsewhere render only when `loadAiSettings() !== null`.

**Step 4: Verify** — `cd apps/web && npm run lint && npm run build` → clean. Manual: `make dev-web` + `make dev-api`, open the modal, pick a model, confirm it persists across reload.

**Step 5: Commit**

```bash
git add apps/web/app/components/AiSettingsModal.tsx apps/web/src/lib/aiSettings.ts apps/web/app/components/Topbar.tsx apps/web/app/BuilderClient.tsx apps/web/app/globals.css
git commit -m "feat(web): AI settings modal — user-selectable provider and model"
```

---

## Task 7: Web — AI auto-map in DataPanel

Reuse the existing suggestion pipeline: `autoMatchSuggestions` (BuilderClient.tsx:1608) already renders suggestions with apply-one/apply-all and confidence levels. AI adds suggestions the string heuristics can't find, plus TLE mapping.

**Files:**
- Modify: `apps/web/app/BuilderClient.tsx`
- Modify: `apps/web/app/components/DataPanel.tsx`

**Step 1: BuilderClient — AI suggestion state + fetch**

Add state `aiSuggestions: Array<{placeholder: string; column: string; confidence: "high" | "low"}>` and `aiMapLoading: boolean`. Handler:

```typescript
const runAiAutomap = async () => {
  const settings = loadAiSettings();
  if (!settings) return;
  setAiMapLoading(true);
  try {
    const response = await fetch(`${env.apiBaseUrl}/ai/automap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: settings.provider,
        model: settings.model,
        placeholders: placeholders.filter((p) => !placeholderMap[p]),
        columns,
        sample_rows: rows.slice(0, 5),
      }),
    });
    if (!response.ok) throw new Error((await response.json()).detail ?? "AI request failed");
    const data = await response.json();
    setAiSuggestions(
      Object.entries(data.mapping).map(([placeholder, entry]: [string, any]) => ({
        placeholder,
        column: entry.column,
        confidence: entry.confidence === "high" ? "high" : "low",
      }))
    );
    // TLE suggestions merge into mailingMap ONLY for fields the user hasn't set
    setMailingMap((prev) => {
      const next = { ...prev };
      for (const [key, col] of Object.entries(data.tle ?? {})) {
        if (!next[key]) next[key] = col as string;
      }
      return next;
    });
    showToast("AI suggestions ready — review and apply.");
  } catch (err) {
    showToast(err instanceof Error ? err.message : "AI auto-map failed");
  } finally {
    setAiMapLoading(false);
  }
};
```

(Adapt `rows`/`showToast`/`setMailingMap` names to what BuilderClient actually uses — read the surrounding code; the toast system and mailingMap state exist from Phase 4.)

**Step 2: DataPanel — the button + suggestion rows.** Add props `onAiAutomap?: () => void`, `aiMapLoading?: boolean`, `aiSuggestions?: ...`, `onApplySuggestion: (placeholder, column) => void`. Render a "✨ Auto-map with AI" button in the placeholders section (only when the prop is provided — i.e., AI configured — and there are unmapped placeholders). AI suggestions render in the same visual style as the heuristic suggestions, each with an Apply button and low-confidence badge. **Applying is always an explicit user click** (apply-all allowed for high-confidence only).

**Step 3: Verify** — `npm run lint && npm run build` clean. Manual end-to-end with a real key in `apps/api/.env.local`: upload a CSV with columns like `fname, lname, ADDR_LINE_1`, letter with `[FirstName] [LastName]`, click auto-map, confirm sensible suggestions and that TLE fields fill.

**Step 4: Commit**

```bash
git add apps/web/app/BuilderClient.tsx apps/web/app/components/DataPanel.tsx apps/web/app/globals.css
git commit -m "feat(web): AI auto-map button feeding the suggestion pipeline"
```

---

## Task 8: Web — preflight report before Generate

**Files:**
- Create: `apps/web/app/components/PreflightModal.tsx`
- Modify: `apps/web/app/BuilderClient.tsx` (intercept the Generate flow)
- Modify: `apps/web/app/globals.css`

**Step 1:** Find the Generate handler in BuilderClient (Topbar's `onGenerate`). Insert a preflight step: when a spreadsheet is loaded, call `POST /ai/preflight` (include provider/model only if AI configured — deterministic checks work without) with `rows`, `mapped_columns` (values of `placeholderMap`), `tle_columns` (from `mailingMap`).

**Step 2:** `PreflightModal` — table of issues (row, field, severity icon, message; AI findings get a small "AI" badge), summary line ("2 errors, 5 warnings in 1,204 rows"). Buttons: **Cancel** and **Generate anyway** (label switches to just **Generate** when zero errors). Zero issues → skip the modal entirely and generate immediately.

**Step 3:** Failure of the preflight call itself must NOT block generation — log, toast "Preflight unavailable", proceed. (Core workflow never depends on AI infrastructure.)

**Step 4: Verify** — lint + build clean; manual run with a CSV containing an empty address row → modal shows the error, Cancel and Generate-anyway both behave.

**Step 5: Commit**

```bash
git add apps/web/app/components/PreflightModal.tsx apps/web/app/BuilderClient.tsx apps/web/app/globals.css
git commit -m "feat(web): preflight report before generate"
```

---

## Task 9: Docs + env examples

**Files:**
- Modify: `apps/api/.env.example` (add commented `ANTHROPIC_API_KEY=`, `OPENAI_API_KEY=`, `OPENAI_BASE_URL=`)
- Modify: `README.md` (short "AI features" section: which env vars enable AI, that users pick the model in the AI settings modal, that everything works without AI configured)

**Verify:** full API test suite green (`pytest tests/ -v`), web `npm run build` green.

**Commit:**

```bash
git add apps/api/.env.example README.md
git commit -m "docs: AI provider configuration"
```

---

## Definition of done

- `pytest tests/ -v` in `apps/api`: all green, zero live network calls.
- `npm run lint && npm run build` in `apps/web`: clean.
- With no AI env vars set: app behaves exactly as before, no AI buttons, preflight still runs deterministic checks.
- With `ANTHROPIC_API_KEY` set: model picker shows Claude models; auto-map returns filtered suggestions; preflight includes AI findings.
- No new dependencies in any package file. Pre-existing dirty files (`afp_document_generator.py`, `TaglineLibrary.tsx`) untouched and unstaged.
