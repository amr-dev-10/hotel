"""add default flag to shift templates

Revision ID: a9b8c7d6e5f4
Revises: f7a8b9c0d1e2
Create Date: 2026-07-17 15:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "shift_templates",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("shift_templates", "is_default", server_default=None)
    op.create_index(op.f("ix_shift_templates_is_default"), "shift_templates", ["is_default"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_shift_templates_is_default"), table_name="shift_templates")
    op.drop_column("shift_templates", "is_default")
