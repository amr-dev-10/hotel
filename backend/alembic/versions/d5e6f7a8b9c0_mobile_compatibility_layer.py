"""mobile compatibility layer

Revision ID: d5e6f7a8b9c0
Revises: c1b2a3d4e5f6
Create Date: 2026-07-12 23:20:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, Sequence[str], None] = "c1b2a3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("employee_code", sa.String(length=40), nullable=True))
    op.add_column("users", sa.Column("online_for_chat", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("unseen_messages", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("deactivated_by", sa.String(length=40), nullable=True))
    op.create_index(op.f("ix_users_employee_code"), "users", ["employee_code"], unique=False)
    op.create_unique_constraint("uq_users_hotel_employee_code", "users", ["hotel_id", "employee_code"])

    op.add_column("tickets", sa.Column("mobile_workflow_step", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_delivery_status", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_room_no", sa.String(length=80), nullable=True))
    op.add_column("tickets", sa.Column("mobile_updated_room_no", sa.String(length=80), nullable=True))
    op.add_column("tickets", sa.Column("mobile_guest_name", sa.String(length=255), nullable=True))
    op.add_column("tickets", sa.Column("mobile_task_adder_id", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_task_adder_name", sa.String(length=255), nullable=True))
    op.add_column("tickets", sa.Column("mobile_priority_label", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_ticket_type", sa.String(length=80), nullable=True))
    op.add_column("tickets", sa.Column("mobile_item_ordered", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("mobile_note", sa.Text(), nullable=True))
    op.add_column("tickets", sa.Column("mobile_paid_by", sa.String(length=120), nullable=True))
    op.add_column("tickets", sa.Column("mobile_desired_date", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_desired_time", sa.String(length=40), nullable=True))
    op.add_column("tickets", sa.Column("mobile_payload", sa.JSON(), nullable=True))
    op.create_index(op.f("ix_tickets_mobile_workflow_step"), "tickets", ["mobile_workflow_step"], unique=False)
    op.create_index(op.f("ix_tickets_mobile_delivery_status"), "tickets", ["mobile_delivery_status"], unique=False)
    op.create_index(op.f("ix_tickets_mobile_room_no"), "tickets", ["mobile_room_no"], unique=False)
    op.create_index(op.f("ix_tickets_mobile_task_adder_id"), "tickets", ["mobile_task_adder_id"], unique=False)
    op.create_index(op.f("ix_tickets_mobile_priority_label"), "tickets", ["mobile_priority_label"], unique=False)
    op.create_index(op.f("ix_tickets_mobile_ticket_type"), "tickets", ["mobile_ticket_type"], unique=False)

    op.add_column(
        "inventory_items",
        sa.Column("mobile_available", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "mobile_chat_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("room_key", sa.String(length=160), nullable=False),
        sa.Column("chat_type", sa.String(length=20), nullable=False),
        sa.Column("sender_id", sa.String(length=40), nullable=False),
        sa.Column("receiver_id", sa.String(length=80), nullable=False),
        sa.Column("sender_name", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("system_marker", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mobile_chat_messages_hotel_id", "mobile_chat_messages", ["hotel_id"], unique=False)
    op.create_index("ix_mobile_chat_messages_room_key", "mobile_chat_messages", ["room_key"], unique=False)
    op.create_index("ix_mobile_chat_messages_chat_type", "mobile_chat_messages", ["chat_type"], unique=False)
    op.create_index("ix_mobile_chat_messages_sender_id", "mobile_chat_messages", ["sender_id"], unique=False)
    op.create_index("ix_mobile_chat_messages_receiver_id", "mobile_chat_messages", ["receiver_id"], unique=False)
    op.create_index(
        "ix_mobile_chat_hotel_room",
        "mobile_chat_messages",
        ["hotel_id", "room_key", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_mobile_chat_hotel_receiver",
        "mobile_chat_messages",
        ["hotel_id", "receiver_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_mobile_chat_hotel_receiver", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_hotel_room", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_messages_receiver_id", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_messages_sender_id", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_messages_chat_type", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_messages_room_key", table_name="mobile_chat_messages")
    op.drop_index("ix_mobile_chat_messages_hotel_id", table_name="mobile_chat_messages")
    op.drop_table("mobile_chat_messages")

    op.drop_column("inventory_items", "mobile_available")

    op.drop_index(op.f("ix_tickets_mobile_ticket_type"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_mobile_priority_label"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_mobile_task_adder_id"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_mobile_room_no"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_mobile_delivery_status"), table_name="tickets")
    op.drop_index(op.f("ix_tickets_mobile_workflow_step"), table_name="tickets")
    op.drop_column("tickets", "mobile_payload")
    op.drop_column("tickets", "mobile_desired_time")
    op.drop_column("tickets", "mobile_desired_date")
    op.drop_column("tickets", "mobile_paid_by")
    op.drop_column("tickets", "mobile_note")
    op.drop_column("tickets", "mobile_item_ordered")
    op.drop_column("tickets", "mobile_ticket_type")
    op.drop_column("tickets", "mobile_priority_label")
    op.drop_column("tickets", "mobile_task_adder_name")
    op.drop_column("tickets", "mobile_task_adder_id")
    op.drop_column("tickets", "mobile_guest_name")
    op.drop_column("tickets", "mobile_updated_room_no")
    op.drop_column("tickets", "mobile_room_no")
    op.drop_column("tickets", "mobile_delivery_status")
    op.drop_column("tickets", "mobile_workflow_step")

    op.drop_constraint("uq_users_hotel_employee_code", "users", type_="unique")
    op.drop_index(op.f("ix_users_employee_code"), table_name="users")
    op.drop_column("users", "deactivated_by")
    op.drop_column("users", "unseen_messages")
    op.drop_column("users", "online_for_chat")
    op.drop_column("users", "employee_code")
