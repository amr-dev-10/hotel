"""Add F&B layout detail fields

Revision ID: e4a7c1d9f205
Revises: d9e2f4a1b7c3
Create Date: 2026-06-21 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4a7c1d9f205"
down_revision: Union[str, Sequence[str], None] = "d9e2f4a1b7c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not _column_exists("menu_items", "preparation_time_minutes"):
        op.add_column(
            "menu_items",
            sa.Column("preparation_time_minutes", sa.Integer(), nullable=False, server_default="15"),
        )
    if not _column_exists("tax_configs", "description"):
        op.add_column("tax_configs", sa.Column("description", sa.Text(), nullable=True))
    if not _column_exists("tax_configs", "tax_type"):
        op.add_column(
            "tax_configs",
            sa.Column("tax_type", sa.String(length=40), nullable=False, server_default="percentage"),
        )
    if not _column_exists("tax_configs", "fixed_amount"):
        op.add_column(
            "tax_configs",
            sa.Column("fixed_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    if _column_exists("tax_configs", "fixed_amount"):
        op.drop_column("tax_configs", "fixed_amount")
    if _column_exists("tax_configs", "tax_type"):
        op.drop_column("tax_configs", "tax_type")
    if _column_exists("tax_configs", "description"):
        op.drop_column("tax_configs", "description")
    if _column_exists("menu_items", "preparation_time_minutes"):
        op.drop_column("menu_items", "preparation_time_minutes")


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))
