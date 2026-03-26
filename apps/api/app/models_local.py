"""SQLite-compatible ORM models mirroring models.py.

Replaces PostgreSQL-specific types:
- UUID → String(36) with Python-side uuid4 default
- JSONB → JSON
- DateTime(timezone=True) server_default=func.now() → DateTime with Python-side default
- onupdate=func.now() → Python-side onupdate lambda
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db_local import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class TemplateProfile(Base):
    __tablename__ = "template_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    name: Mapped[str] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(50))
    template_s3_key: Mapped[str] = mapped_column(String(512))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    type: Mapped[str] = mapped_column(String(50))
    filename: Mapped[str] = mapped_column(String(255))
    s3_key: Mapped[str] = mapped_column(String(512))
    checksum_sha256: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    name: Mapped[str] = mapped_column(String(255))
    template_profile_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("template_profiles.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    template_profile: Mapped[TemplateProfile] = relationship()


class JobMapping(Base):
    __tablename__ = "job_mappings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id")
    )
    placeholder_name: Mapped[str] = mapped_column(String(128))
    expression_json: Mapped[dict] = mapped_column(JSON)

    job: Mapped[Job] = relationship()


class JobTleConfig(Base):
    __tablename__ = "job_tle_config"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id"), primary_key=True
    )
    name_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr1_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr2_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    addr3_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr1_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr2_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    return_addr3_expr: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped[Job] = relationship()


class JobReturnAddress(Base):
    __tablename__ = "job_return_address"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id"), primary_key=True
    )
    return_addr1: Mapped[str] = mapped_column(Text)
    return_addr2: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_addr3: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    job: Mapped[Job] = relationship()


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=_new_uuid
    )
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("jobs.id")
    )
    status: Mapped[str] = mapped_column(String(50))
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_s3_key: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    output_tle_s3_key: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=_utcnow, onupdate=_utcnow
    )

    job: Mapped[Job] = relationship()
