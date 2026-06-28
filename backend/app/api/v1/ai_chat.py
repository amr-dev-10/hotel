from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.ai_models import AIPrompt
from app.models.user import User
from app.schemas.ai import (
    AIChatRequest,
    AIGenerateTicketRequest,
    AIProcessingResult,
    AIPromptCreate,
    AIPromptRead,
    AIPromptUpdate,
    AISuggestReplyRequest,
    AISummarizeRequest,
    AIUsageLogRead,
)
from app.services.ai_analytics_service import AIAnalyticsService
from app.services.ai_orchestrator import AIOrchestratorService
from app.services.ai_settings_service import AISettingsService

router = APIRouter()


@router.post("/chat")
async def process_ai_chat(
    hotel_id: str,
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    result = await AIOrchestratorService.process_message(
        db,
        hotel_id,
        payload.conversation_id,
        payload.message,
        source="dashboard",
    )
    return ok(result.model_dump())


@router.post("/suggest-reply")
async def suggest_ai_reply(
    hotel_id: str,
    payload: AISuggestReplyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    result = await AIOrchestratorService.generate_reply(
        db,
        hotel_id,
        payload.conversation_id,
        payload.staff_context,
    )
    return ok(result.model_dump())


@router.post("/generate-ticket")
async def generate_ai_ticket(
    hotel_id: str,
    payload: AIGenerateTicketRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    result = await AIOrchestratorService.generate_ticket(
        db,
        hotel_id,
        payload.conversation_id,
        payload.message,
    )
    return ok(result.model_dump())


@router.post("/summarize")
async def summarize_ai_conversation(
    hotel_id: str,
    payload: AISummarizeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    summary = await AIOrchestratorService.summarize_conversation(db, hotel_id, payload.conversation_id)
    return ok({"summary": summary})


@router.get("/analytics")
def ai_analytics(
    hotel_id: str,
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.view")),
) -> dict:
    return ok(AIAnalyticsService.get_usage_summary(db, hotel_id, days).model_dump())


@router.get("/analytics/logs")
def ai_analytics_logs(
    hotel_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.view")),
) -> dict:
    rows = AIAnalyticsService.list_logs(db, hotel_id, limit=limit)
    return ok([AIUsageLogRead.model_validate(row).model_dump() for row in rows])


@router.post("/test-provider")
def test_ai_provider(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    return ok(AISettingsService(db).test(hotel_id))


@router.get("/prompts")
def list_ai_prompts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rows = db.execute(
        select(AIPrompt)
        .where(AIPrompt.hotel_id == hotel_id)
        .order_by(AIPrompt.name, AIPrompt.version.desc())
    ).scalars().all()
    return ok([AIPromptRead.model_validate(row).model_dump() for row in rows])


@router.post("/prompts")
def create_ai_prompt(
    hotel_id: str,
    payload: AIPromptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    prompt = AIPrompt(hotel_id=hotel_id, **payload.model_dump())
    db.add(prompt)
    db.commit()
    db.refresh(prompt)
    return ok(AIPromptRead.model_validate(prompt).model_dump())


@router.put("/prompts/{prompt_id}")
def update_ai_prompt(
    hotel_id: str,
    prompt_id: str,
    payload: AIPromptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    prompt = db.execute(
        select(AIPrompt).where(AIPrompt.hotel_id == hotel_id, AIPrompt.id == prompt_id)
    ).scalar_one_or_none()
    if not prompt:
        raise not_found("AI prompt not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(prompt, key, value)
    db.commit()
    db.refresh(prompt)
    return ok(AIPromptRead.model_validate(prompt).model_dump())
