"""Add TicketMessage and ticket source context

Revision ID: 3c6a76be3ad5
Revises: 279141ff7d1d
Create Date: 2026-06-20 21:39:38.897126

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c6a76be3ad5"
down_revision: Union[str, Sequence[str], None] = "279141ff7d1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TICKET_MESSAGE_TABLE = "ticket_messages"
LEGACY_CHAT_TABLE = "chat_messages"


def upgrade() -> None:
    if _table_exists(LEGACY_CHAT_TABLE) and not _table_exists(TICKET_MESSAGE_TABLE):
        op.rename_table(LEGACY_CHAT_TABLE, TICKET_MESSAGE_TABLE)
    elif not _table_exists(TICKET_MESSAGE_TABLE):
        op.create_table(
            TICKET_MESSAGE_TABLE,
            sa.Column("hotel_id", sa.String(length=36), nullable=False),
            sa.Column("ticket_id", sa.String(length=36), nullable=False),
            sa.Column("sender_type", sa.String(length=40), nullable=False),
            sa.Column("sender_id", sa.String(length=36), nullable=True),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], name="fk_ticket_messages_hotel_id_hotels"),
            sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], name="fk_ticket_messages_ticket_id_tickets"),
            sa.PrimaryKeyConstraint("id", name="pk_ticket_messages"),
        )
        op.create_index("ix_ticket_messages_hotel_id", TICKET_MESSAGE_TABLE, ["hotel_id"], unique=False)
        op.create_index("ix_ticket_messages_ticket_id", TICKET_MESSAGE_TABLE, ["ticket_id"], unique=False)

    if not _column_exists("tickets", "reservation_id"):
        op.add_column("tickets", sa.Column("reservation_id", sa.String(length=36), nullable=True))
        op.create_index("ix_tickets_reservation_id", "tickets", ["reservation_id"], unique=False)
    if not _column_exists("tickets", "conversation_id"):
        op.add_column("tickets", sa.Column("conversation_id", sa.String(length=36), nullable=True))
        op.create_index("ix_tickets_conversation_id", "tickets", ["conversation_id"], unique=False)

    if not _foreign_key_exists("tickets", "fk_tickets_reservation_id_reservations"):
        op.create_foreign_key(
            "fk_tickets_reservation_id_reservations",
            "tickets",
            "reservations",
            ["reservation_id"],
            ["id"],
        )
    if not _foreign_key_exists("tickets", "fk_tickets_conversation_id_whatsapp_conversations"):
        op.create_foreign_key(
            "fk_tickets_conversation_id_whatsapp_conversations",
            "tickets",
            "whatsapp_conversations",
            ["conversation_id"],
            ["id"],
        )


def downgrade() -> None:
    if _foreign_key_exists("tickets", "fk_tickets_conversation_id_whatsapp_conversations"):
        op.drop_constraint("fk_tickets_conversation_id_whatsapp_conversations", "tickets", type_="foreignkey")
    if _foreign_key_exists("tickets", "fk_tickets_reservation_id_reservations"):
        op.drop_constraint("fk_tickets_reservation_id_reservations", "tickets", type_="foreignkey")

    if _index_exists("tickets", "ix_tickets_conversation_id"):
        op.drop_index("ix_tickets_conversation_id", table_name="tickets")
    if _column_exists("tickets", "conversation_id"):
        op.drop_column("tickets", "conversation_id")
    if _index_exists("tickets", "ix_tickets_reservation_id"):
        op.drop_index("ix_tickets_reservation_id", table_name="tickets")
    if _column_exists("tickets", "reservation_id"):
        op.drop_column("tickets", "reservation_id")

    if _table_exists(TICKET_MESSAGE_TABLE) and not _table_exists(LEGACY_CHAT_TABLE):
        op.rename_table(TICKET_MESSAGE_TABLE, LEGACY_CHAT_TABLE)


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
