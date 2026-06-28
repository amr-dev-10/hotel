# AI Chatbot Development And Testing Guide

This document records the current AI chatbot MVP development for Arcadia and how to configure, run, and functionally test it.

## Scope

The chatbot work adds an AI Operations layer around the existing hotel operations platform. It does not remove the existing WhatsApp menu bot.

Current MVP capabilities:

- Structured AI chat decision pipeline.
- Local deterministic provider for development and tests.
- OpenAI, Gemini, and Anthropic provider adapters with lazy SDK imports.
- AI context builder for hotel, conversation, guest, reservation, room, open tickets, summaries, and knowledge snippets.
- AI response parser that fails closed to staff escalation when provider output is invalid.
- Decision engine using high and low confidence thresholds.
- Tool executor that creates tickets through the existing `TicketService`.
- AI usage logs, tool execution logs, conversation summaries, and prompt records.
- Dashboard AI settings controls and usage metrics.
- WhatsApp handoff only for existing active or live-chat text sessions when AI runtime is enabled.
- Live chat AI analyze and reply generation endpoints.

## Important Design Rules

- Existing WhatsApp onboarding, menu, interactive list, and service request flows remain handled by `BotService`.
- AI takes over only when all of these are true:
  - incoming message is text,
  - message is not an interactive reply,
  - an existing WhatsApp session is in `active` or `live_chat`,
  - hotel AI settings are connected and runtime enabled,
  - provider is not `local` for WhatsApp runtime handoff.
- AI never creates tickets directly through raw model/table writes. It calls existing Arcadia services.
- Auto-reply is disabled by default. Suggested replies are safe for staff review.
- Local provider is intended for development/test. Real providers need API keys and provider configuration.

## Main Files

Backend:

- `backend/app/schemas/ai.py`
- `backend/app/models/ai_models.py`
- `backend/app/api/v1/ai_chat.py`
- `backend/app/services/ai_orchestrator.py`
- `backend/app/services/ai_context_builder.py`
- `backend/app/services/ai_knowledge_loader.py`
- `backend/app/services/ai_request_builder.py`
- `backend/app/services/ai_response_parser.py`
- `backend/app/services/ai_decision_engine.py`
- `backend/app/services/ai_tool_executor.py`
- `backend/app/services/ai_analytics_service.py`
- `backend/app/services/ai_settings_service.py`
- `backend/app/integrations/ai/*.py`
- `backend/alembic/versions/c1b2a3d4e5f6_ai_operations_platform.py`
- `backend/tests/test_ai_chatbot_mvp.py`

Frontend:

- `apps/dashboard/src/features/ai/components/ai-dashboard-page.tsx`
- `apps/dashboard/src/features/ai/components/ai-settings-page.tsx`
- `apps/dashboard/src/features/ai/hooks/useAiSettings.ts`
- `apps/dashboard/src/types/domain.ts`
- `apps/dashboard/src/lib/api/query-keys.ts`

Integration points:

- `backend/app/api/v1/router.py` registers `/hotels/{hotel_id}/ai`.
- `backend/app/api/v1/live_chat.py` exposes AI analyze and reply endpoints.
- `backend/app/api/v1/webhooks.py` checks whether AI should handle active WhatsApp text messages.
- `backend/app/services/bot_service.py` now returns inbound message and conversation IDs while preserving existing return fields.

## Database Changes

Run the new migration before using the AI operations tables in a migrated database:

```powershell
.\.venv-win\Scripts\python.exe -m alembic -c backend\alembic.ini upgrade head
```

New tables:

- `ai_conversation_summaries`
- `ai_usage_logs`
- `ai_tool_execution_logs`
- `ai_prompts`

The AI settings are still stored in the existing hotel vault secret payload, not in a new settings table.

## Dependencies

Backend dependencies added:

- `openai`
- `anthropic`

`google-generativeai` already existed.

Install/update dependencies for Windows development if needed:

```powershell
.\.venv-win\Scripts\python.exe -m pip install -r backend\requirements.txt
```

## Local Runtime Configuration

Use these local dashboard settings in `apps/dashboard/.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

Backend provider environment variables are optional for local-provider testing:

```env
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEFAULT_AI_PROVIDER=local
```

Provider API keys can also be saved per hotel from the dashboard AI settings page. Those keys are stored in the hotel vault secret records.

## Hotel AI Settings

Dashboard path:

```text
http://localhost:3000/{hotelId}/ai/settings
```

Useful MVP configuration for local development:

- Provider: `local`
- Model: `local-keyword`
- Enable AI runtime: on
- Create tickets: on
- Auto-send replies: off
- Sentiment analysis: on
- High confidence: `0.9`
- Low confidence: `0.75`
- Context messages: `20`
- Language: `en`
- Escalation department: `front_office`

Recommended real-provider setup:

- Provider: `gemini`, `openai`, or `anthropic`
- API key: provider key for this hotel
- Model examples:
  - Gemini: `gemini-2.0-flash`
  - OpenAI: `gpt-4o-mini`
  - Anthropic: `claude-3-5-sonnet-latest`
- Keep Auto-send replies off until staff validates outputs in real guest conversations.

## API Endpoints

AI operations:

- `POST /api/v1/hotels/{hotel_id}/ai/chat`
- `POST /api/v1/hotels/{hotel_id}/ai/suggest-reply`
- `POST /api/v1/hotels/{hotel_id}/ai/generate-ticket`
- `POST /api/v1/hotels/{hotel_id}/ai/summarize`
- `GET /api/v1/hotels/{hotel_id}/ai/analytics`
- `GET /api/v1/hotels/{hotel_id}/ai/analytics/logs`
- `POST /api/v1/hotels/{hotel_id}/ai/test-provider`
- `GET /api/v1/hotels/{hotel_id}/ai/prompts`
- `POST /api/v1/hotels/{hotel_id}/ai/prompts`
- `PUT /api/v1/hotels/{hotel_id}/ai/prompts/{prompt_id}`

Live chat AI helpers:

- `POST /api/v1/hotels/{hotel_id}/live-chat/analyze`
- `POST /api/v1/hotels/{hotel_id}/live-chat/generate-reply`

Settings:

- `GET /api/v1/hotels/{hotel_id}/settings/ai`
- `PUT /api/v1/hotels/{hotel_id}/settings/ai`
- `POST /api/v1/hotels/{hotel_id}/settings/ai/test`
- `DELETE /api/v1/hotels/{hotel_id}/settings/ai`

## Run Development On Windows

Backend on port `8000`:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Frontend on port `3000`:

```powershell
pnpm --filter @arcadia/dashboard dev
```

Open:

```text
http://localhost:3000
```

Health checks:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health"
Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing
```

Expected:

- backend health returns `ok: True`
- frontend returns HTTP `200`
- unauthenticated frontend proxy check returns backend `401`:

```powershell
try {
  Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/v1/auth/me" -UseBasicParsing
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

## Port Cleanup

If a local dev port is blocked, identify and stop the process:

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :3000
Stop-Process -Id <PID> -Force
```

Only stop processes that are clearly local backend/frontend dev servers.

## Automated Tests

Run the focused AI chatbot tests:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests\test_ai_chatbot_mvp.py -v
```

Expected:

```text
4 passed
```

These tests cover:

- local provider structured housekeeping intent,
- parser safe fallback for invalid JSON,
- decision engine high-confidence action mapping,
- live `/ai/chat` endpoint using local provider,
- AI ticket creation,
- AI analytics logging.

Run full backend tests:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests
```

Expected after this development:

```text
48 passed
```

Run frontend TypeScript check:

```powershell
pnpm --filter @arcadia/dashboard typecheck
```

Expected:

```text
tsc --noEmit
```

with exit code `0`.

## Manual Functional Test

Use this test when you want to prove the running backend can process a chatbot message end to end.

1. Start backend on `8000`.
2. Start frontend on `3000`.
3. Bootstrap or use an existing hotel.
4. Configure AI settings for that hotel:
   - provider `local`
   - model `local-keyword`
   - runtime enabled
   - ticket creation enabled
   - auto-reply disabled
   - high confidence `0.9`
   - low confidence `0.75`
5. Create or use a WhatsApp conversation for that hotel.
6. Call:

```http
POST /api/v1/hotels/{hotel_id}/ai/chat
```

Body:

```json
{
  "conversation_id": "<conversation_id>",
  "message": "Please send extra towels to my room."
}
```

Expected response:

- `processed: true`
- `decision.intent: housekeeping`
- `action.ticket_action: auto_create`
- `ticket_created: true`
- `ticket_id` is present
- `suggested_reply` is present because auto-reply is disabled

Then verify:

- the ticket source is `AI`,
- the ticket conversation ID matches the conversation,
- the ticket task category is `housekeeping`,
- `GET /api/v1/hotels/{hotel_id}/ai/analytics` shows at least one request.

## Live Smoke Test Script

This script bootstraps a temporary hotel, creates a conversation, configures local AI, calls `/ai/chat`, verifies a ticket, and checks analytics.

Run while backend is already listening on `8000`:

```powershell
$env:PYTHONPATH='backend'
@'
import json
import urllib.error
import urllib.request
from uuid import uuid4

from app.core.database import SessionLocal
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage

base = "http://127.0.0.1:8000"
suffix = uuid4().hex[:8]

def request(method, path, payload=None, token=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.status, json.loads(response.read().decode("utf-8") or "{}")

status, bootstrap = request("POST", "/api/v1/hotels/bootstrap", {
    "slug": f"ai-live-{suffix}",
    "name": "Arcadia AI Live Smoke",
    "owner_name": "AI Smoke Owner",
    "owner_email": f"ai-smoke-{suffix}@example.com",
    "owner_password": "secretpass123",
    "contact_phone": "+919000511111",
    "whatsapp_phone_number_id": f"ai_live_{suffix}",
    "seed_rooms": ["2201"],
})
assert status == 200, bootstrap
hotel_id = bootstrap["data"]["hotel"]["id"]
token = bootstrap["data"]["access_token"]

db = SessionLocal()
try:
    conversation = WhatsAppConversation(
        hotel_id=hotel_id,
        whatsapp_account_id=None,
        guest_id=None,
        phone=f"555{suffix}",
        status="open",
        priority="normal",
        started_at=utcnow(),
        last_message_at=utcnow(),
    )
    db.add(conversation)
    db.flush()
    db.add(WhatsAppMessage(
        hotel_id=hotel_id,
        whatsapp_account_id=None,
        conversation_id=conversation.id,
        reservation_id=None,
        ticket_id=None,
        direction="inbound",
        message_type="text",
        message_text="Please send extra towels to my room.",
        status="received",
        created_at=utcnow(),
    ))
    db.commit()
    conversation_id = conversation.id
finally:
    db.close()

status, _settings = request("PUT", f"/api/v1/hotels/{hotel_id}/settings/ai", {
    "provider": "local",
    "model": "local-keyword",
    "is_active": True,
    "high_confidence_threshold": 0.9,
    "low_confidence_threshold": 0.75,
    "enable_ticket_creation": True,
    "enable_auto_reply": False,
}, token)
assert status == 200

status, chat = request("POST", f"/api/v1/hotels/{hotel_id}/ai/chat", {
    "conversation_id": conversation_id,
    "message": "Please send extra towels to my room.",
}, token)
assert status == 200, chat
result = chat["data"]
assert result["processed"] is True
assert result["decision"]["intent"] == "housekeeping"
assert result["ticket_created"] is True

db = SessionLocal()
try:
    ticket = db.get(Ticket, result["ticket_id"])
    assert ticket is not None
    assert ticket.source == "AI"
    assert ticket.task_category == "housekeeping"
finally:
    db.close()

status, analytics = request("GET", f"/api/v1/hotels/{hotel_id}/ai/analytics", token=token)
assert status == 200
assert analytics["data"]["total_requests"] >= 1

print(json.dumps({
    "hotel_id": hotel_id,
    "conversation_id": conversation_id,
    "intent": result["decision"]["intent"],
    "ticket_id": result["ticket_id"],
    "analytics_total_requests": analytics["data"]["total_requests"],
}, indent=2))
'@ | .\.venv-win\Scripts\python.exe -
```

Expected output:

```json
{
  "hotel_id": "...",
  "conversation_id": "...",
  "intent": "housekeeping",
  "ticket_id": "...",
  "analytics_total_requests": 1
}
```

## Dashboard Functional Test

1. Open `http://localhost:3000`.
2. Login as the hotel owner/admin.
3. Open `/{hotelId}/ai/settings`.
4. Configure local AI using the MVP settings above.
5. Save settings.
6. Open `/{hotelId}/ai`.
7. Confirm:
   - provider displays correctly,
   - status is connected,
   - automation toggles reflect saved settings,
   - analytics cards load without errors.

If using a real provider, use the Test button on the settings page after saving the API key.

## WhatsApp Functional Notes

WhatsApp AI handoff is intentionally conservative.

To test it manually:

1. Create or reuse a WhatsApp session that is already `active` or `live_chat`.
2. Configure hotel AI with a connected real provider.
3. Set `is_active` to true.
4. Keep auto-reply disabled for first tests.
5. Send a plain text message through the WhatsApp webhook.
6. Confirm the webhook response includes AI processing data and that the conversation/ticket state is correct.

New guest onboarding messages, interactive buttons, and menu flows should still use `BotService`. This protects the existing working WhatsApp bot behavior.

## Troubleshooting

Backend import error in ad hoc scripts:

- Set `PYTHONPATH=backend`.

Frontend proxy returns `500`:

- Confirm backend is running on the port in `apps/dashboard/.env.local`.
- Confirm `API_PROXY_TARGET=http://localhost:8000`.
- Restart the frontend after env changes.

AI returns low confidence:

- Check provider configuration and model.
- Check whether the provider returned valid JSON.
- Inspect `/ai/analytics/logs` for errors.
- For local provider, use operational keywords such as `towel`, `pillow`, `cleaning`, `AC`, `TV`, `food`, or `complaint`.

No ticket created:

- Confirm `enable_ticket_creation` is true.
- Confirm confidence is at or above high threshold.
- Confirm there is no existing open ticket on the same conversation.
- Confirm the hotel has active departments and ticket categories.

Unexpected WhatsApp behavior:

- Confirm the session is existing and in `active` or `live_chat`.
- Confirm the message is plain text, not an interactive reply.
- Confirm AI runtime is enabled with a non-local connected provider.
- New sessions are intentionally handled by the legacy bot.

## Current Verified Results

Last verified on Windows development environment:

- AI chatbot targeted tests: `4 passed`
- Full backend suite: `48 passed`
- Frontend typecheck: passed
- Backend dev server: `http://127.0.0.1:8000`
- Frontend dev server: `http://127.0.0.1:3000`
- Live AI smoke test result:
  - intent: `housekeeping`
  - ticket source: `AI`
  - ticket category: `housekeeping`
  - analytics request count: `1`
