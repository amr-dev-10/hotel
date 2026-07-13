from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import bad_request, forbidden, not_found
from app.core.security import verify_password
from app.models.availability import RoomBlock
from app.models.base import utcnow
from app.models.department import Department
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.inventory import InventoryItem
from app.models.ops import MediaFile, Notification
from app.models.room import Room
from app.models.ticket import MobileChatMessage, Ticket
from app.models.user import User
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.repositories.user_repository import FCMTokenRepository
from app.schemas.ops import FCMTokenRead
from app.services.auth_service import AuthService
from app.services.notification_service import NotificationService


MOBILE_TERMINAL_STAGES = {"Completed", "Cancelled", "Delivered", "Closed"}
CANONICAL_STAGE_TO_MOBILE = {
    "Open": "Created",
    "created": "Created",
    "pending_accept": "Assigned",
    "accepted": "Assigned",
    "in_progress": "Assigned",
    "pending_approval": "Executed",
    "approved": "Completed",
    "Completed": "Completed",
    "closed": "Completed",
    "resolved": "Completed",
}
MOBILE_STAGE_TO_CANONICAL = {
    "Created": "Open",
    "Assigned": "accepted",
    "Executed": "pending_approval",
    "Completed": "approved",
}
PRIORITY_TO_INT = {"Routine": 2, "Important": 3, "High": 4}
INT_TO_PRIORITY = {1: "Routine", 2: "Routine", 3: "Important", 4: "High", 5: "High"}


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _norm(value: Any) -> str:
    return _text(value).lower().replace(" ", "").replace("_", "").replace("-", "")


def _canon_dept(value: Any) -> str:
    normalized = _norm(value)
    if normalized in {
        "fnb",
        "roomservice",
        "inroomdining",
        "foodandbeverage",
        "foodandbeverages",
        "foodbeveragesupport",
        "foodandbeveragesupport",
    }:
        return "foodandbeverages"
    if normalized in {"engineersupport", "technicalsupport", "maintenance", "technical", "engineering", "maintainance"}:
        return "engineering"
    if normalized in {"emergencyservices", "emergencyresponse", "handlegeneralinquiries", "safety", "frontdesk", "reception"}:
        return "frontdesk"
    if normalized in {"housekeeping", "housekeeping"}:
        return "housekeeping"
    return normalized


def _role_name(user: User) -> str:
    raw = user.job_role or user.staff_level or user.user_type or ""
    normalized = _norm(raw)
    if normalized in {"attendant", "attendent"}:
        return "Attendent"
    if normalized in {"frontdesk", "frontdeskagent", "reception"}:
        return "Front_desk"
    if normalized in {"manager", "supervisor"}:
        return "Manager"
    if user.is_hotel_owner:
        return "Owner"
    return raw or "Attendent"


def _mobile_employee_id(user: User | None) -> str:
    if not user:
        return ""
    return user.employee_code or user.id


def _safe_payload(ticket: Ticket) -> dict[str, Any]:
    return ticket.mobile_payload if isinstance(ticket.mobile_payload, dict) else {}


class MobileCompatService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ----- auth / hotels -----
    def login(self, employee_id: str, password: str, selected_role: str | None = None) -> dict[str, Any]:
        user = self.resolve_user_any(employee_id)
        if not user or not user.is_active or user.deleted_at is not None:
            raise bad_request("Invalid employee ID or password")
        if not verify_password(password, user.hashed_password):
            raise bad_request("Invalid employee ID or password")
        hotel = self.db.get(Hotel, user.hotel_id)
        if not hotel:
            raise not_found("Hotel not found")
        if _norm(hotel.status) == "suspended":
            raise forbidden("Hotel is suspended. Contact Admin.")

        token = AuthService(self.db).token_for_user(user)
        return {
            **token,
            "user": self.mobile_user(user),
            "hotel": self.mobile_hotel(hotel),
            "selected_role": selected_role,
        }

    def mobile_hotel(self, hotel: Hotel) -> dict[str, Any]:
        return {
            "id": hotel.id,
            "hotel_id": hotel.id,
            "name": hotel.name,
            "hotelName": hotel.name,
            "status": hotel.status,
            "timezone": hotel.timezone,
        }

    # ----- users -----
    def resolve_user_any(self, employee_id: str, hotel_id: str | None = None) -> User | None:
        value = _text(employee_id)
        if not value:
            return None
        statement = select(User).where(
            or_(User.employee_code == value, User.id == value),
            User.deleted_at.is_(None),
        )
        if hotel_id:
            statement = statement.where(User.hotel_id == hotel_id)
        return self.db.execute(statement).scalars().first()

    def require_user(self, employee_id: str, hotel_id: str) -> User:
        user = self.resolve_user_any(employee_id, hotel_id)
        if not user:
            raise not_found("User not found")
        return user

    def mobile_user(self, user: User) -> dict[str, Any]:
        department = self.db.get(Department, user.department_id) if user.department_id else None
        return {
            "EmployeeId": _mobile_employee_id(user),
            "Email": user.email,
            "Name": user.name,
            "Jobrole": _role_name(user),
            "JobRole": _role_name(user),
            "Status": bool(user.is_on_duty),
            "Department": department.key if department else None,
            "ProfileImage": user.profile_image_url or "",
            "isHotelOwner": bool(user.is_hotel_owner),
            "hotel_id": user.hotel_id,
            "OnlineForChat": bool(user.online_for_chat),
            "UnseenMessages": user.unseen_messages or [],
        }

    def list_users(self, hotel_id: str) -> list[dict[str, Any]]:
        users = self.db.execute(
            select(User).where(User.hotel_id == hotel_id, User.deleted_at.is_(None)).order_by(User.name)
        ).scalars().all()
        return [self.mobile_user(user) for user in users]

    def upsert_user(self, hotel_id: str, employee_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        user = self.resolve_user_any(employee_id, hotel_id)
        department = self.resolve_department(hotel_id, payload.get("Department"))
        password = _text(payload.get("Password"))
        email = _text(payload.get("Email")) or f"{employee_id}@mobile.local"
        name = _text(payload.get("Name")) or employee_id
        job_role = _text(payload.get("Jobrole") or payload.get("JobRole")) or "Attendent"

        if user is None:
            user = User(
                hotel_id=hotel_id,
                employee_code=employee_id,
                department_id=department.id if department else None,
                user_type="HOTEL_ADMIN" if payload.get("isHotelOwner") else "HOTEL_EMPLOYEE",
                staff_level=self.staff_level_from_mobile_role(job_role, payload.get("isHotelOwner") is True),
                name=name,
                email=email,
                hashed_password=AuthService.password_hash(password or "changeme"),
                job_role=job_role,
                profile_image_url=_text(payload.get("ProfileImage")) or None,
                is_hotel_owner=payload.get("isHotelOwner") is True,
                is_active=True,
                is_on_duty=bool(payload.get("Status")),
                online_for_chat=bool(payload.get("OnlineForChat")),
                unseen_messages=payload.get("UnseenMessages") if isinstance(payload.get("UnseenMessages"), list) else [],
            )
            self.db.add(user)
        else:
            if "EmployeeId" in payload or not user.employee_code:
                user.employee_code = _text(payload.get("EmployeeId")) or employee_id
            if "Name" in payload:
                user.name = name
            if "Email" in payload:
                user.email = email
            if password:
                user.hashed_password = AuthService.password_hash(password)
            if "Jobrole" in payload or "JobRole" in payload:
                user.job_role = job_role
                user.staff_level = self.staff_level_from_mobile_role(job_role, user.is_hotel_owner)
            if "Department" in payload:
                user.department_id = department.id if department else None
            if "Status" in payload:
                user.is_on_duty = bool(payload.get("Status"))
            if "ProfileImage" in payload:
                user.profile_image_url = _text(payload.get("ProfileImage")) or None
            if "OnlineForChat" in payload:
                user.online_for_chat = bool(payload.get("OnlineForChat"))
            if isinstance(payload.get("UnseenMessages"), list):
                user.unseen_messages = payload["UnseenMessages"]
        self.db.commit()
        self.db.refresh(user)
        return self.mobile_user(user)

    def set_active_status(self, hotel_id: str, employee_id: str, active: bool, deactivated_by: str = "self") -> dict[str, Any]:
        user = self.require_user(employee_id, hotel_id)
        user.is_on_duty = active
        user.deactivated_by = "" if active else deactivated_by
        self.db.commit()
        self.db.refresh(user)
        if active and user.department_id:
            self.assign_pending_tickets(hotel_id, user.department_id)
        return self.mobile_user(user)

    def delete_user(self, hotel_id: str, employee_id: str, actor_id: str | None = None) -> dict[str, Any]:
        user = self.require_user(employee_id, hotel_id)
        user.deleted_at = utcnow()
        user.deleted_by = actor_id
        user.is_active = False
        self.db.commit()
        return {"deleted": True, "user_id": employee_id}

    def staff_level_from_mobile_role(self, role: str, is_owner: bool = False) -> str:
        if is_owner:
            return "admin"
        normalized = _norm(role)
        if normalized == "manager":
            return "manager"
        if normalized in {"frontdesk", "frontdeskagent"}:
            return "manager"
        return "attendant"

    # ----- departments / rooms -----
    def resolve_department(self, hotel_id: str, raw: Any) -> Department | None:
        value = _text(raw)
        if not value or _norm(value) == "all":
            return None
        wanted = _canon_dept(value)
        departments = self.db.execute(
            select(Department).where(
                Department.hotel_id == hotel_id,
                Department.deleted_at.is_(None),
                Department.is_active.is_(True),
            )
        ).scalars().all()
        for department in departments:
            keys = [_canon_dept(department.key), _canon_dept(department.name)]
            keys.extend(_canon_dept(keyword) for keyword in (department.keywords or []))
            if wanted in keys:
                return department
        return None

    def first_department(self, hotel_id: str) -> Department | None:
        return self.db.execute(
            select(Department).where(
                Department.hotel_id == hotel_id,
                Department.deleted_at.is_(None),
                Department.is_active.is_(True),
            ).order_by(Department.sort_order, Department.name)
        ).scalars().first()

    def list_departments(self, hotel_id: str) -> list[dict[str, Any]]:
        departments = self.db.execute(
            select(Department).where(
                Department.hotel_id == hotel_id,
                Department.deleted_at.is_(None),
                Department.is_active.is_(True),
            ).order_by(Department.sort_order, Department.name)
        ).scalars().all()
        return [
            {
                "id": department.id,
                "name": department.name,
                "key": department.key,
                "description": department.description or "",
                "keywords": department.keywords or [],
                "resolutionTime": department.resolution_time,
                "resolutionMinutes": self.department_minutes(department),
            }
            for department in departments
        ]

    def department_minutes(self, department: Department | None) -> int | None:
        if not department or not department.resolution_time:
            return None
        digits = "".join(ch for ch in department.resolution_time if ch.isdigit())
        return int(digits) if digits else None

    def resolve_room(self, hotel_id: str, room_no: Any) -> Room | None:
        value = _text(room_no)
        if not value:
            return None
        return self.db.execute(
            select(Room).where(
                Room.hotel_id == hotel_id,
                Room.room_number == value,
                Room.deleted_at.is_(None),
            )
        ).scalars().first()

    def list_rooms(self, hotel_id: str) -> list[dict[str, Any]]:
        rooms = self.db.execute(
            select(Room).where(Room.hotel_id == hotel_id, Room.deleted_at.is_(None)).order_by(Room.room_number)
        ).scalars().all()
        blocks = self.db.execute(
            select(RoomBlock).where(RoomBlock.hotel_id == hotel_id).order_by(RoomBlock.start_date)
        ).scalars().all()
        blocks_by_room: dict[str, list[RoomBlock]] = {}
        for block in blocks:
            if block.room_id:
                blocks_by_room.setdefault(block.room_id, []).append(block)
        return [self.mobile_room(room, blocks_by_room.get(room.id, [])) for room in rooms]

    def mobile_room(self, room: Room, blocks: list[RoomBlock]) -> dict[str, Any]:
        status = _norm(room.status)
        active = status in {"maintenance", "outoforder", "blocked", "unavailable"}
        return {
            "id": room.id,
            "hotel_id": room.hotel_id,
            "roomNo": room.room_number,
            "floor": room.floor,
            "roomType": room.room_type,
            "maintenance": {
                "active": active,
                "reason": room.notes,
                "since": room.updated_at.isoformat() if active and room.updated_at else None,
                "clearedAt": None if active else room.updated_at.isoformat() if room.updated_at else None,
            },
            "maintenanceBlocks": [
                {
                    "id": block.id,
                    "from": block.start_date.isoformat(),
                    "to": block.end_date.isoformat(),
                    "reason": block.notes,
                    "createdBy": block.created_by,
                    "createdByName": None,
                    "createdAt": block.created_at.isoformat() if block.created_at else None,
                }
                for block in blocks
                if block.block_type in {"maintenance", "out_of_order", "blocked"}
            ],
        }

    # ----- tickets / tasks -----
    def mobile_task(self, ticket: Ticket) -> dict[str, Any]:
        payload = _safe_payload(ticket)
        department = self.db.get(Department, ticket.department_id) if ticket.department_id else None
        room = self.db.get(Room, ticket.room_id) if ticket.room_id else None
        assignee = self.db.get(User, ticket.assigned_to) if ticket.assigned_to else None
        stage = payload.get("Stage") or CANONICAL_STAGE_TO_MOBILE.get(ticket.stage, ticket.stage or "Created")
        priority = payload.get("Priority") or ticket.mobile_priority_label or INT_TO_PRIORITY.get(ticket.priority, "Routine")
        room_no = ticket.mobile_updated_room_no or ticket.mobile_room_no or (room.room_number if room else None)
        base = {
            **payload,
            "TaskId": ticket.id,
            "RandomTaskId": payload.get("RandomTaskId") or ticket.ticket_code,
            "RoomNo": payload.get("RoomNo") or ticket.mobile_room_no or (room.room_number if room else ""),
            "UpdatedRoomNo": payload.get("UpdatedRoomNo") or ticket.mobile_updated_room_no or None,
            "TaskAdderName": payload.get("TaskAdderName") or ticket.mobile_task_adder_name or "",
            "TaskAdderId": payload.get("TaskAdderId") or ticket.mobile_task_adder_id or "",
            "Priority": priority,
            "Note": payload.get("Note") if "Note" in payload else ticket.mobile_note,
            "ItemOrdered": payload.get("ItemOrdered") or ticket.mobile_item_ordered or ticket.item_description,
            "PaidBy": payload.get("PaidBy") or ticket.mobile_paid_by,
            "AddOns": payload.get("AddOns") if isinstance(payload.get("AddOns"), list) else [],
            "DesiredDate": payload.get("DesiredDate") or ticket.mobile_desired_date,
            "DesiredTime": payload.get("DesiredTime") or ticket.mobile_desired_time,
            "GuestName": payload.get("GuestName") or ticket.mobile_guest_name or "",
            "AssignedToID": _mobile_employee_id(assignee),
            "AssignedToName": assignee.name if assignee else payload.get("AssignedToName") or "",
            "Stage": stage,
            "DeliveryStatus": payload.get("DeliveryStatus") or ticket.mobile_delivery_status,
            "TicketType": payload.get("TicketType") or ticket.mobile_ticket_type or ticket.type,
            "Department": payload.get("Department") or (department.key if department else None),
            "WorkflowStep": payload.get("WorkflowStep") or ticket.mobile_workflow_step or ("Accepted" if assignee else "Pending"),
            "CandidateIds": payload.get("CandidateIds") if isinstance(payload.get("CandidateIds"), list) else [],
            "RejectedByIds": payload.get("RejectedByIds") if isinstance(payload.get("RejectedByIds"), list) else [],
            "SlaAlertSent": bool(payload.get("SlaAlertSent", False)),
            "AssignmentHistory": payload.get("AssignmentHistory") if isinstance(payload.get("AssignmentHistory"), list) else [],
            "CreatedTime": payload.get("CreatedTime") or self.epoch_ms(ticket.created_at),
            "hotel_id": ticket.hotel_id,
            "guest_id": ticket.guest_id,
            "timestamp": payload.get("timestamp") or self.epoch_ms(ticket.created_at),
            "roomNo": room_no,
        }
        return base

    def list_tasks(self, hotel_id: str, stage: str | None = None, assigned_to: str | None = None, deleted: bool = False) -> list[dict[str, Any]]:
        statement = select(Ticket).where(Ticket.hotel_id == hotel_id)
        if deleted:
            statement = statement.where(Ticket.deleted_at.is_not(None))
        else:
            statement = statement.where(Ticket.deleted_at.is_(None))
        if assigned_to:
            user = self.resolve_user_any(assigned_to, hotel_id)
            statement = statement.where(Ticket.assigned_to == (user.id if user else "__missing__"))
        if stage:
            canonical = MOBILE_STAGE_TO_CANONICAL.get(stage, stage)
            stage_aliases = {
                "Created": ("Open", "created"),
                "Assigned": ("accepted", "pending_accept", "in_progress"),
                "Executed": ("pending_approval",),
                "Completed": ("approved", "Completed", "closed", "resolved"),
            }
            statement = statement.where(Ticket.stage.in_(stage_aliases.get(stage, (canonical,))))
        rows = self.db.execute(statement.order_by(Ticket.created_at.desc())).scalars().all()
        tasks = [self.mobile_task(row) for row in rows]
        if stage:
            tasks = [task for task in tasks if _norm(task.get("Stage")) == _norm(stage)]
        return tasks

    def get_task(self, hotel_id: str, task_id: str, include_deleted: bool = False) -> dict[str, Any] | None:
        statement = select(Ticket).where(Ticket.hotel_id == hotel_id, Ticket.id == task_id)
        if not include_deleted:
            statement = statement.where(Ticket.deleted_at.is_(None))
        ticket = self.db.execute(statement).scalars().first()
        return self.mobile_task(ticket) if ticket else None

    def require_ticket(self, hotel_id: str, task_id: str, include_deleted: bool = False) -> Ticket:
        statement = select(Ticket).where(Ticket.hotel_id == hotel_id, Ticket.id == task_id)
        if not include_deleted:
            statement = statement.where(Ticket.deleted_at.is_(None))
        ticket = self.db.execute(statement).scalars().first()
        if not ticket:
            raise not_found("Task not found")
        return ticket

    def create_task(self, hotel_id: str, payload: dict[str, Any], actor: User | None = None) -> dict[str, Any]:
        data = dict(payload)
        ticket_type = _text(data.get("TicketType"))
        if _norm(ticket_type) in {"complaint", "complaints"}:
            data["Department"] = "Front_desk"
        department = self.resolve_department(hotel_id, data.get("Department")) or self.first_department(hotel_id)
        if not department:
            raise not_found("No active department exists for this hotel")
        room = self.resolve_room(hotel_id, data.get("UpdatedRoomNo") or data.get("RoomNo"))
        assignee = self.resolve_user_any(_text(data.get("AssignedToID")), hotel_id) if data.get("AssignedToID") else None
        now = utcnow()
        data.setdefault("TaskId", "")
        data.setdefault("RandomTaskId", self.mobile_task_code())
        data.setdefault("Stage", "Created")
        data.setdefault("WorkflowStep", "Pending")
        data.setdefault("CandidateIds", [])
        data.setdefault("RejectedByIds", [])
        data.setdefault("SlaAlertSent", False)
        data.setdefault("hotel_id", hotel_id)
        data.setdefault("timestamp", self.epoch_ms(now))
        data.setdefault("CreatedTime", self.epoch_ms(now))
        ticket = Ticket(
            hotel_id=hotel_id,
            ticket_code=_text(data.get("RandomTaskId")) or self.mobile_task_code(),
            guest_id=_text(data.get("guest_id")) or None,
            room_id=room.id if room else None,
            department_id=department.id,
            assigned_to=assignee.id if assignee else None,
            stage=MOBILE_STAGE_TO_CANONICAL.get(_text(data.get("Stage")), "Open"),
            mobile_workflow_step=_text(data.get("WorkflowStep")) or "Pending",
            mobile_delivery_status=_text(data.get("DeliveryStatus")) or None,
            mobile_room_no=_text(data.get("RoomNo")) or (room.room_number if room else None),
            mobile_updated_room_no=_text(data.get("UpdatedRoomNo")) or None,
            mobile_guest_name=_text(data.get("GuestName")) or None,
            mobile_task_adder_id=_text(data.get("TaskAdderId")) or (_mobile_employee_id(actor) if actor else None),
            mobile_task_adder_name=_text(data.get("TaskAdderName")) or (actor.name if actor else None),
            mobile_priority_label=_text(data.get("Priority")) or "Routine",
            mobile_ticket_type=ticket_type or "Service",
            mobile_item_ordered=_text(data.get("ItemOrdered")) or None,
            mobile_note=_text(data.get("Note")) or None,
            mobile_paid_by=_text(data.get("PaidBy")) or None,
            mobile_desired_date=_text(data.get("DesiredDate")) or None,
            mobile_desired_time=_text(data.get("DesiredTime")) or None,
            mobile_payload=data,
            type=ticket_type or "Service",
            item_description=_text(data.get("ItemOrdered")) or _text(data.get("Note")) or _text(data.get("GuestName")) or "Task",
            source="MOBILE",
            followers=[assignee.id] if assignee else [],
            priority=PRIORITY_TO_INT.get(_text(data.get("Priority")), 2),
            sla_due_at=None,
        )
        self.db.add(ticket)
        self.db.flush()
        data["TaskId"] = ticket.id
        ticket.mobile_payload = data
        if assignee:
            self.apply_mobile_patch(
                ticket,
                {
                    "Stage": "Assigned",
                    "WorkflowStep": "Accepted",
                    "AssignedToID": _mobile_employee_id(assignee),
                    "AssignedToName": assignee.name,
                    "AssignedTime": str(self.epoch_ms(now)),
                    "AcceptedTime": str(self.epoch_ms(now)),
                    "TimerStartTime": str(self.epoch_ms(now)),
                    "SlaAlertSent": False,
                },
                commit=False,
            )
        else:
            self.auto_assign_ticket(ticket, commit=False)
        self.db.commit()
        self.db.refresh(ticket)
        self.notify_task_assignment(ticket)
        return self.mobile_task(ticket)

    def update_task(self, hotel_id: str, task_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        self.apply_mobile_patch(ticket, payload, commit=True)
        if payload.get("Escalated") or "EscalationLevel" in payload:
            self.notify_escalation(ticket)
        return self.mobile_task(ticket)

    def apply_mobile_patch(self, ticket: Ticket, patch: dict[str, Any], commit: bool = True) -> None:
        payload = {**_safe_payload(ticket), **patch}
        if "Stage" in patch:
            ticket.stage = MOBILE_STAGE_TO_CANONICAL.get(_text(patch["Stage"]), _text(patch["Stage"]))
        if "WorkflowStep" in patch:
            ticket.mobile_workflow_step = _text(patch["WorkflowStep"]) or None
        if "DeliveryStatus" in patch:
            ticket.mobile_delivery_status = _text(patch["DeliveryStatus"]) or None
        if "Priority" in patch:
            ticket.mobile_priority_label = _text(patch["Priority"]) or None
            ticket.priority = PRIORITY_TO_INT.get(_text(patch["Priority"]), ticket.priority)
        if "RoomNo" in patch:
            ticket.mobile_room_no = _text(patch["RoomNo"]) or None
            room = self.resolve_room(ticket.hotel_id, patch["RoomNo"])
            if room:
                ticket.room_id = room.id
        if "UpdatedRoomNo" in patch:
            ticket.mobile_updated_room_no = _text(patch["UpdatedRoomNo"]) or None
        if "GuestName" in patch:
            ticket.mobile_guest_name = _text(patch["GuestName"]) or None
        if "TaskAdderId" in patch:
            ticket.mobile_task_adder_id = _text(patch["TaskAdderId"]) or None
        if "TaskAdderName" in patch:
            ticket.mobile_task_adder_name = _text(patch["TaskAdderName"]) or None
        if "TicketType" in patch:
            ticket.mobile_ticket_type = _text(patch["TicketType"]) or None
            ticket.type = _text(patch["TicketType"]) or ticket.type
        if "ItemOrdered" in patch:
            ticket.mobile_item_ordered = _text(patch["ItemOrdered"]) or None
            if _text(patch["ItemOrdered"]):
                ticket.item_description = _text(patch["ItemOrdered"])
        if "Note" in patch:
            ticket.mobile_note = _text(patch["Note"]) or None
            if not ticket.mobile_item_ordered and _text(patch["Note"]):
                ticket.item_description = _text(patch["Note"])
        if "PaidBy" in patch:
            ticket.mobile_paid_by = _text(patch["PaidBy"]) or None
        if "DesiredDate" in patch:
            ticket.mobile_desired_date = _text(patch["DesiredDate"]) or None
        if "DesiredTime" in patch:
            ticket.mobile_desired_time = _text(patch["DesiredTime"]) or None
        if "Department" in patch:
            department = self.resolve_department(ticket.hotel_id, patch["Department"])
            if department:
                ticket.department_id = department.id
        if "AssignedToID" in patch:
            assignee = self.resolve_user_any(_text(patch["AssignedToID"]), ticket.hotel_id)
            ticket.assigned_to = assignee.id if assignee else None
            payload["AssignedToID"] = _mobile_employee_id(assignee)
            payload["AssignedToName"] = assignee.name if assignee else ""
        ticket.mobile_payload = payload
        if commit:
            self.db.commit()
            self.db.refresh(ticket)

    def assign_task(self, hotel_id: str, task_id: str, employee_id: str, name: str | None = None) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        assignee = self.require_user(employee_id, hotel_id)
        now = str(self.epoch_ms(utcnow()))
        history = self.assignment_history(ticket, "reassigned")
        self.apply_mobile_patch(
            ticket,
            {
                "AssignedToID": _mobile_employee_id(assignee),
                "AssignedToName": name or assignee.name,
                "Stage": "Assigned",
                "WorkflowStep": "Accepted",
                "AssignedTime": now,
                "AcceptedTime": now,
                "TimerStartTime": now,
                "SlaAlertSent": False,
                "CandidateIds": [],
                "AssignmentHistory": history,
            },
            commit=True,
        )
        self.notify_task_assignment(ticket)
        return self.mobile_task(ticket)

    def transfer_task(self, hotel_id: str, task_id: str, new_department: str, assign_to: dict[str, Any] | None = None) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        department = self.resolve_department(hotel_id, new_department)
        if not department:
            raise not_found("Department not found")
        history = self.assignment_history(ticket, "transferred")
        patch: dict[str, Any] = {
            "Department": department.key,
            "CandidateIds": [],
            "RejectedByIds": [],
            "AssignmentHistory": history,
        }
        if assign_to and assign_to.get("id"):
            assignee = self.require_user(assign_to["id"], hotel_id)
            now = str(self.epoch_ms(utcnow()))
            patch.update(
                {
                    "AssignedToID": _mobile_employee_id(assignee),
                    "AssignedToName": _text(assign_to.get("name")) or assignee.name,
                    "Stage": "Assigned",
                    "WorkflowStep": "Accepted",
                    "AssignedTime": now,
                    "AcceptedTime": now,
                    "TimerStartTime": now,
                    "SlaAlertSent": False,
                }
            )
            self.apply_mobile_patch(ticket, patch, commit=True)
        else:
            patch.update({"AssignedToID": "", "AssignedToName": "", "Stage": "Created", "WorkflowStep": "Pending"})
            self.apply_mobile_patch(ticket, patch, commit=False)
            ticket.department_id = department.id
            self.auto_assign_ticket(ticket, commit=True)
        self.notify_task_assignment(ticket)
        return self.mobile_task(ticket)

    def mark_workflow_step(self, hotel_id: str, task_id: str, step: str, photo_urls: list[str] | None = None) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        now = str(self.epoch_ms(utcnow()))
        patch: dict[str, Any] = {"WorkflowStep": step}
        if step == "EnRoute":
            patch["EnRouteTime"] = now
            if photo_urls:
                patch["EnRoutePhotos"] = photo_urls
        elif step == "AtLocation":
            patch["AtLocationTime"] = now
            if photo_urls:
                patch["AtLocationPhotos"] = photo_urls
        self.apply_mobile_patch(ticket, patch, commit=True)
        return self.mobile_task(ticket)

    def mark_sla_exceeded(self, hotel_id: str, task_id: str) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        self.apply_mobile_patch(ticket, {"SlaAlertSent": True}, commit=True)
        return self.mobile_task(ticket)

    def reject_task(self, hotel_id: str, task_id: str, employee_id: str) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        payload = _safe_payload(ticket)
        rejected = list(payload.get("RejectedByIds") or [])
        if employee_id not in rejected:
            rejected.append(employee_id)
        self.apply_mobile_patch(ticket, {"RejectedByIds": rejected}, commit=True)
        return self.mobile_task(ticket)

    def delete_task(self, hotel_id: str, task_id: str, actor_id: str | None = None) -> dict[str, Any]:
        ticket = self.require_ticket(hotel_id, task_id)
        ticket.deleted_at = utcnow()
        ticket.deleted_by = actor_id
        self.db.commit()
        return {"deleted": True, "task_id": task_id}

    def assignment_history(self, ticket: Ticket, reason: str) -> list[dict[str, Any]]:
        payload = _safe_payload(ticket)
        prior = payload.get("AssignmentHistory") if isinstance(payload.get("AssignmentHistory"), list) else []
        assignee = self.db.get(User, ticket.assigned_to) if ticket.assigned_to else None
        previous_id = _mobile_employee_id(assignee) or _text(payload.get("AssignedToID"))
        previous_name = assignee.name if assignee else _text(payload.get("AssignedToName")) or "Unknown"
        if not previous_id and not previous_name:
            return prior
        return [
            *prior,
            {
                "EmployeeId": previous_id,
                "Name": previous_name,
                "Department": payload.get("Department"),
                "AssignedAt": payload.get("AssignedTime"),
                "ReplacedAt": str(self.epoch_ms(utcnow())),
                "Reason": reason,
            },
        ]

    def assign_pending_tickets(self, hotel_id: str, department_id: str) -> None:
        rows = self.db.execute(
            select(Ticket).where(
                Ticket.hotel_id == hotel_id,
                Ticket.department_id == department_id,
                Ticket.assigned_to.is_(None),
                Ticket.deleted_at.is_(None),
            )
        ).scalars().all()
        assigned: list[Ticket] = []
        for ticket in rows:
            if _safe_payload(ticket).get("Stage", "Created") == "Created":
                self.auto_assign_ticket(ticket, commit=False)
                if ticket.assigned_to:
                    assigned.append(ticket)
        self.db.commit()
        for ticket in assigned:
            self.notify_task_assignment(ticket)

    def auto_assign_ticket(self, ticket: Ticket, commit: bool = True) -> None:
        if ticket.assigned_to:
            return
        department = self.db.get(Department, ticket.department_id) if ticket.department_id else None
        dept_key = _canon_dept(department.key if department else "")
        users = self.db.execute(
            select(User).where(
                User.hotel_id == ticket.hotel_id,
                User.is_active.is_(True),
                User.is_on_duty.is_(True),
                User.deleted_at.is_(None),
            )
        ).scalars().all()
        candidates = []
        for user in users:
            user_department = self.db.get(Department, user.department_id) if user.department_id else None
            user_dept_key = _canon_dept(user_department.key if user_department else "")
            role = _norm(_role_name(user))
            if role in {"attendent", "attendant"} and user_dept_key == dept_key:
                rank = 0
            elif role in {"manager", "frontdesk"} and user_dept_key == dept_key:
                rank = 1
            elif user_dept_key == "frontdesk" and dept_key != "frontdesk":
                rank = 2
            elif user.is_hotel_owner or user.staff_level == "admin" or user.user_type == "HOTEL_ADMIN":
                rank = 3
            else:
                continue
            candidates.append((rank, user))
        if not candidates:
            return
        load = {
            user.id: self.db.execute(
                select(func.count()).select_from(Ticket).where(
                    Ticket.hotel_id == ticket.hotel_id,
                    Ticket.assigned_to == user.id,
                    Ticket.deleted_at.is_(None),
                    Ticket.stage.not_in(("approved", "Completed", "closed", "resolved", "cancelled")),
                )
            ).scalar_one()
            for _, user in candidates
        }
        _, best = sorted(candidates, key=lambda item: (item[0], load[item[1].id], item[1].name))[0]
        now = str(self.epoch_ms(utcnow()))
        self.apply_mobile_patch(
            ticket,
            {
                "AssignedToID": _mobile_employee_id(best),
                "AssignedToName": best.name,
                "Stage": "Assigned",
                "WorkflowStep": "Accepted",
                "AssignedTime": now,
                "AcceptedTime": now,
                "TimerStartTime": now,
                "SlaAlertSent": False,
                "CandidateIds": [],
            },
            commit=False,
        )
        if commit:
            self.db.commit()

    def notify_task_assignment(self, ticket: Ticket) -> None:
        if not ticket.assigned_to:
            return
        task = self.mobile_task(ticket)
        item = _text(task.get("ItemOrdered")) or ticket.item_description or "New task"
        room = _text(task.get("UpdatedRoomNo") or task.get("RoomNo"))
        body = f"{item} - Room {room}" if room else item
        notifier = NotificationService(self.db)
        notifier.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.assigned",
                "ticket_id": ticket.id,
                "taskId": ticket.id,
                "department_id": ticket.department_id,
                "room_id": ticket.room_id,
                "item": item,
                "assigned_to": ticket.assigned_to,
            },
        )
        notifier.send_fcm_to_user(
            ticket.assigned_to,
            "New Ticket",
            body,
            {"event": "new_ticket", "taskId": ticket.id, "ticket_id": ticket.id, "hotel_id": ticket.hotel_id},
        )

    def escalation_recipients(self, ticket: Ticket, level: int) -> list[User]:
        users = self.db.execute(
            select(User).where(
                User.hotel_id == ticket.hotel_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).scalars().all()
        recipients = []
        for user in users:
            role = _norm(_role_name(user))
            if level >= 2:
                if user.is_hotel_owner or user.staff_level == "admin" or user.user_type == "HOTEL_ADMIN":
                    recipients.append(user)
                continue
            if role not in {"manager", "frontdesk"} or user.is_hotel_owner:
                continue
            if not ticket.department_id or user.department_id == ticket.department_id:
                recipients.append(user)
        return recipients

    def notify_escalation(self, ticket: Ticket) -> None:
        task = self.mobile_task(ticket)
        level = int(task.get("EscalationLevel") or 0)
        if level <= 0:
            return
        item = _text(task.get("ItemOrdered")) or ticket.item_description or "Ticket"
        room = _text(task.get("UpdatedRoomNo") or task.get("RoomNo"))
        department = _text(task.get("Department"))
        body = item
        if room:
            body += f" - Room {room}"
        if department:
            body += f" ({department})"
        title = "Critical: ticket still unresolved" if level >= 2 else "Ticket overdue"
        notifier = NotificationService(self.db)
        notifier.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.escalated",
                "ticket_id": ticket.id,
                "taskId": ticket.id,
                "level": "admin" if level >= 2 else "manager",
                "department_id": ticket.department_id,
                "item": item,
            },
        )
        for user in self.escalation_recipients(ticket, level):
            notifier.send_fcm_to_user(
                user.id,
                title,
                body,
                {
                    "event": "escalation",
                    "taskId": ticket.id,
                    "ticket_id": ticket.id,
                    "hotel_id": ticket.hotel_id,
                    "level": "admin" if level >= 2 else "manager",
                },
            )

    def active_task_counts(self, hotel_id: str) -> dict[str, int]:
        rows = self.db.execute(
            select(Ticket).where(
                Ticket.hotel_id == hotel_id,
                Ticket.assigned_to.is_not(None),
                Ticket.deleted_at.is_(None),
                Ticket.stage.not_in(("approved", "Completed", "closed", "resolved", "cancelled")),
            )
        ).scalars().all()
        counts: dict[str, int] = {}
        for ticket in rows:
            user = self.db.get(User, ticket.assigned_to) if ticket.assigned_to else None
            employee_id = _mobile_employee_id(user)
            if employee_id:
                counts[employee_id] = counts.get(employee_id, 0) + 1
        return counts

    # ----- inventory -----
    def list_inventory(self, hotel_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            select(InventoryItem).where(InventoryItem.hotel_id == hotel_id).order_by(InventoryItem.name)
        ).scalars().all()
        return [{"id": row.id, "Name": row.name, "Available": bool(row.mobile_available)} for row in rows]

    def add_inventory_item(self, hotel_id: str, name: str) -> dict[str, Any]:
        clean = _text(name)
        if not clean:
            raise bad_request("Name is required")
        existing = self.db.execute(
            select(InventoryItem).where(InventoryItem.hotel_id == hotel_id, func.lower(InventoryItem.name) == clean.lower())
        ).scalars().first()
        if existing:
            raise bad_request("Already exists")
        item = InventoryItem(
            hotel_id=hotel_id,
            name=clean,
            category="mobile",
            unit="piece",
            min_stock=0,
            current_stock=0,
            cost_per_unit=0,
            is_active=True,
            mobile_available=False,
        )
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return {"id": item.id, "Name": item.name, "Available": bool(item.mobile_available)}

    def update_inventory_availability(self, hotel_id: str, item_id: str, available: bool) -> dict[str, Any]:
        item = self.db.execute(
            select(InventoryItem).where(InventoryItem.hotel_id == hotel_id, or_(InventoryItem.id == item_id, InventoryItem.name == item_id))
        ).scalars().first()
        if not item:
            raise not_found("Inventory item not found")
        item.mobile_available = available
        self.db.commit()
        self.db.refresh(item)
        return {"id": item.id, "Name": item.name, "Available": bool(item.mobile_available)}

    # ----- chat / notifications -----
    def chat_room_key(self, user_id1: str, user_id2: str, chat_type: str) -> str:
        if chat_type == "GUEST":
            return f"Guest/{user_id2}"
        return "+".join(sorted([user_id1, user_id2]))

    def send_chat_message(self, hotel_id: str, sender_id: str, receiver_id: str, message: str, chat_type: str = "USER") -> dict[str, Any]:
        chat_type = "GUEST" if chat_type == "GUEST" else "USER"
        if chat_type == "GUEST":
            return self.send_guest_chat_message(hotel_id, sender_id, receiver_id, message)
        sender = self.resolve_user_any(sender_id, hotel_id)
        row = MobileChatMessage(
            hotel_id=hotel_id,
            room_key=self.chat_room_key(sender_id, receiver_id, chat_type),
            chat_type=chat_type,
            sender_id=sender_id,
            receiver_id=receiver_id,
            sender_name=sender.name if sender else None,
            message=message,
            created_at=utcnow(),
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self.mobile_chat_message(row)

    def list_chat_messages(self, hotel_id: str, user_id1: str, user_id2: str, chat_type: str = "USER") -> list[dict[str, Any]]:
        if chat_type == "GUEST":
            return self.list_guest_chat_messages(hotel_id, staff_id=user_id1, conversation_key=user_id2)
        room_key = self.chat_room_key(user_id1, user_id2, "GUEST" if chat_type == "GUEST" else "USER")
        rows = self.db.execute(
            select(MobileChatMessage).where(
                MobileChatMessage.hotel_id == hotel_id,
                MobileChatMessage.room_key == room_key,
            ).order_by(MobileChatMessage.created_at)
        ).scalars().all()
        return [self.mobile_chat_message(row) for row in rows]

    def mobile_chat_message(self, row: MobileChatMessage) -> dict[str, Any]:
        return {
            "msgId": row.id,
            "senderId": row.sender_id,
            "message": row.message,
            "timestamp": str(self.epoch_ms(row.created_at)),
            "senderName": row.sender_name,
            "_system": row.system_marker,
        }

    def guest_threads(self, hotel_id: str) -> list[dict[str, Any]]:
        conversations = self.db.execute(
            select(WhatsAppConversation)
            .where(WhatsAppConversation.hotel_id == hotel_id, WhatsAppConversation.status != "deleted")
            .order_by(WhatsAppConversation.last_message_at.desc().nullslast(), WhatsAppConversation.started_at.desc())
        ).scalars().all()
        threads = []
        for conversation in conversations:
            last = self.db.execute(
                select(WhatsAppMessage)
                .where(
                    WhatsAppMessage.hotel_id == hotel_id,
                    WhatsAppMessage.conversation_id == conversation.id,
                )
                .order_by(WhatsAppMessage.created_at.desc())
            ).scalars().first()
            guest = self.db.get(Guest, conversation.guest_id) if conversation.guest_id else None
            name = guest.name if guest else conversation.phone
            threads.append(
                {
                    "userId": conversation.id,
                    "guestId": conversation.guest_id,
                    "name": name,
                    "phone": conversation.phone,
                    "lastMessage": last.message_text if last else "",
                    "timestamp": str(self.epoch_ms(conversation.last_message_at or conversation.started_at)),
                }
            )
        if threads:
            return threads

        rows = self.db.execute(
            select(MobileChatMessage).where(
                MobileChatMessage.hotel_id == hotel_id,
                MobileChatMessage.chat_type == "GUEST",
            ).order_by(MobileChatMessage.created_at.desc())
        ).scalars().all()
        seen = set()
        threads = []
        for row in rows:
            if row.receiver_id in seen:
                continue
            seen.add(row.receiver_id)
            threads.append(
                {
                    "userId": row.receiver_id,
                    "name": row.receiver_id,
                    "lastMessage": row.message,
                    "timestamp": str(self.epoch_ms(row.created_at)),
                }
            )
        return threads

    def resolve_guest_conversation(self, hotel_id: str, conversation_key: str) -> WhatsAppConversation | None:
        value = _text(conversation_key)
        if not value:
            return None
        return self.db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.hotel_id == hotel_id,
                or_(
                    WhatsAppConversation.id == value,
                    WhatsAppConversation.guest_id == value,
                    WhatsAppConversation.phone == value,
                ),
            )
        ).scalars().first()

    def create_guest_conversation(self, hotel_id: str, conversation_key: str) -> WhatsAppConversation:
        if not _text(conversation_key):
            raise bad_request("Guest conversation is required")
        guest = self.db.execute(
            select(Guest).where(
                Guest.hotel_id == hotel_id,
                Guest.id == conversation_key,
                Guest.deleted_at.is_(None),
            )
        ).scalars().first()
        now = utcnow()
        conversation = WhatsAppConversation(
            hotel_id=hotel_id,
            whatsapp_account_id=None,
            guest_id=guest.id if guest else None,
            phone=(guest.whatsapp_phone or guest.phone or f"guest:{guest.id}") if guest else conversation_key,
            status="open",
            started_at=now,
            last_message_at=now,
        )
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def guest_conversation_or_create(self, hotel_id: str, conversation_key: str) -> WhatsAppConversation:
        return self.resolve_guest_conversation(hotel_id, conversation_key) or self.create_guest_conversation(hotel_id, conversation_key)

    def send_guest_chat_message(self, hotel_id: str, sender_id: str, conversation_key: str, message: str) -> dict[str, Any]:
        if not _text(message):
            raise bad_request("Message is required")
        conversation = self.guest_conversation_or_create(hotel_id, conversation_key)
        sender = self.resolve_user_any(sender_id, hotel_id)
        now = utcnow()
        if conversation.status in {"deleted", "resolved", "ended"}:
            conversation.status = "open"
            conversation.resolved_at = None
        if sender:
            conversation.assigned_staff_id = sender.id
            conversation.assigned_at = conversation.assigned_at or now
        conversation.last_message_at = now
        row = WhatsAppMessage(
            hotel_id=hotel_id,
            whatsapp_account_id=conversation.whatsapp_account_id,
            conversation_id=conversation.id,
            reservation_id=None,
            ticket_id=None,
            direction="outbound",
            message_type="text",
            message_text=message,
            status="sent",
            created_at=now,
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return self.mobile_guest_message(row, sender_id, conversation)

    def list_guest_chat_messages(self, hotel_id: str, staff_id: str, conversation_key: str) -> list[dict[str, Any]]:
        conversation = self.resolve_guest_conversation(hotel_id, conversation_key)
        if not conversation:
            return []
        rows = self.db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.conversation_id == conversation.id,
            )
            .order_by(WhatsAppMessage.created_at)
        ).scalars().all()
        return [self.mobile_guest_message(row, staff_id, conversation) for row in rows]

    def mobile_guest_message(self, row: WhatsAppMessage, staff_id: str, conversation: WhatsAppConversation) -> dict[str, Any]:
        assigned = self.db.get(User, conversation.assigned_staff_id) if conversation.assigned_staff_id else None
        return {
            "msgId": row.id,
            "senderId": (_mobile_employee_id(assigned) or staff_id) if row.direction == "outbound" else conversation.id,
            "message": row.message_text or "",
            "timestamp": str(self.epoch_ms(row.created_at)),
            "senderName": (assigned.name if assigned else "Staff") if row.direction == "outbound" else conversation.phone,
            "_system": "chat_ended" if row.status == "chat_ended" else None,
        }

    def update_unread(self, hotel_id: str, current_user_id: str, target_user_id: str, name: str, increment: bool) -> list[dict[str, Any]]:
        user = self.require_user(current_user_id, hotel_id)
        unseen = list(user.unseen_messages or [])
        index = next((i for i, item in enumerate(unseen) if item.get("UserId") == target_user_id), -1)
        if increment:
            if index >= 0:
                unseen[index]["Count"] = int(unseen[index].get("Count") or 0) + 1
            else:
                unseen.append({"UserId": target_user_id, "Name": name, "Count": 1})
        else:
            unseen = [item for item in unseen if item.get("UserId") != target_user_id]
        user.unseen_messages = unseen
        self.db.commit()
        return unseen

    def claim_notifications(self, hotel_id: str) -> list[dict[str, Any]]:
        rows = self.db.execute(
            select(Notification).where(Notification.hotel_id == hotel_id).order_by(Notification.created_at.desc())
        ).scalars().all()
        items = []
        for row in rows:
            meta = row.metadata_json or {}
            if meta.get("type") != "TICKET_CLAIMED" and row.notification_type != "ticket_claimed":
                continue
            items.append(
                {
                    "id": row.id,
                    "type": "TICKET_CLAIMED",
                    "ticketId": meta.get("ticketId") or meta.get("ticket_id") or row.reference_id,
                    "attendantId": meta.get("attendantId") or meta.get("attendant_id"),
                    "attendantName": meta.get("attendantName") or meta.get("attendant_name"),
                    "itemOrdered": meta.get("itemOrdered") or row.message,
                    "roomNo": meta.get("roomNo") or meta.get("room_number"),
                    "timestamp": self.epoch_ms(row.created_at),
                    "readBy": meta.get("readBy") or [],
                }
            )
        return items

    def mark_claim_read(self, hotel_id: str, notification_id: str, employee_id: str) -> dict[str, Any]:
        row = self.db.execute(
            select(Notification).where(Notification.hotel_id == hotel_id, Notification.id == notification_id)
        ).scalars().first()
        if not row:
            return {"read": False}
        meta = dict(row.metadata_json or {})
        read_by = list(meta.get("readBy") or [])
        if employee_id not in read_by:
            read_by.append(employee_id)
        meta["readBy"] = read_by
        row.metadata_json = meta
        row.read_at = row.read_at or utcnow()
        self.db.commit()
        return {"read": True, "readBy": read_by}

    def escalations(self, hotel_id: str) -> list[dict[str, Any]]:
        now_ms = self.epoch_ms(utcnow())
        rows = self.db.execute(
            select(Ticket).where(Ticket.hotel_id == hotel_id, Ticket.deleted_at.is_(None)).order_by(Ticket.created_at.desc())
        ).scalars().all()
        items = []
        for ticket in rows:
            task = self.mobile_task(ticket)
            level = task.get("EscalationLevel")
            if not level and not task.get("Escalated"):
                continue
            level_name = "admin" if int(level or 0) >= 2 else "manager"
            items.append(
                {
                    "ticketId": ticket.id,
                    "level": level_name,
                    "department": task.get("Department") or "",
                    "itemOrdered": task.get("ItemOrdered"),
                    "roomNo": task.get("UpdatedRoomNo") or task.get("RoomNo"),
                    "guestName": task.get("GuestName"),
                    "timeLimitMinutes": None,
                    "ticketStartedAt": task.get("TimerStartTime") or task.get("CreatedTime"),
                    "managerEscalatedAt": task.get("ManagerEscalatedAt"),
                    "adminEscalatedAt": task.get("AdminEscalatedAt"),
                    "updatedAt": now_ms,
                    "stage": task.get("Stage"),
                }
            )
        return items

    def register_fcm_token(self, hotel_id: str, employee_id: str, token: str, platform: str = "android") -> dict[str, Any]:
        user = self.require_user(employee_id, hotel_id)
        row = FCMTokenRepository(self.db).upsert(hotel_id, user.id, token, platform)
        return FCMTokenRead.model_validate(row).model_dump()

    # ----- media -----
    async def save_upload(self, hotel_id: str, uploaded: UploadFile, current_user: User | None = None) -> dict[str, Any]:
        root = Path(os.getenv("MOBILE_MEDIA_ROOT") or Path(__file__).resolve().parents[2] / "media" / "mobile").resolve()
        target_dir = root / hotel_id
        target_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(uploaded.filename or "").suffix or ".jpg"
        filename = f"{uuid4().hex}{suffix}"
        path = target_dir / filename
        content = await uploaded.read()
        path.write_bytes(content)
        url = f"/media/mobile/{hotel_id}/{filename}"
        media = MediaFile(
            hotel_id=hotel_id,
            file_url=url,
            file_type=uploaded.content_type or "application/octet-stream",
            file_name=uploaded.filename,
            file_size_bytes=len(content),
            storage_provider=settings.media_storage_backend or "local",
            uploaded_by=current_user.id if current_user else None,
            created_at=utcnow(),
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return {"id": media.id, "url": url, "file_url": url}

    # ----- misc -----
    @staticmethod
    def mobile_task_code() -> str:
        return f"TN{str(int(datetime.now().timestamp() * 1000) % 10000000).zfill(7)}"

    @staticmethod
    def epoch_ms(value: datetime | date | None) -> int | None:
        if value is None:
            return None
        if isinstance(value, datetime):
            return int(value.timestamp() * 1000)
        return int(datetime.combine(value, datetime.min.time()).timestamp() * 1000)
