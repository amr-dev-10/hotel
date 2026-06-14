from collections import defaultdict, deque
from time import time

from sqlalchemy.orm import Session

from app.core.exceptions import forbidden
from app.models.ops import ApiRateLimit
from app.repositories.ops_repository import ApiRateLimitRepository
from app.schemas.platform import ApiRateLimitUpsert


DEFAULT_RATE_LIMITS = {
    "auth": (10, 900),
    "tickets": (100, 60),
    "whatsapp": (500, 60),
    "menu": (60, 60),
    "general": (200, 60),
    "export": (5, 600),
    "import": (3, 600),
}

_WINDOWS: dict[tuple[str, str], deque[float]] = defaultdict(deque)


class RateLimitService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.limits = ApiRateLimitRepository(db)

    def seed_defaults(self, hotel_id: str) -> None:
        for group, (max_requests, window_seconds) in DEFAULT_RATE_LIMITS.items():
            if not self.limits.get_for_group(hotel_id, group):
                self.db.add(
                    ApiRateLimit(
                        hotel_id=hotel_id,
                        endpoint_group=group,
                        max_requests=max_requests,
                        window_seconds=window_seconds,
                    )
                )
        self.db.flush()

    def upsert(self, hotel_id: str, payload: ApiRateLimitUpsert) -> ApiRateLimit:
        limit = self.limits.get_for_group(hotel_id, payload.endpoint_group)
        if not limit:
            limit = ApiRateLimit(hotel_id=hotel_id, **payload.model_dump())
            self.db.add(limit)
        else:
            limit.max_requests = payload.max_requests
            limit.window_seconds = payload.window_seconds
        self.db.commit()
        self.db.refresh(limit)
        return limit

    def check(self, hotel_id: str, endpoint_group: str) -> None:
        limit = self.limits.get_for_group(hotel_id, endpoint_group)
        max_requests, window_seconds = DEFAULT_RATE_LIMITS.get(endpoint_group, DEFAULT_RATE_LIMITS["general"])
        if limit:
            max_requests = limit.max_requests
            window_seconds = limit.window_seconds
        now = time()
        key = (hotel_id, endpoint_group)
        bucket = _WINDOWS[key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= max_requests:
            raise forbidden("API rate limit exceeded")
        bucket.append(now)
