from __future__ import annotations

import base64
import json
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Generic, TypeVar

from sqlalchemy import Select, and_, or_

ModelT = TypeVar("ModelT")


@dataclass(frozen=True)
class CursorResult(Generic[ModelT]):
    items: Sequence[ModelT]
    next_cursor: str | None
    has_more: bool
    limit: int


def apply_created_at_cursor(statement: Select, model: type, cursor: str | None) -> Select:
    if not cursor:
        return statement
    created_at, item_id = decode_cursor(cursor)
    return statement.where(
        or_(
            model.created_at < created_at,
            and_(model.created_at == created_at, model.id < item_id),
        )
    )


def paginate_created_at_desc(rows: Sequence[ModelT], limit: int) -> CursorResult[ModelT]:
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = None
    if has_more and items:
        last = items[-1]
        next_cursor = encode_cursor(last.created_at, last.id)
    return CursorResult(items=items, next_cursor=next_cursor, has_more=has_more, limit=limit)


def encode_cursor(created_at: datetime, item_id: str) -> str:
    payload = json.dumps(
        {"created_at": created_at.isoformat(), "id": item_id},
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    padding = "=" * (-len(cursor) % 4)
    try:
        raw = base64.urlsafe_b64decode(f"{cursor}{padding}".encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
        return datetime.fromisoformat(payload["created_at"]), str(payload["id"])
    except Exception as exc:
        raise ValueError("Invalid pagination cursor") from exc
