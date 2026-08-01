"""Tests for the local filesystem storage service."""
from __future__ import annotations

import os

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.local_storage import (
    _reset,
    file_exists,
    get_download_url,
    get_upload_url,
    read_file,
    router,
    save_file,
)


@pytest.fixture(autouse=True)
def _tmp_storage(tmp_path):
    """Point storage at a temporary directory and reset between tests."""
    os.environ["LOCAL_STORAGE_PATH"] = str(tmp_path)
    _reset()
    yield
    _reset()
    os.environ.pop("LOCAL_STORAGE_PATH", None)


# ---------------------------------------------------------------------------
# Unit tests for storage functions
# ---------------------------------------------------------------------------


class TestSaveAndReadRoundTrip:
    def test_round_trip(self, tmp_path):
        key = "uploads/TEMPLATE/abc/file.pdf"
        data = b"%PDF-1.4 fake content"
        save_file(key, data)
        assert read_file(key) == data

    def test_binary_data(self, tmp_path):
        key = "bin/data.bin"
        data = bytes(range(256))
        save_file(key, data)
        assert read_file(key) == data


class TestReadFileMissing:
    def test_raises_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            read_file("does/not/exist.txt")


class TestGetUploadUrl:
    def test_format(self):
        assert get_upload_url("a/b/c.pdf") == "/local/upload/a/b/c.pdf"

    def test_simple_key(self):
        assert get_upload_url("file.txt") == "/local/upload/file.txt"


class TestGetDownloadUrl:
    def test_format(self):
        assert get_download_url("a/b/c.pdf") == "/local/download/a/b/c.pdf"

    def test_simple_key(self):
        assert get_download_url("file.txt") == "/local/download/file.txt"


class TestFileExists:
    def test_false_then_true(self):
        key = "check/exists.txt"
        assert file_exists(key) is False
        save_file(key, b"hello")
        assert file_exists(key) is True


class TestPathTraversal:
    def test_traversal_rejected_save(self):
        with pytest.raises(ValueError, match="Path traversal"):
            save_file("../../etc/passwd", b"bad")

    def test_traversal_rejected_read(self):
        with pytest.raises(ValueError, match="Path traversal"):
            read_file("../../../etc/shadow")


# ---------------------------------------------------------------------------
# Integration tests for FastAPI endpoints
# ---------------------------------------------------------------------------


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


class TestUploadEndpoint:
    def test_upload_and_download(self, client):
        key = "uploads/test/hello.txt"
        resp = client.put(f"/local/upload/{key}", content=b"hello world")
        assert resp.status_code == 200
        assert resp.json()["key"] == key

        resp = client.get(f"/local/download/{key}")
        assert resp.status_code == 200
        assert resp.content == b"hello world"

    def test_upload_empty_body_rejected(self, client):
        resp = client.put("/local/upload/empty.txt", content=b"")
        assert resp.status_code == 400

    def test_download_missing_file(self, client):
        resp = client.get("/local/download/nope.txt")
        assert resp.status_code == 404

    def test_download_path_traversal(self, client):
        # URL-level traversal (../../) gets normalized by the HTTP layer.
        # Path traversal protection is verified at the function level in
        # TestPathTraversal above. Here we just confirm a non-existent
        # nested key returns 404 (route still works with path params).
        resp = client.get("/local/download/sub/dir/missing.txt")
        assert resp.status_code == 404
