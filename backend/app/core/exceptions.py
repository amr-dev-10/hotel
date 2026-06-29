from typing import Any

from fastapi import HTTPException, status


class DomainError(Exception):
    def __init__(self, message: str, code: str = "domain_error") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


def error_detail(
    message: str,
    code: str,
    *,
    cause: str | None = None,
    hint: str | None = None,
    request_id: str | None = None,
    fields: list[dict[str, Any]] | None = None,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    detail: dict[str, Any] = {
        "message": message,
        "code": code,
    }
    if cause:
        detail["cause"] = cause
    if hint:
        detail["hint"] = hint
    if request_id:
        detail["request_id"] = request_id
    if fields:
        detail["fields"] = fields
    if context:
        detail["context"] = context
    return detail


def not_found(message: str = "Resource not found") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def forbidden(message: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def conflict(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)
