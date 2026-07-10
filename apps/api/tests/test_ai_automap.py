# apps/api/tests/test_ai_automap.py
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import ai as ai_module
from app.main import app

CANNED = {
    "mapping": {"[FirstName]": {"column": "fname", "confidence": "high"}},
    "tle": {"mailing_name": "fname", "mailing_addr1": "addr1"},
}


@pytest.fixture(autouse=True)
def reset_limiter():
    ai_module.limiter.reset()
    yield


def install_mock(monkeypatch, reply: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": json.dumps(reply)}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))


def install_openai_mock(monkeypatch, reply: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"choices": [{"message": {"content": json.dumps(reply)}}]}
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


def test_automap_unconfigured_provider_returns_503(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    client = TestClient(app)
    response = client.post(
        "/ai/automap",
        json={
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "placeholders": ["[FirstName]"],
            "columns": ["fname"],
            "sample_rows": [],
        },
    )
    assert response.status_code == 503


def test_automap_unknown_model_returns_400(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    client = TestClient(app)
    response = client.post(
        "/ai/automap",
        json={
            "provider": "anthropic",
            "model": "not-a-real-model",
            "placeholders": ["[FirstName]"],
            "columns": ["fname"],
            "sample_rows": [],
        },
    )
    assert response.status_code == 400


def test_automap_openai_compatible_accepts_arbitrary_model(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_BASE_URL", "http://fake")
    install_openai_mock(monkeypatch, CANNED)
    client = TestClient(app)
    response = client.post(
        "/ai/automap",
        json={
            "provider": "openai_compatible",
            "model": "any-local-model",
            "placeholders": ["[FirstName]"],
            "columns": ["fname", "addr1"],
            "sample_rows": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["mapping"]["[FirstName]"]["column"] == "fname"
