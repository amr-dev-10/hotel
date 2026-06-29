from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import DomainError, error_detail

logger = logging.getLogger(__name__)


def register_error_handlers(app) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(IntegrityError, integrity_error_handler)
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = _request_id(request)
    detail = _normalize_detail(
        exc.detail,
        status_code=exc.status_code,
        request_id=request_id,
    )
    return _error_response(exc.status_code, detail, headers=getattr(exc, "headers", None))


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = _request_id(request)
    fields = [
        {
            "field": ".".join(str(part) for part in error.get("loc", []) if part != "body"),
            "message": str(error.get("msg", "Invalid value")),
            "type": str(error.get("type", "validation_error")),
        }
        for error in exc.errors()
    ]
    detail = error_detail(
        "Request validation failed.",
        "request_validation_failed",
        cause="One or more submitted fields are missing or invalid.",
        hint="Review the highlighted fields and try again.",
        request_id=request_id,
        fields=fields,
    )
    return _error_response(status.HTTP_422_UNPROCESSABLE_ENTITY, detail)


async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    request_id = _request_id(request)
    detail, status_code = _integrity_detail(exc, request_id)
    logger.warning(
        "Database integrity error",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "error_code": detail["code"],
            "constraint": detail.get("context", {}).get("constraint"),
        },
    )
    return _error_response(status_code, detail)


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    request_id = _request_id(request)
    detail = error_detail(exc.message, exc.code, request_id=request_id)
    return _error_response(status.HTTP_400_BAD_REQUEST, detail)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = _request_id(request)
    logger.exception(
        "Unhandled request exception",
        extra={"request_id": request_id, "path": request.url.path},
    )
    detail = error_detail(
        "Unexpected server error.",
        "internal_server_error",
        cause="The server hit an unexpected condition while processing the request.",
        hint="Retry once. If it continues, share the request id with support.",
        request_id=request_id,
    )
    return _error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, detail)


def _request_id(request: Request) -> str:
    request_id = request.headers.get("x-request-id")
    if request_id:
        return request_id[:120]
    return f"req_{uuid4().hex[:12]}"


def _normalize_detail(
    detail: Any,
    *,
    status_code: int,
    request_id: str,
) -> dict[str, Any]:
    if isinstance(detail, dict):
        message = str(detail.get("message") or detail.get("detail") or _default_message(status_code))
        code = str(detail.get("code") or _default_code(status_code))
        normalized = dict(detail)
        normalized["message"] = message
        normalized["code"] = code
        normalized["request_id"] = str(normalized.get("request_id") or request_id)
        return normalized

    message = str(detail or _default_message(status_code))
    return error_detail(
        message,
        _default_code(status_code),
        cause=_default_cause(status_code),
        hint=_default_hint(status_code),
        request_id=request_id,
    )


def _integrity_detail(exc: IntegrityError, request_id: str) -> tuple[dict[str, Any], int]:
    constraint = _constraint_name(exc)
    original = str(getattr(exc, "orig", exc))

    if constraint == "uq_whatsapp_conversation_guest":
        return (
            error_detail(
                "WhatsApp conversation is already linked.",
                "whatsapp_conversation_duplicate_guest",
                cause="This guest already has another WhatsApp conversation in the same hotel.",
                hint="Open the existing conversation and remove its profile link, then retry.",
                request_id=request_id,
                context={"constraint": constraint},
            ),
            status.HTTP_409_CONFLICT,
        )

    if constraint:
        return (
            error_detail(
                "Duplicate record.",
                "database_unique_violation",
                cause="A record with the same unique values already exists.",
                hint="Check the existing record and retry with a different value.",
                request_id=request_id,
                context={"constraint": constraint},
            ),
            status.HTTP_409_CONFLICT,
        )

    if "unique constraint" in original.lower() or "unique violation" in original.lower():
        return (
            error_detail(
                "Duplicate record.",
                "database_unique_violation",
                cause="A record with the same unique values already exists.",
                hint="Check the existing record and retry with a different value.",
                request_id=request_id,
            ),
            status.HTTP_409_CONFLICT,
        )

    return (
        error_detail(
            "Database integrity error.",
            "database_integrity_error",
            cause="The requested change conflicts with existing database rules.",
            hint="Review related records and try again.",
            request_id=request_id,
        ),
        status.HTTP_409_CONFLICT,
    )


def _constraint_name(exc: IntegrityError) -> str | None:
    diag = getattr(getattr(exc, "orig", None), "diag", None)
    constraint = getattr(diag, "constraint_name", None)
    if constraint:
        return str(constraint)

    text = str(getattr(exc, "orig", exc))
    known_constraints = [
        "uq_whatsapp_conversation_guest",
        "uq_guest_consent",
        "uq_reservation_guest",
        "uq_whatsapp_messages_meta_message_id",
        "uq_whatsapp_account_hotel_phone_id",
    ]
    lower_text = text.lower()
    for known in known_constraints:
        if known.lower() in lower_text:
            return known
    return None


def _error_response(
    status_code: int,
    detail: dict[str, Any],
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    response_headers = dict(headers or {})
    response_headers["X-Request-ID"] = str(detail["request_id"])
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": detail["message"],
            "detail": detail,
        },
        headers=response_headers,
    )


def _default_code(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "request_validation_failed",
        429: "rate_limited",
    }.get(status_code, f"http_{status_code}")


def _default_message(status_code: int) -> str:
    return {
        400: "Bad request.",
        401: "Authentication required.",
        403: "Access denied.",
        404: "Resource not found.",
        409: "Conflict.",
        422: "Request validation failed.",
        429: "Too many requests.",
    }.get(status_code, "Request failed.")


def _default_cause(status_code: int) -> str | None:
    return {
        400: "The request could not be understood by the server.",
        401: "Your session is missing or expired.",
        403: "Your role does not allow this action.",
        404: "The requested record could not be found.",
        409: "The requested change conflicts with an existing record.",
        429: "This action has been attempted too frequently.",
    }.get(status_code)


def _default_hint(status_code: int) -> str | None:
    return {
        400: "Check the submitted values and try again.",
        401: "Sign in again and retry.",
        403: "Ask an owner or role admin to update your permissions.",
        404: "Refresh the page and confirm the record still exists.",
        409: "Review the related record and retry.",
        429: "Wait a moment before trying again.",
    }.get(status_code)
