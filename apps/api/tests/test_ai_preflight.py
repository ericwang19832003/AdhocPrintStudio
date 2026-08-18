# apps/api/tests/test_ai_preflight.py
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import ai as ai_module
from app.main import app


@pytest.fixture(autouse=True)
def reset_limiter():
    # Shared limiter in ai.py (used by /ai/automap and /ai/preflight) — reset
    # so counts never bleed across tests.
    ai_module.limiter.reset()
    yield


def install_mock(monkeypatch, reply: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": json.dumps(reply)}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))


def ai_payload(**overrides) -> dict:
    payload = {
        "provider": "anthropic",
        "model": "claude-sonnet-5",
        "rows": [{"name": "Ann Lee", "addr1": "Main St"}],
        "mapped_columns": [],
        "tle_columns": {"mailing_name": "name", "mailing_addr1": "addr1",
                        "mailing_addr3": "addr1"},
    }
    payload.update(overrides)
    return payload


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
    install_mock(monkeypatch, ai_reply)
    client = TestClient(app)
    response = client.post("/ai/preflight", json=ai_payload())
    issues = response.json()["issues"]
    assert any(i.get("source") == "ai" for i in issues)


def test_preflight_ai_severity_downgraded_to_warning(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {"issues": [{"row": 1, "field": "name", "severity": "error",
                     "message": "Looks like a test record."}]},
    )
    client = TestClient(app)
    body = client.post("/ai/preflight", json=ai_payload()).json()
    ai_issues = [i for i in body["issues"] if i.get("source") == "ai"]
    assert ai_issues and all(i["severity"] == "warning" for i in ai_issues)


def test_preflight_ai_rows_out_of_range_dropped(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {"issues": [
            {"row": 0, "field": "name", "severity": "warning", "message": "x"},
            {"row": 5, "field": "name", "severity": "warning", "message": "x"},
            {"row": -1, "field": "name", "severity": "warning", "message": "x"},
        ]},
    )
    client = TestClient(app)
    body = client.post("/ai/preflight", json=ai_payload()).json()  # 1 row
    assert [i for i in body["issues"] if i.get("source") == "ai"] == []


def test_preflight_ai_non_int_row_dropped(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {"issues": [
            {"row": "1", "field": "name", "severity": "warning", "message": "x"},
            {"row": None, "field": "name", "severity": "warning", "message": "x"},
            "not-a-dict",
        ]},
    )
    client = TestClient(app)
    body = client.post("/ai/preflight", json=ai_payload()).json()
    assert [i for i in body["issues"] if i.get("source") == "ai"] == []


def test_preflight_ai_issue_projected_to_fixed_fields(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    install_mock(
        monkeypatch,
        {"issues": [{"row": 1, "field": "name", "severity": "warning",
                     "message": "m", "EXTRA": "smuggled"}]},
    )
    client = TestClient(app)
    body = client.post("/ai/preflight", json=ai_payload()).json()
    ai_issue = next(i for i in body["issues"] if i.get("source") == "ai")
    assert set(ai_issue) == {"row", "field", "message", "severity", "source"}


def test_preflight_ai_bool_row_dropped(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    # JSON true is a Python bool — an int subclass — and must not sneak
    # through the integer row check as row 1.
    install_mock(
        monkeypatch,
        {"issues": [
            {"row": True, "field": "name", "severity": "warning", "message": "x"},
        ]},
    )
    client = TestClient(app)
    body = client.post("/ai/preflight", json=ai_payload()).json()
    assert [i for i in body["issues"] if i.get("source") == "ai"] == []


def test_preflight_skips_ai_call_when_nothing_to_sample(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": '{"issues": []}'}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))
    client = TestClient(app)
    # Rows non-empty but no mapped/TLE columns -> nothing to send: no LLM call.
    response = client.post(
        "/ai/preflight", json=ai_payload(mapped_columns=[], tle_columns={})
    )
    assert response.status_code == 200
    assert all(i.get("source") != "ai" for i in response.json()["issues"])
    # Empty rows -> nothing to sample: no LLM call either.
    response = client.post("/ai/preflight", json=ai_payload(rows=[]))
    assert response.status_code == 200
    assert calls["count"] == 0


def test_preflight_only_relevant_columns_sent_to_provider(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content.decode()
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": '{"issues": []}'}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json=ai_payload(
            rows=[{"name": "Ann Lee", "addr1": "1 Main St",
                   "internal_notes": "SSN-ish sensitive stuff"}],
            mapped_columns=["addr1"],
            tle_columns={"mailing_name": "name"},
        ),
    )
    assert response.status_code == 200
    # Column neither mapped nor in tle_columns must not reach the provider.
    assert "internal_notes" not in captured["body"]
    assert "sensitive stuff" not in captured["body"]
    assert "name" in captured["body"] and "addr1" in captured["body"]


def test_preflight_response_truncated_at_500(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    # 11 mapped columns x 60 all-empty rows -> 50 reported per column = 550.
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json={
            "rows": [{} for _ in range(60)],
            "mapped_columns": [f"c{i}" for i in range(11)],
            "tle_columns": {},
        },
    )
    body = response.json()
    assert body["truncated"] is True
    assert body["total_issues"] > 500
    assert len(body["issues"]) == 500


def test_preflight_not_truncated_metadata(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = TestClient(app)
    body = client.post(
        "/ai/preflight",
        json={
            "rows": [{"name": ""}],
            "mapped_columns": [],
            "tle_columns": {"mailing_name": "name"},
        },
    ).json()
    assert body["truncated"] is False
    assert body["total_issues"] == len(body["issues"])


def test_preflight_non_string_row_value_rejected(monkeypatch):
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json={"rows": [{"amt": 5}], "mapped_columns": [], "tle_columns": {}},
    )
    assert response.status_code == 422


def test_preflight_oversized_request_rejected(monkeypatch):
    client = TestClient(app)
    base = {"rows": [{"a": "x"}], "mapped_columns": [], "tle_columns": {}}
    # 5001 rows exceeds the 5000-row cap.
    response = client.post(
        "/ai/preflight", json={**base, "rows": [{"a": "x"}] * 5001}
    )
    assert response.status_code == 422
    # Row value >500 chars rejected.
    response = client.post(
        "/ai/preflight", json={**base, "rows": [{"a": "x" * 501}]}
    )
    assert response.status_code == 422
    # Row key >200 chars rejected.
    response = client.post(
        "/ai/preflight", json={**base, "rows": [{"k" * 201: "x"}]}
    )
    assert response.status_code == 422
    # A row with 501 keys exceeds the per-row key-count cap.
    response = client.post(
        "/ai/preflight",
        json={**base, "rows": [{f"k{i}": "v" for i in range(501)}]},
    )
    assert response.status_code == 422
    # 501 mapped columns exceeds the 500-item cap.
    response = client.post(
        "/ai/preflight",
        json={**base, "mapped_columns": [f"c{i}" for i in range(501)]},
    )
    assert response.status_code == 422


def test_preflight_unknown_tle_keys_ignored(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json={
            "rows": [{"name": "Ann Lee"}],
            "mapped_columns": [],
            "tle_columns": {"mailing_name": "name", "bogus_key": "missing_col"},
        },
    )
    assert response.status_code == 200
    # No checks run against the bogus key's column.
    assert all(i["field"] != "missing_col" for i in response.json()["issues"])


def test_preflight_rate_limited_after_20(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    client = TestClient(app)
    body = {
        "rows": [{"name": "Ann Lee"}],
        "mapped_columns": [],
        "tle_columns": {"mailing_name": "name"},
    }
    codes = [client.post("/ai/preflight", json=body).status_code for _ in range(20)]
    assert codes == [200] * 20
    assert client.post("/ai/preflight", json=body).status_code == 429


def test_preflight_ai_sample_expands_mailing_templates(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content.decode()
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": '{"issues": []}'}]}
        )

    monkeypatch.setattr(ai_module, "_test_transport", httpx.MockTransport(handler))
    client = TestClient(app)
    response = client.post(
        "/ai/preflight",
        json=ai_payload(
            rows=[{"first_name": "Ann", "last_name": "Lee", "street": "1 Main St",
                   "secret": "do not send"}],
            mapped_columns=[],
            tle_columns={
                "mailing_name": "{first_name} {last_name}",
                "mailing_addr1": "street",
                "mailing_addr3": "{city}, {state} {zip}",
            },
        ),
    )
    assert response.status_code == 200
    # The template's referenced columns are sampled with real values...
    for expected in ("first_name", "Ann", "last_name", "Lee", "street", "1 Main St"):
        assert expected in captured["body"]
    # ...the raw template string is not sent as a column name, and unrelated
    # columns still never leave the server.
    assert "{first_name}" not in captured["body"]
    assert "do not send" not in captured["body"]
