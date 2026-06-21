"""Add ticket categories and category-aware SLA/escalation links

Revision ID: 8c9d2e4f1a70
Revises: f3b8c6a2d941
Create Date: 2026-06-22 12:00:00.000000

"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "8c9d2e4f1a70"
down_revision: Union[str, Sequence[str], None] = "f3b8c6a2d941"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_TICKET_CATEGORIES = [
    ("guest_request", "Guest Request", "front_office", "General guest request from WhatsApp, portal, or dashboard.", 15, 2, 2),
    ("complaint", "Complaint", "front_office", "Guest complaint requiring faster supervisory attention.", 10, 2, 4),
    ("taxi_booking", "Taxi Booking", "front_office", "Taxi, cab, or airport transfer request.", 10, 2, 2),
    ("luggage_assist", "Luggage Assist", "front_office", "Bell desk or luggage movement support.", 10, 2, 2),
    ("housekeeping", "Housekeeping", "housekeeping", "General room housekeeping request.", 20, 2, 2),
    ("towel_request", "Towel Request", "housekeeping", "Extra towel or bath linen request.", 10, 2, 2),
    ("drinking_water", "Drinking Water", "housekeeping", "Water bottle or drinking water request.", 10, 2, 2),
    ("extra_pillow", "Extra Pillow", "housekeeping", "Extra pillow request.", 10, 2, 2),
    ("extra_blanket", "Extra Blanket", "housekeeping", "Extra blanket request.", 10, 2, 2),
    ("occupied_clean", "Occupied Room Cleaning", "housekeeping", "Cleaning request while guest is in-house.", 13, 2, 2),
    ("checkout_clean", "Checkout Cleaning", "housekeeping", "Room cleaning after checkout.", 45, 5, 2),
    ("maintenance", "Maintenance", "engineering", "General maintenance or repair request.", 20, 2, 3),
    ("ac_repair", "AC Repair", "engineering", "Air-conditioning not cooling or not working.", 20, 2, 3),
    ("plumbing", "Plumbing", "engineering", "Leak, flush, tap, or bathroom plumbing issue.", 30, 5, 3),
    ("electrical", "Electrical", "engineering", "Electrical issue in room or public area.", 25, 3, 3),
    ("tv_repair", "TV Repair", "engineering", "Television repair request.", 20, 2, 2),
    ("room_service", "Room Service", "food_beverage", "In-room dining service request.", 45, 3, 2),
    ("food_order", "Food Order", "food_beverage", "Food order service.", 45, 3, 2),
    ("drink_order", "Drink Order", "food_beverage", "Drink or beverage order.", 20, 2, 2),
]


def upgrade() -> None:
    if not _table_exists("ticket_categories"):
        op.create_table(
            "ticket_categories",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("hotel_id", sa.String(length=36), sa.ForeignKey("hotels.id"), nullable=False, index=True),
            sa.Column("department_id", sa.String(length=36), sa.ForeignKey("departments.id"), nullable=True, index=True),
            sa.Column("key", sa.String(length=80), nullable=False, index=True),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("default_priority", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("sla_minutes", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("accept_timeout_minutes", sa.Integer(), nullable=False, server_default="2"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true(), index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("hotel_id", "key", name="uq_ticket_category_hotel_key"),
        )
        op.create_index("ix_ticket_category_hotel_dept", "ticket_categories", ["hotel_id", "department_id"])

    category_columns = (
        ("tickets", "task_category_id"),
        ("task_type_slas", "ticket_category_id"),
        ("escalation_rules", "task_category_id"),
    )
    for table_name, column_name in category_columns:
        if _table_exists(table_name) and not _column_exists(table_name, column_name):
            op.add_column(table_name, sa.Column(column_name, sa.String(length=36), nullable=True))
            op.create_index(f"ix_{table_name}_{column_name}", table_name, [column_name])

    _seed_categories()
    _backfill_category_links()


def downgrade() -> None:
    category_columns = (
        ("escalation_rules", "task_category_id"),
        ("task_type_slas", "ticket_category_id"),
        ("tickets", "task_category_id"),
    )
    for table_name, column_name in category_columns:
        index_name = f"ix_{table_name}_{column_name}"
        if _table_exists(table_name) and _index_exists(table_name, index_name):
            op.drop_index(index_name, table_name=table_name)
        if _table_exists(table_name) and _column_exists(table_name, column_name):
            op.drop_column(table_name, column_name)
    if _table_exists("ticket_categories"):
        op.drop_index("ix_ticket_category_hotel_dept", table_name="ticket_categories")
        op.drop_table("ticket_categories")


def _seed_categories() -> None:
    bind = op.get_bind()
    now = datetime.now(UTC)
    hotels = bind.execute(sa.text("select id from hotels")).mappings().all()
    for hotel in hotels:
        departments = bind.execute(
            sa.text("select id, key from departments where hotel_id = :hotel_id and deleted_at is null"),
            {"hotel_id": hotel["id"]},
        ).mappings().all()
        department_ids = {row["key"]: row["id"] for row in departments}
        for key, name, department_key, description, sla_minutes, accept_timeout, priority in DEFAULT_TICKET_CATEGORIES:
            department_id = department_ids.get(department_key)
            if not department_id:
                continue
            exists = bind.execute(
                sa.text("select id from ticket_categories where hotel_id = :hotel_id and key = :key"),
                {"hotel_id": hotel["id"], "key": key},
            ).scalar()
            if exists:
                continue
            bind.execute(
                sa.text(
                    """
                    insert into ticket_categories
                    (id, hotel_id, department_id, key, name, description, default_priority,
                     sla_minutes, accept_timeout_minutes, is_active, created_at, updated_at)
                    values
                    (:id, :hotel_id, :department_id, :key, :name, :description, :default_priority,
                     :sla_minutes, :accept_timeout_minutes, true, :created_at, :updated_at)
                    """
                ),
                {
                    "id": str(uuid4()),
                    "hotel_id": hotel["id"],
                    "department_id": department_id,
                    "key": key,
                    "name": name,
                    "description": description,
                    "default_priority": priority,
                    "sla_minutes": sla_minutes,
                    "accept_timeout_minutes": accept_timeout,
                    "created_at": now,
                    "updated_at": now,
                },
            )


def _backfill_category_links() -> None:
    bind = op.get_bind()
    categories = bind.execute(
        sa.text("select id, hotel_id, department_id, key from ticket_categories")
    ).mappings().all()
    by_scope = {(row["hotel_id"], row["department_id"], row["key"]): row["id"] for row in categories}
    for table_name, column_name in (
        ("tickets", "task_category_id"),
        ("task_type_slas", "ticket_category_id"),
        ("escalation_rules", "task_category_id"),
    ):
        if not _table_exists(table_name) or not _column_exists(table_name, column_name):
            continue
        rows = bind.execute(
            sa.text(
                f"""
                select id, hotel_id, department_id, task_category
                from {table_name}
                where {column_name} is null and task_category is not null
                """
            )
        ).mappings().all()
        for row in rows:
            category_id = by_scope.get((row["hotel_id"], row["department_id"], row["task_category"]))
            if not category_id:
                continue
            bind.execute(
                sa.text(f"update {table_name} set {column_name} = :category_id where id = :id"),
                {"category_id": category_id, "id": row["id"]},
            )


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))
