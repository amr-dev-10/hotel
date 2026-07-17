"""attendance v2 planning and execution

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-17 13:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shift_templates",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("code", sa.String(length=40), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("break_minutes", sa.Integer(), nullable=False),
        sa.Column("grace_minutes", sa.Integer(), nullable=False),
        sa.Column("late_after_minutes", sa.Integer(), nullable=False),
        sa.Column("is_night_shift", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "code", name="uq_shift_templates_hotel_code"),
    )
    op.create_index(op.f("ix_shift_templates_hotel_id"), "shift_templates", ["hotel_id"], unique=False)
    op.create_index(op.f("ix_shift_templates_is_active"), "shift_templates", ["is_active"], unique=False)

    op.create_table(
        "employee_shift_assignments",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("employee_id", sa.String(length=36), nullable=False),
        sa.Column("shift_template_id", sa.String(length=36), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("working_days", sa.JSON(), nullable=False),
        sa.Column("rotation_type", sa.String(length=40), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.ForeignKeyConstraint(["shift_template_id"], ["shift_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_employee_shift_assignments_effective_from"), "employee_shift_assignments", ["effective_from"], unique=False)
    op.create_index(op.f("ix_employee_shift_assignments_effective_to"), "employee_shift_assignments", ["effective_to"], unique=False)
    op.create_index(op.f("ix_employee_shift_assignments_employee_id"), "employee_shift_assignments", ["employee_id"], unique=False)
    op.create_index(op.f("ix_employee_shift_assignments_hotel_id"), "employee_shift_assignments", ["hotel_id"], unique=False)
    op.create_index(op.f("ix_employee_shift_assignments_is_active"), "employee_shift_assignments", ["is_active"], unique=False)
    op.create_index(op.f("ix_employee_shift_assignments_shift_template_id"), "employee_shift_assignments", ["shift_template_id"], unique=False)
    op.create_index(
        "ix_shift_assignments_hotel_active",
        "employee_shift_assignments",
        ["hotel_id", "is_active"],
        unique=False,
    )
    op.create_index(
        "ix_shift_assignments_hotel_employee_dates",
        "employee_shift_assignments",
        ["hotel_id", "employee_id", "effective_from", "effective_to"],
        unique=False,
    )

    op.create_table(
        "attendance_logs",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("employee_id", sa.String(length=36), nullable=False),
        sa.Column("attendance_date", sa.Date(), nullable=False),
        sa.Column("shift_assignment_id", sa.String(length=36), nullable=True),
        sa.Column("shift_template_id", sa.String(length=36), nullable=True),
        sa.Column("shift_name", sa.String(length=120), nullable=True),
        sa.Column("scheduled_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attendance_status", sa.String(length=40), nullable=False),
        sa.Column("arrival_status", sa.String(length=40), nullable=False),
        sa.Column("leave_status", sa.String(length=40), nullable=False),
        sa.Column("worked_minutes", sa.Integer(), nullable=False),
        sa.Column("late_minutes", sa.Integer(), nullable=False),
        sa.Column("early_leave_minutes", sa.Integer(), nullable=False),
        sa.Column("overtime_minutes", sa.Integer(), nullable=False),
        sa.Column("checkin_method", sa.String(length=40), nullable=True),
        sa.Column("checkout_method", sa.String(length=40), nullable=True),
        sa.Column("device_info", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=True),
        sa.Column("gps_location", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["employee_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.ForeignKeyConstraint(["shift_assignment_id"], ["employee_shift_assignments.id"]),
        sa.ForeignKeyConstraint(["shift_template_id"], ["shift_templates.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "employee_id", "attendance_date", name="uq_attendance_logs_employee_date"),
    )
    op.create_index(op.f("ix_attendance_logs_attendance_date"), "attendance_logs", ["attendance_date"], unique=False)
    op.create_index(op.f("ix_attendance_logs_attendance_status"), "attendance_logs", ["attendance_status"], unique=False)
    op.create_index(op.f("ix_attendance_logs_employee_id"), "attendance_logs", ["employee_id"], unique=False)
    op.create_index(op.f("ix_attendance_logs_hotel_id"), "attendance_logs", ["hotel_id"], unique=False)
    op.create_index("ix_attendance_logs_hotel_date", "attendance_logs", ["hotel_id", "attendance_date"], unique=False)
    op.create_index(
        "ix_attendance_logs_hotel_employee_date",
        "attendance_logs",
        ["hotel_id", "employee_id", "attendance_date"],
        unique=False,
    )

    op.create_table(
        "hotel_holidays",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "date", name="uq_hotel_holidays_hotel_date"),
    )
    op.create_index(op.f("ix_hotel_holidays_date"), "hotel_holidays", ["date"], unique=False)
    op.create_index(op.f("ix_hotel_holidays_hotel_id"), "hotel_holidays", ["hotel_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_hotel_holidays_hotel_id"), table_name="hotel_holidays")
    op.drop_index(op.f("ix_hotel_holidays_date"), table_name="hotel_holidays")
    op.drop_table("hotel_holidays")

    op.drop_index("ix_attendance_logs_hotel_employee_date", table_name="attendance_logs")
    op.drop_index("ix_attendance_logs_hotel_date", table_name="attendance_logs")
    op.drop_index(op.f("ix_attendance_logs_hotel_id"), table_name="attendance_logs")
    op.drop_index(op.f("ix_attendance_logs_employee_id"), table_name="attendance_logs")
    op.drop_index(op.f("ix_attendance_logs_attendance_status"), table_name="attendance_logs")
    op.drop_index(op.f("ix_attendance_logs_attendance_date"), table_name="attendance_logs")
    op.drop_table("attendance_logs")

    op.drop_index("ix_shift_assignments_hotel_employee_dates", table_name="employee_shift_assignments")
    op.drop_index("ix_shift_assignments_hotel_active", table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_shift_template_id"), table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_is_active"), table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_hotel_id"), table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_employee_id"), table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_effective_to"), table_name="employee_shift_assignments")
    op.drop_index(op.f("ix_employee_shift_assignments_effective_from"), table_name="employee_shift_assignments")
    op.drop_table("employee_shift_assignments")

    op.drop_index(op.f("ix_shift_templates_is_active"), table_name="shift_templates")
    op.drop_index(op.f("ix_shift_templates_hotel_id"), table_name="shift_templates")
    op.drop_table("shift_templates")
