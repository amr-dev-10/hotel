# AI Chatbot Conversation Test Cases

Use this document to manually test the AI chatbot behavior after the AI Operations MVP is running.

## Current Integrated Providers

Current code-level AI providers:

- `local` - deterministic keyword provider for development and automated tests.
- `gemini` - Google Gemini adapter.
- `openai` - OpenAI adapter.
- `anthropic` - Anthropic Claude adapter.

Current tested development model:

- Provider: `local`
- Model: `local-keyword`

Recommended real-provider examples:

- Gemini: `gemini-2.0-flash`
- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-5-sonnet-latest`

The local provider is the only provider used in automated tests. Real providers require API keys and should be tested carefully with auto-reply disabled first.

## Required Test Setup

Run backend:

```powershell
.\.venv-win\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Run frontend:

```powershell
pnpm --filter @arcadia/dashboard dev
```

Dashboard env:

```env
NEXT_PUBLIC_API_BASE_URL=/api/v1
API_PROXY_TARGET=http://localhost:8000
NEXT_PUBLIC_WS_BASE_URL=ws://localhost:8000
```

Configure hotel AI settings from:

```text
http://localhost:3000/{hotelId}/ai/settings
```

Use this development configuration:

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

## How To Execute Each Case

For API testing, call:

```http
POST /api/v1/hotels/{hotel_id}/ai/chat
```

Body:

```json
{
  "conversation_id": "<conversation_id>",
  "message": "<guest message>"
}
```

After each test, check:

- response `processed`,
- response `decision.intent`,
- response `decision.confidence`,
- response `action.reply_action`,
- response `action.ticket_action`,
- whether `ticket_created` is expected,
- whether `suggested_reply` is present,
- `/api/v1/hotels/{hotel_id}/ai/analytics` request count increased.

## Conversation Cases

### Case 1 - Housekeeping Towels

Guest message:

```text
Please send two extra towels to my room.
```

Expected local-provider result:

- Intent: `housekeeping`
- Sentiment: `neutral`
- Confidence: around `0.92`
- Ticket required: yes
- Reply required: yes
- Ticket action: `auto_create`
- Reply action: `suggest`
- Ticket department: `housekeeping`
- Ticket category: `housekeeping`
- Ticket source: `AI`

Pass criteria:

- AI creates a ticket.
- Ticket `conversation_id` matches the conversation.
- Staff suggested reply is present.
- No WhatsApp auto-send happens because auto-reply is off.

### Case 2 - Housekeeping Pillow

Guest message:

```text
Can I get one extra pillow?
```

Expected result:

- Intent: `housekeeping`
- Ticket created
- Suggested reply present
- Department: `housekeeping`

Pass criteria:

- Ticket is created with source `AI`.
- Ticket description mentions housekeeping-style assistance.

### Case 3 - Room Cleaning

Guest message:

```text
My room needs cleaning.
```

Expected result:

- Intent: `housekeeping`
- Ticket created
- Priority: normal operational priority
- Department: `housekeeping`

Pass criteria:

- Staff can see a new ticket in ticket list.

### Case 4 - Maintenance AC

Guest message:

```text
The AC is not working.
```

Expected result:

- Intent: `maintenance`
- Ticket created
- Department: `engineering`
- Task category: `maintenance`

Pass criteria:

- Ticket source is `AI`.
- Ticket category is `maintenance`.

### Case 5 - Maintenance TV

Guest message:

```text
The TV is not working in my room.
```

Expected result:

- Intent: `maintenance`
- Ticket created
- Department: `engineering`
- Suggested reply present

### Case 6 - Plumbing Leak

Guest message:

```text
There is a leak in the bathroom.
```

Expected result:

- Intent: `maintenance`
- Ticket created
- Department: `engineering`
- Priority: `2`

### Case 7 - Food Order

Guest message:

```text
I want to order dinner.
```

Expected result:

- Intent: `food_order`
- Ticket created
- Department: `food_beverage`
- Task category: `room_service`
- Suggested reply present

### Case 8 - Coffee Or Tea Request

Guest message:

```text
Please send coffee to my room.
```

Expected result:

- Intent: `food_order`
- Ticket created
- Department: `food_beverage`

### Case 9 - Complaint

Guest message:

```text
I am unhappy with the dirty room and bad service.
```

Expected result:

- Intent: `complaint`
- Sentiment: `negative`
- Confidence: around `0.88`
- Ticket created because negative sentiment override applies
- Department: `front_office`
- Priority: high

Pass criteria:

- Ticket is created.
- Ticket has source `AI`.
- Analytics logs negative sentiment.

### Case 10 - Emergency

Guest message:

```text
There is a fire in the hallway.
```

Expected result:

- Intent: `emergency`
- Sentiment: `negative`
- Confidence: high
- Ticket created
- Department: `front_office`
- Priority: urgent

Pass criteria:

- Ticket priority is urgent/high.
- Suggested reply indicates immediate staff alert.

### Case 11 - Information Request

Guest message:

```text
What time is breakfast?
```

Expected local-provider result:

- Intent: `information_request`
- Confidence: around `0.76`
- Reply required: yes
- Ticket required: no
- Ticket action: `none`
- Reply action: `suggest`

Pass criteria:

- No ticket is created.
- Suggested reply is present.

Note:

With real provider and hotel knowledge documents, this should answer more directly from hotel policy/context.

### Case 12 - Wi-Fi Question

Guest message:

```text
What is the Wi-Fi password?
```

Expected local-provider result:

- Intent: `information_request`
- Medium confidence
- Suggested reply
- No ticket

Pass criteria:

- No ticket created unless confidence/configuration is changed.

### Case 13 - Unknown/Ambiguous Message

Guest message:

```text
It is not okay here.
```

Expected result:

- Intent: `unknown`
- Low confidence
- Reply action: `none`
- Ticket action: `escalation`
- Escalation ticket created if no open ticket exists

Pass criteria:

- AI does not send guest-facing answer.
- Staff review ticket is created.

### Case 14 - Invalid Provider JSON Safety

This is covered by automated tests, but can also be simulated by unit testing `AIResponseParser`.

Expected result:

- Parser returns `parse_error: true`
- Confidence: `0`
- Ticket required: yes
- Reply required: no
- Staff escalation path is used

Pass criteria:

- Bad provider output never becomes an unsafe guest reply.

### Case 15 - Open Ticket Already Exists

Setup:

1. Create a conversation.
2. Create an unresolved ticket linked to that conversation.
3. Send another similar message:

```text
I still need towels.
```

Expected result:

- Decision can still be `housekeeping`.
- `has_open_ticket` prevents duplicate auto-ticket creation.

Pass criteria:

- No duplicate ticket is created for the same conversation when an open ticket already exists.

### Case 16 - Auto-Reply Disabled

Setup:

- `enable_auto_reply = false`

Guest message:

```text
Please send extra towels.
```

Expected result:

- Ticket created.
- Suggested reply present.
- `reply_sent = false`.

Pass criteria:

- No outbound WhatsApp message is recorded by AI.

### Case 17 - Auto-Reply Enabled

Setup:

- `enable_auto_reply = true`
- Use local/direct `/ai/chat` endpoint first, not production WhatsApp.

Guest message:

```text
Please send extra towels.
```

Expected result:

- Ticket created.
- `reply_sent = true`.
- Outbound WhatsApp message row recorded in dry-run style.

Pass criteria:

- Outbound message exists in `whatsapp_messages`.
- Use carefully with real WhatsApp credentials.

### Case 18 - WhatsApp New Guest Still Uses Existing Bot

Setup:

- No existing WhatsApp session for guest phone.
- Send text webhook:

```text
Hi
```

Expected result:

- Existing `BotService` onboarding flow runs.
- AI does not take over.

Pass criteria:

- Guest receives onboarding/menu response.
- No AI ticket is created.

### Case 19 - WhatsApp Active Session AI Handoff

Setup:

- Existing WhatsApp session is `active` or `live_chat`.
- Hotel AI settings are connected and active.
- Provider is a real provider, not `local`, for WhatsApp runtime handoff.
- Auto-reply disabled for first test.

Guest message:

```text
The AC is not working.
```

Expected result:

- AI processes message.
- Maintenance decision is produced.
- Ticket can be created according to thresholds.
- Suggested reply may be available for staff.

Pass criteria:

- Existing onboarding/menu flow is not used for this active text message.
- Ticket and analytics are created correctly.

### Case 20 - Live Chat Suggested Reply

Endpoint:

```http
POST /api/v1/hotels/{hotel_id}/live-chat/generate-reply
```

Body:

```json
{
  "conversation_id": "<conversation_id>",
  "staff_context": "Guest has already waited 10 minutes."
}
```

Expected result:

- Reply text returned.
- Intent and confidence returned.
- No ticket is automatically created by this endpoint.

Pass criteria:

- Staff can use suggested text for manual response.

## Regression Checklist

Run these after any chatbot change:

```powershell
.\.venv-win\Scripts\python.exe -m pytest backend\tests\test_ai_chatbot_mvp.py -v
.\.venv-win\Scripts\python.exe -m pytest backend\tests\test_v1_whatsapp_flow.py -v
.\.venv-win\Scripts\python.exe -m pytest backend\tests
pnpm --filter @arcadia/dashboard typecheck
```

Expected current result:

- AI chatbot tests: `4 passed`
- Full backend suite: `48 passed`
- Frontend typecheck: exit code `0`

## Adding Grok/xAI

Current status:

- Grok/xAI is not currently integrated in this codebase.
- The current provider list is `local`, `gemini`, `openai`, and `anthropic`.

Official xAI docs currently show OpenAI-compatible access with:

- base URL: `https://api.x.ai/v1`
- model example: `grok-4.3`
- chat endpoint: `/v1/chat/completions`

Sources:

- xAI overview and examples: https://docs.x.ai/overview
- xAI chat API reference: https://docs.x.ai/developers/rest-api-reference/inference/chat

Because your app already has an OpenAI-style provider abstraction, adding Grok is a small-to-medium backend change.

### Minimal Grok Integration Plan

Add config:

```python
xai_api_key: str = ""
```

Add provider:

```text
backend/app/integrations/ai/xai_provider.py
```

Register provider:

```python
PROVIDERS = {
    "local": LocalProvider,
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "xai": XAIProvider,
}
```

Provider implementation can reuse the installed `openai` package with:

```python
OpenAI(api_key=<xai key>, base_url="https://api.x.ai/v1")
```

Then call chat completions or responses with a Grok model such as `grok-4.3`.

Frontend changes:

- Add `xai` option to AI Provider select.
- Suggested model placeholder: `grok-4.3`.
- Domain label: `xAI Grok`.

Schema/settings changes:

- No major schema change is required because settings already store `provider`, `model`, and write-only `api_key`.
- Optional: add `XAI_API_KEY` environment support for platform-level default.

Tests to add:

- Unit test that `get_ai_provider("xai")` returns `XAIProvider`.
- Mocked provider chat test verifying it returns the standard `AIChatResponse` shape.
- Optional live provider test behind an environment variable, skipped when `XAI_API_KEY` is absent.

### Estimated Change Size

Approximate files to modify:

- `backend/app/core/config.py`
- `backend/app/integrations/ai/factory.py`
- `backend/app/integrations/ai/xai_provider.py`
- `apps/dashboard/src/features/ai/components/ai-settings-page.tsx`
- optional tests in `backend/tests`
- optional docs update

Approximate code size:

- 80-150 backend lines for provider/config/tests.
- 2-10 frontend lines for provider select/model hint.

Risk:

- Low if xAI OpenAI-compatible API is used.
- Medium if you want xAI-specific Responses API, structured outputs, tool calling, or pricing/usage accounting.

Recommendation:

- Add Grok first as `provider="xai"` using OpenAI-compatible chat completions.
- Keep response parsing through existing `AIResponseParser`.
- Keep auto-reply disabled until manual conversation cases pass.
