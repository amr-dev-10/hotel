"""Add performance indexes for tenant-scoped list queries

Revision ID: f3b8c6a2d941
Revises: e4a7c1d9f205
Create Date: 2026-06-21 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f3b8c6a2d941"
down_revision: Union[str, Sequence[str], None] = "e4a7c1d9f205"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEXES = (
    ("tickets", "ix_ticket_hotel_dept", ["hotel_id", "department_id"]),
    ("tickets", "ix_ticket_hotel_assigned", ["hotel_id", "assigned_to"]),
    ("tickets", "ix_ticket_hotel_created", ["hotel_id", "created_at", "id"]),
    ("tickets", "ix_ticket_hotel_priority", ["hotel_id", "priority"]),
    ("tickets", "ix_ticket_hotel_stage", ["hotel_id", "stage"]),
    ("reservations", "ix_reservation_hotel_checkin", ["hotel_id", "checkin_date"]),
    ("reservations", "ix_reservation_hotel_checkout", ["hotel_id", "checkout_date"]),
    ("reservations", "ix_reservation_hotel_room", ["hotel_id", "room_id"]),
    ("reservations", "ix_reservation_hotel_status", ["hotel_id", "status"]),
    ("reservations", "ix_reservation_hotel_created", ["hotel_id", "created_at", "id"]),
    ("whatsapp_conversations", "ix_wa_conv_hotel_phone", ["hotel_id", "phone"]),
    ("whatsapp_conversations", "ix_wa_conv_hotel_last_msg", ["hotel_id", "last_message_at", "id"]),
    ("whatsapp_conversations", "ix_wa_conv_hotel_status", ["hotel_id", "status"]),
    ("guests", "ix_guest_hotel_created", ["hotel_id", "created_at", "id"]),
    ("guests", "ix_guest_hotel_status", ["hotel_id", "status"]),
    ("housekeeping_schedules", "ix_hk_hotel_status", ["hotel_id", "status"]),
    ("housekeeping_schedules", "ix_hk_hotel_room", ["hotel_id", "room_id"]),
    ("housekeeping_schedules", "ix_hk_hotel_scheduled", ["hotel_id", "scheduled_date"]),
)


def upgrade() -> None:
    for table_name, index_name, columns in INDEXES:
        if _table_exists(table_name) and not _index_exists(table_name, index_name):
            op.create_index(index_name, table_name, columns)


def downgrade() -> None:
    for table_name, index_name, _ in reversed(INDEXES):
        if _table_exists(table_name) and _index_exists(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _index_exists(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))
