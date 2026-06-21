"""Fix task SLA ticket category column name

Revision ID: 91b7a4c6d8e2
Revises: 8c9d2e4f1a70
Create Date: 2026-06-22 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "91b7a4c6d8e2"
down_revision: Union[str, Sequence[str], None] = "8c9d2e4f1a70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if _table_exists("task_type_slas") and not _column_exists("task_type_slas", "ticket_category_id"):
        op.add_column("task_type_slas", sa.Column("ticket_category_id", sa.String(length=36), nullable=True))
        op.create_index("ix_task_type_slas_ticket_category_id", "task_type_slas", ["ticket_category_id"])
    _backfill_task_slas()
    if _table_exists("task_type_slas") and _column_exists("task_type_slas", "task_category_id"):
        if _index_exists("task_type_slas", "ix_task_type_slas_task_category_id"):
            op.drop_index("ix_task_type_slas_task_category_id", table_name="task_type_slas")
        op.drop_column("task_type_slas", "task_category_id")


def downgrade() -> None:
    if _table_exists("task_type_slas") and _index_exists("task_type_slas", "ix_task_type_slas_ticket_category_id"):
        op.drop_index("ix_task_type_slas_ticket_category_id", table_name="task_type_slas")
    if _table_exists("task_type_slas") and _column_exists("task_type_slas", "ticket_category_id"):
        op.drop_column("task_type_slas", "ticket_category_id")


def _backfill_task_slas() -> None:
    if not (
        _table_exists("task_type_slas")
        and _table_exists("ticket_categories")
        and _column_exists("task_type_slas", "ticket_category_id")
    ):
        return
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            select id, hotel_id, department_id, task_category
            from task_type_slas
            where ticket_category_id is null and task_category is not null
            """
        )
    ).mappings().all()
    for row in rows:
        category_id = bind.execute(
            sa.text(
                """
                select id
                from ticket_categories
                where hotel_id = :hotel_id
                  and department_id = :department_id
                  and key = :key
                limit 1
                """
            ),
            {
                "hotel_id": row["hotel_id"],
                "department_id": row["department_id"],
                "key": row["task_category"],
            },
        ).scalar()
        if category_id:
            bind.execute(
                sa.text("update task_type_slas set ticket_category_id = :category_id where id = :id"),
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
