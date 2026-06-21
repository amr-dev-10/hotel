"""Add dispatch notification fields

Revision ID: c2f4a6d8e901
Revises: b7a1c9d2e4f6
Create Date: 2026-06-21 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c2f4a6d8e901"
down_revision: Union[str, Sequence[str], None] = "b7a1c9d2e4f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not _column_exists("ticket_acceptances", "rejection_reason"):
        op.add_column("ticket_acceptances", sa.Column("rejection_reason", sa.String(length=255), nullable=True))

    if not _column_exists("notifications", "notification_type"):
        op.add_column(
            "notifications",
            sa.Column("notification_type", sa.String(length=40), nullable=False, server_default="general"),
        )
        op.create_index("ix_notifications_notification_type", "notifications", ["notification_type"], unique=False)

    if not _column_exists("notifications", "reference_id"):
        op.add_column("notifications", sa.Column("reference_id", sa.String(length=36), nullable=True))
        op.create_index("ix_notifications_reference_id", "notifications", ["reference_id"], unique=False)


def downgrade() -> None:
    if _index_exists("notifications", "ix_notifications_reference_id"):
        op.drop_index("ix_notifications_reference_id", table_name="notifications")
    if _column_exists("notifications", "reference_id"):
        op.drop_column("notifications", "reference_id")

    if _index_exists("notifications", "ix_notifications_notification_type"):
        op.drop_index("ix_notifications_notification_type", table_name="notifications")
    if _column_exists("notifications", "notification_type"):
        op.drop_column("notifications", "notification_type")

    if _column_exists("ticket_acceptances", "rejection_reason"):
        op.drop_column("ticket_acceptances", "rejection_reason")


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))
