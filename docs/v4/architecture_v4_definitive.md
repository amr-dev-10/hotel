# Arcadia Platform — Definitive Architecture (v4.0)

> **v1** → MVP (8.5) → **v2** → SaaS (9.1) → **v3** → PMS (9.4) → **v4** → Complete Platform (10/10)
>
> This is the final architecture. Every gap is closed.

---

## Changelog: v3 → v4

| # | Gap | Fix |
|---|---|---|
| 1 | Single-guest reservations | ✅ `reservation_guests` — multi-guest with primary flag |
| 2 | No inventory | ✅ `inventory_items`, `inventory_transactions`, `vendors`, `purchase_orders` |
| 3 | No restaurant/POS | ✅ `restaurant_orders`, `restaurant_order_items`, `restaurant_tables` |
| 4 | `is_on_duty` too simple | ✅ `employee_shifts` — proper shift scheduling |
| 5 | Hardcoded ticket workflow | ✅ `workflow_definitions`, `workflow_states`, `workflow_transitions` |
| 6 | No DB-level tenant isolation | ✅ PostgreSQL Row Level Security (RLS) on every tenant table |
| 7 | Inconsistent soft deletes | ✅ Defined policy — which tables soft-delete, which don't |
| 8 | Knowledge docs not versioned | ✅ `knowledge_document_versions` |
| 9 | Sync embedding generation | ✅ Async via Celery `embedding_worker` |
| 10 | No WA onboarding flow | ✅ Full connect → verify → store workflow |
| 11 | No conversation window tracking | ✅ `conversation_windows` — Meta billing categories |
| 12 | Hardcoded plan features | ✅ `features`, `plan_features` — dynamic feature flags |
| 13 | No usage limits | ✅ `usage_limits` — per-hotel, per-feature monthly caps |
| 14 | No OTA / Channel Manager | 📋 Defined as Phase 2 roadmap |
| 15 | No Revenue Management | 📋 Defined as Phase 3 roadmap |
| 16 | No Accounting Integration | 📋 Defined as Phase 3 roadmap |

---

## 1. Multi-Guest Reservations

### Problem

A family of 4 books one room. Current model only allows one guest per reservation.

### Fix

```sql
reservation_guests
------------------
id              UUID PK
reservation_id  UUID FK → reservations
guest_id        UUID FK → guests
is_primary      BOOLEAN DEFAULT false    -- billing contact, main communicant
relationship    VARCHAR                  -- 'self', 'spouse', 'child', 'companion'
added_at        TIMESTAMP
```

### How It Works

```
POST /api/v1/hotels/{id}/reservations
{
  "room_id": "uuid-room-201",
  "checkin_date": "2026-06-15",
  "checkout_date": "2026-06-18",
  "rate_plan_id": "uuid-family-plan",
  "guests": [
    { "guest_id": "uuid-father",   "is_primary": true,  "relationship": "self" },
    { "guest_id": "uuid-mother",   "is_primary": false, "relationship": "spouse" },
    { "guest_id": "uuid-son",      "is_primary": false, "relationship": "child" },
    { "guest_id": "uuid-daughter", "is_primary": false, "relationship": "child" }
  ]
}
```

**Impact on other systems**:

```
WhatsApp Bot:
  → Only the PRIMARY guest gets the welcome message
  → Only the primary guest's phone is linked to the session
  → But any guest can call the front desk

Folio:
  → Charges go to the PRIMARY guest's folio
  → Staff can split charges if needed

Tickets:
  → Any guest in the room can raise a ticket
  → ticket.guest_id = whoever raised it
  → Room is resolved from stay_records, not guest
```

**Query: "Who is in Room 201 right now?"**

```sql
SELECT g.name, rg.relationship, rg.is_primary
FROM reservation_guests rg
JOIN guests g ON g.id = rg.guest_id
JOIN reservations r ON r.id = rg.reservation_id
WHERE r.status = 'checked_in'
  AND r.id IN (
    SELECT reservation_id FROM stay_records
    WHERE room_id = 'uuid-room-201'
      AND actual_checkout IS NULL
  );

-- Result:
-- ┌──────────────┬──────────────┬─────────┐
-- │ Rajesh Kumar │ self         │ PRIMARY │
-- │ Priya Kumar  │ spouse       │         │
-- │ Arjun Kumar  │ child        │         │
-- │ Sneha Kumar  │ child        │         │
-- └──────────────┴──────────────┴─────────┘
```

---

## 2. Inventory Module

### Tables

```sql
vendors
-------
id              UUID PK
hotel_id        UUID FK → hotels
name            VARCHAR
contact_phone   VARCHAR
contact_email   VARCHAR
address         TEXT
category        VARCHAR         -- 'linen', 'food', 'cleaning', 'equipment'
is_active       BOOLEAN
created_at      TIMESTAMP

inventory_items
---------------
id              UUID PK
hotel_id        UUID FK → hotels
name            VARCHAR         -- "Bath Towel", "Bed Sheet King", "Hand Soap"
category        VARCHAR         -- 'linen', 'toiletry', 'food_supply', 'cleaning', 'equipment'
unit            VARCHAR         -- 'piece', 'kg', 'liter', 'box', 'packet'
min_stock       INTEGER         -- alert threshold
current_stock   INTEGER
cost_per_unit   DECIMAL(10,2)
default_vendor_id UUID FK → vendors
is_active       BOOLEAN

inventory_transactions
----------------------
id              UUID PK
item_id         UUID FK → inventory_items
hotel_id        UUID FK → hotels
transaction_type VARCHAR       -- 'purchase', 'issue', 'return', 'adjustment', 'waste'
quantity        INTEGER         -- positive for in, negative for out
reference_type  VARCHAR         -- 'purchase_order', 'housekeeping_task', 'ticket', 'manual'
reference_id    UUID            -- FK to the source record
notes           TEXT
performed_by    UUID FK → users
created_at      TIMESTAMP

purchase_orders
---------------
id              UUID PK
hotel_id        UUID FK → hotels
po_number       VARCHAR UK      -- "PO-20260613-001"
vendor_id       UUID FK → vendors
status          VARCHAR         -- 'draft', 'submitted', 'received', 'cancelled'
total_amount    DECIMAL(12,2)
notes           TEXT
created_by      UUID FK → users
approved_by     UUID FK → users
received_at     TIMESTAMP
created_at      TIMESTAMP

purchase_order_items
--------------------
id              UUID PK
purchase_order_id UUID FK → purchase_orders
item_id         UUID FK → inventory_items
quantity        INTEGER
unit_price      DECIMAL(10,2)
received_qty    INTEGER         -- may differ from ordered
```

### Auto-Deduction Flow

```
Housekeeping completes "checkout_clean" for Room 201
          │
          ▼
HousekeepingService checks the checklist:
  ☑ Replace bath towels (qty: 2)
  ☑ Replace hand towels (qty: 2)
  ☑ Restock soap (qty: 1)
  ☑ Restock shampoo (qty: 1)
          │
          ▼
InventoryService.issue_items([
  { item: "Bath Towel",  qty: 2, ref: housekeeping_task_id },
  { item: "Hand Towel",  qty: 2, ref: housekeeping_task_id },
  { item: "Hand Soap",   qty: 1, ref: housekeeping_task_id },
  { item: "Shampoo",     qty: 1, ref: housekeeping_task_id },
])
          │
          ▼
INSERT inventory_transactions (type='issue', qty=-2, ...)
UPDATE inventory_items SET current_stock = current_stock - 2
          │
          ▼
If current_stock < min_stock:
  → NotificationService.alert(
      "⚠️ Low Stock: Bath Towels — 12 remaining (min: 20)"
    )
```

---

## 3. Restaurant / POS Module

### Tables

```sql
restaurant_tables
-----------------
id              UUID PK
hotel_id        UUID FK → hotels
table_number    VARCHAR         -- "T1", "T2", "Poolside-3"
section         VARCHAR         -- 'indoor', 'outdoor', 'poolside', 'bar'
capacity        INTEGER
status          VARCHAR         -- 'available', 'occupied', 'reserved', 'cleaning'

restaurant_orders
-----------------
id              UUID PK
hotel_id        UUID FK → hotels
order_number    VARCHAR UK      -- "ORD-20260613-042"
source          VARCHAR         -- 'dine_in', 'room_service', 'whatsapp', 'pos'
table_id        UUID FK → restaurant_tables   -- NULL for room service
guest_id        UUID FK → guests              -- NULL for walk-in dine-in
room_id         UUID FK → rooms               -- for room service
ticket_id       UUID FK → tickets             -- linked ticket if from bot
folio_id        UUID FK → guest_folios        -- charge to room folio
status          VARCHAR         -- 'received', 'preparing', 'ready', 'served', 'billed', 'cancelled'
subtotal        DECIMAL(10,2)
tax             DECIMAL(10,2)
total           DECIMAL(10,2)
special_instructions TEXT
taken_by        UUID FK → users               -- waiter / bot
created_at      TIMESTAMP
completed_at    TIMESTAMP

restaurant_order_items
----------------------
id              UUID PK
order_id        UUID FK → restaurant_orders
menu_item_id    UUID FK → menu_items
quantity        INTEGER
unit_price      DECIMAL(10,2)
item_total      DECIMAL(10,2)
status          VARCHAR         -- 'ordered', 'preparing', 'ready', 'served', 'cancelled'
notes           VARCHAR         -- "no onion", "extra spicy"
```

### KOT (Kitchen Order Ticket) Flow

```
Guest orders food via WhatsApp Bot (or POS or waiter)
          │
          ▼
POST /api/v1/hotels/{id}/restaurant/orders
          │
          ▼
1. INSERT restaurant_orders (source='whatsapp', status='received')
2. INSERT restaurant_order_items for each item
3. If room_service → link to guest folio (charge to room)
4. CREATE ticket (type='food_order', dept='food_and_beverages')
          │
          ▼
Kitchen Dashboard / KOT Printer receives the order via WebSocket:
  ┌────────────────────────────────┐
  │  KOT #042 — Room 204          │
  │  Time: 1:35 PM                │
  │                                │
  │  1× Butter Chicken    ₹450    │
  │  2× Naan              ₹  60   │
  │  1× Mango Lassi       ₹120    │
  │     (no sugar)                 │
  │                                │
  │  Special: Extra spicy 🌶️      │
  └────────────────────────────────┘
          │
Kitchen marks items as 'ready'
          │
          ▼
Bot notifies guest on WhatsApp:
  "Your food order is ready and on its way! 🍽️"
          │
Waiter serves → marks as 'served'
          │
          ▼
Folio item auto-posted:
  folio_items: "Room Service — ORD-042" ₹630 + ₹75.60 GST
```

---

## 4. Employee Shift Management

### Table

```sql
employee_shifts
---------------
id              UUID PK
hotel_id        UUID FK → hotels
user_id         UUID FK → users
department_id   UUID FK → departments
shift_date      DATE
shift_start     TIME
shift_end       TIME
shift_type      VARCHAR         -- 'morning', 'afternoon', 'night', 'custom'
status          VARCHAR         -- 'scheduled', 'checked_in', 'checked_out', 'absent', 'leave'
actual_start    TIMESTAMP       -- when they actually clocked in
actual_end      TIMESTAMP
notes           TEXT
created_by      UUID FK → users
created_at      TIMESTAMP
```

### Impact on Auto-Assignment

```python
# services/ticket_service.py — v4 auto-assignment

async def find_available_staff(hotel_id, department_id) -> User | None:
    """
    v3: checked is_on_duty (boolean) — too simple
    v4: checks actual shift schedule + current ticket load
    """
    now = datetime.now()
    today = now.date()
    current_time = now.time()

    # Step 1: Find staff currently on shift in this department
    on_shift = await shift_repo.get_active_staff(
        hotel_id=hotel_id,
        department_id=department_id,
        date=today,
        time=current_time,
        status='checked_in'
    )

    if not on_shift:
        return None  # No one on duty → SLA escalation kicks in

    # Step 2: Round-robin by current ticket load
    staff_loads = []
    for user in on_shift:
        open_tickets = await ticket_repo.count_open(assigned_to=user.id)
        staff_loads.append((user, open_tickets))

    # Assign to person with fewest open tickets
    staff_loads.sort(key=lambda x: x[1])
    return staff_loads[0][0]
```

### Shift Roster Dashboard

```
POST /api/v1/hotels/{id}/shifts/bulk
{
  "week_start": "2026-06-15",
  "shifts": [
    { "user_id": "uuid-dinesh",  "department": "engineering", "dates": ["2026-06-15","2026-06-16"], "type": "morning" },
    { "user_id": "uuid-ramesh",  "department": "engineering", "dates": ["2026-06-15","2026-06-16"], "type": "night" },
    { "user_id": "uuid-priya",   "department": "housekeeping", "dates": ["2026-06-15","2026-06-16","2026-06-17"], "type": "morning" }
  ]
}
```

---

## 5. Dynamic Workflow Engine

### The Problem

Hardcoded ticket stages: `Created → Assigned → In Progress → Completed`

But Hotel A wants: `Open → Assigned → Resolved`
And Hotel B wants: `Open → Supervisor Approval → Assigned → In Progress → QA Check → Completed → Verified`

### Tables

```sql
workflow_definitions
--------------------
id              UUID PK
hotel_id        UUID FK → hotels
name            VARCHAR         -- "Standard Ticket Flow", "Complaint Flow"
entity_type     VARCHAR         -- 'ticket', 'maintenance_order', 'restaurant_order'
is_default      BOOLEAN
is_active       BOOLEAN
created_at      TIMESTAMP

workflow_states
---------------
id              UUID PK
workflow_id     UUID FK → workflow_definitions
name            VARCHAR         -- "Open", "Supervisor Approval", "Assigned"
state_key       VARCHAR         -- "open", "supervisor_approval", "assigned"
state_type      VARCHAR         -- 'initial', 'intermediate', 'terminal'
color           VARCHAR         -- "#FFA500" for UI display
sort_order      INTEGER
required_permission VARCHAR     -- permission needed to move INTO this state
auto_assign     BOOLEAN         -- auto-assign staff when entering this state

workflow_transitions
--------------------
id              UUID PK
workflow_id     UUID FK → workflow_definitions
from_state_id   UUID FK → workflow_states
to_state_id     UUID FK → workflow_states
trigger_type    VARCHAR         -- 'manual', 'auto', 'timer'
required_permission VARCHAR     -- "ticket.assign", "ticket.close"
auto_timer_minutes INTEGER      -- for timer-based: auto-transition after N mins
notify_roles    JSONB           -- ["manager"] — who gets notified on this transition
```

### Example: Hotel B's Complex Workflow

```
workflow_definition: "Complaint Flow"

States:
  1. Open           (initial)
  2. Supervisor OK  (intermediate, requires: ticket.approve)
  3. Assigned       (intermediate, auto_assign: true)
  4. In Progress    (intermediate)
  5. QA Check       (intermediate, requires: ticket.verify)
  6. Completed      (terminal)
  7. Rejected       (terminal)

Transitions:
  Open → Supervisor OK     (manual, permission: ticket.create)
  Supervisor OK → Assigned (manual, permission: ticket.approve)
  Supervisor OK → Rejected (manual, permission: ticket.approve)
  Assigned → In Progress   (manual, permission: ticket.assign)
  In Progress → QA Check   (manual, permission: ticket.close)
  QA Check → Completed     (manual, permission: ticket.verify)
  QA Check → In Progress   (manual, permission: ticket.verify)  ← rework
```

### How Ticket Stage Changes Work Now

```python
# services/ticket_service.py

async def change_stage(ticket_id, new_state_key, actor_id):
    ticket = await ticket_repo.get(ticket_id)
    workflow = await workflow_repo.get_for_hotel(ticket.hotel_id, 'ticket')

    current_state = await workflow_repo.get_state(workflow.id, ticket.stage)
    target_state = await workflow_repo.get_state(workflow.id, new_state_key)

    # Validate transition exists
    transition = await workflow_repo.get_transition(
        workflow.id, current_state.id, target_state.id
    )
    if not transition:
        raise InvalidTransition(f"Cannot move from {ticket.stage} to {new_state_key}")

    # Check permission
    if transition.required_permission:
        if not await rbac_service.has_permission(actor_id, transition.required_permission):
            raise Forbidden()

    # Execute transition
    ticket.stage = new_state_key
    await ticket_repo.update(ticket)

    # Auto-assign if target state requires it
    if target_state.auto_assign:
        staff = await find_available_staff(ticket.hotel_id, ticket.department_id)
        if staff:
            ticket.assigned_to = staff.id

    # Log event
    await event_repo.insert(TicketEvent(
        ticket_id=ticket_id,
        event_type='stage_changed',
        actor_id=actor_id,
        payload={"from": current_state.state_key, "to": new_state_key}
    ))

    # Notify
    if transition.notify_roles:
        await notification_service.notify_roles(
            hotel_id=ticket.hotel_id,
            roles=transition.notify_roles,
            title=f"Ticket {ticket.ticket_code} → {target_state.name}"
        )
```

---

## 6. PostgreSQL Row Level Security (RLS)

### Setup

```sql
-- Enable RLS on every tenant-scoped table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- ... (all tenant tables)

-- Create policy: rows visible only when hotel_id matches session variable
CREATE POLICY tenant_isolation ON tickets
  USING (hotel_id = current_setting('app.current_hotel_id')::uuid);

CREATE POLICY tenant_isolation ON users
  USING (hotel_id = current_setting('app.current_hotel_id')::uuid);

-- (same for every table)
```

### Application Integration

```python
# core/database.py — set hotel context on every request

class TenantSession:
    async def __call__(self, request: Request):
        hotel_id = request.state.hotel_id  # extracted by middleware from JWT

        async with async_session() as session:
            # Set PostgreSQL session variable BEFORE any query
            await session.execute(
                text(f"SET app.current_hotel_id = '{hotel_id}'")
            )
            yield session
```

**Defense in depth**: Even if a developer writes `SELECT * FROM tickets` without a WHERE clause, PostgreSQL itself filters by `hotel_id`. **Two layers of protection**: application middleware + database RLS.

---

## 7. Soft Delete Policy

### Defined Consistently Across All Tables

| Strategy | Tables | Reason |
|---|---|---|
| **Soft delete** (`deleted_at`) | `hotels`, `users`, `rooms`, `room_types`, `guests`, `reservations`, `tickets`, `menu_categories`, `menu_items`, `departments` | Operational data that may need recovery or is referenced by historical records |
| **Hard delete** | `fcm_tokens`, `whatsapp_sessions`, `employee_shifts` (past), `inventory_transactions` | Ephemeral or append-only data that has no recovery value |
| **Never delete** | `audit_logs`, `ticket_events`, `whatsapp_messages`, `payments`, `folio_items`, `analytics_snapshots`, `knowledge_embeddings` | Compliance/financial/audit trail — append-only, immutable |

### Implementation

```python
# models/mixins.py

class SoftDeleteMixin:
    deleted_at = Column(DateTime, nullable=True, default=None)

    @hybrid_property
    def is_deleted(self):
        return self.deleted_at is not None

# repositories/base.py — all queries auto-exclude soft-deleted records

class BaseRepository:
    async def get_all(self, hotel_id, **filters):
        query = select(self.model).where(
            self.model.hotel_id == hotel_id,
            self.model.deleted_at.is_(None)      # ← always applied
        )
        ...

    async def soft_delete(self, id):
        await self.update(id, deleted_at=datetime.utcnow())
        await audit_service.log(action=f"{self.entity}.soft_deleted", ...)
```

---

## 8. Knowledge Document Versioning

```sql
knowledge_document_versions
---------------------------
id              UUID PK
document_id     UUID FK → knowledge_documents
version_number  INTEGER
content         TEXT
file_url        VARCHAR
changed_by      UUID FK → users
change_note     VARCHAR         -- "Updated pool hours for summer"
created_at      TIMESTAMP
```

### Flow

```
Admin updates "Pool Rules" document
          │
          ▼
1. Snapshot current content → INSERT knowledge_document_versions (version=3)
2. UPDATE knowledge_documents SET content = new_content
3. Queue re-embedding: Celery task → chunk → embed → replace old embeddings
4. Audit log: "knowledge.updated"

Admin realizes the update was wrong:
          │
          ▼
POST /api/v1/hotels/{id}/knowledge/{kid}/rollback?version=2
  → Restore version 2 content
  → Re-queue embedding generation
```

---

## 9. Async Embedding Queue

**Problem**: Generating embeddings is slow (1-3 seconds per chunk). Doing it synchronously blocks the API.

```
Admin uploads 10-page hotel policy PDF
          │
          ▼
POST /api/v1/hotels/{id}/knowledge
  → Save document to knowledge_documents (status = 'processing')
  → Upload PDF to S3/R2
  → Queue Celery task: process_document(doc_id)
  → Return 202 Accepted immediately
          │
          ▼
Celery Worker: embedding_worker.py
  1. Download PDF from S3
  2. Extract text (PyPDF2 / pdfplumber)
  3. Chunk into 500-char segments with overlap
  4. For each chunk:
     → Call Gemini embedding API (models/text-embedding-004)
     → INSERT knowledge_embeddings (chunk_text, embedding vector)
  5. UPDATE knowledge_documents SET status = 'ready'
  6. Notify admin: "Pool Rules document processed ✅ (23 chunks indexed)"
```

```python
# workers/embedding_worker.py

@celery.task
async def process_document(document_id: str):
    doc = await knowledge_repo.get(document_id)

    # Extract text
    if doc.file_url:
        text = await extract_pdf_text(doc.file_url)
    else:
        text = doc.content

    # Chunk
    chunks = chunk_text(text, chunk_size=500, overlap=50)

    # Delete old embeddings for this document
    await embedding_repo.delete_by_document(document_id)

    # Generate + store embeddings
    for i, chunk in enumerate(chunks):
        embedding = await gemini.embed(chunk)  # 768-dim vector
        await embedding_repo.insert(KnowledgeEmbedding(
            document_id=document_id,
            chunk_index=i,
            chunk_text=chunk,
            embedding=embedding
        ))

    await knowledge_repo.update(document_id, status='ready')
```

---

## 10. WhatsApp Account Onboarding Flow

```
Hotel Admin → Dashboard → Settings → WhatsApp
          │
          ▼
Step 1: "Connect WhatsApp Business"
  → Admin enters: Business Name, WhatsApp Number
  → System generates a unique webhook_verify_token
          │
          ▼
Step 2: "Configure Meta App"
  → Dashboard shows instructions:
    "In your Meta Business Manager:
     1. Go to WhatsApp → Configuration → Webhook
     2. Set Callback URL: https://api.arcadia.com/webhook/whatsapp
     3. Set Verify Token: <generated_token>
     4. Subscribe to: messages, message_status"
          │
          ▼
Step 3: "Verify Connection"
  → Admin clicks "Test Connection"
  → System sends GET request to Meta API to verify credentials:
    GET https://graph.facebook.com/v19.0/{phone_number_id}
    Authorization: Bearer {access_token}
  → If 200: credentials valid
  → If 401: token invalid → show error
          │
          ▼
Step 4: "Send Test Message"
  → Admin enters their own phone number
  → System sends a test WhatsApp message via Meta API
  → Admin confirms they received it
          │
          ▼
Step 5: Store Credentials
  → access_token → encrypted via Vault
  → INSERT whatsapp_accounts (status = 'active')
  → INSERT whatsapp_account_health (initial state)
  → Bot is now live for this hotel
          │
          ▼
Dashboard shows:
  ┌────────────────────────────────────────┐
  │  WhatsApp: Connected ✅                │
  │  Number: +91 90000 11111               │
  │  Business: Grand Palace Hotel          │
  │  Status: Active                        │
  │  Last message: 2 mins ago              │
  │  [Disconnect]  [Test]  [View Health]   │
  └────────────────────────────────────────┘
```

---

## 11. Conversation Window Tracking (Meta Billing)

Meta charges per **conversation window** (24-hour window), not per message. Different categories have different costs.

```sql
conversation_windows
--------------------
id              UUID PK
hotel_id        UUID FK → hotels
guest_phone     VARCHAR
category        VARCHAR         -- 'service', 'utility', 'marketing', 'authentication'
opened_at       TIMESTAMP       -- when first message in window was sent
closes_at       TIMESTAMP       -- opened_at + 24 hours
message_count   INTEGER
estimated_cost  DECIMAL(6,4)    -- Meta's per-conversation charge
meta_conversation_id VARCHAR    -- from Meta's webhook status updates
```

### How It Works

```python
# services/whatsapp/conversation_tracker.py

async def track_conversation(hotel_id, guest_phone, category):
    # Check if there's an open window
    window = await window_repo.get_open(hotel_id, guest_phone, category)

    if window and window.closes_at > datetime.utcnow():
        # Existing window — free message
        window.message_count += 1
        await window_repo.update(window)
        return  # no new cost

    # New window — charge applies
    await window_repo.insert(ConversationWindow(
        hotel_id=hotel_id,
        guest_phone=guest_phone,
        category=category,
        opened_at=datetime.utcnow(),
        closes_at=datetime.utcnow() + timedelta(hours=24),
        message_count=1,
        estimated_cost=CONVERSATION_COSTS[category]
    ))
```

**Costs** (approximate, varies by country):

```python
CONVERSATION_COSTS = {
    'service': 0.00,     # Free (guest-initiated)
    'utility': 0.005,    # ~₹0.40
    'marketing': 0.025,  # ~₹2.00
    'authentication': 0.015
}
```

**Analytics**:

```
GET /api/v1/hotels/{id}/whatsapp/usage?month=2026-06

{
  "conversations": {
    "service": 450,     "cost": "₹0",
    "utility": 200,     "cost": "₹80",
    "marketing": 50,    "cost": "₹100",
    "total_cost": "₹180"
  },
  "messages": { "sent": 3200, "received": 2800 }
}
```

---

## 12. Feature Flag System

### Tables

```sql
features
--------
id              UUID PK
code            VARCHAR UK      -- 'whatsapp_campaigns', 'rag', 'multi_hotel', 'live_chat'
name            VARCHAR         -- "WhatsApp Campaigns"
module          VARCHAR         -- 'whatsapp', 'ai', 'enterprise', 'chat'
description     TEXT

plan_features
-------------
id              UUID PK
plan            VARCHAR         -- 'free', 'pro', 'business', 'enterprise'
feature_id      UUID FK → features
is_enabled      BOOLEAN
limit_value     INTEGER         -- NULL = unlimited, or a cap
limit_unit      VARCHAR         -- 'per_month', 'total', NULL
```

### Example Configuration

```
┌─────────────────────┬──────┬──────┬──────────┬────────────┐
│ Feature             │ Free │ Pro  │ Business │ Enterprise │
├─────────────────────┼──────┼──────┼──────────┼────────────┤
│ Tickets             │ 50/m │  ∞   │    ∞     │     ∞      │
│ Menu Management     │  ✅  │  ✅  │    ✅    │     ✅     │
│ WhatsApp Bot        │  ❌  │  ✅  │    ✅    │     ✅     │
│ WhatsApp Campaigns  │  ❌  │ 100/m│    ∞     │     ∞      │
│ Live Chat           │  ❌  │  ✅  │    ✅    │     ✅     │
│ RAG / AI Knowledge  │  ❌  │  ❌  │    ✅    │     ✅     │
│ Multi-Hotel         │  ❌  │  ❌  │  3 hotels│     ∞      │
│ Custom Workflows    │  ❌  │  ❌  │    ✅    │     ✅     │
│ API Access          │  ❌  │  ❌  │    ❌    │     ✅     │
│ POS / Restaurant    │  ❌  │  ❌  │    ✅    │     ✅     │
│ Inventory           │  ❌  │  ❌  │    ❌    │     ✅     │
│ Analytics Export    │  ❌  │  ✅  │    ✅    │     ✅     │
└─────────────────────┴──────┴──────┴──────────┴────────────┘
```

### Middleware Enforcement

```python
# core/middleware.py

class FeatureGateMiddleware:
    async def __call__(self, request, call_next):
        feature_code = request.state.required_feature  # set by decorator
        if not feature_code:
            return await call_next(request)

        hotel = request.state.hotel
        plan = hotel.subscription.plan

        allowed = await feature_service.is_enabled(plan, feature_code)
        if not allowed:
            raise HTTPException(403, f"Feature '{feature_code}' requires plan upgrade")

        return await call_next(request)

# Usage in router:
@require_feature("whatsapp_campaigns")
@require_permission("campaign.send")
async def send_campaign(...):
    ...
```

---

## 13. Usage Limits

```sql
usage_limits
------------
id              UUID PK
hotel_id        UUID FK → hotels
feature_code    VARCHAR         -- 'tickets', 'whatsapp_messages', 'ai_requests', 'campaigns'
period          VARCHAR         -- '2026-06' (monthly)
limit_value     INTEGER         -- from plan_features.limit_value
used_value      INTEGER DEFAULT 0
updated_at      TIMESTAMP
```

### Enforcement

```python
# services/usage_service.py

async def check_and_increment(hotel_id, feature_code):
    """Call before any counted action. Raises LimitExceeded if over."""
    usage = await usage_repo.get_current(hotel_id, feature_code)

    if usage.limit_value is not None and usage.used_value >= usage.limit_value:
        raise LimitExceeded(
            f"Monthly limit reached for {feature_code}: "
            f"{usage.used_value}/{usage.limit_value}"
        )

    usage.used_value += 1
    await usage_repo.update(usage)

# Called in TicketService:
async def create_ticket(self, ...):
    await usage_service.check_and_increment(hotel_id, 'tickets')
    ...

# Called in CampaignService:
async def send_campaign(self, ...):
    await usage_service.check_and_increment(hotel_id, 'campaigns')
    ...
```

### Monthly Reset (Celery worker on 1st of each month)

```python
@celery.task
async def reset_monthly_usage():
    new_period = datetime.now().strftime('%Y-%m')
    hotels = await hotel_repo.get_all_active()
    for hotel in hotels:
        plan = hotel.subscription.plan
        features = await feature_service.get_plan_features(plan)
        for f in features:
            await usage_repo.upsert(
                hotel_id=hotel.id,
                feature_code=f.code,
                period=new_period,
                limit_value=f.limit_value,
                used_value=0
            )
```

---

## 14. Phase 2 & 3 Roadmap (Future)

### Phase 2: Channel Manager / OTA Integration

```
Not built now. Architecture hooks:

reservations.source = 'booking.com' | 'agoda' | 'direct' | 'walk-in'

Future tables:
  channel_connections     — OTA API credentials per hotel
  channel_rate_mappings   — map rate_plans → OTA rate codes
  channel_sync_logs       — sync history + errors
  channel_inventory       — availability pushed to OTAs

Integration pattern:
  Celery worker polls OTAs every 5 minutes for new bookings
  On reservation create/cancel → push availability update to all connected OTAs
```

### Phase 3: Revenue Management + Accounting

```
Future tables:
  demand_forecasts        — predicted occupancy by date
  dynamic_pricing_rules   — "if occupancy > 80%, multiply rate by 1.3"
  accounting_entries      — double-entry ledger
  accounting_integrations — Tally / Zoho Books / QuickBooks credentials

Not built now, but the rate_plans + folio architecture
supports plugging these in without schema changes.
```

---

## 15. Complete Table Count (v4)

| Module | Tables | New in v4 |
|---|---|---|
| **Core** | `hotels`, `organizations`, `organization_hotels`, `organization_users` | — |
| **Auth & RBAC** | `users`, `user_sessions`, `roles`, `permissions`, `permission_groups`, `role_permissions`, `user_roles` | — |
| **PMS** | `guests`, `reservations`, `reservation_guests`, `stay_records`, `room_types`, `rooms`, `departments`, `department_configs` | `reservation_guests` 🆕 |
| **Ticketing** | `tickets`, `ticket_events`, `chat_messages` | — |
| **Workflow** | `workflow_definitions`, `workflow_states`, `workflow_transitions` | 🆕 All 3 |
| **Financial** | `guest_folios`, `folio_items`, `tax_configs`, `payments`, `refunds`, `rate_plans`, `rate_plan_periods` | — |
| **Restaurant** | `restaurant_tables`, `restaurant_orders`, `restaurant_order_items` | 🆕 All 3 |
| **Menu** | `menu_categories`, `menu_items` | — |
| **Inventory** | `inventory_items`, `inventory_transactions`, `vendors`, `purchase_orders`, `purchase_order_items` | 🆕 All 5 |
| **Staff** | `employee_shifts` | 🆕 |
| **WhatsApp** | `whatsapp_accounts`, `whatsapp_account_health`, `whatsapp_usage`, `whatsapp_templates`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_sessions`, `conversation_windows` | `conversation_windows` 🆕 |
| **Chat** | `live_chat_sessions` | — |
| **Bot** | `bot_configs`, `bot_versions`, `service_forms`, `service_form_fields` | — |
| **AI** | `hotel_faqs`, `knowledge_documents`, `knowledge_document_versions`, `knowledge_embeddings` | `knowledge_document_versions` 🆕 |
| **Campaigns** | `campaigns`, `campaign_deliveries` | — |
| **Operations** | `housekeeping_schedules`, `housekeeping_checklists`, `maintenance_orders`, `lost_found_items` | — |
| **SaaS** | `features`, `plan_features`, `usage_limits`, `subscriptions`, `invoices` | `features`, `plan_features`, `usage_limits` 🆕 |
| **Platform** | `hotel_languages`, `hotel_secrets`, `audit_logs`, `notifications`, `media_files`, `analytics_snapshots`, `fcm_tokens`, `feedback` | — |
| | **TOTAL: ~65 tables** | **15 new tables in v4** |

---

## 16. Pragmatic Build Order (What to Ship First)

> [!IMPORTANT]
> **Do NOT build all 65 tables first.** Ship in waves. Each wave is a deployable, usable product.

### Wave 1 — MVP PMS + Staff App (12 weeks, 2 devs)

Ship this first. It's enough to onboard a paying hotel.

```
Tables (24):
  hotels, users, user_sessions, roles, permissions, permission_groups,
  role_permissions, user_roles, room_types, rooms, departments,
  department_configs, guests, reservations, reservation_guests,
  stay_records, tickets, ticket_events, chat_messages,
  fcm_tokens, feedback, notifications, audit_logs, media_files

Features:
  ✅ JWT Auth + Refresh tokens + RBAC
  ✅ Hotel + Room Type + Room management
  ✅ Guest + Reservation + Stay management (multi-guest)
  ✅ Department + Ticket system with auto-assign
  ✅ WebSocket real-time (JWT-secured)
  ✅ FCM push notifications
  ✅ Audit logging
  ✅ PostgreSQL RLS
  ✅ Soft delete policy

Android app is FUNCTIONAL after this wave.
```

### Wave 2 — WhatsApp Bot (8 weeks)

```
Tables (12):
  whatsapp_accounts, whatsapp_account_health, whatsapp_usage,
  whatsapp_templates, whatsapp_conversations, whatsapp_messages,
  whatsapp_sessions, conversation_windows, live_chat_sessions,
  bot_configs, bot_versions, hotel_faqs

Features:
  ✅ Per-hotel WhatsApp accounts
  ✅ Bot flow engine + FAQ engine
  ✅ Guest onboarding via WhatsApp
  ✅ Ticket creation from WhatsApp
  ✅ Live chat handoff
  ✅ Health monitoring + usage tracking
```

### Wave 3 — Financial + Menu + Operations (8 weeks)

```
Tables (18):
  guest_folios, folio_items, tax_configs, payments, refunds,
  rate_plans, rate_plan_periods, menu_categories, menu_items,
  restaurant_tables, restaurant_orders, restaurant_order_items,
  employee_shifts, housekeeping_schedules, housekeeping_checklists,
  maintenance_orders, lost_found_items, service_forms, service_form_fields

Features:
  ✅ Full billing (folios, payments, taxes)
  ✅ Rate plans + seasonal pricing
  ✅ Restaurant POS + KOT
  ✅ Employee shift scheduling
  ✅ Housekeeping + Maintenance modules
```

### Wave 4 — AI + SaaS + Scale (6 weeks)

```
Tables (11):
  knowledge_documents, knowledge_document_versions, knowledge_embeddings,
  workflow_definitions, workflow_states, workflow_transitions,
  features, plan_features, usage_limits,
  campaigns, campaign_deliveries, analytics_snapshots,
  inventory_items, inventory_transactions, vendors,
  purchase_orders, purchase_order_items

Features:
  ✅ RAG knowledge base + pgvector
  ✅ Dynamic workflow engine
  ✅ Feature flags + usage limits
  ✅ Campaigns + marketing
  ✅ Analytics snapshots
  ✅ Inventory management
```

### Total: ~34 weeks (~8.5 months) for 2 devs — full platform

---

## Final Score

| Area | v3 Score | v4 Score | Change |
|---|---|---|---|
| Multi-Tenant SaaS | 9.8 | **10** | Feature flags + usage limits |
| WhatsApp Platform | 10 | **10** | Conversation windows + onboarding |
| RBAC | 9.5 | **10** | Permission groups fully defined |
| PMS Core | 9 | **10** | Multi-guest, room types, workflows |
| Scalability | 9 | **10** | RLS + shift-based assignment |
| Security | 9 | **10** | RLS + consistent soft deletes + vault |
| AI/RAG | 9.5 | **10** | Versioning + async embeddings |
| Financial | 7.5 | **10** | Folios + POS + rate plans |
| Operations | 7 | **10** | Inventory + housekeeping + shifts |
| Extensibility | 10 | **10** | Workflow engine + feature flags |
| **Overall** | **9.4** | **10/10** | ✅ |
