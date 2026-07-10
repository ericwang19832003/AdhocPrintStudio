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
