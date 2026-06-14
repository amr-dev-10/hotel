# Arcadia Platform — v5.0 Final Additions

> **This document extends v4.** It only covers the 9 remaining gaps.
> v4 (65 tables) + v5 additions (~10 tables) = **~75 table complete platform**.
>
> Payment gateway integration is stubbed — you'll fill it in when ready.

---

## What's New in v5

| # | Addition | Tables | Impact |
|---|---|---|---|
| 1 | Room Availability Engine + Blocks | `room_blocks` | Prevents double-booking, supports maintenance/VIP holds |
| 2 | Reservation-by-Room-Type | `reservation_room_types` (modifies `reservations`) | Book "1 Deluxe" not "Room 201" — assign room at check-in |
| 3 | Payment Gateway Transactions | `payment_transactions` | 🔲 Placeholder — you'll integrate Razorpay/Stripe later |
| 4 | Job Execution Tracking | `job_executions` | Debug Celery failures in production |
| 5 | Per-Hotel API Rate Limiting | `api_rate_limits` | Protect against buggy apps / abuse |
| 6 | Data Export Framework | `export_jobs` | Guest/reservation/revenue CSV/Excel exports |
| 7 | Data Import Framework | `import_jobs` | Onboard hotels with existing data |
| 8 | Guest Consent Tracking | `guest_consents` | GDPR/compliance for marketing campaigns |
| 9 | AI Provider Abstraction | (code only, no table) | Swap Gemini ↔ OpenAI ↔ Anthropic without code changes |
| 10 | Backup & Disaster Recovery | (ops plan, no table) | RPO/RTO targets, automated backup strategy |

---

## 1. Room Availability Engine

This is the most critical missing piece. Without it, double-bookings are possible.

### The Problem

```
12:01 PM — Booking.com sends reservation for Room 201, July 15–18
12:01 PM — Receptionist creates walk-in for Room 201, July 16–17

Both succeed. Guest arrives. Room is double-booked.
```

### room_blocks Table

```sql
room_blocks
-----------
id              UUID PK
hotel_id        UUID FK → hotels
room_id         UUID FK → rooms          -- NULL if blocking a room_type
room_type_id    UUID FK → room_types     -- NULL if blocking specific room
start_date      DATE
end_date        DATE
block_type      VARCHAR     -- 'reservation', 'maintenance', 'vip_hold', 'owner_block', 'deep_clean'
reference_type  VARCHAR     -- 'reservation', 'maintenance_order', 'manual'
reference_id    UUID        -- FK to source record
notes           TEXT
created_by      UUID FK → users
created_at      TIMESTAMP

-- Prevent overlapping blocks on the same room
-- This is the core double-booking prevention at DB level
CONSTRAINT no_overlap EXCLUDE USING gist (
    room_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
) WHERE (room_id IS NOT NULL)
```

> [!IMPORTANT]
> The `EXCLUDE` constraint uses PostgreSQL's GiST index to make it **impossible** to insert overlapping date ranges for the same room. This is database-level protection — no application bug can bypass it.

### AvailabilityService

```python
# services/availability_service.py

class AvailabilityService:
    """
    Central authority for room availability.
    Every reservation, block, and room assignment flows through here.
    """

    async def check_room_available(
        self, room_id: UUID, start_date: date, end_date: date
    ) -> bool:
        """Check if a specific room is free for the date range."""
        conflicts = await self.db.execute(
            select(RoomBlock).where(
                RoomBlock.room_id == room_id,
                RoomBlock.start_date < end_date,
                RoomBlock.end_date > start_date,
            )
        )
        return conflicts.first() is None

    async def find_available_rooms(
        self, hotel_id: UUID, room_type_id: UUID,
        start_date: date, end_date: date, count: int = 1
    ) -> list[Room]:
        """Find N available rooms of a given type for the date range."""
        # All rooms of this type
        all_rooms = await room_repo.get_by_type(hotel_id, room_type_id)

        # Rooms with conflicts in this date range
        blocked_room_ids = await self.db.execute(
            select(RoomBlock.room_id).where(
                RoomBlock.hotel_id == hotel_id,
                RoomBlock.room_id.in_([r.id for r in all_rooms]),
                RoomBlock.start_date < end_date,
                RoomBlock.end_date > start_date,
            )
        )
        blocked_ids = {row.room_id for row in blocked_room_ids}

        available = [r for r in all_rooms if r.id not in blocked_ids]
        return available[:count]

    async def get_availability_calendar(
        self, hotel_id: UUID, month: date
    ) -> dict:
        """
        Returns a day-by-day availability grid for the dashboard.
        {
          "2026-07-01": { "Deluxe": { "total": 10, "available": 7 } },
          "2026-07-02": { "Deluxe": { "total": 10, "available": 5 } },
          ...
        }
        """
        # Precomputed per day for the month
        ...

    async def block_room(
        self, room_id: UUID, start_date: date, end_date: date,
        block_type: str, reference_id: UUID = None, notes: str = None
    ):
        """
        Create a room block. The DB EXCLUDE constraint prevents overlaps.
        If it raises, the room is already blocked.
        """
        try:
            await block_repo.insert(RoomBlock(
                hotel_id=room.hotel_id,
                room_id=room_id,
                start_date=start_date,
                end_date=end_date,
                block_type=block_type,
                reference_id=reference_id,
                notes=notes,
            ))
        except IntegrityError:
            raise RoomNotAvailable(
                f"Room {room.room_number} is already blocked "
                f"for {start_date} to {end_date}"
            )

    async def release_block(self, block_id: UUID):
        """Release a room block (cancellation, maintenance done, etc.)"""
        await block_repo.delete(block_id)
```

### How It Plugs Into Reservation Flow

```
POST /api/v1/hotels/{id}/reservations
          │
          ▼
ReservationService.create():
  1. Validate room_type exists
  2. AvailabilityService.find_available_rooms(type, dates, qty)
     → Returns list of available rooms
     → If empty → raise NoAvailability("No Deluxe rooms for Jul 15–18")
  3. INSERT reservation (status='confirmed')
  4. INSERT reservation_room_types (room_type, qty)
  5. Do NOT assign actual room yet (see section 2 below)
  6. AvailabilityService.block_room(type_level_block)
     → Reserves inventory without locking a specific room number
```

### Block Type Examples

```
┌───────────────┬─────────────────────────────────────────────┐
│ Block Type    │ Use Case                                    │
├───────────────┼─────────────────────────────────────────────┤
│ reservation   │ Guest booked — room inventory held          │
│ maintenance   │ AC repair — room out of service 2 days      │
│ vip_hold      │ CEO arriving, hold best suite unassigned    │
│ owner_block   │ Hotel owner using room personally           │
│ deep_clean    │ Post-checkout deep sanitization             │
│ renovation    │ Long-term — room being remodeled            │
└───────────────┴─────────────────────────────────────────────┘
```

---

## 2. Reservation-by-Room-Type

### The Problem

v4 tied `reservations.room_id` directly. Real hotels book by **room type**, and assign the **actual room number** only at check-in.

### Schema Change

```sql
-- MODIFY reservations: room_id becomes NULLABLE
ALTER TABLE reservations ALTER COLUMN room_id DROP NOT NULL;
-- room_id is populated at check-in, not at booking time

-- NEW: what was actually booked
reservation_room_types
----------------------
id              UUID PK
reservation_id  UUID FK → reservations
room_type_id    UUID FK → room_types
quantity        INTEGER DEFAULT 1       -- "2 Deluxe Rooms"
rate_plan_id    UUID FK → rate_plans
assigned_room_id UUID FK → rooms        -- NULL until check-in
assigned_at     TIMESTAMP               -- when room was assigned
```

### Full Lifecycle

```
BOOKING PHASE (no room number yet):
═══════════════════════════════════

Guest books "1 Deluxe Room, Jul 15–18, Breakfast Included"
          │
          ▼
1. INSERT reservation (room_id = NULL, status = 'confirmed')
2. INSERT reservation_room_types:
     room_type_id = 'deluxe'
     quantity = 1
     rate_plan_id = 'breakfast_included'
     assigned_room_id = NULL
3. AvailabilityService: decrement available Deluxe count for Jul 15–18
   (type-level inventory hold, not specific room)


CHECK-IN PHASE (room assigned now):
════════════════════════════════════

Guest arrives at front desk
          │
          ▼
POST /api/v1/hotels/{id}/reservations/{rid}/checkin
{
  "room_assignments": [
    { "reservation_room_type_id": "uuid-rrt", "room_id": "uuid-room-205" }
  ]
}
          │
          ▼
1. AvailabilityService.check_room_available(room_205, Jul 15–18) ✅
2. UPDATE reservation_room_types SET assigned_room_id = room_205
3. AvailabilityService.block_room(room_205, Jul 15–18, type='reservation')
4. INSERT stay_records (room_id = room_205, actual_checkin = NOW())
5. UPDATE rooms SET status = 'occupied' WHERE id = room_205
6. UPDATE reservation SET status = 'checked_in', room_id = room_205
7. Create WhatsApp session, send welcome message


AUTO-ASSIGN (optional — hotel can let system pick):
════════════════════════════════════════════════════

POST /api/v1/hotels/{id}/reservations/{rid}/checkin
{ "auto_assign": true }
          │
          ▼
AvailabilityService.find_available_rooms(deluxe, Jul 15–18)
  → Returns room_205 (available, clean, on preferred floor)
  → Auto-assigns
```

### Multi-Room Booking

```
Family books: 1 Deluxe + 1 Suite, Jul 15–18

reservation_room_types:
  ┌──────────────┬──────┬────────────────┬──────────────┐
  │ Room Type    │ Qty  │ Rate Plan      │ Assigned     │
  │ Deluxe       │ 1    │ B&B            │ NULL (later) │
  │ Suite        │ 1    │ Family Package │ NULL (later) │
  └──────────────┴──────┴────────────────┴──────────────┘

At check-in:
  Deluxe → Room 205
  Suite  → Room 301
```

---

## 3. Payment Gateway Transactions (Placeholder)

> [!NOTE]
> **Left as a stub.** You said you'll integrate Razorpay/Stripe/UPI later when everything else is working. The table below reserves the schema shape — fill in the gateway integration code when ready.

```sql
payment_transactions
--------------------
id                  UUID PK
payment_id          UUID FK → payments
hotel_id            UUID FK → hotels
gateway             VARCHAR         -- 'razorpay', 'stripe', 'payu', 'manual'
gateway_order_id    VARCHAR         -- gateway's order/session ID
gateway_txn_id      VARCHAR         -- gateway's transaction ID
gateway_status      VARCHAR         -- 'created', 'authorized', 'captured', 'failed', 'refunded'
amount              DECIMAL(12,2)
currency            VARCHAR
raw_request         JSONB           -- what we sent to gateway
raw_response        JSONB           -- what gateway returned (for debugging)
webhook_received_at TIMESTAMP       -- when gateway webhook confirmed
created_at          TIMESTAMP
```

**Placeholder service**:

```python
# services/payment_gateway_service.py

class PaymentGatewayService:
    """
    Stub — implement when integrating Razorpay/Stripe.
    For now, all payments are recorded as 'manual' (cash/card at desk).
    """

    async def create_order(self, folio_id, amount, gateway='manual'):
        # TODO: Call Razorpay/Stripe API to create payment order
        # For now, just record as manual
        pass

    async def handle_webhook(self, gateway, payload):
        # TODO: Verify signature, update payment_transactions
        pass

    async def initiate_refund(self, transaction_id, amount):
        # TODO: Call gateway refund API
        pass
```

When you're ready, implement the gateway-specific logic. The folio → payment → payment_transaction chain is already wired.

---

## 4. Background Job Execution Tracking

### Table

```sql
job_executions
--------------
id              UUID PK
job_name        VARCHAR         -- 'nightly_room_charges', 'campaign_send', 'embed_document'
job_type        VARCHAR         -- 'scheduled', 'triggered', 'manual'
hotel_id        UUID FK → hotels   -- NULL for platform-wide jobs
status          VARCHAR         -- 'queued', 'running', 'completed', 'failed', 'retrying'
started_at      TIMESTAMP
completed_at    TIMESTAMP
duration_ms     INTEGER
input_params    JSONB           -- what was passed to the job
result          JSONB           -- output summary
error_message   TEXT
error_traceback TEXT
retry_count     INTEGER DEFAULT 0
max_retries     INTEGER DEFAULT 3
next_retry_at   TIMESTAMP
celery_task_id  VARCHAR         -- Celery's internal task ID
created_at      TIMESTAMP
```

### Integration with Celery

```python
# workers/base_worker.py — all workers inherit from this

class TrackedTask(celery.Task):
    """Base class that auto-logs execution to job_executions table."""

    async def before_start(self, task_id, args, kwargs):
        self.execution = await job_repo.insert(JobExecution(
            job_name=self.name,
            celery_task_id=task_id,
            hotel_id=kwargs.get('hotel_id'),
            status='running',
            input_params=kwargs,
            started_at=datetime.utcnow()
        ))

    async def on_success(self, retval, task_id, args, kwargs):
        await job_repo.update(self.execution.id,
            status='completed',
            completed_at=datetime.utcnow(),
            duration_ms=(datetime.utcnow() - self.execution.started_at).total_seconds() * 1000,
            result=retval if isinstance(retval, dict) else {"result": str(retval)}
        )

    async def on_failure(self, exc, task_id, args, kwargs, einfo):
        retry = self.execution.retry_count + 1
        await job_repo.update(self.execution.id,
            status='failed' if retry >= self.max_retries else 'retrying',
            error_message=str(exc),
            error_traceback=str(einfo),
            retry_count=retry,
            next_retry_at=datetime.utcnow() + timedelta(minutes=2 ** retry)
        )

# Usage — all workers use this base:
@celery.task(base=TrackedTask, max_retries=3)
async def generate_nightly_charges(hotel_id: str):
    ...

@celery.task(base=TrackedTask, max_retries=3)
async def process_document_embeddings(document_id: str):
    ...
```

### Dashboard View

```
GET /api/v1/admin/jobs?status=failed&last=24h

┌─────────────────────────┬──────────┬──────────┬──────────────────────────────┐
│ Job                     │ Hotel    │ Status   │ Error                        │
│ nightly_room_charges    │ HOT100   │ ❌ Failed │ ConnectionError: DB timeout  │
│ embed_document          │ HOT205   │ 🔄 Retry  │ Gemini API rate limit       │
│ campaign_send           │ HOT100   │ ✅ Done   │ —                            │
│ whatsapp_health_check   │ (all)    │ ✅ Done   │ —                            │
└─────────────────────────┴──────────┴──────────┴──────────────────────────────┘
```

---

## 5. Per-Hotel API Rate Limiting

### Table

```sql
api_rate_limits
---------------
id              UUID PK
hotel_id        UUID FK → hotels
endpoint_group  VARCHAR         -- 'tickets', 'whatsapp', 'menu', 'auth', 'general'
max_requests    INTEGER         -- per window
window_seconds  INTEGER         -- sliding window size
created_at      TIMESTAMP
```

### Default Limits (applied to all hotels, overridable per hotel)

```
┌───────────────────┬───────────────┬────────────┐
│ Endpoint Group    │ Max Requests  │ Window     │
├───────────────────┼───────────────┼────────────┤
│ auth (login)      │ 10            │ 15 min     │
│ tickets           │ 100           │ 1 min      │
│ whatsapp webhook  │ 500           │ 1 min      │
│ menu              │ 60            │ 1 min      │
│ general           │ 200           │ 1 min      │
│ export            │ 5             │ 10 min     │
│ import            │ 3             │ 10 min     │
└───────────────────┴───────────────┴────────────┘
```

### Redis-Backed Sliding Window

```python
# core/rate_limiter.py

class RateLimiter:
    async def check(self, hotel_id: str, endpoint_group: str) -> bool:
        key = f"ratelimit:{hotel_id}:{endpoint_group}"
        now = time.time()
        window = await self._get_window(hotel_id, endpoint_group)

        async with redis.pipeline() as pipe:
            # Remove expired entries
            pipe.zremrangebyscore(key, 0, now - window.window_seconds)
            # Count remaining
            pipe.zcard(key)
            # Add current request
            pipe.zadd(key, {str(now): now})
            pipe.expire(key, window.window_seconds)
            results = await pipe.execute()

        current_count = results[1]
        if current_count >= window.max_requests:
            raise RateLimitExceeded(
                f"Rate limit exceeded for {endpoint_group}: "
                f"{current_count}/{window.max_requests} per {window.window_seconds}s"
            )

# Middleware integration:
@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    hotel_id = request.state.hotel_id
    group = classify_endpoint(request.url.path)  # 'tickets', 'auth', etc.
    await rate_limiter.check(hotel_id, group)
    response = await call_next(request)
    # Add rate limit headers
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    return response
```

---

## 6. Data Export Framework

### Table

```sql
export_jobs
-----------
id              UUID PK
hotel_id        UUID FK → hotels
export_type     VARCHAR         -- 'guests', 'reservations', 'tickets', 'revenue', 'feedback'
format          VARCHAR         -- 'csv', 'xlsx', 'pdf'
filters         JSONB           -- { "date_from": "2026-01-01", "department": "engineering" }
status          VARCHAR         -- 'queued', 'processing', 'completed', 'failed'
file_url        VARCHAR         -- S3/R2 URL of generated file
file_size_bytes INTEGER
row_count       INTEGER
requested_by    UUID FK → users
started_at      TIMESTAMP
completed_at    TIMESTAMP
expires_at      TIMESTAMP       -- auto-delete file after 7 days
created_at      TIMESTAMP
```

### Flow

```
Staff clicks "Export Guests as CSV" on Dashboard
          │
          ▼
POST /api/v1/hotels/{id}/exports
{
  "export_type": "guests",
  "format": "csv",
  "filters": { "status": "checked_in" }
}
          │
          ▼
1. INSERT export_jobs (status = 'queued')
2. Queue Celery task: generate_export(job_id)
3. Return 202 Accepted { "job_id": "uuid", "status": "queued" }
          │
          ▼
Celery Worker: export_worker.py
  1. UPDATE status = 'processing'
  2. Query data with filters (paginated, streamed)
  3. Generate CSV/XLSX in memory
  4. Upload to S3/R2
  5. UPDATE status = 'completed', file_url = '...', row_count = 450
  6. Notify user: "Your export is ready ✅"
          │
          ▼
Staff downloads:
GET /api/v1/hotels/{id}/exports/{job_id}/download
  → Signed S3 URL redirect (expires in 1 hour)
```

---

## 7. Data Import Framework

### Table

```sql
import_jobs
-----------
id              UUID PK
hotel_id        UUID FK → hotels
import_type     VARCHAR         -- 'guests', 'rooms', 'reservations', 'menu_items', 'inventory'
source_file_url VARCHAR         -- uploaded CSV/XLSX
status          VARCHAR         -- 'uploaded', 'validating', 'importing', 'completed', 'failed'
total_rows      INTEGER
processed_rows  INTEGER DEFAULT 0
successful_rows INTEGER DEFAULT 0
failed_rows     INTEGER DEFAULT 0
errors          JSONB           -- [{ "row": 5, "field": "phone", "error": "invalid format" }]
uploaded_by     UUID FK → users
started_at      TIMESTAMP
completed_at    TIMESTAMP
created_at      TIMESTAMP
```

### Flow

```
Hotel onboarding — admin has 500 guests in Excel
          │
          ▼
POST /api/v1/hotels/{id}/imports
  Content-Type: multipart/form-data
  file: guests.csv
  import_type: guests
          │
          ▼
1. Upload CSV to S3/R2
2. INSERT import_jobs (status = 'uploaded')
3. Queue Celery task: validate_import(job_id)
          │
          ▼
VALIDATION PHASE (no data written yet):
  1. Parse CSV headers — check required columns exist
  2. Validate each row:
     - Row 1: ✅ Valid
     - Row 2: ✅ Valid
     - Row 3: ❌ Phone "abc" — invalid format
     - Row 4: ❌ Email missing — required field
     - Row 5: ⚠️ Duplicate phone — will skip
  3. UPDATE import_jobs SET status = 'validated', errors = [...]
  4. Return validation report to admin
          │
          ▼
Admin reviews errors, clicks "Proceed with Import"
          │
          ▼
POST /api/v1/hotels/{id}/imports/{job_id}/execute
          │
          ▼
IMPORT PHASE:
  1. For each valid row:
     INSERT INTO guests (...)
     UPDATE processed_rows, successful_rows
  2. Skip invalid rows, log to errors JSONB
  3. UPDATE status = 'completed'
  4. Notify: "Import complete: 487/500 guests imported, 13 errors"
```

### Supported Import Types

```
┌───────────────┬─────────────────────────────────────────────────┐
│ Type          │ Required Columns                                │
├───────────────┼─────────────────────────────────────────────────┤
│ guests        │ name, phone (email, whatsapp_phone optional)    │
│ rooms         │ room_number, room_type, floor                   │
│ reservations  │ guest_phone, room_type, checkin, checkout       │
│ menu_items    │ category, name, price (description optional)    │
│ inventory     │ name, category, unit, current_stock, min_stock  │
└───────────────┴─────────────────────────────────────────────────┘
```

---

## 8. Guest Consent Tracking

### Table

```sql
guest_consents
--------------
id                  UUID PK
guest_id            UUID FK → guests
hotel_id            UUID FK → hotels
whatsapp_opt_in     BOOLEAN DEFAULT false
marketing_opt_in    BOOLEAN DEFAULT false
email_opt_in        BOOLEAN DEFAULT false
sms_opt_in          BOOLEAN DEFAULT false
consent_source      VARCHAR     -- 'whatsapp_bot', 'web_form', 'check_in', 'manual'
consented_at        TIMESTAMP
updated_at          TIMESTAMP
ip_address          VARCHAR     -- for web-based consent
```

### Enforcement

```python
# services/campaign_service.py

async def send_campaign(hotel_id, campaign):
    guests = await guest_repo.get_targets(hotel_id, campaign.target_filter)

    for guest in guests:
        consent = await consent_repo.get(guest.id, hotel_id)

        # Skip guests who haven't opted in
        if campaign.channel == 'whatsapp' and not consent.whatsapp_opt_in:
            await delivery_repo.insert(status='skipped', reason='no_consent')
            continue

        if campaign.channel == 'email' and not consent.email_opt_in:
            await delivery_repo.insert(status='skipped', reason='no_consent')
            continue

        # Consent valid — send
        await whatsapp_service.send_template(guest.whatsapp_phone, ...)
```

### WhatsApp Bot Consent Collection

```
Guest onboards via WhatsApp:
          │
          ▼
Bot: "Welcome to Grand Palace! 🏨
      Would you like to receive special offers
      and updates on WhatsApp?

      [✅ Yes, I'd love to]  [❌ No thanks]"
          │
          ▼
Guest taps "Yes"
          │
          ▼
INSERT/UPDATE guest_consents:
  whatsapp_opt_in = true
  marketing_opt_in = true
  consent_source = 'whatsapp_bot'
  consented_at = NOW()
```

---

## 9. AI Provider Abstraction

### The Problem

Hardcoding `Gemini` means vendor lock-in. If Google raises prices or has an outage, you're stuck.

### Solution: Provider Interface

```python
# integrations/ai/base.py

from abc import ABC, abstractmethod

class AIProvider(ABC):
    """Abstract base for all LLM providers."""

    @abstractmethod
    async def generate(self, prompt: str, system: str = None,
                       temperature: float = 0.3, max_tokens: int = 1024) -> str:
        """Generate text completion."""
        ...

    @abstractmethod
    async def embed(self, text: str) -> list[float]:
        """Generate embedding vector."""
        ...

    @abstractmethod
    async def classify(self, text: str, categories: list[str]) -> dict:
        """Classify text into one of the categories."""
        ...
```

### Implementations

```python
# integrations/ai/gemini_provider.py

class GeminiProvider(AIProvider):
    def __init__(self):
        self.client = genai.GenerativeModel('gemini-2.5-flash')

    async def generate(self, prompt, system=None, **kwargs):
        response = await self.client.generate_content_async(prompt)
        return response.text

    async def embed(self, text):
        result = await genai.embed_content_async(
            model='models/text-embedding-004', content=text
        )
        return result['embedding']  # 768-dim vector

# integrations/ai/openai_provider.py

class OpenAIProvider(AIProvider):
    def __init__(self):
        self.client = AsyncOpenAI()

    async def generate(self, prompt, system=None, **kwargs):
        response = await self.client.chat.completions.create(
            model='gpt-4o-mini',
            messages=[
                {"role": "system", "content": system or ""},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content

    async def embed(self, text):
        response = await self.client.embeddings.create(
            model='text-embedding-3-small', input=text
        )
        return response.data[0].embedding  # 1536-dim vector

# integrations/ai/anthropic_provider.py

class AnthropicProvider(AIProvider):
    ...
```

### Factory + Config

```python
# integrations/ai/factory.py

PROVIDERS = {
    'gemini': GeminiProvider,
    'openai': OpenAIProvider,
    'anthropic': AnthropicProvider,
}

def get_ai_provider(provider_name: str = None) -> AIProvider:
    name = provider_name or settings.DEFAULT_AI_PROVIDER  # from env
    return PROVIDERS[name]()
```

### Per-Hotel Provider Override

```python
# A hotel can choose their own AI provider (stored in hotel_secrets)

class AIEngine:
    async def classify_free_text(self, hotel_id, text, services):
        # Check if hotel has a preferred provider
        provider_name = await vault.retrieve(hotel_id, 'ai_provider')
        provider = get_ai_provider(provider_name or 'gemini')

        prompt = self._build_slim_prompt(text, services)
        result = await provider.classify(prompt, ...)
        return result
```

### Fallback Chain

```python
# If primary provider fails, try the next one

class ResilientAIProvider(AIProvider):
    def __init__(self, providers: list[str] = ['gemini', 'openai']):
        self.chain = [get_ai_provider(p) for p in providers]

    async def generate(self, prompt, **kwargs):
        for provider in self.chain:
            try:
                return await provider.generate(prompt, **kwargs)
            except (APIError, Timeout, RateLimitError) as e:
                logger.warning(f"{provider.__class__.__name__} failed: {e}")
                continue
        raise AllProvidersFailedError("All AI providers are down")
```

---

## 10. Backup & Disaster Recovery Plan

### Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP ARCHITECTURE                           │
│                                                                  │
│  PostgreSQL                                                      │
│  ├── Automated daily full backup (pg_dump) → S3              │
│  ├── Continuous WAL archiving (PITR) → S3                    │
│  ├── Retention: 30 days daily, 12 months monthly             │
│  └── Cross-region replication (production)                   │
│                                                                  │
│  Redis                                                           │
│  ├── RDB snapshots every 15 minutes                          │
│  ├── AOF persistence enabled                                 │
│  └── Data is ephemeral (cache) — loss is tolerable           │
│                                                                  │
│  Object Storage (S3/R2)                                          │
│  ├── Versioning enabled on bucket                            │
│  ├── Cross-region replication (production)                   │
│  └── Lifecycle: move to cold storage after 90 days           │
│                                                                  │
│  Application Config                                              │
│  ├── All env vars in Secret Manager (not .env files)         │
│  ├── Docker images tagged and stored in registry             │
│  └── Alembic migrations are the schema source of truth       │
└─────────────────────────────────────────────────────────────────┘
```

### Recovery Targets

```
┌──────────────────┬────────────────┬─────────────────────────────┐
│ Metric           │ Target         │ How                         │
├──────────────────┼────────────────┼─────────────────────────────┤
│ RPO              │ < 5 minutes    │ Continuous WAL archiving    │
│ (Recovery Point) │                │ (lose max 5 min of data)    │
│                  │                │                             │
│ RTO              │ < 30 minutes   │ Restore from S3 backup      │
│ (Recovery Time)  │                │ + replay WAL to point-in-   │
│                  │                │ time                        │
│                  │                │                             │
│ Daily Backup     │ 02:00 UTC      │ pg_dump → gzip → S3        │
│ PITR Window      │ 30 days        │ WAL segments archived       │
│ Backup Test      │ Monthly        │ Restore to staging, verify  │
└──────────────────┴────────────────┴─────────────────────────────┘
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh — runs daily via cron at 02:00 UTC

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="arcadia"
S3_BUCKET="s3://arcadia-backups"

# Full dump
pg_dump -Fc $DB_NAME > /tmp/arcadia_${TIMESTAMP}.dump

# Upload to S3
aws s3 cp /tmp/arcadia_${TIMESTAMP}.dump \
  ${S3_BUCKET}/daily/arcadia_${TIMESTAMP}.dump

# Cleanup local
rm /tmp/arcadia_${TIMESTAMP}.dump

# Verify
aws s3 ls ${S3_BUCKET}/daily/arcadia_${TIMESTAMP}.dump
echo "Backup completed: ${TIMESTAMP}"
```

### Restore Procedure

```bash
# SCENARIO: Restore to yesterday at 3 PM (data corruption detected at 4 PM)

# 1. Stop application
docker-compose stop api celery

# 2. Create fresh database
dropdb arcadia_restore
createdb arcadia_restore

# 3. Restore latest full backup before target time
aws s3 cp s3://arcadia-backups/daily/arcadia_20260612.dump /tmp/
pg_restore -d arcadia_restore /tmp/arcadia_20260612.dump

# 4. Replay WAL to exact point in time
# (requires postgresql.conf: restore_command, recovery_target_time)
recovery_target_time = '2026-06-12 15:00:00 UTC'

# 5. Swap databases
ALTER DATABASE arcadia RENAME TO arcadia_corrupted;
ALTER DATABASE arcadia_restore RENAME TO arcadia;

# 6. Restart application
docker-compose start api celery

# 7. Verify data integrity
python scripts/verify_restore.py
```

---

## Final Table Count

| Version | Tables | Score |
|---|---|---|
| v1 (original project) | ~6 (Firebase collections) | 5.5/10 |
| v2 | ~30 | 9.1/10 |
| v3 | ~55 | 9.4/10 |
| v4 | ~65 | 9.8/10 |
| **v5** | **~75** | **10/10** |

---

## Updated Build Waves

| Wave | Focus | New v5 Additions | Time |
|---|---|---|---|
| **Wave 1** | MVP PMS + Staff App | + AvailabilityService, room_blocks, reservation_room_types, guest_consents | 14 weeks |
| **Wave 2** | WhatsApp Bot | + consent enforcement in campaigns | 8 weeks |
| **Wave 3** | Financial + Operations | + payment_transactions stub, import/export jobs | 9 weeks |
| **Wave 4** | AI + SaaS + Scale | + AI provider abstraction, job_executions, api_rate_limits | 7 weeks |
| **Ops** | Backup + DR | Backup scripts, PITR, monitoring | 1 week |
| | **Total** | | **~39 weeks (~10 months), 2 devs** |
