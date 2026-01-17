from __future__ import annotations

import os

import boto3
from fastapi import HTTPException


def get_s3_client() -> tuple[str, boto3.client]:
    region = os.getenv("AWS_REGION")
    bucket = os.getenv("S3_BUCKET")
    if not region or not bucket:
        raise HTTPException(status_code=500, detail="AWS_REGION or S3_BUCKET not set")
    return bucket, boto3.client("s3", region_name=region)


def get_sqs_client() -> tuple[str, boto3.client]:
    region = os.getenv("AWS_REGION")
    queue_url = os.getenv("SQS_QUEUE_URL")
    if not region or not queue_url:
        raise HTTPException(status_code=500, detail="AWS_REGION or SQS_QUEUE_URL not set")
    return queue_url, boto3.client("sqs", region_name=region)
