#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
S3_BUCKET="adhocprintstudio-dev-files"
SQS_QUEUE="adhocprintstudio-dev-generate-queue"

ensure_bucket() {
  if aws s3api head-bucket --bucket "$S3_BUCKET" >/dev/null 2>&1; then
    return
  fi

  if [ "$AWS_REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$S3_BUCKET" >/dev/null
  else
    aws s3api create-bucket \
      --bucket "$S3_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" \
      >/dev/null
  fi
}

ensure_queue() {
  if aws sqs get-queue-url --queue-name "$SQS_QUEUE" --region "$AWS_REGION" >/dev/null 2>&1; then
    return
  fi

  aws sqs create-queue --queue-name "$SQS_QUEUE" --region "$AWS_REGION" >/dev/null
}

ensure_bucket
ensure_queue

SQS_QUEUE_URL="$(aws sqs get-queue-url --queue-name "$SQS_QUEUE" --region "$AWS_REGION" --query 'QueueUrl' --output text)"

echo "export AWS_REGION=$AWS_REGION"
echo "export S3_BUCKET=$S3_BUCKET"
echo "export SQS_QUEUE_URL=$SQS_QUEUE_URL"
