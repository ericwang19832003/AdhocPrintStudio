#!/usr/bin/env bash
set -euo pipefail

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI not found. Install with: brew install awscli"
  exit 1
fi

aws sts get-caller-identity >/dev/null 2>&1
echo "AWS CLI is configured."
