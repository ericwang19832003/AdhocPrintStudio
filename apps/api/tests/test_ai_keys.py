"""Tests for the app-managed AI key store and /ai/keys routes."""

import httpx
import pytest
from fastapi.testclient import TestClient

import app.ai as ai_module
from app import ai_keys
from app.main import app


@pytest.fixture()
def keys_file(tmp_path, monkeypatch):
    path = tmp_path / "ai_keys.json"
    monkeypatch.setenv("AI_KEYS_PATH", str(path))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    return path


def test_env_var_takes_precedence_over_store(keys_file, monkeypatch):
    ai_keys.store({"ANTHROPIC_API_KEY": "stored-key-1234"})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "env-key-9999")
    assert ai_keys.resolve("ANTHROPIC_API_KEY") == "env-key-9999"
    assert ai_keys.source_of("ANTHROPIC_API_KEY") == "env"


def test_store_resolve_and_hint(keys_file):
    assert ai_keys.resolve("ANTHROPIC_API_KEY") is None
    ai_keys.store({"ANTHROPIC_API_KEY": "sk-ant-test-abcd"})
    assert ai_keys.resolve("ANTHROPIC_API_KEY") == "sk-ant-test-abcd"
    assert ai_keys.source_of("ANTHROPIC_API_KEY") == "app"
    assert ai_keys.key_hint("ANTHROPIC_API_KEY") == "····abcd"


def test_post_key_validates_and_persists(keys_file, monkeypatch):
    monkeypatch.setattr(
        ai_module, "_test_transport",
        httpx.MockTransport(lambda request: httpx.Response(200, json={"data": []})),
    )
    client = TestClient(app)
    response = client.post(
        "/ai/keys", json={"provider": "anthropic", "api_key": "sk-ant-test-abcd"}
    )
    assert response.status_code == 200
    status = response.json()["providers"]
    anth = next(p for p in status if p["provider"] == "anthropic")
    assert anth["configured"] is True
    assert anth["source"] == "app"
    assert anth["keyHint"] == "····abcd"
    # full key never appears in the response
    assert "sk-ant-test-abcd" not in response.text
    # models endpoint now sees the provider
    assert any(
        p["provider"] == "anthropic" for p in client.get("/ai/models").json()["providers"]
    )


def test_post_key_rejected_by_provider_not_saved(keys_file, monkeypatch):
    monkeypatch.setattr(
        ai_module, "_test_transport",
        httpx.MockTransport(lambda request: httpx.Response(401)),
    )
    client = TestClient(app)
    response = client.post(
        "/ai/keys", json={"provider": "anthropic", "api_key": "sk-ant-bad-key1"}
    )
    assert response.status_code == 400
    assert "rejected" in response.json()["detail"]
    assert ai_keys.resolve("ANTHROPIC_API_KEY") is None


def test_delete_key(keys_file):
    ai_keys.store({"ANTHROPIC_API_KEY": "sk-ant-test-abcd"})
    client = TestClient(app)
    response = client.delete("/ai/keys/anthropic")
    assert response.status_code == 200
    assert ai_keys.resolve("ANTHROPIC_API_KEY") is None


def test_openai_compatible_stores_base_url(keys_file, monkeypatch):
    monkeypatch.setattr(
        ai_module, "_test_transport",
        httpx.MockTransport(lambda request: httpx.Response(200, json={"data": []})),
    )
    client = TestClient(app)
    response = client.post(
        "/ai/keys",
        json={
            "provider": "openai_compatible",
            "api_key": "sk-test-abcd",
            "base_url": "https://api.deepseek.com/",
        },
    )
    assert response.status_code == 200
    assert ai_keys.resolve("OPENAI_BASE_URL") == "https://api.deepseek.com"


def test_keyless_openai_compatible_endpoint(keys_file, monkeypatch):
    """Local endpoints (Ollama/vLLM) work with a base URL and no key."""
    monkeypatch.setattr(
        ai_module, "_test_transport",
        httpx.MockTransport(lambda request: httpx.Response(200, json={"data": []})),
    )
    client = TestClient(app)
    response = client.post(
        "/ai/keys",
        json={"provider": "openai_compatible", "base_url": "http://localhost:11434"},
    )
    assert response.status_code == 200
    status = next(
        p for p in response.json()["providers"] if p["provider"] == "openai_compatible"
    )
    assert status["configured"] is True
    assert status["keyHint"] is None
    assert ai_keys.resolve("OPENAI_BASE_URL") == "http://localhost:11434"


def test_anthropic_requires_key(keys_file):
    client = TestClient(app)
    response = client.post("/ai/keys", json={"provider": "anthropic"})
    assert response.status_code == 400
