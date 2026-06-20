"""Add ticket workspace fields

Revision ID: b7a1c9d2e4f6
Revises: 3c6a76be3ad5
Create Date: 2026-06-20 23:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7a1c9d2e4f6"
down_revision: Union[str, Sequence[str], None] = "3c6a76be3ad5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TABLE_NAME = "whatsapp_messages"
COLUMN_NAME = "ticket_id"
INDEX_NAME = "ix_whatsapp_messages_ticket_id"
FK_NAME = "fk_whatsapp_messages_ticket_id_tickets"


def upgrade() -> None:
    if not _column_exists("tickets", "followers"):
        op.add_column(
            "tickets",
            sa.Column("followers", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        )
    if not _column_exists(TABLE_NAME, COLUMN_NAME):
        op.add_column(TABLE_NAME, sa.Column(COLUMN_NAME, sa.String(length=36), nullable=True))
    if not _index_exists(TABLE_NAME, INDEX_NAME):
        op.create_index(INDEX_NAME, TABLE_NAME, [COLUMN_NAME], unique=False)
    if not _foreign_key_exists(TABLE_NAME, FK_NAME):
        op.create_foreign_key(FK_NAME, TABLE_NAME, "tickets", [COLUMN_NAME], ["id"])


def downgrade() -> None:
    if _foreign_key_exists(TABLE_NAME, FK_NAME):
        op.drop_constraint(FK_NAME, TABLE_NAME, type_="foreignkey")
    if _index_exists(TABLE_NAME, INDEX_NAME):
        op.drop_index(INDEX_NAME, table_name=TABLE_NAME)
    if _column_exists(TABLE_NAME, COLUMN_NAME):
        op.drop_column(TABLE_NAME, COLUMN_NAME)
    if _column_exists("tickets", "followers"):
        op.drop_column("tickets", "followers")


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


def _foreign_key_exists(table_name: str, constraint_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(fk["name"] == constraint_name for fk in inspector.get_foreign_keys(table_name))
