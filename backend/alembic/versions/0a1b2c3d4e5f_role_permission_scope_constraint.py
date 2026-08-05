"""add role permission scope constraint

Revision ID: 0a1b2c3d4e5f
Revises: a9b8c7d6e5f4
Create Date: 2026-07-18 16:30:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0a1b2c3d4e5f"
down_revision: Union[str, Sequence[str], None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE role_permissions "
        "SET scope = 'hotel' "
        "WHERE scope IS NULL OR scope NOT IN ('own', 'department', 'hotel')"
    )
    with op.batch_alter_table("role_permissions") as batch_op:
        batch_op.create_check_constraint(
            "ck_role_permissions_scope",
            "scope IN ('own', 'department', 'hotel')",
        )


def downgrade() -> None:
    with op.batch_alter_table("role_permissions") as batch_op:
        batch_op.drop_constraint("ck_role_permissions_scope", type_="check")
