from __future__ import annotations

import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"))
    status: Mapped[str] = mapped_column(String(50))
    progress: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    output_tle_s3_key: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class JobTleConfig(Base):
    __tablename__ = "job_tle_config"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), primary_key=True
    )
    name_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    addr1_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    addr2_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    addr3_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    return_addr1_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    return_addr2_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    return_addr3_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)


class JobReturnAddress(Base):
    __tablename__ = "job_return_address"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("jobs.id"), primary_key=True
    )
    return_addr1: Mapped[str] = mapped_column(Text)
    return_addr2: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_addr3: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    type: Mapped[str] = mapped_column(String(50))
    filename: Mapped[str] = mapped_column(String(255))
    s3_key: Mapped[str] = mapped_column(String(512))
    checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
