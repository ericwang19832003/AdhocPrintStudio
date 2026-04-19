"""make assets.checksum_sha256 nullable

Revision ID: 20250115_assets_checksum_nullable
Revises: 20250115_job_return_address
Create Date: 2026-01-15 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250115_assets_checksum_nullable"
down_revision = "20250115_job_return_address"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("assets", "checksum_sha256", existing_type=sa.String(length=64), nullable=True)


def downgrade() -> None:
    op.alter_column("assets", "checksum_sha256", existing_type=sa.String(length=64), nullable=False)
