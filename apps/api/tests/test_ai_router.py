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
