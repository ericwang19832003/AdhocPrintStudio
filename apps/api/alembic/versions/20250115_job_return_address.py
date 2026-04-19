"""add job_return_address and extend job_tle_config

Revision ID: 20250115_job_return_address
Revises: 20250115_mvp_tables
Create Date: 2026-01-15 00:00:00

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "20250115_job_return_address"
down_revision = "20250115_mvp_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_tle_config",
        sa.Column("return_addr1_expr", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "job_tle_config",
        sa.Column("return_addr2_expr", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "job_tle_config",
        sa.Column("return_addr3_expr", postgresql.JSONB(), nullable=True),
    )

    op.create_table(
        "job_return_address",
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("jobs.id"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("return_addr1", sa.Text(), nullable=False),
        sa.Column("return_addr2", sa.Text(), nullable=True),
        sa.Column("return_addr3", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("job_return_address")
    op.drop_column("job_tle_config", "return_addr3_expr")
    op.drop_column("job_tle_config", "return_addr2_expr")
    op.drop_column("job_tle_config", "return_addr1_expr")
