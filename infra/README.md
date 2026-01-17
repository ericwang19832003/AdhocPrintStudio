# Infrastructure notes

Suggested AWS resources:
- SQS queue for background jobs
- IAM role/user with least-privilege access to the queue
- Optional CloudWatch log group for worker output

Keep secrets in `.env.local` files per app.
