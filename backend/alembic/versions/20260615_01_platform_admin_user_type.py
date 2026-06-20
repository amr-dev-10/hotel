"""add platform admin layer and user type fields

Revision ID: 20260615_01
Revises:
Create Date: 2026-06-15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260615_01"
down_revision = None
branch_labels = None
depends_on = None


SOFT_DELETE_TABLES = (
    "departments",
    "guests",
    "hotels",
    "menu_categories",
    "menu_items",
    "room_types",
    "rooms",
    "reservations",
    "tickets",
    "users",
)


def upgrade() -> None:
    if not _table_exists("platform_admins"):
        op.create_table(
            "platform_admins",
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=False),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
    if not _index_exists("platform_admins", "ix_platform_admins_email"):
        op.create_index(op.f("ix_platform_admins_email"), "platform_admins", ["email"], unique=True)

    if not _table_exists("platform_settings"):
        op.create_table(
            "platform_settings",
            sa.Column("key", sa.String(length=120), nullable=False),
            sa.Column("value", sa.JSON(), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("updated_by", sa.String(length=36), nullable=True),
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("key", name="uq_platform_settings_key"),
        )
    if not _index_exists("platform_settings", "ix_platform_settings_key"):
        op.create_index(op.f("ix_platform_settings_key"), "platform_settings", ["key"], unique=False)

    for table in SOFT_DELETE_TABLES:
        if _table_exists(table) and not _column_exists(table, "is_deleted"):
            op.add_column(table, sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()))
        if _table_exists(table) and not _column_exists(table, "deleted_by"):
            op.add_column(table, sa.Column("deleted_by", sa.String(length=36), nullable=True))

    if not _column_exists("users", "user_type"):
        op.add_column(
            "users",
            sa.Column("user_type", sa.String(length=30), nullable=False, server_default="HOTEL_EMPLOYEE"),
        )
    op.execute(
        "UPDATE users SET user_type = 'HOTEL_ADMIN' "
        "WHERE is_hotel_owner = true OR staff_level = 'admin'"
    )
    if not _index_exists("users", "ix_users_user_type"):
        op.create_index(op.f("ix_users_user_type"), "users", ["user_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_users_user_type"), table_name="users")
    op.drop_column("users", "user_type")
    for table in reversed(SOFT_DELETE_TABLES):
        op.drop_column(table, "deleted_by")
        op.drop_column(table, "is_deleted")
    op.drop_index(op.f("ix_platform_settings_key"), table_name="platform_settings")
    op.drop_table("platform_settings")
    op.drop_index(op.f("ix_platform_admins_email"), table_name="platform_admins")
    op.drop_table("platform_admins")


def _table_exists(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _column_exists(table_name: str, column_name: str) -> bool:
    return column_name in {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)
    }


def _index_exists(table_name: str, index_name: str) -> bool:
    if not _table_exists(table_name):
        return False
    return index_name in {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)
    }
