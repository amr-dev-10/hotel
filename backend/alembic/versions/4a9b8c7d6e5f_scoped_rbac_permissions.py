"""Add scoped RBAC permission assignments

Revision ID: 4a9b8c7d6e5f
Revises: 91b7a4c6d8e2
Create Date: 2026-06-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4a9b8c7d6e5f"
down_revision: Union[str, Sequence[str], None] = "91b7a4c6d8e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if _table_exists("permissions"):
        if not _column_exists("permissions", "resource"):
            op.add_column("permissions", sa.Column("resource", sa.String(length=80), nullable=True))
        if not _column_exists("permissions", "action"):
            op.add_column("permissions", sa.Column("action", sa.String(length=80), nullable=True))
        _backfill_permission_parts()
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("permissions", "resource", existing_type=sa.String(length=80), nullable=False)
            op.alter_column("permissions", "action", existing_type=sa.String(length=80), nullable=False)
        if not _index_exists("permissions", "ix_permissions_resource"):
            op.create_index(op.f("ix_permissions_resource"), "permissions", ["resource"], unique=False)
        if not _index_exists("permissions", "ix_permissions_action"):
            op.create_index(op.f("ix_permissions_action"), "permissions", ["action"], unique=False)

    if _table_exists("role_permissions") and not _column_exists("role_permissions", "scope"):
        op.add_column(
            "role_permissions",
            sa.Column("scope", sa.String(length=20), nullable=False, server_default="hotel"),
        )
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("role_permissions", "scope", server_default=None)


def downgrade() -> None:
    if _table_exists("role_permissions") and _column_exists("role_permissions", "scope"):
        op.drop_column("role_permissions", "scope")

    if _table_exists("permissions"):
        if _index_exists("permissions", "ix_permissions_action"):
            op.drop_index(op.f("ix_permissions_action"), table_name="permissions")
        if _index_exists("permissions", "ix_permissions_resource"):
            op.drop_index(op.f("ix_permissions_resource"), table_name="permissions")
        if _column_exists("permissions", "action"):
            op.drop_column("permissions", "action")
        if _column_exists("permissions", "resource"):
            op.drop_column("permissions", "resource")


def _backfill_permission_parts() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("select id, code from permissions")).all()
    for permission_id, code in rows:
        resource, action = _split_code(code)
        bind.execute(
            sa.text("update permissions set resource = :resource, action = :action where id = :id"),
            {"id": permission_id, "resource": resource, "action": action},
        )


def _split_code(code: str) -> tuple[str, str]:
    if "." not in code:
        return code, "manage"
    return code.split(".", 1)


def _table_exists(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(column["name"] == column_name for column in inspector.get_columns(table_name))


def _index_exists(table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return any(index["name"] == index_name for index in inspector.get_indexes(table_name))
.