from collections.abc import Generator
from contextvars import ContextVar
from time import perf_counter

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_query_stats: ContextVar[dict[str, float]] = ContextVar(
    "query_stats",
    default={"count": 0.0, "time_ms": 0.0},
)


def db_connect_args(database_url: str | None = None) -> dict[str, object]:
    url = database_url or settings.database_url
    if url.startswith("sqlite"):
        return {"check_same_thread": False}
    if "pooler.supabase.com:6543" in url:
        return {"prepare_threshold": None}
    return {}


engine = create_engine(
    settings.database_url,
    connect_args=db_connect_args(),
    pool_pre_ping=not settings.database_url.startswith("sqlite"),
)


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    context._arcadia_query_start = perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany) -> None:
    started_at = getattr(context, "_arcadia_query_start", None)
    stats = _query_stats.get()
    stats["count"] += 1
    if started_at is not None:
        stats["time_ms"] += (perf_counter() - started_at) * 1000


def reset_query_stats() -> None:
    _query_stats.set({"count": 0.0, "time_ms": 0.0})


def get_query_stats() -> tuple[int, float]:
    stats = _query_stats.get()
    return int(stats["count"]), stats["time_ms"]

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_tenant_context(db: Session, hotel_id: str) -> None:
    if db.get_bind().dialect.name != "postgresql":
        return
    db.execute(
        text("select set_config('app.current_hotel_id', :hotel_id, true)"),
        {"hotel_id": hotel_id},
    )


def init_db() -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
