"""store media file data in db

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-14 01:30:00.000000
"""

import base64
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import context, op


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _legacy_file_payload(file_url: str | None) -> str | None:
    if not file_url or not file_url.startswith("/media/mobile/"):
        return None

    relative_name = file_url.removeprefix("/media/mobile/")
    media_root = (Path(__file__).resolve().parents[2] / "media" / "mobile").resolve()
    legacy_path = (media_root / relative_name).resolve()
    try:
        legacy_path.relative_to(media_root)
    except ValueError:
        return None
    if not legacy_path.is_file():
        return None
    return base64.b64encode(legacy_path.read_bytes()).decode("ascii")


def upgrade() -> None:
    op.add_column("media_files", sa.Column("file_data_base64", sa.Text(), nullable=True))

    if context.is_offline_mode():
        return

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, file_url
            FROM media_files
            WHERE file_data_base64 IS NULL
              AND file_url LIKE '/media/mobile/%'
            """
        )
    ).mappings()

    for row in rows:
        payload = _legacy_file_payload(row["file_url"])
        if not payload:
            continue
        bind.execute(
            sa.text(
                """
                UPDATE media_files
                SET file_data_base64 = :payload,
                    storage_provider = 'database'
                WHERE id = :id
                """
            ),
            {"id": row["id"], "payload": payload},
        )


def downgrade() -> None:
    op.drop_column("media_files", "file_data_base64")
