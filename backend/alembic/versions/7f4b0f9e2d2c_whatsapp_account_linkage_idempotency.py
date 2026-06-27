"""whatsapp account linkage idempotency

Revision ID: 7f4b0f9e2d2c
Revises: 2c9008cee828
Create Date: 2026-06-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f4b0f9e2d2c"
down_revision: Union[str, Sequence[str], None] = "2c9008cee828"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("whatsapp_sessions") as batch:
        batch.add_column(sa.Column("whatsapp_account_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_whatsapp_sessions_whatsapp_account_id",
            "whatsapp_accounts",
            ["whatsapp_account_id"],
            ["id"],
        )
        batch.create_index("ix_whatsapp_sessions_whatsapp_account_id", ["whatsapp_account_id"])

    with op.batch_alter_table("whatsapp_conversations") as batch:
        batch.add_column(sa.Column("whatsapp_account_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_whatsapp_conversations_whatsapp_account_id",
            "whatsapp_accounts",
            ["whatsapp_account_id"],
            ["id"],
        )
        batch.create_index("ix_whatsapp_conversations_whatsapp_account_id", ["whatsapp_account_id"])
        batch.create_index("ix_wa_conv_account_phone", ["whatsapp_account_id", "phone"])

    with op.batch_alter_table("whatsapp_messages") as batch:
        batch.add_column(sa.Column("whatsapp_account_id", sa.String(length=36), nullable=True))
        batch.create_foreign_key(
            "fk_whatsapp_messages_whatsapp_account_id",
            "whatsapp_accounts",
            ["whatsapp_account_id"],
            ["id"],
        )
        batch.create_index("ix_whatsapp_messages_whatsapp_account_id", ["whatsapp_account_id"])
        batch.create_index("ix_wa_msg_hotel_created", ["hotel_id", "created_at", "id"])
        batch.create_index("ix_wa_msg_hotel_meta_id", ["hotel_id", "meta_message_id"])
        batch.create_unique_constraint("uq_whatsapp_messages_meta_message_id", ["meta_message_id"])


def downgrade() -> None:
    with op.batch_alter_table("whatsapp_messages") as batch:
        batch.drop_constraint("uq_whatsapp_messages_meta_message_id", type_="unique")
        batch.drop_index("ix_wa_msg_hotel_meta_id")
        batch.drop_index("ix_wa_msg_hotel_created")
        batch.drop_index("ix_whatsapp_messages_whatsapp_account_id")
        batch.drop_constraint("fk_whatsapp_messages_whatsapp_account_id", type_="foreignkey")
        batch.drop_column("whatsapp_account_id")

    with op.batch_alter_table("whatsapp_conversations") as batch:
        batch.drop_index("ix_wa_conv_account_phone")
        batch.drop_index("ix_whatsapp_conversations_whatsapp_account_id")
        batch.drop_constraint("fk_whatsapp_conversations_whatsapp_account_id", type_="foreignkey")
        batch.drop_column("whatsapp_account_id")

    with op.batch_alter_table("whatsapp_sessions") as batch:
        batch.drop_index("ix_whatsapp_sessions_whatsapp_account_id")
        batch.drop_constraint("fk_whatsapp_sessions_whatsapp_account_id", type_="foreignkey")
        batch.drop_column("whatsapp_account_id")
