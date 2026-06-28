import pytest
from fastapi import Request
from starlette.applications import Starlette
from starlette.responses import Response

from app.core import rate_limiter
from app.core.rate_limiter import RateLimitMiddleware


@pytest.mark.anyio
async def test_rate_limit_dispatch_tracks_non_hotel_routes_by_client_ip(monkeypatch) -> None:
    checked: list[tuple[str, str]] = []

    class FakeRateLimitService:
        def __init__(self, db) -> None:
            self.db = db

        def check(self, identifier: str, group: str) -> None:
            checked.append((identifier, group))

    class FakeDb:
        def close(self) -> None:
            pass

    monkeypatch.setattr(rate_limiter.settings, "rate_limit_enabled", True)
    monkeypatch.setattr(rate_limiter, "SessionLocal", lambda: FakeDb())
    monkeypatch.setattr(rate_limiter, "RateLimitService", FakeRateLimitService)

    middleware = _middleware()

    await middleware.dispatch(
        _request("/api/v1/auth/login", headers={"x-forwarded-for": "203.0.113.10"}),
        _ok_response,
    )
    await middleware.dispatch(
        _request("/api/v1/auth/login", headers={"x-forwarded-for": "203.0.113.11"}),
        _ok_response,
    )

    assert checked == [
        ("ip:203.0.113.10", "auth"),
        ("ip:203.0.113.11", "auth"),
    ]


def test_rate_limit_identifier_prefers_path_param_hotel_id() -> None:
    request = _request(
        "/api/v1/auth/login",
        headers={"x-forwarded-for": "203.0.113.10"},
        path_params={"hotel_id": "hotel-from-router"},
    )

    assert _middleware()._limit_identifier(request) == "hotel-from-router"


def test_rate_limit_identifier_uses_hotel_id_from_url_path_before_ip() -> None:
    request = _request(
        "/api/v1/hotels/hotel-from-path/tickets",
        headers={"x-forwarded-for": "203.0.113.10"},
    )

    assert _middleware()._limit_identifier(request) == "hotel-from-path"


def test_rate_limit_identifier_uses_forwarded_for_first_ip_for_non_hotel_routes() -> None:
    request = _request(
        "/api/v1/auth/login",
        headers={"x-forwarded-for": "203.0.113.25, 10.0.0.8"},
        client=("198.51.100.9", 1234),
    )

    assert _middleware()._limit_identifier(request) == "ip:203.0.113.25"


def test_rate_limit_identifier_falls_back_to_real_ip_for_non_hotel_routes() -> None:
    request = _request(
        "/api/v1/platform/auth/login",
        headers={"x-real-ip": "198.51.100.44"},
        client=("10.0.0.9", 1234),
    )

    assert _middleware()._limit_identifier(request) == "ip:198.51.100.44"


def test_rate_limit_identifier_falls_back_to_client_host_for_non_hotel_routes() -> None:
    request = _request("/api/v1/auth/login", client=("198.51.100.77", 1234))

    assert _middleware()._limit_identifier(request) == "ip:198.51.100.77"


def _middleware() -> RateLimitMiddleware:
    return RateLimitMiddleware(Starlette())


async def _ok_response(_: Request) -> Response:
    return Response()


def _request(
    path: str,
    headers: dict[str, str] | None = None,
    client: tuple[str, int] = ("127.0.0.1", 1234),
    path_params: dict[str, str] | None = None,
) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": path,
            "raw_path": path.encode(),
            "root_path": "",
            "scheme": "http",
            "query_string": b"",
            "headers": [
                (name.lower().encode(), value.encode())
                for name, value in (headers or {}).items()
            ],
            "client": client,
            "server": ("testserver", 80),
            "path_params": path_params or {},
        }
    )
