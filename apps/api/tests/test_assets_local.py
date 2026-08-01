"""Tests for local-mode asset endpoints."""
from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path):
    os.environ["LOCAL_DATABASE_PATH"] = str(tmp_path / "test.db")
    os.environ["LOCAL_STORAGE_PATH"] = str(tmp_path / "storage")

    from app.db_local import init_db, _reset as db_reset
    from app.local_storage import _reset as storage_reset

    db_reset()
    storage_reset()
    init_db()

    from app.assets_local import router as assets_router
    from app.local_storage import router as storage_router

    test_app = FastAPI()
    test_app.include_router(storage_router)
    test_app.include_router(assets_router)

    yield TestClient(test_app)

    os.environ.pop("LOCAL_DATABASE_PATH", None)
    os.environ.pop("LOCAL_STORAGE_PATH", None)
    db_reset()
    storage_reset()


class TestPresignUpload:
    def test_returns_local_url(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "application/pdf",
            "asset_type": "TEMPLATE",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "asset_id" in data
        assert "s3_key" in data
        assert "/local/upload/" in data["presigned_url"]

    def test_s3_key_format(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "data.xlsx",
            "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "asset_type": "SPREADSHEET",
        })
        data = resp.json()
        assert data["s3_key"].startswith("uploads/SPREADSHEET/")
        assert data["s3_key"].endswith("/data.xlsx")

    def test_invalid_content_type(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "bad",
            "asset_type": "TEMPLATE",
        })
        assert resp.status_code == 422

    def test_invalid_asset_type(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "application/pdf",
            "asset_type": "INVALID",
        })
        assert resp.status_code == 422


class TestCommitAsset:
    def test_commit_ok(self, client):
        # Create asset first
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "application/pdf",
            "asset_type": "TEMPLATE",
        })
        asset_id = resp.json()["asset_id"]

        resp = client.post("/assets/commit", json={"asset_id": asset_id})
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_commit_with_checksum(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "application/pdf",
            "asset_type": "TEMPLATE",
        })
        asset_id = resp.json()["asset_id"]

        resp = client.post("/assets/commit", json={
            "asset_id": asset_id,
            "checksum_sha256": "abc123",
        })
        assert resp.status_code == 200

    def test_commit_not_found(self, client):
        resp = client.post("/assets/commit", json={
            "asset_id": "00000000-0000-0000-0000-000000000000",
        })
        assert resp.status_code == 404

    def test_commit_invalid_id(self, client):
        resp = client.post("/assets/commit", json={"asset_id": "not-a-uuid"})
        assert resp.status_code == 400


class TestPresignDownload:
    def test_download_url_contains_local(self, client):
        resp = client.post("/assets/presign-upload", json={
            "filename": "test.pdf",
            "content_type": "application/pdf",
            "asset_type": "TEMPLATE",
        })
        asset_id = resp.json()["asset_id"]

        resp = client.get(f"/assets/{asset_id}/presign-download")
        assert resp.status_code == 200
        assert "/local/download/" in resp.json()["url"]

    def test_download_not_found(self, client):
        resp = client.get("/assets/00000000-0000-0000-0000-000000000000/presign-download")
        assert resp.status_code == 404

    def test_download_invalid_id(self, client):
        resp = client.get("/assets/not-a-uuid/presign-download")
        assert resp.status_code == 400


class TestFullUploadDownloadFlow:
    def test_upload_then_download(self, client):
        """Full flow: presign-upload -> PUT file -> presign-download -> GET file."""
        # 1. Get upload URL
        resp = client.post("/assets/presign-upload", json={
            "filename": "hello.txt",
            "content_type": "text/plain",
            "asset_type": "TEMPLATE",
        })
        assert resp.status_code == 200
        upload_data = resp.json()
        upload_url = upload_data["presigned_url"]
        asset_id = upload_data["asset_id"]

        # 2. PUT file content to upload URL
        file_content = b"Hello, local storage!"
        resp = client.put(upload_url, content=file_content)
        assert resp.status_code == 200

        # 3. Get download URL
        resp = client.get(f"/assets/{asset_id}/presign-download")
        assert resp.status_code == 200
        download_url = resp.json()["url"]

        # 4. GET file content from download URL
        resp = client.get(download_url)
        assert resp.status_code == 200
        assert resp.content == file_content
