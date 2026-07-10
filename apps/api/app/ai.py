# NOTE: no `from __future__ import annotations` here. slowapi's limit decorator
# wraps endpoints in a function whose __globals__ are slowapi's, so postponed
# (string) annotations like `AutomapRequest` cannot be resolved by FastAPI and
# the body param silently degrades to a query param (422s). All annotations in
# this module are runtime-valid on Python 3.11.
import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.ai_providers import (
    AIProviderError,
    available_providers,
    complete,
    curated_models,
)

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
