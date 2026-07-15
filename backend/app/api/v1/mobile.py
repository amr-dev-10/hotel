from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db, set_tenant_context
from app.core.responses import ok
from app.models.user import User
from app.services.mobile_compat_service import MobileCompatService

router = APIRouter()


def _service(db: Session) -> MobileCompatService:
    return MobileCompatService(db)


def _ensure_mobile_hotel(hotel_id: str, current_user: User, db: Session) -> None:
    ensure_hotel_access(hotel_id, current_user)
    set_tenant_context(db, hotel_id)


@router.post("/auth/login")
def mobile_login(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict:
    employee_id = str(payload.get("employeeId") or payload.get("employee_id") or payload.get("EmployeeId") or "")
    password = str(payload.get("password") or payload.get("Password") or "")
    selected_role = payload.get("userType") or payload.get("user_type") or payload.get("role")
    return ok(_service(db).login(employee_id, password, str(selected_role) if selected_role else None))


@router.get("/auth/me")
def mobile_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return ok(_service(db).mobile_user(current_user))


@router.get("/hotels/{hotel_id}/departments")
def mobile_departments(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_departments(hotel_id))


@router.get("/hotels/{hotel_id}/rooms")
def mobile_rooms(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_rooms(hotel_id))


@router.get("/hotels/{hotel_id}/users")
def mobile_users(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_users(hotel_id))


@router.get("/hotels/{hotel_id}/users/{employee_id}")
def mobile_user(
    hotel_id: str,
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    user = _service(db).resolve_user_any(employee_id, hotel_id)
    return ok(_service(db).mobile_user(user) if user else None)


@router.patch("/hotels/{hotel_id}/users/{employee_id}")
@router.put("/hotels/{hotel_id}/users/{employee_id}")
def mobile_upsert_user(
    hotel_id: str,
    employee_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).upsert_user(hotel_id, employee_id, payload))


@router.post("/hotels/{hotel_id}/users/{employee_id}/active-status")
def mobile_user_active_status(
    hotel_id: str,
    employee_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).set_active_status(hotel_id, employee_id, bool(payload.get("active"))))


@router.delete("/hotels/{hotel_id}/users/{employee_id}")
def mobile_delete_user(
    hotel_id: str,
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).delete_user(hotel_id, employee_id, current_user.id))


@router.get("/hotels/{hotel_id}/tasks")
def mobile_tasks(
    hotel_id: str,
    stage: str | None = None,
    assigned_to: str | None = None,
    deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_tasks(hotel_id, stage=stage, assigned_to=assigned_to, deleted=deleted))


@router.get("/hotels/{hotel_id}/tasks/counts")
def mobile_task_counts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).active_task_counts(hotel_id))


@router.post("/hotels/{hotel_id}/tasks")
def mobile_create_task(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).create_task(hotel_id, payload, actor=current_user))


@router.get("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_task(
    hotel_id: str,
    task_id: str,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).get_task(hotel_id, task_id, include_deleted=include_deleted))


@router.patch("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_update_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).update_task(hotel_id, task_id, payload))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/assign")
def mobile_assign_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).assign_task(hotel_id, task_id, str(payload.get("attendantId") or payload.get("employeeId") or ""), payload.get("attendantName")))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/transfer")
def mobile_transfer_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).transfer_task(hotel_id, task_id, str(payload.get("newDepartment") or payload.get("Department") or ""), payload.get("assignTo")))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/workflow-step")
def mobile_workflow_step(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    photo_urls = payload.get("photoUrls") if isinstance(payload.get("photoUrls"), list) else None
    return ok(_service(db).mark_workflow_step(hotel_id, task_id, str(payload.get("step") or ""), photo_urls))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/sla-exceeded")
def mobile_sla_exceeded(
    hotel_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).mark_sla_exceeded(hotel_id, task_id))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/reject")
def mobile_reject_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).reject_task(hotel_id, task_id, str(payload.get("employeeId") or payload.get("employee_id") or current_user.employee_code or current_user.id)))


@router.delete("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_delete_task(
    hotel_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).delete_task(hotel_id, task_id, current_user.id))


@router.get("/hotels/{hotel_id}/deleted-tasks")
def mobile_deleted_tasks(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_tasks(hotel_id, deleted=True))


@router.get("/hotels/{hotel_id}/inventory")
def mobile_inventory(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_inventory(hotel_id))


@router.post("/hotels/{hotel_id}/inventory")
def mobile_add_inventory(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).add_inventory_item(hotel_id, str(payload.get("name") or payload.get("Name") or "")))


@router.patch("/hotels/{hotel_id}/inventory/{item_id}")
def mobile_update_inventory(
    hotel_id: str,
    item_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).update_inventory_availability(hotel_id, item_id, bool(payload.get("available") if "available" in payload else payload.get("Available"))))


@router.get("/hotels/{hotel_id}/chat/messages")
def mobile_chat_messages(
    hotel_id: str,
    user_id1: str = Query(alias="userId1"),
    user_id2: str = Query(alias="userId2"),
    chat_type: str = Query(default="USER", alias="chatType"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_chat_messages(hotel_id, user_id1, user_id2, chat_type))


@router.post("/hotels/{hotel_id}/chat/messages")
def mobile_send_chat_message(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(
        _service(db).send_chat_message(
            hotel_id,
            str(payload.get("senderId") or ""),
            str(payload.get("receiverId") or ""),
            str(payload.get("message") or ""),
            str(payload.get("chatType") or "USER"),
        )
    )


@router.get("/hotels/{hotel_id}/chat/guest-threads")
def mobile_guest_threads(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).guest_threads(hotel_id))


@router.post("/hotels/{hotel_id}/chat/unread")
def mobile_update_unread(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    unseen = _service(db).update_unread(
        hotel_id,
        str(payload.get("currentUserId") or ""),
        str(payload.get("targetUserId") or ""),
        str(payload.get("name") or ""),
        bool(payload.get("increment")),
    )
    return ok(unseen)


@router.get("/hotels/{hotel_id}/notifications/claims")
def mobile_claim_notifications(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).claim_notifications(hotel_id))


@router.post("/hotels/{hotel_id}/notifications/claims/{notification_id}/read")
def mobile_mark_claim_read(
    hotel_id: str,
    notification_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    employee_id = str(payload.get("employeeId") or current_user.employee_code or current_user.id)
    return ok(_service(db).mark_claim_read(hotel_id, notification_id, employee_id))


@router.get("/hotels/{hotel_id}/notifications/escalations")
def mobile_escalations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).escalations(hotel_id))


@router.post("/hotels/{hotel_id}/fcm-token")
def mobile_fcm_token(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    employee_id = str(payload.get("employeeId") or current_user.employee_code or current_user.id)
    return ok(_service(db).register_fcm_token(hotel_id, employee_id, str(payload.get("token") or ""), str(payload.get("platform") or "android")))


@router.post("/hotels/{hotel_id}/media/upload")
async def mobile_upload(
    hotel_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(await _service(db).save_upload(hotel_id, file, current_user))
