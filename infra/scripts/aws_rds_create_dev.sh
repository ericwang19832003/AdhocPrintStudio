#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
DB_IDENTIFIER="adhocprintstudio-dev-pg"
DB_NAME="adhocprint"
DB_CLASS="db.t3.micro"
DB_STORAGE_GB="20"

DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
  echo "DB_USER and DB_PASSWORD must be set."
  exit 1
fi

if aws rds describe-db-instances --db-instance-identifier "$DB_IDENTIFIER" --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "RDS instance already exists: $DB_IDENTIFIER"
else
  aws rds create-db-instance \
    --db-instance-identifier "$DB_IDENTIFIER" \
    --db-name "$DB_NAME" \
    --db-instance-class "$DB_CLASS" \
    --engine postgres \
    --allocated-storage "$DB_STORAGE_GB" \
    --master-username "$DB_USER" \
    --master-user-password "$DB_PASSWORD" \
    --publicly-accessible \
    --region "$AWS_REGION" \
    >/dev/null
fi

aws rds wait db-instance-available --db-instance-identifier "$DB_IDENTIFIER" --region "$AWS_REGION"

ENDPOINT="$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_IDENTIFIER" \
  --region "$AWS_REGION" \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)"

echo "$ENDPOINT"
