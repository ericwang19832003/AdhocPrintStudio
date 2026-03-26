"""Local-mode asset endpoints replacing S3 presigned URL flow with local storage."""
from __future__ import annotations

import uuid
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.db_local import get_session
from app.local_storage import get_download_url, get_upload_url
from app.models_local import Asset
from app.security import sanitize_filename


class AssetType(str, Enum):
    TEMPLATE = "TEMPLATE"
    SPREADSHEET = "SPREADSHEET"
    LOGO = "LOGO"
    APPEND_PDF = "APPEND_PDF"
    OUTPUT_AFP = "OUTPUT_AFP"
    OUTPUT_TLE = "OUTPUT_TLE"


class PresignUploadRequest(BaseModel):
    filename: str
    content_type: str
    asset_type: AssetType

    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v: str) -> str:
        return sanitize_filename(v)

    @field_validator('content_type')
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if not v or '/' not in v or len(v) > 256:
            raise ValueError('Invalid content type')
        return v


class PresignUploadResponse(BaseModel):
    asset_id: str
    s3_key: str
    presigned_url: str


class CommitAssetRequest(BaseModel):
    asset_id: str
    checksum_sha256: str | None = None


class PresignDownloadResponse(BaseModel):
    url: str


router = APIRouter()


@router.post("/assets/presign-upload", response_model=PresignUploadResponse)
def presign_upload(payload: PresignUploadRequest) -> PresignUploadResponse:
    asset_id = str(uuid.uuid4())
    s3_key = f"uploads/{payload.asset_type.value}/{asset_id}/{payload.filename}"

    with get_session() as session:
        asset = Asset(
            id=asset_id,
            type=payload.asset_type.value,
            filename=payload.filename,
            s3_key=s3_key,
        )
        session.add(asset)
        session.commit()

    presigned_url = get_upload_url(s3_key)

    return PresignUploadResponse(
        asset_id=asset_id,
        s3_key=s3_key,
        presigned_url=presigned_url,
    )


@router.post("/assets/commit")
def commit_asset(payload: CommitAssetRequest) -> dict[str, str]:
    try:
        uuid.UUID(payload.asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid asset_id") from exc

    with get_session() as session:
        asset = session.get(Asset, payload.asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
        if payload.checksum_sha256 is not None:
            asset.checksum_sha256 = payload.checksum_sha256
        session.commit()

    return {"status": "ok"}


@router.get("/assets/{asset_id}/presign-download", response_model=PresignDownloadResponse)
def presign_download(asset_id: str) -> PresignDownloadResponse:
    try:
        uuid.UUID(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid asset_id") from exc

    with get_session() as session:
        asset = session.get(Asset, asset_id)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
        s3_key = asset.s3_key

    url = get_download_url(s3_key)
    return PresignDownloadResponse(url=url)
