"""Tests for the SQLite local database layer."""
from __future__ import annotations

import os
import tempfile
import uuid

import pytest
from sqlalchemy import inspect, text

from app.db_local import _reset, get_engine, get_session, init_db


@pytest.fixture(autouse=True)
def _tmp_database(tmp_path):
    """Point the database at a temporary file and reset between tests."""
    db_file = str(tmp_path / "test.db")
    os.environ["LOCAL_DATABASE_PATH"] = db_file
    _reset()
    yield
    _reset()
    os.environ.pop("LOCAL_DATABASE_PATH", None)


class TestCreateAllTables:
    def test_tables_are_created(self):
        init_db()
        engine = get_engine()
        inspector = inspect(engine)
        table_names = set(inspector.get_table_names())
        expected = {
            "template_profiles",
            "assets",
            "jobs",
            "job_mappings",
            "job_tle_config",
            "job_return_address",
            "job_runs",
        }
        assert expected.issubset(table_names)

    def test_empty_query_works(self):
        init_db()
        with get_session() as session:
            from app.models_local import Asset

            results = session.query(Asset).all()
            assert results == []


class TestInsertAndReadAsset:
    def test_insert_and_read(self):
        init_db()
        from app.models_local import Asset

        asset_id = str(uuid.uuid4())
        with get_session() as session:
            asset = Asset(
                id=asset_id,
                type="image",
                filename="logo.png",
                s3_key="assets/logo.png",
                checksum_sha256="abc123",
            )
            session.add(asset)
            session.commit()

        with get_session() as session:
            loaded = session.get(Asset, asset_id)
            assert loaded is not None
            assert loaded.filename == "logo.png"
            assert loaded.type == "image"
            assert loaded.s3_key == "assets/logo.png"
            assert loaded.checksum_sha256 == "abc123"
            assert loaded.created_at is not None


class TestInsertAndReadJobWithJson:
    def test_json_round_trip(self):
        init_db()
        from app.models_local import Job, JobTleConfig, TemplateProfile

        tp_id = str(uuid.uuid4())
        job_id = str(uuid.uuid4())

        name_expr = {"type": "column", "value": "FULL_NAME"}
        addr1_expr = {"type": "literal", "value": "123 Main St"}

        with get_session() as session:
            tp = TemplateProfile(
                id=tp_id,
                name="Letter",
                version=1,
                status="active",
                template_s3_key="templates/letter.afp",
            )
            session.add(tp)
            session.flush()

            job = Job(
                id=job_id,
                name="Test Job",
                template_profile_id=tp_id,
            )
            session.add(job)
            session.flush()

            tle = JobTleConfig(
                job_id=job_id,
                name_expr=name_expr,
                addr1_expr=addr1_expr,
            )
            session.add(tle)
            session.commit()

        with get_session() as session:
            loaded_tle = session.get(JobTleConfig, job_id)
            assert loaded_tle is not None
            assert loaded_tle.name_expr == name_expr
            assert loaded_tle.addr1_expr == addr1_expr
            assert loaded_tle.addr2_expr is None

            loaded_job = session.get(Job, job_id)
            assert loaded_job is not None
            assert loaded_job.name == "Test Job"
            assert loaded_job.template_profile_id == tp_id
