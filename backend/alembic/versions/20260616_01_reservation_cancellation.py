"""add reservation cancellation metadata

Revision ID: 20260616_01
Revises: 20260615_01
Create Date: 2026-06-16
"""

from alembic import op
import sqlalchemy as sa


revision = "20260616_01"
down_revision = "20260615_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not _column_exists("reservations", "cancelled_at"):
        op.add_column("reservations", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
    if not _column_exists("reservations", "cancelled_by"):
        op.add_column("reservations", sa.Column("cancelled_by", sa.String(length=36), nullable=True))
    if not _column_exists("reservations", "cancellation_reason"):
        op.add_column("reservations", sa.Column("cancellation_reason", sa.Text(), nullable=True))
    if not _index_exists("reservations", "ix_reservations_cancelled_at"):
        op.create_index("ix_reservations_cancelled_at", "reservations", ["cancelled_at"], unique=False)


def downgrade() -> None:
    if _index_exists("reservations", "ix_reservations_cancelled_at"):
        op.drop_index("ix_reservations_cancelled_at", table_name="reservations")
    if _column_exists("reservations", "cancellation_reason"):
        op.drop_column("reservations", "cancellation_reason")
    if _column_exists("reservations", "cancelled_by"):
        op.drop_column("reservations", "cancelled_by")
    if _column_exists("reservations", "cancelled_at"):
        op.drop_column("reservations", "cancelled_at")


def _column_exists(table_name: str, column_name: str) -> bool:
    if not sa.inspect(op.get_bind()).has_table(table_name):
        return False
    return column_name in {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _index_exists(table_name: str, index_name: str) -> bool:
    if not sa.inspect(op.get_bind()).has_table(table_name):
        return False
    return index_name in {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)
    }
