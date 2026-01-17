from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_session
from app.models import (
    Job,
    JobMapping,
    JobReturnAddress,
    JobTleConfig,
    TemplateProfile,
)


router = APIRouter()


class CreateTemplateProfileRequest(BaseModel):
    name: str
    template_asset_id: str


class CreateJobRequest(BaseModel):
    name: str
    template_profile_id: str


class JobMappingInput(BaseModel):
    placeholder_name: str
    expression_json: dict[str, Any]


class UpdateMappingsRequest(BaseModel):
    mappings: list[JobMappingInput]


class UpdateTleRequest(BaseModel):
    name_expr: dict[str, Any] | None = None
    addr1_expr: dict[str, Any] | None = None
    addr2_expr: dict[str, Any] | None = None
    addr3_expr: dict[str, Any] | None = None
    return_addr1_expr: dict[str, Any] | None = None
    return_addr2_expr: dict[str, Any] | None = None
    return_addr3_expr: dict[str, Any] | None = None


class UpdateReturnAddressRequest(BaseModel):
    return_addr1: str
    return_addr2: str | None = None
    return_addr3: str | None = None


@router.post("/template-profiles")
def create_template_profile(payload: CreateTemplateProfileRequest) -> dict[str, Any]:
    try:
        asset_id = uuid.UUID(payload.template_asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid template_asset_id") from exc

    from app.models import Asset

    with get_session() as session:
        asset = session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
        template_profile = TemplateProfile(
            name=payload.name,
            version=1,
            status="DRAFT",
            template_s3_key=asset.s3_key,
        )
        session.add(template_profile)
        session.commit()
        session.refresh(template_profile)

    return {
        "id": str(template_profile.id),
        "name": template_profile.name,
        "version": template_profile.version,
        "status": template_profile.status,
        "template_s3_key": template_profile.template_s3_key,
        "created_at": template_profile.created_at,
    }


@router.get("/template-profiles/{template_profile_id}")
def get_template_profile(template_profile_id: str) -> dict[str, Any]:
    try:
        profile_id = uuid.UUID(template_profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid template_profile_id") from exc

    with get_session() as session:
        profile = session.get(TemplateProfile, profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="template profile not found")

    return {
        "id": str(profile.id),
        "name": profile.name,
        "version": profile.version,
        "status": profile.status,
        "template_s3_key": profile.template_s3_key,
        "created_at": profile.created_at,
    }


@router.post("/jobs")
def create_job(payload: CreateJobRequest) -> dict[str, Any]:
    try:
        template_profile_id = uuid.UUID(payload.template_profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid template_profile_id") from exc

    with get_session() as session:
        template_profile = session.get(TemplateProfile, template_profile_id)
        if not template_profile:
            raise HTTPException(status_code=404, detail="template profile not found")
        job = Job(name=payload.name, template_profile_id=template_profile.id)
        session.add(job)
        session.commit()
        session.refresh(job)

    return {"id": str(job.id), "name": job.name, "template_profile_id": str(job.template_profile_id)}


@router.put("/jobs/{job_id}/mappings")
def update_job_mappings(job_id: str, payload: UpdateMappingsRequest) -> dict[str, str]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        job = session.get(Job, job_uuid)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        session.query(JobMapping).filter(JobMapping.job_id == job_uuid).delete()
        for mapping in payload.mappings:
            session.add(
                JobMapping(
                    job_id=job_uuid,
                    placeholder_name=mapping.placeholder_name,
                    expression_json=mapping.expression_json,
                )
            )
        session.commit()

    return {"status": "ok"}


@router.put("/jobs/{job_id}/tle")
def update_job_tle(job_id: str, payload: UpdateTleRequest) -> dict[str, str]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        job = session.get(Job, job_uuid)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        tle = session.get(JobTleConfig, job_uuid)
        if not tle:
            tle = JobTleConfig(job_id=job_uuid)
            session.add(tle)
        tle.name_expr = payload.name_expr
        tle.addr1_expr = payload.addr1_expr
        tle.addr2_expr = payload.addr2_expr
        tle.addr3_expr = payload.addr3_expr
        tle.return_addr1_expr = payload.return_addr1_expr
        tle.return_addr2_expr = payload.return_addr2_expr
        tle.return_addr3_expr = payload.return_addr3_expr
        session.commit()

    return {"status": "ok"}


@router.get("/jobs/{job_id}/tle")
def get_job_tle(job_id: str) -> dict[str, Any]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        tle = session.get(JobTleConfig, job_uuid)
        if not tle:
            raise HTTPException(status_code=404, detail="job tle config not found")

    return {
        "name_expr": tle.name_expr,
        "addr1_expr": tle.addr1_expr,
        "addr2_expr": tle.addr2_expr,
        "addr3_expr": tle.addr3_expr,
        "return_addr1_expr": tle.return_addr1_expr,
        "return_addr2_expr": tle.return_addr2_expr,
        "return_addr3_expr": tle.return_addr3_expr,
    }


@router.put("/jobs/{job_id}/return-address")
def upsert_return_address(job_id: str, payload: UpdateReturnAddressRequest) -> dict[str, str]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        job = session.get(Job, job_uuid)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")
        address = session.get(JobReturnAddress, job_uuid)
        if not address:
            address = JobReturnAddress(job_id=job_uuid)
            session.add(address)
        address.return_addr1 = payload.return_addr1
        address.return_addr2 = payload.return_addr2
        address.return_addr3 = payload.return_addr3
        session.commit()

    return {"status": "ok"}


@router.get("/jobs/{job_id}/return-address")
def get_return_address(job_id: str) -> dict[str, Any]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    with get_session() as session:
        address = session.get(JobReturnAddress, job_uuid)
        if not address:
            raise HTTPException(status_code=404, detail="return address not found")

    return {
        "return_addr1": address.return_addr1,
        "return_addr2": address.return_addr2,
        "return_addr3": address.return_addr3,
        "updated_at": address.updated_at,
    }


@router.post("/jobs/{job_id}/validate")
def validate_job(job_id: str) -> dict[str, Any]:
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid job_id") from exc

    errors: list[str] = []
    warnings: list[str] = []

    with get_session() as session:
        job = session.get(Job, job_uuid)
        if not job:
            raise HTTPException(status_code=404, detail="job not found")

        mappings_count = session.query(JobMapping).filter(JobMapping.job_id == job_uuid).count()
        if mappings_count == 0:
            warnings.append("no mappings configured")

        tle = session.get(JobTleConfig, job_uuid)
        has_tle_config = tle is not None

        return_address = session.get(JobReturnAddress, job_uuid)
        has_return_address = return_address is not None

        name_expr = tle.name_expr if tle else None
        addr1_expr = tle.addr1_expr if tle else None
        return_addr1_expr = tle.return_addr1_expr if tle else None

        if not name_expr:
            errors.append("name_expr is required")
        if not addr1_expr:
            errors.append("addr1_expr is required")
        if not (return_address and return_address.return_addr1) and not return_addr1_expr:
            errors.append("return_addr1 is required")

    return {
        "missing_mappings_count": 0 if mappings_count > 0 else 1,
        "has_tle_config": has_tle_config,
        "has_return_address": has_return_address,
        "errors": errors,
        "warnings": warnings,
    }
