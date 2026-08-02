# NOTE: no `from __future__ import annotations` here. slowapi's limit decorator
# wraps endpoints in a function whose __globals__ are slowapi's, so postponed
# (string) annotations like `AutomapRequest` cannot be resolved by FastAPI and
# the body param silently degrades to a query param (422s). All annotations in
# this module are runtime-valid on Python 3.11.
import json
import logging
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.ai_providers import (
    AIProviderError,
    available_providers,
    complete,
    curated_models,
)
from app.preflight import run_checks

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

limiter = Limiter(key_func=get_remote_address)

# Injection point for tests: a MockTransport here avoids live HTTP.
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


# Payload bounds: this endpoint feeds user input into a paid LLM call, so cap
# item counts and string lengths to put a ceiling on prompt size/cost.
BoundedName = Annotated[str, StringConstraints(max_length=200)]
BoundedValue = Annotated[str, StringConstraints(max_length=500)]


def _validate_row_width(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    # Per-row key count is otherwise unbounded; mirror the columns cap.
    for row in rows:
        if len(row) > 500:
            raise ValueError("row has too many keys (max 500).")
    return rows


class AutomapRequest(BaseModel):
    provider: str
    model: str
    placeholders: Annotated[list[BoundedName], Field(max_length=200)]
    columns: Annotated[list[BoundedName], Field(max_length=500)]
    sample_rows: Annotated[
        list[dict[BoundedName, BoundedValue]], Field(max_length=5)
    ] = []

    @field_validator("sample_rows")
    @classmethod
    def _cap_row_width(cls, rows: list[dict[str, str]]) -> list[dict[str, str]]:
        return _validate_row_width(rows)


def build_automap_prompt(req: AutomapRequest) -> str:
    lines = [
        f"Placeholders: {json.dumps(req.placeholders)}",
        f"Columns: {json.dumps(req.columns)}",
        f"Sample rows (up to 5): {json.dumps(req.sample_rows[:5])}",
    ]
    return "\n".join(lines)


@router.post("/automap")
@limiter.limit("20/minute")
async def automap(request: Request, payload: AutomapRequest) -> dict[str, Any]:
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
    placeholders = set(payload.placeholders)
    columns = set(payload.columns)
    # Project mapping entries onto a fixed output contract — never pass LLM
    # dict entries through verbatim.
    mapping: dict[str, dict[str, str]] = {}
    for ph, entry in (result.get("mapping") or {}).items():
        if (
            ph in placeholders
            and isinstance(entry, dict)
            and entry.get("column") in columns
        ):
            confidence = entry.get("confidence")
            mapping[ph] = {
                "column": entry["column"],
                "confidence": confidence if confidence in ("high", "low") else "low",
            }
    tle = {
        key: col
        for key, col in (result.get("tle") or {}).items()
        if key in TLE_KEYS and col in columns
    }
    return {"mapping": mapping, "tle": tle}


PREFLIGHT_SYSTEM = (
    "You review mail-merge recipient data before a print run. "
    "Flag ONLY genuine data problems: malformed or incomplete street addresses, "
    "obviously fake/test records, swapped fields. Do not flag stylistic issues. "
    'Respond with JSON only: {"issues": [{"row": <1-based int>, "field": "<col>", '
    '"severity": "warning", "message": "<short user-facing sentence>"}]}. '
    'Return {"issues": []} when the data looks fine.'
)

PREFLIGHT_AI_SAMPLE = 20
MAX_RESPONSE_ISSUES = 500


class PreflightRequest(BaseModel):
    provider: str | None = None
    model: str | None = None
    rows: Annotated[list[dict[BoundedName, BoundedValue]], Field(max_length=5000)]
    mapped_columns: Annotated[list[BoundedName], Field(max_length=500)] = []
    tle_columns: dict[str, BoundedName | None] = {}

    @field_validator("rows")
    @classmethod
    def _cap_row_width(cls, rows: list[dict[str, str]]) -> list[dict[str, str]]:
        return _validate_row_width(rows)

    @field_validator("tle_columns")
    @classmethod
    def _drop_unknown_tle_keys(
        cls, tle_columns: dict[str, str | None]
    ) -> dict[str, str | None]:
        return {k: v for k, v in tle_columns.items() if k in TLE_KEYS}


@router.post("/preflight")
@limiter.limit("20/minute")
async def preflight(request: Request, payload: PreflightRequest) -> dict[str, Any]:
    tle_columns = {k: v for k, v in payload.tle_columns.items() if v}
    issues = run_checks(
        rows=payload.rows,
        mapped_columns=payload.mapped_columns,
        tle_columns=tle_columns,
    )
    if payload.provider and payload.model:
        validate_selection(payload.provider, payload.model)
        # Data minimization: only mapped/TLE columns leave the server.
        relevant = sorted(set(payload.mapped_columns) | set(tle_columns.values()))
        sample = [
            {col: row.get(col, "") for col in relevant}
            for row in payload.rows[:PREFLIGHT_AI_SAMPLE]
        ]
        # Skip the paid LLM call when there is nothing to review (no relevant
        # columns, or no rows).
        if relevant and sample:
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
                # Project AI issues onto a fixed contract: severity forced to
                # "warning", rows outside 1..len(rows) dropped (bools are int
                # subclasses — reject those too), no extra keys.
                for issue in result.get("issues", []):
                    if (
                        isinstance(issue, dict)
                        and isinstance(issue.get("row"), int)
                        and not isinstance(issue.get("row"), bool)
                        and 1 <= issue["row"] <= max_row
                    ):
                        issues.append(
                            {
                                "row": issue["row"],
                                "field": str(issue.get("field", "")),
                                "message": str(issue.get("message", "")),
                                "severity": "warning",
                                "source": "ai",
                            }
                        )
    total = len(issues)
    truncated = total > MAX_RESPONSE_ISSUES
    return {
        "issues": issues[:MAX_RESPONSE_ISSUES],
        "truncated": truncated,
        "total_issues": total,
    }


# ---------------- API key management (settings UI) ----------------
# Keys entered in the UI are validated live against the provider, then stored
# in the app key store (data/ai_keys.json). Env vars always take precedence.

from app import ai_keys as _ai_keys  # noqa: E402
from app.ai_providers import test_credentials  # noqa: E402


def _keys_status() -> dict[str, Any]:
    providers = []
    for provider, env_name in _ai_keys.PROVIDER_ENV_KEYS.items():
        configured = _ai_keys.resolve(env_name) is not None
        source = _ai_keys.source_of(env_name)
        entry: dict[str, Any] = {
            "provider": provider,
            "configured": configured,
            "source": source,
            "keyHint": _ai_keys.key_hint(env_name),
        }
        if provider == "openai_compatible":
            base_url = _ai_keys.resolve(_ai_keys.PROVIDER_BASE_URL_KEY)
            entry["baseUrl"] = base_url or ""
            # Local endpoints (Ollama/vLLM/LM Studio) are valid with no key
            if base_url and not configured:
                entry["configured"] = True
                entry["source"] = _ai_keys.source_of(_ai_keys.PROVIDER_BASE_URL_KEY)
        providers.append(entry)
    return {"providers": providers}


@router.get("/keys")
def get_keys_status() -> dict[str, Any]:
    """Configured-provider status for the settings UI. Never returns full keys."""
    return _keys_status()


class AiKeyRequest(BaseModel):
    provider: Annotated[str, StringConstraints(pattern="^(anthropic|openai_compatible)$")]
    # Optional for OpenAI-compatible: local endpoints (Ollama, vLLM, LM Studio)
    # are commonly keyless.
    api_key: Annotated[str, StringConstraints(min_length=8, max_length=300)] | None = None
    base_url: Annotated[str, StringConstraints(max_length=300)] | None = None


@router.post("/keys")
@limiter.limit("10/minute")
async def save_key(request: Request, payload: AiKeyRequest) -> dict[str, Any]:
    """Validate pasted credentials against the provider, then persist them."""
    if payload.provider == "anthropic" and not payload.api_key:
        raise HTTPException(status_code=400, detail="An API key is required for Anthropic.")
    if payload.provider == "openai_compatible" and not payload.api_key and not payload.base_url:
        raise HTTPException(
            status_code=400, detail="Enter an API key, an endpoint URL, or both."
        )
    try:
        await test_credentials(
            payload.provider, payload.api_key, payload.base_url, transport=_test_transport
        )
    except AIProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    values: dict[str, str] = {}
    if payload.api_key:
        values[_ai_keys.PROVIDER_ENV_KEYS[payload.provider]] = payload.api_key
    if payload.provider == "openai_compatible" and payload.base_url:
        values[_ai_keys.PROVIDER_BASE_URL_KEY] = payload.base_url.rstrip("/")
    _ai_keys.store(values)
    return _keys_status()


@router.delete("/keys/{provider}")
def delete_key(provider: str) -> dict[str, Any]:
    """Remove an app-stored key (environment-provided keys cannot be removed here)."""
    env_name = _ai_keys.PROVIDER_ENV_KEYS.get(provider)
    if env_name is None:
        raise HTTPException(status_code=404, detail="Unknown provider")
    names = [env_name]
    if provider == "openai_compatible":
        names.append(_ai_keys.PROVIDER_BASE_URL_KEY)
    _ai_keys.remove(names)
    return _keys_status()
