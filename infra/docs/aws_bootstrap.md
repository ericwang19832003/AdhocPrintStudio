# AWS bootstrap (dev)

Creates the dev S3 bucket and SQS queue, then prints export lines.

## Mac commands

From the repo root:
```
chmod +x infra/scripts/aws_bootstrap_dev.sh
AWS_REGION=us-east-1 infra/scripts/aws_bootstrap_dev.sh
```

Optional region override:
```
AWS_REGION=us-west-2 infra/scripts/aws_bootstrap_dev.sh
```

To load the exports into your shell:
```
eval "$(AWS_REGION=us-east-1 infra/scripts/aws_bootstrap_dev.sh)"
```
