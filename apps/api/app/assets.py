from __future__ import annotations

import uuid
from enum import Enum

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.aws import get_s3_client
from app.db import get_session
from app.models import Asset


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
    asset_id = uuid.uuid4()
    s3_key = f"uploads/{payload.asset_type}/{asset_id}/{payload.filename}"

    with get_session() as session:
        asset = Asset(
            id=asset_id,
            type=payload.asset_type.value,
            filename=payload.filename,
            s3_key=s3_key,
        )
        session.add(asset)
        session.commit()

    bucket, client = get_s3_client()
    presigned_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": s3_key, "ContentType": payload.content_type},
        ExpiresIn=3600,
    )

    return PresignUploadResponse(
        asset_id=str(asset_id),
        s3_key=s3_key,
        presigned_url=presigned_url,
    )


@router.post("/assets/commit")
def commit_asset(payload: CommitAssetRequest) -> dict[str, str]:
    try:
        asset_uuid = uuid.UUID(payload.asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid asset_id") from exc

    with get_session() as session:
        asset = session.get(Asset, asset_uuid)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")
        if payload.checksum_sha256 is not None:
            asset.checksum_sha256 = payload.checksum_sha256
        session.commit()

    return {"status": "ok"}


@router.get("/assets/{asset_id}/presign-download", response_model=PresignDownloadResponse)
def presign_download(asset_id: str) -> PresignDownloadResponse:
    try:
        asset_uuid = uuid.UUID(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="invalid asset_id") from exc

    with get_session() as session:
        asset = session.get(Asset, asset_uuid)
        if not asset:
            raise HTTPException(status_code=404, detail="asset not found")

    bucket, client = get_s3_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": asset.s3_key},
        ExpiresIn=3600,
    )
    return PresignDownloadResponse(url=url)
