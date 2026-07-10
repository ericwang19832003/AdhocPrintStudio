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


def test_automap_oversized_request_rejected(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(monkeypatch, CANNED)
    client = TestClient(app)
    base = {
        "provider": "anthropic",
        "model": "claude-sonnet-5",
        "placeholders": ["[FirstName]"],
        "columns": ["fname"],
        "sample_rows": [],
    }
    # 501 columns exceeds the 500-item cap.
    response = client.post(
        "/ai/automap", json={**base, "columns": [f"c{i}" for i in range(501)]}
    )
    assert response.status_code == 422
    # 6 sample rows exceeds the 5-row cap.
    response = client.post(
        "/ai/automap", json={**base, "sample_rows": [{"fname": "x"}] * 6}
    )
    assert response.status_code == 422
    # Oversized sample-row value (>500 chars) is rejected.
    response = client.post(
        "/ai/automap", json={**base, "sample_rows": [{"fname": "x" * 501}]}
    )
    assert response.status_code == 422
    # A row with 501 keys exceeds the per-row key-count cap.
    wide_row = {f"k{i}": "v" for i in range(501)}
    response = client.post("/ai/automap", json={**base, "sample_rows": [wide_row]})
    assert response.status_code == 422


def test_automap_projects_mapping_entries(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {
            "mapping": {
                "[FirstName]": {
                    "column": "fname",
                    "confidence": "banana",
                    "EXTRA": "smuggled",
                }
            },
            "tle": {},
        },
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
    # Only whitelisted fields survive; invalid confidence coerced to "low".
    assert body["mapping"]["[FirstName]"] == {"column": "fname", "confidence": "low"}


def test_automap_filters_invalid_tle_entries(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {
            "mapping": {},
            "tle": {"mailing_bogus": "fname", "mailing_addr1": "nope"},
        },
    )
    client = TestClient(app)
    body = client.post(
        "/ai/automap",
        json={
            "provider": "anthropic",
            "model": "claude-sonnet-5",
            "placeholders": [],
            "columns": ["fname"],
            "sample_rows": [],
        },
    ).json()
    assert body["tle"] == {}  # bogus key and non-existent column both filtered


def test_automap_rate_limited_after_20(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(monkeypatch, CANNED)
    client = TestClient(app)
    body = {
        "provider": "anthropic",
        "model": "claude-sonnet-5",
        "placeholders": ["[FirstName]"],
        "columns": ["fname", "addr1"],
        "sample_rows": [],
    }
    codes = [client.post("/ai/automap", json=body).status_code for _ in range(20)]
    assert codes == [200] * 20
    assert client.post("/ai/automap", json=body).status_code == 429


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
