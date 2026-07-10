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

pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend():
    return "asyncio"


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


async def test_complete_anthropic(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    result = await complete(
        provider="anthropic",
        model="claude-sonnet-5",
        messages=[{"role": "user", "content": "hi"}],
        transport=anthropic_transport("hello"),
    )
    assert result == "hello"


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
