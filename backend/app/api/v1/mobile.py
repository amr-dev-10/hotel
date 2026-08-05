from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user, require_any_permission, require_permission
from app.core.database import get_db, set_tenant_context
from app.core.exceptions import forbidden, missing_any_permission, missing_permission, not_found
from app.core.permissions import Permissions
from app.core.responses import ok
from app.models.user import User
from app.services.mobile_compat_service import MobileCompatService
from app.services.rbac_service import RBACService
from app.services.user_service import UserService

router = APIRouter()


TICKET_VIEW_PERMISSIONS = (
    Permissions.TICKET_VIEW,
    Permissions.TICKET_VIEW_OWN,
    Permissions.TICKET_VIEW_DEPT,
    Permissions.TICKET_VIEW_ALL,
)
MOBILE_REFERENCE_PERMISSIONS = (
    Permissions.TICKET_VIEW,
    Permissions.TICKET_CREATE,
    Permissions.TICKET_UPDATE,
    Permissions.TICKET_ASSIGN_OTHERS,
    Permissions.ROOM_VIEW,
    Permissions.USER_VIEW,
    Permissions.HOTEL_SETTINGS_MANAGE,
)
MOBILE_MEDIA_UPLOAD_PERMISSIONS = (
    Permissions.MEDIA_UPLOAD,
    Permissions.TICKET_CREATE,
    Permissions.TICKET_UPDATE,
    Permissions.TICKET_VIEW,
)


def _service(db: Session) -> MobileCompatService:
    return MobileCompatService(db)


def _ensure_mobile_hotel(hotel_id: str, current_user: User, db: Session) -> None:
    ensure_hotel_access(hotel_id, current_user)
    set_tenant_context(db, hotel_id)


def _mobile_identity_matches(user: User, employee_id: str) -> bool:
    value = str(employee_id or "").strip()
    return bool(value and value in {user.id, user.employee_code})


def _require_mobile_any(db: Session, current_user: User, permission_codes: tuple[str, ...]) -> None:
    if not RBACService(db).has_any(current_user, permission_codes):
        raise missing_any_permission(permission_codes)


def _require_mobile_staff_target(
    service: MobileCompatService,
    hotel_id: str,
    employee_id: str,
) -> User:
    user = service.resolve_user_any(employee_id, hotel_id)
    if not user:
        raise not_found("User not found")
    return user


def _ensure_can_view_mobile_staff(db: Session, current_user: User, target: User) -> None:
    if not RBACService(db).can_view_staff(current_user, target):
        raise forbidden("Staff member is outside your access scope")


def _ensure_can_update_mobile_staff(db: Session, current_user: User, target: User) -> None:
    if not RBACService(db).can_update_staff(current_user, target):
        raise forbidden("Staff member is outside your access scope")


def _require_visible_mobile_ticket(
    service: MobileCompatService,
    db: Session,
    hotel_id: str,
    task_id: str,
    current_user: User,
    include_deleted: bool = False,
):
    ticket = service.require_ticket(hotel_id, task_id, include_deleted=include_deleted)
    if not RBACService(db).can_view_ticket(current_user, ticket):
        raise forbidden("Task is outside your access scope")
    return ticket


def _ensure_mobile_ticket_update_allowed(db: Session, current_user: User, ticket) -> None:
    if not RBACService(db).can_update_ticket(current_user, ticket):
        raise forbidden("Task is outside your update scope")


def _ensure_mobile_ticket_delete_allowed(db: Session, current_user: User, ticket) -> None:
    if not RBACService(db).can_delete_ticket(current_user, ticket):
        raise forbidden("Task is outside your delete scope")


def _ensure_mobile_ticket_assignment_allowed(
    db: Session,
    current_user: User,
    ticket,
    assignee_id: str | None,
) -> None:
    rbac = RBACService(db)
    if assignee_id == current_user.id:
        if rbac.can_assign_ticket_to_self(current_user, ticket):
            return
    elif assignee_id and rbac.can_assign_ticket_to_others(current_user, ticket):
        return
    elif not assignee_id and rbac.can_assign_ticket_to_others(current_user, ticket):
        return
    permission = Permissions.TICKET_ASSIGN_SELF if assignee_id == current_user.id else Permissions.TICKET_ASSIGN_OTHERS
    raise missing_permission(permission, "Missing ticket assignment permission")


def _mobile_payload_assignee_id(
    service: MobileCompatService,
    hotel_id: str,
    payload: dict[str, Any],
) -> str | None:
    assignee_value = str(payload.get("AssignedToID") or payload.get("attendantId") or payload.get("employeeId") or "").strip()
    if not assignee_value:
        return None
    assignee = service.resolve_user_any(assignee_value, hotel_id)
    return assignee.id if assignee else None


def _ensure_mobile_create_assignment_allowed(
    db: Session,
    current_user: User,
    department_id: str | None,
    assignee_id: str | None,
) -> None:
    if not assignee_id or current_user.is_hotel_owner:
        return
    rbac = RBACService(db)
    assigns_self = assignee_id == current_user.id
    required_permission = Permissions.TICKET_ASSIGN_SELF if assigns_self else Permissions.TICKET_ASSIGN_OTHERS
    if not rbac.has_permission(current_user, required_permission):
        raise missing_permission(required_permission, "Missing ticket assignment permission")
    scope = rbac.permission_scope(current_user, required_permission)
    if scope == "hotel":
        return
    if scope == "department" and department_id and department_id == current_user.department_id:
        return
    if scope == "own" and assigns_self:
        return
    raise forbidden("Ticket assignment is outside your access scope")


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
    current_user: User = Depends(require_any_permission(*MOBILE_REFERENCE_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_departments(hotel_id))


@router.get("/hotels/{hotel_id}/rooms")
def mobile_rooms(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*MOBILE_REFERENCE_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_rooms(hotel_id))


@router.get("/hotels/{hotel_id}/users")
def mobile_users(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.USER_VIEW)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_users(hotel_id, current_user=current_user))


@router.get("/hotels/{hotel_id}/users/{employee_id}")
def mobile_user(
    hotel_id: str,
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    user = service.resolve_user_any(employee_id, hotel_id)
    if user and not _mobile_identity_matches(current_user, employee_id):
        RBACService(db).require(current_user, Permissions.USER_VIEW)
        _ensure_can_view_mobile_staff(db, current_user, user)
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
    service = _service(db)
    target = service.resolve_user_any(employee_id, hotel_id)
    rbac = RBACService(db)
    if target:
        rbac.require(current_user, Permissions.USER_UPDATE)
        _ensure_can_update_mobile_staff(db, current_user, target)
    else:
        rbac.require(current_user, Permissions.USER_CREATE)
    return ok(service.upsert_user(hotel_id, employee_id, payload, actor=current_user))


@router.post("/hotels/{hotel_id}/users/{employee_id}/active-status")
def mobile_user_active_status(
    hotel_id: str,
    employee_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    target = _require_mobile_staff_target(service, hotel_id, employee_id)
    if not _mobile_identity_matches(current_user, employee_id):
        RBACService(db).require(current_user, Permissions.USER_UPDATE)
        _ensure_can_update_mobile_staff(db, current_user, target)
    return ok(service.set_active_status(hotel_id, employee_id, bool(payload.get("active")), current_user.id))


@router.delete("/hotels/{hotel_id}/users/{employee_id}")
def mobile_delete_user(
    hotel_id: str,
    employee_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.USER_DELETE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    target = _require_mobile_staff_target(_service(db), hotel_id, employee_id)
    _ensure_can_update_mobile_staff(db, current_user, target)
    UserService(db).delete_user(hotel_id, target.id, current_user)
    return ok({"deleted": True, "user_id": employee_id})


@router.get("/hotels/{hotel_id}/tasks")
def mobile_tasks(
    hotel_id: str,
    stage: str | None = None,
    assigned_to: str | None = None,
    deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*TICKET_VIEW_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_tasks(hotel_id, stage=stage, assigned_to=assigned_to, deleted=deleted, current_user=current_user))


@router.get("/hotels/{hotel_id}/tasks/counts")
def mobile_task_counts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*TICKET_VIEW_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).active_task_counts(hotel_id, current_user=current_user))


@router.post("/hotels/{hotel_id}/tasks")
def mobile_create_task(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_CREATE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    department = service.resolve_department(hotel_id, payload.get("Department")) or service.first_department(hotel_id)
    _ensure_mobile_create_assignment_allowed(
        db,
        current_user,
        department.id if department else None,
        _mobile_payload_assignee_id(service, hotel_id, payload),
    )
    return ok(service.create_task(hotel_id, payload, actor=current_user))


@router.get("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_task(
    hotel_id: str,
    task_id: str,
    include_deleted: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*TICKET_VIEW_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    ticket = _require_visible_mobile_ticket(service, db, hotel_id, task_id, current_user, include_deleted=include_deleted)
    return ok(service.mobile_task(ticket))


@router.patch("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_update_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    ticket = _require_visible_mobile_ticket(service, db, hotel_id, task_id, current_user)
    if "AssignedToID" in payload:
        _ensure_mobile_ticket_assignment_allowed(
            db,
            current_user,
            ticket,
            _mobile_payload_assignee_id(service, hotel_id, payload),
        )
    _ensure_mobile_ticket_update_allowed(db, current_user, ticket)
    return ok(service.update_task(hotel_id, task_id, payload))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/assign")
def mobile_assign_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    service = _service(db)
    assignee_value = str(payload.get("attendantId") or payload.get("employeeId") or "")
    ticket = _require_visible_mobile_ticket(service, db, hotel_id, task_id, current_user)
    assignee = service.resolve_user_any(assignee_value, hotel_id) if assignee_value else None
    _ensure_mobile_ticket_assignment_allowed(db, current_user, ticket, assignee.id if assignee else None)
    return ok(service.assign_task(hotel_id, task_id, assignee_value, payload.get("attendantName")))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/transfer")
def mobile_transfer_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_ASSIGN_OTHERS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    ticket = _require_visible_mobile_ticket(_service(db), db, hotel_id, task_id, current_user)
    if not RBACService(db).can_assign_ticket_to_others(current_user, ticket):
        raise missing_permission(Permissions.TICKET_ASSIGN_OTHERS, "Missing ticket assignment permission")
    return ok(_service(db).transfer_task(hotel_id, task_id, str(payload.get("newDepartment") or payload.get("Department") or ""), payload.get("assignTo")))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/workflow-step")
def mobile_workflow_step(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    ticket = _require_visible_mobile_ticket(_service(db), db, hotel_id, task_id, current_user)
    _ensure_mobile_ticket_update_allowed(db, current_user, ticket)
    photo_urls = payload.get("photoUrls") if isinstance(payload.get("photoUrls"), list) else None
    return ok(_service(db).mark_workflow_step(hotel_id, task_id, str(payload.get("step") or ""), photo_urls))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/sla-exceeded")
def mobile_sla_exceeded(
    hotel_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    ticket = _require_visible_mobile_ticket(_service(db), db, hotel_id, task_id, current_user)
    _ensure_mobile_ticket_update_allowed(db, current_user, ticket)
    return ok(_service(db).mark_sla_exceeded(hotel_id, task_id))


@router.post("/hotels/{hotel_id}/tasks/{task_id}/reject")
def mobile_reject_task(
    hotel_id: str,
    task_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    ticket = _require_visible_mobile_ticket(_service(db), db, hotel_id, task_id, current_user)
    _ensure_mobile_ticket_update_allowed(db, current_user, ticket)
    return ok(_service(db).reject_task(hotel_id, task_id, str(payload.get("employeeId") or payload.get("employee_id") or current_user.employee_code or current_user.id)))


@router.delete("/hotels/{hotel_id}/tasks/{task_id}")
def mobile_delete_task(
    hotel_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_DELETE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    ticket = _require_visible_mobile_ticket(_service(db), db, hotel_id, task_id, current_user)
    _ensure_mobile_ticket_delete_allowed(db, current_user, ticket)
    return ok(_service(db).delete_task(hotel_id, task_id, current_user.id))


@router.get("/hotels/{hotel_id}/deleted-tasks")
def mobile_deleted_tasks(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_DELETE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_tasks(hotel_id, deleted=True, current_user=current_user))


@router.get("/hotels/{hotel_id}/inventory")
def mobile_inventory(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.INVENTORY_MANAGE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).list_inventory(hotel_id))


@router.post("/hotels/{hotel_id}/inventory")
def mobile_add_inventory(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.INVENTORY_MANAGE)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(_service(db).add_inventory_item(hotel_id, str(payload.get("name") or payload.get("Name") or "")))


@router.patch("/hotels/{hotel_id}/inventory/{item_id}")
def mobile_update_inventory(
    hotel_id: str,
    item_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.INVENTORY_MANAGE)),
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
    if chat_type == "GUEST":
        RBACService(db).require(current_user, Permissions.LIVE_CHAT_MANAGE)
    elif not (_mobile_identity_matches(current_user, user_id1) or _mobile_identity_matches(current_user, user_id2)):
        RBACService(db).require(current_user, Permissions.LIVE_CHAT_MANAGE)
    return ok(_service(db).list_chat_messages(hotel_id, user_id1, user_id2, chat_type))


@router.post("/hotels/{hotel_id}/chat/messages")
def mobile_send_chat_message(
    hotel_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    chat_type = str(payload.get("chatType") or "USER")
    sender_id = str(payload.get("senderId") or "")
    if chat_type == "GUEST":
        RBACService(db).require(current_user, Permissions.LIVE_CHAT_MANAGE)
    elif not _mobile_identity_matches(current_user, sender_id):
        raise forbidden("You can only send mobile chat messages as yourself")
    return ok(
        _service(db).send_chat_message(
            hotel_id,
            sender_id,
            str(payload.get("receiverId") or ""),
            str(payload.get("message") or ""),
            chat_type,
        )
    )


@router.get("/hotels/{hotel_id}/chat/guest-threads")
def mobile_guest_threads(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.LIVE_CHAT_MANAGE)),
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
    current_user_id = str(payload.get("currentUserId") or "")
    if not _mobile_identity_matches(current_user, current_user_id):
        RBACService(db).require(current_user, Permissions.LIVE_CHAT_MANAGE)
    unseen = _service(db).update_unread(
        hotel_id,
        current_user_id,
        str(payload.get("targetUserId") or ""),
        str(payload.get("name") or ""),
        bool(payload.get("increment")),
    )
    return ok(unseen)


@router.get("/hotels/{hotel_id}/notifications/claims")
def mobile_claim_notifications(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*TICKET_VIEW_PERMISSIONS)),
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
    if not _mobile_identity_matches(current_user, employee_id):
        RBACService(db).require(current_user, Permissions.TICKET_ASSIGN_OTHERS)
    return ok(_service(db).mark_claim_read(hotel_id, notification_id, employee_id))


@router.get("/hotels/{hotel_id}/notifications/escalations")
def mobile_escalations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*TICKET_VIEW_PERMISSIONS)),
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
    if not _mobile_identity_matches(current_user, employee_id):
        raise forbidden("You can only register a mobile token for yourself")
    return ok(_service(db).register_fcm_token(hotel_id, employee_id, str(payload.get("token") or ""), str(payload.get("platform") or "android")))


@router.post("/hotels/{hotel_id}/media/upload")
async def mobile_upload(
    hotel_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*MOBILE_MEDIA_UPLOAD_PERMISSIONS)),
) -> dict:
    _ensure_mobile_hotel(hotel_id, current_user, db)
    return ok(await _service(db).save_upload(hotel_id, file, current_user))
