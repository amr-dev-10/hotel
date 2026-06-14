# Arcadia Platform — Complete Architecture Design v2.0

> **Design philosophy**: One language. One database. One API. Everything else is a plugin.
> Built for a team of 2–4 developers. Scales to 10,000 hotels. Runs on a single $20/month VPS to start.
> **Updated**: Extended with enterprise multi-tenant features — Dynamic RBAC, Reservation Management, per-hotel WhatsApp credentials, AI knowledge base, Bot versioning, SaaS billing, and more.

---

## 0. Core Design Principles

1. **Modular Monolith first** — NOT microservices. One FastAPI app with clean internal boundaries.
2. **PostgreSQL is the single source of truth** — No Firebase, no split-brain between Firestore + RTDB.
3. **Real-time is a layer, not a foundation** — WebSocket is a push notification channel on top of REST.
4. **Multi-tenancy by `hotel_id` on every row** — Not separate schemas per hotel. Every query always filters by `hotel_id`.
5. **Config-driven bot, not code-driven** — Hotel customizations live in a DB table, not in hardcoded prompt strings.
6. **Security is baked in from day one** — JWT auth, row-level scoping, no API keys in the frontend.
7. **Dynamic RBAC** — Hotel admins define their own roles and permissions. No code changes needed.

---

## 1. The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Android App  │  │ Staff React  │  │ Guest Web    │  │ WhatsApp /     │  │
│  │ (Hotel Staff │  │ Dashboard    │  │ Chatbot      │  │ Twilio Voice   │  │
│  │ & Managers)  │  │ (Vite)       │  │ (Next.js)    │  │ Webhooks       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
└─────────┼─────────────────┼──────────────────┼──────────────────┼───────────┘
          │  REST + WS      │  REST + WS        │  REST + WS       │  POST webhook
          ▼                 ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY LAYER                                     │
│                   (nginx — SSL termination, rate limiting)                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Application (Python 3.12)                       │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         ROUTER LAYER                                   │  │
│  │  /api/v1/auth    /api/v1/hotels    /api/v1/tickets    /api/v1/menu    │  │
│  │  /api/v1/users   /api/v1/guests    /api/v1/chat       /api/v1/bot     │  │
│  │  /api/v1/roles   /api/v1/campaigns /api/v1/reservations               │  │
│  │  /ws/{hotel_id}  /webhook/whatsapp  /webhook/voice                    │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                        │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │                       SERVICE LAYER                                    │  │
│  │  AuthService  │ HotelService    │ TicketService  │ MenuService         │  │
│  │  GuestService │ BotService      │ NotifService   │ RBACService         │  │
│  │  CampaignService │ ReservationService │ AuditService                   │  │
│  │                                                                        │  │
│  │  [BotService split]:                                                   │  │
│  │    FlowEngine │ FAQEngine │ AIEngine │ WhatsAppService                 │  │
│  │  [NotifService split]:                                                 │  │
│  │    FCMChannel │ EmailChannel │ WhatsAppChannel │ WebSocketChannel      │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                        │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │                      REPOSITORY LAYER                                  │  │
│  │  (SQLAlchemy async ORM — every query scoped by hotel_id)               │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                        │
│  ┌──────────────────────────────────▼────────────────────────────────────┐  │
│  │                    INTEGRATION LAYER (plugins)                         │  │
│  │  WhatsApp Cloud API │ Twilio │ Gemini AI │ FCM Push │ ElevenLabs TTS  │  │
│  │  S3 / Cloudflare R2 (media) │ Stripe (billing)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
              ┌───────────────────────┼─────────────────────┐
              ▼                       ▼                     ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │   PostgreSQL 16   │   │  Redis 7          │   │  Celery Workers  │
   │   (Primary DB)    │   │  • Session store  │   │  • SLA sweeper   │
   │   • All tables    │   │  • WS Pub/Sub     │   │  • Checkout sync │
   │   • JSONB config  │   │  • Rate limiting  │   │  • Notif sender  │
   │   • Full text     │   │  • Bot cache      │   │  • Review sweep  │
   └──────────────────┘   └──────────────────┘   │  • Campaign sender│
                                                   └──────────────────┘
```

---

## 2. Database Design (PostgreSQL)

### Design Decisions
- **UUIDs** as primary keys (safe for distributed inserts)
- **`hotel_id` on every tenant table** — enforced at DB level with FK + application-level guard middleware
- **`JSONB` for flexible config** — `bot_config`, `sla_config`, `department_keywords` don't need rigid columns
- **Soft deletes** — `deleted_at` timestamp, never hard-delete operational data
- **Audit trail built-in** — `ticket_events` + `audit_logs` tables record every state change

---

### 2.1 Core Tables

```sql
-- Multi-tenant root
hotels
------
id                      UUID PK
slug                    VARCHAR UNIQUE
name                    VARCHAR
address                 TEXT
timezone                VARCHAR
contact_email           VARCHAR
contact_phone           VARCHAR
subscription_tier       VARCHAR   -- 'starter', 'pro', 'enterprise'
status                  VARCHAR   -- 'active', 'suspended', 'trial'
owner_user_id           UUID FK → users
created_at              TIMESTAMP
deleted_at              TIMESTAMP

users
-----
id                      UUID PK
hotel_id                UUID FK → hotels
department_id           UUID FK → departments
name                    VARCHAR
email                   VARCHAR UNIQUE
hashed_password         VARCHAR
job_role                VARCHAR
profile_image_url       VARCHAR
is_hotel_owner          BOOLEAN
is_active               BOOLEAN
is_on_duty              BOOLEAN
created_at              TIMESTAMP
deleted_at              TIMESTAMP

rooms
-----
id                      UUID PK
hotel_id                UUID FK → hotels
room_number             VARCHAR
room_type               VARCHAR
floor                   VARCHAR
status                  VARCHAR   -- 'available', 'occupied', 'maintenance'
deleted_at              TIMESTAMP

departments
-----------
id                      UUID PK
hotel_id                UUID FK → hotels
name                    VARCHAR
key                     VARCHAR UNIQUE
description             TEXT
keywords                JSONB
resolution_time         VARCHAR
is_active               BOOLEAN
sort_order              INTEGER
```

---

### 2.2 Guest & Reservation Tables (NEW)

```sql
guests
------
id                      UUID PK
hotel_id                UUID FK → hotels
room_id                 UUID FK → rooms
name                    VARCHAR
phone                   VARCHAR
whatsapp_phone          VARCHAR
check_in_date           DATE
check_out_date          DATE
status                  VARCHAR   -- 'pre_arrival', 'checked_in', 'checked_out'
created_at              TIMESTAMP

-- NEW: Reservation & Stay Management (replaces guests-only approach)
-- Without this, the system is NOT a PMS.

reservations
------------
id                      UUID PK
hotel_id                UUID FK → hotels
reservation_no          VARCHAR UNIQUE
guest_id                UUID FK → guests
room_id                 UUID FK → rooms
status                  VARCHAR   -- 'confirmed', 'checked_in', 'checked_out', 'cancelled'
checkin_date            DATE
checkout_date           DATE
source                  VARCHAR   -- 'walk_in', 'ota', 'direct', 'phone'
created_at              TIMESTAMP

stay_records
------------
id                      UUID PK
reservation_id          UUID FK → reservations
room_id                 UUID FK → rooms
actual_checkin          TIMESTAMP
actual_checkout         TIMESTAMP
```

---

### 2.3 Dynamic RBAC Tables (NEW)

Every hotel defines its own roles. No code changes required when a hotel adds or renames a role.

```sql
roles
-----
id                      UUID PK
hotel_id                UUID FK → hotels
name                    VARCHAR         -- 'Manager', 'Receptionist', 'Housekeeping'
description             TEXT
is_system_role          BOOLEAN         -- system roles cannot be deleted
created_at              TIMESTAMP

permissions
-----------
id                      UUID PK
code                    VARCHAR UNIQUE  -- 'ticket.assign', 'room.update', 'campaign.send'
name                    VARCHAR
module                  VARCHAR         -- 'tickets', 'rooms', 'campaigns', 'bot', 'users'

role_permissions
----------------
role_id                 UUID FK → roles
permission_id           UUID FK → permissions
PRIMARY KEY (role_id, permission_id)

user_roles
----------
user_id                 UUID FK → users
role_id                 UUID FK → roles
PRIMARY KEY (user_id, role_id)
```

**Permission codes example set:**
```
ticket.view         ticket.create       ticket.assign       ticket.close
room.view           room.update
guest.view          guest.edit
campaign.create     campaign.send
user.manage
bot.manage
hotel.settings.manage
```

**JWT → Permission flow:**
```
JWT → User → user_roles → roles → role_permissions → permissions → API access
```

**Backend enforcement example:**
```python
@require_permission("ticket.assign")
async def assign_ticket(ticket_id: UUID, ...):
    ...
```

---

### 2.4 WhatsApp Tables (EXTENDED)

**Each hotel owns its own WhatsApp number.** The guest sees the hotel brand, not "Arcadia Bot".

```sql
-- NEW: Per-hotel WhatsApp credentials
whatsapp_accounts
-----------------
id                      UUID PK
hotel_id                UUID FK → hotels
business_name           VARCHAR
phone_number            VARCHAR         -- '+91 90000 11111'
phone_number_id         VARCHAR         -- Meta phone_number_id
waba_id                 VARCHAR         -- WhatsApp Business Account ID
access_token            TEXT            -- encrypted at rest
webhook_verify_token    VARCHAR
status                  VARCHAR         -- 'active', 'pending', 'suspended'
created_at              TIMESTAMP

-- Webhook routing: phone_number_id → hotel_id → load hotel bot config
```

**Routing on incoming webhook:**
```json
{ "phone_number_id": "123456" }
  → lookup whatsapp_accounts
  → hotel_id = HOTEL_A
  → load BOT_CONFIG, FAQ, MENU, SERVICES for that hotel only
```

```sql
-- Session state machine (per guest conversation)
whatsapp_sessions
-----------------
id                      UUID PK
hotel_id                UUID FK → hotels
phone                   VARCHAR UNIQUE
guest_id                UUID FK → guests
state                   VARCHAR DEFAULT 'new'
cart                    JSONB DEFAULT '[]'
pending_action          JSONB
whatsapp_phone_number_id VARCHAR
last_active_at          TIMESTAMP
expires_at              TIMESTAMP

-- NEW: Template management (each hotel registers its own Meta templates)
whatsapp_templates
------------------
id                      UUID PK
hotel_id                UUID FK → hotels
template_name           VARCHAR
template_type           VARCHAR   -- 'welcome', 'checkin_reminder', 'promotional', 'feedback'
language                VARCHAR
status                  VARCHAR   -- 'pending', 'approved', 'rejected'
meta_template_id        VARCHAR

-- NEW: Full conversation history (audit, analytics, complaint review)
whatsapp_conversations
----------------------
id                      UUID PK
hotel_id                UUID FK → hotels
guest_id                UUID FK → guests

whatsapp_messages
-----------------
id                      UUID PK
conversation_id         UUID FK → whatsapp_conversations
direction               VARCHAR   -- 'inbound', 'outbound'
message_type            VARCHAR   -- 'text', 'interactive', 'template', 'image'
message_text            TEXT
meta_message_id         VARCHAR
status                  VARCHAR   -- 'sent', 'delivered', 'read', 'failed'
created_at              TIMESTAMP
```

---

### 2.5 Campaign Tables

```sql
campaigns
---------
id                      UUID PK
hotel_id                UUID FK → hotels
name                    VARCHAR
template_name           VARCHAR
target_type             VARCHAR   -- 'all_guests', 'specific', 'checked_in_today'
params                  JSONB
status                  VARCHAR   -- 'draft', 'scheduled', 'sending', 'sent'
scheduled_at            TIMESTAMP
sent_count              INTEGER DEFAULT 0
created_by              UUID FK → users
created_at              TIMESTAMP

campaign_deliveries
-------------------
id                      UUID PK
campaign_id             UUID FK → campaigns
guest_id                UUID FK → guests
phone                   VARCHAR
status                  VARCHAR   -- 'sent', 'delivered', 'read', 'failed'
sent_at                 TIMESTAMP
delivered_at            TIMESTAMP
read_at                 TIMESTAMP
```

---

### 2.6 Ticket & Operations Tables

```sql
tickets
-------
id                      UUID PK
ticket_code             VARCHAR UNIQUE
hotel_id                UUID FK → hotels
guest_id                UUID FK → guests
room_id                 UUID FK → rooms
department_id           UUID FK → departments
assigned_to             UUID FK → users
stage                   VARCHAR   -- 'open', 'in_progress', 'resolved', 'closed'
type                    VARCHAR   -- 'Ticket', 'FoodOrder', 'ServiceRequest'
item_description        VARCHAR
source                  VARCHAR   -- 'whatsapp', 'dashboard', 'android'
priority                INTEGER
sla_due_at              TIMESTAMP
resolved_at             TIMESTAMP
created_at              TIMESTAMP
updated_at              TIMESTAMP
deleted_at              TIMESTAMP

ticket_events
-------------
id                      UUID PK
ticket_id               UUID FK → tickets
actor_id                UUID FK → users
event_type              VARCHAR   -- 'created', 'assigned', 'stage_changed', 'resolved'
payload                 JSONB
created_at              TIMESTAMP

chat_messages
-------------
id                      UUID PK
ticket_id               UUID FK → tickets
sender_type             VARCHAR   -- 'staff', 'guest', 'bot'
sender_id               UUID
content                 TEXT
is_read                 BOOLEAN
created_at              TIMESTAMP
```

---

### 2.7 AI & Knowledge Base Tables (NEW)

```sql
-- FAQ knowledge base — AI answers from here
hotel_faqs
----------
id                      UUID PK
hotel_id                UUID FK → hotels
question                VARCHAR
answer                  TEXT
category                VARCHAR   -- 'facilities', 'dining', 'policies', 'connectivity'
-- Examples: Pool Timing, Breakfast Hours, WiFi Password, Parking Rules

-- Bot version control — roll back to any previous config
bot_versions
------------
id                      UUID PK
hotel_id                UUID FK → hotels
version                 INTEGER
config_json             JSONB
published_by            UUID FK → users
created_at              TIMESTAMP
-- v1 → v2 → v3, restore any version with one click

-- Multi-language support per hotel
hotel_languages
---------------
hotel_id                UUID FK → hotels PK
default_language        VARCHAR   -- 'en', 'hi', 'ar'
supported_languages     JSONB     -- ['en', 'hi', 'gu', 'ar']
```

---

### 2.8 Bot Configuration Tables

```sql
bot_configs
-----------
id                      UUID PK
hotel_id                UUID FK → hotels
main_menu               JSONB
services                JSONB
messages                JSONB
sla_config              JSONB
active_hours            JSONB
gemini_fallback_enabled BOOLEAN
updated_at              TIMESTAMP

-- NEW: Dynamic department routing (replaces hardcoded keywords)
department_configs
------------------
id                      UUID PK
hotel_id                UUID FK → hotels
department_id           UUID FK → departments
keywords                JSONB         -- ['ac', 'air condition', 'cold']
sla_minutes             INTEGER       -- 20
auto_assignment_enabled BOOLEAN

-- NEW: Dynamic service forms (hotel defines custom intake forms, no dev needed)
service_forms
-------------
id                      UUID PK
hotel_id                UUID FK → hotels
service_name            VARCHAR       -- 'Airport Pickup', 'Laundry'

service_form_fields
-------------------
id                      UUID PK
service_form_id         UUID FK → service_forms
field_name              VARCHAR       -- 'Flight Number'
field_type              VARCHAR       -- 'text', 'time', 'number', 'select'
required                BOOLEAN
sort_order              INTEGER
```

---

### 2.9 Menu Tables

```sql
menu_categories
---------------
id                      UUID PK
hotel_id                UUID FK → hotels
name                    VARCHAR
type                    VARCHAR   -- 'food', 'beverage', 'service'
display_order           INTEGER
is_active               BOOLEAN

menu_items
----------
id                      UUID PK
category_id             UUID FK → menu_categories
name                    VARCHAR
price                   DECIMAL
description             TEXT
image_url               VARCHAR
is_available            BOOLEAN
display_order           INTEGER
```

---

### 2.10 SaaS Operations Tables (NEW)

```sql
-- Subscription & billing
subscriptions
-------------
hotel_id                UUID FK → hotels PK
plan                    VARCHAR   -- 'starter', 'pro', 'enterprise'
status                  VARCHAR   -- 'active', 'cancelled', 'past_due'
renewal_date            DATE

invoices
--------
id                      UUID PK
subscription_id         UUID FK → subscriptions
amount                  DECIMAL
currency                VARCHAR
stripe_invoice_id       VARCHAR
status                  VARCHAR
created_at              TIMESTAMP

-- Full audit trail for every action in the system
audit_logs
----------
id                      UUID PK
hotel_id                UUID FK → hotels
user_id                 UUID FK → users
action                  VARCHAR   -- 'ticket.assigned', 'bot.config.changed', 'role.updated'
entity                  VARCHAR   -- 'ticket', 'bot_config', 'user'
entity_id               UUID
payload                 JSONB
created_at              TIMESTAMP
-- Examples: Ticket Assigned, Bot Config Changed, Role Updated, User Deleted

-- Unified notification center
notifications
-------------
id                      UUID PK
hotel_id                UUID FK → hotels
user_id                 UUID FK → users
channel                 VARCHAR   -- 'fcm', 'email', 'whatsapp', 'sms', 'websocket'
title                   VARCHAR
message                 TEXT
status                  VARCHAR   -- 'pending', 'sent', 'failed'
created_at              TIMESTAMP

-- Media storage tracking
media_files
-----------
id                      UUID PK
hotel_id                UUID FK → hotels
file_url                VARCHAR   -- S3 / Cloudflare R2 / MinIO
file_type               VARCHAR   -- 'image', 'pdf', 'video'
uploaded_by             UUID FK → users
created_at              TIMESTAMP

-- Per-user device tokens for push
fcm_tokens
----------
id                      UUID PK
user_id                 UUID FK → users
token                   VARCHAR
platform                VARCHAR   -- 'android', 'ios'
updated_at              TIMESTAMP

feedback
--------
id                      UUID PK
hotel_id                UUID FK → hotels
guest_id                UUID FK → guests
ticket_id               UUID FK → tickets
rating                  INTEGER
content                 TEXT
created_at              TIMESTAMP
```

---

## 3. Layered Code Architecture

### Project Structure (FastAPI)

```
arcadia/
│
├── main.py                     # App factory, lifespan events
├── core/
│   ├── config.py               # Pydantic Settings (env vars)
│   ├── database.py             # Async SQLAlchemy engine + session
│   ├── redis.py                # Redis connection pool
│   ├── security.py             # JWT sign/verify, password hashing
│   ├── exceptions.py           # Custom HTTP exceptions
│   ├── middleware.py           # hotel_id scoping, request logging
│   └── rbac.py                 # @require_permission decorator
│
├── models/                     # SQLAlchemy ORM models (1:1 with schema)
│   ├── hotel.py
│   ├── user.py
│   ├── role.py                 # NEW: RBAC models
│   ├── ticket.py
│   ├── menu.py
│   ├── guest.py
│   ├── reservation.py          # NEW: PMS models
│   ├── bot_config.py
│   ├── whatsapp_session.py
│   ├── whatsapp_account.py     # NEW: per-hotel credentials
│   ├── campaign.py
│   ├── audit_log.py            # NEW
│   └── media_file.py           # NEW
│
├── schemas/                    # Pydantic request/response models
│   ├── auth.py
│   ├── hotel.py
│   ├── ticket.py
│   ├── reservation.py          # NEW
│   └── ...
│
├── repositories/               # Data access (SQL queries only live here)
│   ├── base.py                 # BaseRepository with hotel_id guard
│   ├── ticket_repo.py
│   ├── user_repo.py
│   ├── reservation_repo.py     # NEW
│   └── ...
│
├── services/                   # Business logic (no SQL, no HTTP)
│   ├── auth_service.py
│   ├── rbac_service.py         # NEW: role/permission management
│   ├── ticket_service.py
│   ├── reservation_service.py  # NEW: PMS operations
│   ├── audit_service.py        # NEW: auto-log every action
│   │
│   ├── bot/                    # SPLIT from single BotService
│   │   ├── flow_engine.py      # State machine
│   │   ├── faq_engine.py       # Hotel FAQ lookup
│   │   ├── ai_engine.py        # Gemini integration
│   │   └── whatsapp_service.py # Meta API calls
│   │
│   └── notifications/          # SPLIT from single NotifService
│       ├── fcm_channel.py
│       ├── email_channel.py
│       ├── whatsapp_channel.py
│       └── websocket_channel.py
│
├── api/
│   ├── v1/
│   │   ├── auth.py
│   │   ├── hotels.py
│   │   ├── users.py
│   │   ├── roles.py            # NEW: RBAC endpoints
│   │   ├── tickets.py
│   │   ├── reservations.py     # NEW: PMS endpoints
│   │   ├── menu.py
│   │   ├── guests.py
│   │   ├── campaigns.py
│   │   ├── feedback.py
│   │   ├── bot_config.py
│   │   ├── media.py            # NEW: file upload/download
│   │   └── webhooks.py         # WhatsApp + Twilio webhook handlers
│   └── ws/
│       ├── tickets_ws.py       # /ws/{hotel_id}/tickets
│       └── chat_ws.py          # /ws/{hotel_id}/chat/{ticket_id}
│
├── integrations/               # External API clients (pure I/O)
│   ├── meta_whatsapp.py
│   ├── gemini.py
│   ├── fcm.py
│   ├── deepgram.py
│   ├── elevenlabs.py
│   ├── stripe.py               # NEW: billing
│   └── s3.py                   # NEW: media storage
│
├── workers/                    # Celery async tasks
│   ├── celery_app.py
│   ├── sla_worker.py
│   ├── checkout_worker.py
│   ├── notification_worker.py
│   └── campaign_worker.py      # NEW: scheduled campaign sending
│
└── alembic/
    └── versions/
```

---

## 4. WhatsApp Guest Flows (End-to-End)

### 4.1 Flow 1: Guest Onboarding (Check-In via WhatsApp)

```
Guest arrives at hotel
        │
        ▼
Reception gives guest a welcome card with QR code / hotel WhatsApp number
        │
        ▼
Guest sends "Hi"
        │
        ▼
POST /webhook/whatsapp
  1. Verify Meta HMAC signature
  2. Extract: from_phone, message_text, phone_number_id
  3. Lookup whatsapp_accounts WHERE phone_number_id = ? → hotel_id
  4. Load/create WhatsApp session

  session.state == "new"
        │
        ▼
  BotService.start_onboarding(phone, hotel_id)
  → Check guests WHERE phone=? AND hotel_id=? AND check_out_date >= today

  ┌──────────────────────────────────────────────────────────┐
  │  PATH A: Pre-registered (reception added guest)           │
  │    → Guest found → session: state="active"               │
  │    → "Welcome, Rahul! 🏨 Room 204. How can I help?"      │
  │                                                           │
  │  PATH B: Self-registration (walk-in / QR scan)            │
  │    → Guest NOT found → state="awaiting_name"             │
  │    → "Welcome! Please share your name."                   │
  │    → Guest: "Rahul Sharma"                               │
  │    → "What is your room number?"                         │
  │    → Guest: "204"                                        │
  │    → Validate room 204 exists                            │
  │    → INSERT into guests + reservations                   │
  │    → state="active" → "You're all set. ✅"               │
  └──────────────────────────────────────────────────────────┘
        │
        ▼
Bot sends main menu:
┌─────────────────────────────────┐
│  Hi Rahul! How can I help? 🏨   │
│  Room 204 — The Grand Palace    │
│                                 │
│  🍽️  Food & Beverages           │
│  🛎️  Room Services              │
│  💬  Talk to Manager            │
│  📋  My Requests                │
│  ❓  Query / Complaint          │
└─────────────────────────────────┘
```

### 4.2 Flow 2: Guest Raises Issue → Ticket

```
Guest taps "🛎️ Room Services" → taps "❄️ AC Not Working"
        │
        ▼
TicketService.create_ticket({
  hotel_id, guest_id, room_id,
  department: "Engineering",
  item: "AC Not Working",
  source: "whatsapp", priority: 2
})
→ INSERT tickets
→ INSERT ticket_events (event_type="created")
→ INSERT audit_logs (action="ticket.created")
→ Auto-assign: round-robin on-duty Engineering staff
→ sla_due_at = NOW() + 20 minutes
        │
        ├─────────────────────────────────┐
        ▼                                 ▼
Redis PUBLISH "hotel:HOT100:tickets"    FCM push to Dinesh's phone
        │
        ▼
Bot replies to guest:
  ✅ Request ID: 091523-130626
  Assigned to Dinesh | ETA: 20 mins

When Dinesh marks resolved:
  → WhatsApp notification to guest:
  "AC fixed! Rate us ⭐⭐⭐⭐⭐"
  → Guest rates → stored in feedback table
  → audit_log: "ticket.resolved"

Free-text fallback (Hindi/any language):
  "mera AC kharab hai yaar"
    → FAQEngine: no FAQ match
    → AIEngine.classify(text, bot_config.services)
    → { matched: true, service_id: "ac", dept: "Engineering" }
    → Bot: "Should I raise: ❄️ AC Not Working? [Yes] [No]"
    → Guest: Yes → same ticket creation flow
```

### 4.3 Flow 3: Hotel Sends Promotional Offers

```
Hotel Staff → Marketing section → Selects template + target → Send / Schedule
        │
        ▼
POST /api/v1/hotels/{hotel_id}/campaigns
  { template_name, target: "all_active_guests", scheduled_at, params }
        │
        ▼
CampaignService:
  1. Fetch all checked_in guests with whatsapp_phone
  2. Queue Celery task per guest: send_whatsapp_template(phone, template)
  3. Celery worker at scheduled time → POST to Meta WhatsApp API
        │
        ▼
Guest receives:
  🍽️ Special Dinner Offer — The Grand
  Hi Rahul! 30% off dinner tonight. Valid until 11 PM.
  [View Menu] [Call Us]

If guest taps "View Menu":
  → Webhook receives reply
  → FlowEngine: "food_menu" intent
  → Bot sends menu → guest can order → food order ticket created
```

---

## 5. The Real-Time System

```
Step 1: Client connects WebSocket
        Android App ──WS──▶ /ws/HOT100/tickets

Step 2: Any write triggers a publish
        POST /api/v1/tickets → PostgreSQL insert
        TicketService → Redis PUBLISH "hotel:HOT100:tickets" {event, ticket_id, ...}

Step 3: FastAPI WS handler subscribes to same Redis channel
        → Forwards JSON to all connected clients in that hotel

Result: Android app receives update in ~50ms with zero polling
```

**Why Redis Pub/Sub:** Solves the load balancer problem — 3 API instances all share one Redis channel, so any client on any instance gets every event.

---

## 6. Bot Architecture (State Machine + AI)

```
Incoming WhatsApp message
            │
            ▼
   Lookup whatsapp_accounts (phone_number_id → hotel_id)
            │
            ▼
   Load session from PostgreSQL (or create new)
            │
            ▼
    ┌───────────────────────────────┐
    │      FLOW ENGINE              │
    │                               │
    │  "new" / "idle"               │──▶ Send main menu
    │  "awaiting_service_select"    │──▶ Create ticket
    │  "awaiting_food_confirm"      │──▶ Create food order ticket
    │  "awaiting_form_field_N"      │──▶ Collect dynamic form fields
    │  "talking_to_manager"         │──▶ Bridge to Chat system
    │                               │
    │  FREE TEXT (no state match)   │
    │    1. FAQEngine: check hotel_faqs
    │    2. AIEngine (Gemini): classify intent
    │    3. Match → confirm + ticket │
    │    4. No match → main menu    │
    └───────────────────────────────┘
            │
            ▼
   Save updated session to PostgreSQL
            │
            ▼
   Publish event to Redis (if ticket created)
            │
            ▼
   Reply via whatsapp_accounts[hotel_id].access_token → Meta API
```

---

## 7. Dynamic RBAC in Practice

Hotel A defines roles:
```
Manager          → [ticket.assign, ticket.close, user.manage, bot.manage]
Receptionist     → [guest.view, guest.edit, ticket.create, ticket.view]
Housekeeping     → [ticket.view, room.update]
Engineering      → [ticket.view, ticket.close, room.update]
Restaurant Mgr   → [menu.manage, ticket.view]
```

Hotel B defines completely different roles:
```
Front Desk Executive  → [guest.view, guest.edit, ticket.create]
Maintenance Lead      → [ticket.view, ticket.close]
Food Coordinator      → [menu.manage]
```

**Zero code changes** between hotels. All managed from the dashboard.

---

## 8. Security Design

| Threat | Solution |
|---|---|
| Unauthenticated API access | JWT Bearer token required on every `/api/v1` route |
| Cross-tenant data leak | `hotel_id` FK middleware validates token's hotel matches URL's hotel |
| Permission enforcement | `@require_permission("code")` decorator on every sensitive endpoint |
| API keys in frontend | Zero client-side keys — all Gemini/Meta/Firebase calls server-side only |
| WhatsApp webhook spoofing | HMAC-SHA256 signature verification on every POST |
| Brute force login | Redis rate limiter: 5 failed logins per IP per 15 min |
| Password storage | `bcrypt` via `passlib` |
| SQL injection | SQLAlchemy ORM + parameterized queries only |
| Access token theft | Short-lived JWT (15 min) + refresh token rotation |
| Media access | Pre-signed S3 URLs with expiry |

---

## 9. Android API Design

1. **Consistent envelope** — every response:
    ```json
    { "success": true, "data": { ... }, "meta": { "total": 100, "page": 1 } }
    ```
2. **Cursor pagination** — `?cursor=<id>&limit=20` — works perfectly with RecyclerView infinite scroll
3. **Offline-friendly** — `updated_at` on every resource; sync with `GET /tickets?updated_after=<ts>`
4. **Minimal payloads** — list endpoints return summary fields; detail endpoints return full data
5. **WebSocket reconnect** — server sends `ping` every 30 seconds; Android auto-reconnects

---

## 10. Infrastructure (Starts Cheap, Scales Cleanly)

```
┌─────────────────────────────────────────────────────────────┐
│                    Single VPS ($20/month)                    │
│                                                             │
│  nginx (SSL + LB)  │  FastAPI (uvicorn 4 workers)          │
│  Celery Workers (3 procs)                                   │
│  PostgreSQL (local) │  Redis (local)                       │
└─────────────────────────────────────────────────────────────┘

Scale path (no code changes):
→ PostgreSQL → AWS RDS / Supabase
→ Redis → AWS ElastiCache
→ 3 FastAPI instances behind nginx (Pub/Sub keeps WS working)
→ Celery workers on separate container
→ Media → S3 / Cloudflare R2
→ Billing → Stripe webhook integration
```

---

## 11. Migration Decisions

| Current Component | Keep? | Action |
|---|---|---|
| Firebase FCM push | ✅ Keep | Python `firebase-admin` SDK works for push only |
| Gemini AI | ✅ Keep | Powers FAQEngine + AIEngine |
| Department routing logic | ✅ Port | Convert `departments.js` alias map to Python, store in `department_configs` |
| Voice Bot (FastAPI) | ✅ Refactor | Point to PostgreSQL, add hotel lookup via `whatsapp_accounts` |
| Bot session state machine | ✅ Port | Port 17-state machine to `flow_engine.py`, persist in PostgreSQL |
| Meta WhatsApp webhook | ✅ Port | Move from Express to FastAPI; add per-hotel credential lookup |
| React/Vite Dashboard | ✅ Keep | Just update API URLs |
| Firebase Firestore | ✅ Remove | → PostgreSQL |
| Firebase RTDB | ✅ Remove | → PostgreSQL + Redis Pub/Sub |
| Express.js WhatsApp Bot | ✅ Remove | → FastAPI webhook handler |
| Legacy Django backend | ✅ Remove | → FastAPI service |
| In-memory JS session map | ✅ Remove | → `whatsapp_sessions` table |
| In-memory department cache | ✅ Remove | → Redis cache with 5-min TTL |
| Hardcoded API keys in source | ✅ Remove | → Environment variables |

---

## 12. Guest Experience End-to-End

```
Day 1 — Arrival:
  ← Hotel sends: "Welcome! Scan QR to connect on WhatsApp"
  → Guest sends: "Hi"
  ← Bot onboards (name + room), creates reservation record, shows main menu

During Stay:
  → Guest: Taps "AC Not Working"
  ← Bot: Ticket created, Dinesh assigned, ETA 20 mins (SLA tracked)
  ← (20 mins later) Bot: "AC fixed! Rate us ⭐⭐⭐⭐⭐"
  → Guest: Rates 5 stars → stored in feedback table, audit logged

Evening:
  ← Hotel sends: "30% off dinner tonight!" (marketing template)
  → Guest: Taps "View Menu" → orders food via bot → food ticket created

Day 2 — Checkout:
  ← Bot auto-sends: "Checkout at 11AM tomorrow. Need help with luggage?"
  → Guest: "Yes" → Bellman ticket created
  ← "Thank you for staying! Here's your feedback link 🙏"
  → stay_records updated with actual_checkout timestamp
```

---

## 13. Feature Completeness Scorecard

| Domain | MVP | Extended v2 |
|---|---|---|
| Multi-tenant isolation | ✅ | ✅ |
| WhatsApp bot (3 flows) | ✅ | ✅ |
| Ticket management | ✅ | ✅ + audit logs |
| Real-time updates | ✅ | ✅ |
| Dynamic RBAC | ❌ | ✅ |
| Reservation / PMS | ❌ | ✅ |
| Per-hotel WhatsApp numbers | ❌ | ✅ |
| Template management | ❌ | ✅ |
| Conversation history | partial | ✅ |
| FAQ knowledge base | ❌ | ✅ |
| Bot versioning / rollback | ❌ | ✅ |
| Multi-language support | ❌ | ✅ |
| Dynamic service forms | ❌ | ✅ |
| Campaign management | ✅ | ✅ + delivery tracking |
| Audit logs | ❌ | ✅ |
| Notification center | partial (FCM) | ✅ all channels |
| Media storage | ❌ | ✅ |
| Subscription & billing | ❌ | ✅ |

**Architecture rating: MVP 8.5/10 → Extended v2: 9.5+/10**
