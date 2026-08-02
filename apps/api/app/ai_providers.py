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

from app import ai_keys
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
    "openai_compatible": [],  # intentionally empty — the UI shows a free-text model input
}


def available_providers() -> list[str]:
    providers: list[str] = []
    if ai_keys.resolve("ANTHROPIC_API_KEY"):
        providers.append("anthropic")
    if ai_keys.resolve("OPENAI_BASE_URL") or ai_keys.resolve("OPENAI_API_KEY"):
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
    api_key = ai_keys.resolve("ANTHROPIC_API_KEY")
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
        try:
            response = await client.post(
                "/v1/messages",
                json=payload,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
            )
        except httpx.HTTPError as exc:
            raise AIProviderError("Could not reach the AI provider.") from exc
    if response.status_code != 200:
        raise AIProviderError(f"AI provider returned status {response.status_code}.")
    try:
        blocks = response.json().get("content", [])
        return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    except (ValueError, KeyError, AttributeError, TypeError) as exc:
        raise AIProviderError("AI provider returned an unexpected response.") from exc


async def _call_openai_compatible(
    model: str, messages: list[dict[str, str]], system: str | None,
    transport: httpx.BaseTransport | None,
) -> str:
    base_url = ai_keys.resolve("OPENAI_BASE_URL") or "https://api.openai.com"
    headers = {}
    api_key = ai_keys.resolve("OPENAI_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    full_messages = messages
    if system:
        full_messages = [{"role": "system", "content": system}, *messages]
    async with httpx.AsyncClient(
        base_url=base_url, transport=transport, timeout=REQUEST_TIMEOUT
    ) as client:
        try:
            response = await client.post(
                "/v1/chat/completions",
                json={"model": model, "messages": full_messages},
                headers=headers,
            )
        except httpx.HTTPError as exc:
            raise AIProviderError("Could not reach the AI provider.") from exc
    if response.status_code != 200:
        raise AIProviderError(f"AI provider returned status {response.status_code}.")
    try:
        choices = response.json().get("choices", [])
    except ValueError as exc:
        raise AIProviderError("AI provider returned an unexpected response.") from exc
    if not choices:
        raise AIProviderError("AI provider returned no choices.")
    try:
        return choices[0]["message"]["content"] or ""
    except (KeyError, TypeError, IndexError) as exc:
        raise AIProviderError("AI provider returned an unexpected response.") from exc


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


async def test_credentials(
    provider: str,
    api_key: str | None,
    base_url: str | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    """Verify credentials against the provider's model-list endpoint.

    Raises AIProviderError with a user-facing message when the key is
    rejected or the endpoint is unreachable; returns None on success.
    api_key may be None for keyless OpenAI-compatible local endpoints —
    no Authorization header is sent then (some local servers reject one).
    """
    if provider == "anthropic":
        if not api_key:
            raise AIProviderError("An API key is required for Anthropic.")
        url, headers = (
            f"{ANTHROPIC_BASE_URL}/v1/models",
            {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
        )
    elif provider == "openai_compatible":
        root = (base_url or "https://api.openai.com").rstrip("/")
        url = f"{root}/v1/models"
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    else:
        raise AIProviderError(f"Unknown provider '{provider}'.")

    async with httpx.AsyncClient(transport=transport, timeout=REQUEST_TIMEOUT) as client:
        try:
            response = await client.get(url, headers=headers)
        except httpx.HTTPError as exc:
            raise AIProviderError(
                "Could not reach the provider — check the URL and your network."
            ) from exc
    if response.status_code in (401, 403):
        raise AIProviderError("The provider rejected this API key.")
    if response.status_code != 200:
        raise AIProviderError(f"Provider returned status {response.status_code}.")
