# WhatsApp Guest Integration — Complete Flow Design

> **Yes — all three flows are fully supported in the architecture:**
> 1. ✅ Guest onboarding (check-in) via WhatsApp
> 2. ✅ Guest raises issues from WhatsApp → creates ticket in hotel management system
> 3. ✅ Hotel sends promotional offers to guest's WhatsApp

All three flows go through one endpoint: `POST /webhook/whatsapp` (incoming) and the Meta WhatsApp Cloud API (outgoing).

---

## Flow 1: Guest Onboarding via WhatsApp (Check-In)

```
Guest arrives at hotel
        │
        ▼
Reception gives guest:
  "Welcome card" with QR code
  OR just the hotel's WhatsApp number
        │
        ▼
Guest scans QR / saves number and sends "Hi"
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│              FastAPI: POST /webhook/whatsapp                       │
│                                                                   │
│  1. Verify Meta HMAC signature (security)                         │
│  2. Extract: from_phone, message_text, phone_number_id            │
│  3. Resolve hotel_id from phone_number_id → hotels table          │
│  4. Load/create WhatsApp session from whatsapp_sessions table     │
│                                                                   │
│  session.state == "new"                                           │
│        │                                                          │
│        ▼                                                          │
│  BotService.start_onboarding(phone, hotel_id)                     │
│  → Check guests table: WHERE phone=? AND hotel_id=? AND           │
│    check_out_date >= today                                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │          TWO ONBOARDING PATHS                             │    │
│  │                                                           │    │
│  │  PATH A: Pre-registered (reception added guest)           │    │
│  │    → Guest found in DB                                    │    │
│  │    → Update session: state="active", guest_id, room_id   │    │
│  │    → Send personalized welcome:                           │    │
│  │      "Welcome, Rahul! 🏨 Room 204. How can I help you?"  │    │
│  │                                                           │    │
│  │  PATH B: Self-registration (walk-in / QR-scan)            │    │
│  │    → Guest NOT found in DB                                │    │
│  │    → Set state="awaiting_name"                            │    │
│  │    → Bot: "Welcome to The Grand! 🏨                       │    │
│  │             Please share your name to get started."       │    │
│  │    → Guest replies "Rahul Sharma"                         │    │
│  │    → Bot: "What is your room number?"                     │    │
│  │    → Guest replies "204"                                  │    │
│  │    → Validate room 204 exists in rooms table              │    │
│  │    → INSERT into guests table                             │    │
│  │    → Set state="active"                                   │    │
│  │    → Bot: "Welcome, Rahul! You're all set. ✅"            │    │
│  └──────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
Guest is now ACTIVE in the system
Session saved in whatsapp_sessions table:
{
  phone: "+919876543210",
  hotel_id: "HOT100",
  guest_id: "uuid-rahul",
  room_id: "uuid-room-204",
  state: "active",
  last_active_at: "2026-06-13T09:15:00Z"
}
        │
        ▼
Bot immediately sends the Main Menu:
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

---

## Flow 2: Guest Raises Issue → Hotel Ticket System

```
Guest (Rahul, Room 204) taps "🛎️ Room Services"
        │
        ▼
Bot sends interactive list:
┌─────────────────────────────────┐
│  Room Services                  │
│                                 │
│  Room Amenities:                │
│   🛏️ Extra Towels               │
│   💧 Drinking Water             │
│   🛏️ Extra Pillows              │
│                                 │
│  Room Issues:                   │
│   ❄️  AC Not Working            │
│   📺 TV Not Working             │
│   🔧 Plumbing Issue             │
│                                 │
│  Other Services:                │
│   🚕 Taxi/Cab                   │
│   ✏️  Other (type below)        │
└─────────────────────────────────┘
        │
Guest taps "❄️ AC Not Working"
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│              FastAPI: POST /webhook/whatsapp                       │
│                                                                   │
│  interactive.list_reply.id == "ac_not_working"                    │
│                                                                   │
│  TicketService.create_ticket({                                    │
│    hotel_id:    "HOT100",                                         │
│    guest_id:    "uuid-rahul",                                     │
│    room_id:     "uuid-room-204",                                  │
│    department:  "Engineering",                                    │
│    item:        "AC Not Working",                                 │
│    source:      "whatsapp",                                       │
│    type:        "Ticket",                                         │
│    priority:    2                                                 │
│  })                                                               │
│                                                                   │
│  → INSERT into tickets table                                      │
│  → INSERT into ticket_events (event_type="created")              │
│  → Auto-assign: find on-duty Engineering staff (round-robin)     │
│  → UPDATE tickets SET assigned_to = "uuid-dinesh"                │
│  → INSERT ticket_events (event_type="assigned")                  │
│  → Calculate SLA: sla_due_at = now + 20 minutes                  │
└───────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────────────────┐
        ▼                                          ▼
Publish to Redis:                         Send FCM Push to Dinesh's phone:
"hotel:HOT100:tickets" channel            {
{                                           title: "New Ticket",
  event: "ticket.created",                  body: "AC Not Working — Room 204"
  ticket_id: "uuid-ticket",               }
  department: "Engineering",
  room: "204",
  item: "AC Not Working"
}
        │                                          │
        ▼                                          ▼
Staff Dashboard / Android App             Dinesh sees notification
gets live update instantly                and opens the ticket
        │
        ▼
Bot replies to Rahul on WhatsApp:
┌─────────────────────────────────────┐
│  ✅ Your request has been raised!   │
│                                     │
│  📋 Request ID: 091523-130626       │
│  🏷️  AC Not Working                 │
│  👤 Assigned to: Dinesh (Eng.)      │
│  ⏰ Expected: within 20 mins        │
│                                     │
│  I'll notify you when it's done!   │
└─────────────────────────────────────┘
        │
        ▼
When Dinesh marks ticket as "Resolved":
  → TicketService updates ticket.stage = "Completed"
  → Publishes Redis event
  → WhatsApp notification sent to Rahul:

┌─────────────────────────────────────┐
│  ✅ Your AC issue has been fixed!   │
│  Hope you're comfortable now. 😊    │
│                                     │
│  How would you rate this service?   │
│  ⭐ 1   ⭐⭐ 2   ⭐⭐⭐ 3            │
│  ⭐⭐⭐⭐ 4   ⭐⭐⭐⭐⭐ 5           │
└─────────────────────────────────────┘
```

### Free-Text Issue (Gemini Fallback)

```
Rahul types: "mera AC kharab hai yaar" (Hindi free text)
        │
        ▼
Flow Engine: no state match, not a greeting
        │
        ▼
GeminiService.classify_free_text(
  text="mera AC kharab hai yaar",
  services=bot_config.services,   ← loaded from bot_configs table
  guest_name="Rahul"
)
Returns: { matched: true, service_id: "ac", department: "Engineering", item: "AC Not Working" }
        │
        ▼
Bot sends confirmation buttons:
┌─────────────────────────────────────┐
│  Should I raise a request for:      │
│  ❄️  AC Not Working?                │
│                                     │
│  [✅ Yes, please]  [❌ No, menu]    │
└─────────────────────────────────────┘
        │
Rahul taps "✅ Yes, please"
        │
        ▼
→ Same ticket creation flow as above
```

---

## Flow 3: Hotel Sends Promotional Offers to Guest WhatsApp

This uses **Meta WhatsApp Template Messages** (pre-approved marketing templates). The hotel staff triggers this from the Dashboard or it can be triggered automatically.

### Types of Outbound Messages

| Trigger | Message Type | Example |
|---|---|---|
| Guest checks in | Transactional | "Welcome, Rahul! Your room 204 is ready 🏨" |
| 2 hours after check-in | Promotional | "Dinner offer tonight!" |
| New menu item added | Promotional | "Try our new Butter Chicken!" |
| Spa availability | Promotional | "Spa slot open at 5PM — ₹500 off!" |
| Checkout approaching | Transactional | "Checkout tomorrow at 11AM. Need anything?" |
| Ticket resolved | Transactional | "Your AC is fixed! How would you rate us?" |

### Architecture for Sending Offers

```
Hotel Staff on Dashboard:
  → Goes to "Marketing" section
  → Selects template: "Special Dinner Offer"
  → Selects target: "All Active Guests" OR specific guest
  → Clicks "Send Now" or schedules for 6 PM
        │
        ▼
POST /api/v1/hotels/{hotel_id}/campaigns
{
  "template_name": "special_dinner_offer",
  "target": "all_active_guests",   ← OR specific guest_id
  "scheduled_at": "2026-06-13T12:30:00Z",
  "params": {
    "hotel_name": "The Grand Palace",
    "offer_detail": "30% off on all dinner items tonight!",
    "valid_until": "11 PM tonight"
  }
}
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│  CampaignService                                                  │
│                                                                   │
│  1. Fetch all active guests for hotel (WHERE status='checked_in') │
│  2. For each guest with whatsapp_phone:                           │
│     → Queue Celery task: send_whatsapp_template(phone, template)  │
│                                                                   │
│  Celery Worker runs at scheduled time:                            │
│  3. Call Meta WhatsApp API:                                       │
│     POST https://graph.facebook.com/v19.0/{phone_id}/messages    │
│     {                                                             │
│       "to": "+919876543210",                                      │
│       "type": "template",                                         │
│       "template": {                                               │
│         "name": "special_dinner_offer",                           │
│         "language": { "code": "en" },                             │
│         "components": [{                                          │
│           "type": "body",                                         │
│           "parameters": [                                         │
│             {"type": "text", "text": "Rahul"},                    │
│             {"type": "text", "text": "30% off dinner tonight!"},  │
│             {"type": "text", "text": "The Grand Palace"}          │
│           ]                                                       │
│         }]                                                        │
│       }                                                           │
│     }                                                             │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
Guest receives on WhatsApp:
┌─────────────────────────────────────────┐
│  🍽️  Special Dinner Offer — The Grand  │
│                                         │
│  Hi Rahul! Enjoy 30% off on all         │
│  dinner items tonight at our            │
│  restaurant. 🌟                         │
│                                         │
│  Valid until 11 PM tonight.             │
│                                         │
│  [🍽️ View Menu]  [📞 Call Us]          │
└─────────────────────────────────────────┘
        │
If guest taps "View Menu":
  → WhatsApp sends back an interactive reply
  → Webhook receives it
  → BotService detects "food_menu" intent
  → Sends food menu list directly
  → Guest can ORDER from the promotion message!
```

---

## Database Tables Supporting These Flows

```sql
-- Stores active WhatsApp conversations (replaces in-memory JS sessions)
CREATE TABLE whatsapp_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id                UUID REFERENCES hotels(id),
  phone                   VARCHAR(20) UNIQUE NOT NULL,
  guest_id                UUID REFERENCES guests(id),
  state                   VARCHAR(50) DEFAULT 'new',
  cart                    JSONB DEFAULT '[]',
  pending_action          JSONB,
  whatsapp_phone_number_id VARCHAR(50),
  last_active_at          TIMESTAMP DEFAULT NOW(),
  expires_at              TIMESTAMP
);

-- Tracks outbound marketing campaigns
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID REFERENCES hotels(id),
  name            VARCHAR(255),
  template_name   VARCHAR(100),
  target_type     VARCHAR(50),  -- 'all_guests', 'specific', 'checked_in_today'
  params          JSONB,
  status          VARCHAR(30),  -- 'draft', 'scheduled', 'sending', 'sent'
  scheduled_at    TIMESTAMP,
  sent_count      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Tracks delivery status per guest per campaign
CREATE TABLE campaign_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id),
  guest_id     UUID REFERENCES guests(id),
  phone        VARCHAR(20),
  status       VARCHAR(30),  -- 'sent', 'delivered', 'read', 'failed'
  sent_at      TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at      TIMESTAMP
);
```

---

## Summary: What the Guest Experiences End-to-End

```
Day 1 — Arrival:
  ← Hotel sends: "Welcome! Scan QR to connect on WhatsApp"
  → Guest sends: "Hi"
  ← Bot: Onboards guest (name + room), shows main menu

During Stay:
  → Guest: Taps "AC Not Working"
  ← Bot: Ticket created, Dinesh assigned, ETA 20 mins
  ← (20 mins later) Bot: "AC fixed! Rate us ⭐⭐⭐⭐⭐"
  → Guest: Rates 5 stars → stored in feedback table

Evening:
  ← Hotel sends: "30% off dinner tonight!" (marketing template)
  → Guest: Taps "View Menu" → orders food via bot → ticket created

Day 2 — Checkout:
  ← Bot auto-sends: "Checkout at 11AM tomorrow. Need help with luggage?"
  → Guest: "Yes" → Bellman ticket created
  ← "Thank you for staying! Here's your feedback link 🙏"
```

**Zero manual steps for the hotel.** Everything above is automated.
