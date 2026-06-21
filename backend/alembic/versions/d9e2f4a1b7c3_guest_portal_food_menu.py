"""Add guest portal food menu fields

Revision ID: d9e2f4a1b7c3
Revises: c2f4a6d8e901
Create Date: 2026-06-21 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e2f4a1b7c3"
down_revision: Union[str, Sequence[str], None] = "c2f4a6d8e901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not _column_exists("menu_items", "description_short"):
        op.add_column("menu_items", sa.Column("description_short", sa.String(length=255), nullable=True))
    if not _column_exists("menu_items", "dietary_tags"):
        op.add_column(
            "menu_items",
            sa.Column("dietary_tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        )
    if not _column_exists("restaurant_orders", "ordered_by_guest"):
        op.add_column(
            "restaurant_orders",
            sa.Column("ordered_by_guest", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if not _table_exists("menu_item_taxes"):
        op.create_table(
            "menu_item_taxes",
            sa.Column("menu_item_id", sa.String(length=36), nullable=False),
            sa.Column("tax_config_id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["menu_item_id"], ["menu_items.id"], name="fk_menu_item_taxes_menu_item_id"),
            sa.ForeignKeyConstraint(["tax_config_id"], ["tax_configs.id"], name="fk_menu_item_taxes_tax_config_id"),
            sa.PrimaryKeyConstraint("menu_item_id", "tax_config_id", name="pk_menu_item_taxes"),
        )

    if not _table_exists("guest_portal_tokens"):
        op.create_table(
            "guest_portal_tokens",
            sa.Column("hotel_id", sa.String(length=36), nullable=False),
            sa.Column("guest_id", sa.String(length=36), nullable=False),
            sa.Column("reservation_id", sa.String(length=36), nullable=False),
            sa.Column("room_id", sa.String(length=36), nullable=True),
            sa.Column("token_hash", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.ForeignKeyConstraint(["guest_id"], ["guests.id"], name="fk_guest_portal_tokens_guest_id"),
            sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"], name="fk_guest_portal_tokens_hotel_id"),
            sa.ForeignKeyConstraint(["reservation_id"], ["reservations.id"], name="fk_guest_portal_tokens_reservation_id"),
            sa.ForeignKeyConstraint(["room_id"], ["rooms.id"], name="fk_guest_portal_tokens_room_id"),
            sa.PrimaryKeyConstraint("id", name="pk_guest_portal_tokens"),
        )
        op.create_index("ix_guest_portal_tokens_guest_id", "guest_portal_tokens", ["guest_id"], unique=False)
        op.create_index("ix_guest_portal_tokens_hotel_id", "guest_portal_tokens", ["hotel_id"], unique=False)
        op.create_index("ix_guest_portal_tokens_reservation_id", "guest_portal_tokens", ["reservation_id"], unique=False)
        op.create_index("ix_guest_portal_tokens_token_hash", "guest_portal_tokens", ["token_hash"], unique=True)


def downgrade() -> None:
    if _table_exists("guest_portal_tokens"):
        op.drop_index("ix_guest_portal_tokens_token_hash", table_name="guest_portal_tokens")
        op.drop_index("ix_guest_portal_tokens_reservation_id", table_name="guest_portal_tokens")
        op.drop_index("ix_guest_portal_tokens_hotel_id", table_name="guest_portal_tokens")
        op.drop_index("ix_guest_portal_tokens_guest_id", table_name="guest_portal_tokens")
        op.drop_table("guest_portal_tokens")

    if _table_exists("menu_item_taxes"):
        op.drop_table("menu_item_taxes")

    if _column_exists("restaurant_orders", "ordered_by_guest"):
        op.drop_column("restaurant_orders", "ordered_by_guest")
    if _column_exists("menu_items", "dietary_tags"):
        op.drop_column("menu_items", "dietary_tags")
    if _column_exists("menu_items", "description_short"):
        op.drop_column("menu_items", "description_short")


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))
