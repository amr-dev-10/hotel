from time import perf_counter

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import get_query_stats, reset_query_stats


class PerformanceMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        reset_query_stats()
        started_at = perf_counter()
        response = await call_next(request)
        query_count, query_time_ms = get_query_stats()
        response.headers["X-Process-Time-ms"] = f"{(perf_counter() - started_at) * 1000:.2f}"
        response.headers["X-DB-Query-Count"] = str(query_count)
        response.headers["X-DB-Query-Time-ms"] = f"{query_time_ms:.2f}"
        return response
