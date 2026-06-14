from typing import Any


def ok(data: Any = None, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True, "data": data}
    if meta is not None:
        payload["meta"] = meta
    return payload
