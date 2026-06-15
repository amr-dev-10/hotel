from typing import Any

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.rbac import user_roles
from app.models.ticket import Ticket
from app.models.user import User, UserSession
from app.repositories.rbac_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserUpdate
from app.services.audit_service import AuditService


ADMIN_USER_TYPE = "HOTEL_ADMIN"
EMPLOYEE_USER_TYPE = "HOTEL_EMPLOYEE"


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.roles = RoleRepository(db)

    def get_user(self, hotel_id: str, user_id: str) -> User:
        user = self.users.get_for_hotel(hotel_id, user_id)
        if not user:
            raise not_found("User not found")
        return user

    def update_user(
        self,
        hotel_id: str,
        user_id: str,
        payload: UserUpdate,
        actor: User,
    ) -> User:
        user = self.get_user(hotel_id, user_id)
        update_data = payload.model_dump(exclude_unset=True)
        role_id = update_data.pop("role_id", None)
        role_ids = update_data.pop("role_ids", None)
        if role_id is not None:
            role_ids = [role_id]

        if "email" in update_data and update_data["email"]:
            if self.users.email_exists_for_other_user(hotel_id, update_data["email"], user_id):
                raise bad_request("User email already exists for this hotel")

        if update_data.get("reports_to"):
            if update_data["reports_to"] == user_id:
                raise bad_request("A user cannot report to themselves")
            manager = self.users.get_for_hotel(hotel_id, update_data["reports_to"])
            if not manager:
                raise bad_request("reports_to user must belong to the same hotel")

        next_staff_level = update_data.get("staff_level", user.staff_level)
        next_user_type = update_data.get("user_type", user.user_type)
        if self._is_admin_user(user) and not self._is_admin_shape(next_user_type, next_staff_level, user.is_hotel_owner):
            self._ensure_not_last_admin(hotel_id)

        if "staff_level" in update_data and "user_type" not in update_data:
            update_data["user_type"] = ADMIN_USER_TYPE if update_data["staff_level"] == "admin" else EMPLOYEE_USER_TYPE

        old_payload = self._user_audit_payload(user)
        for field, value in update_data.items():
            setattr(user, field, value)

        if role_ids is not None:
            self._replace_roles(hotel_id, user_id, role_ids)

        AuditService(self.db).log(
            hotel_id,
            "user.updated",
            "user",
            user.id,
            actor.id,
            old_payload=old_payload,
            new_payload=self._user_audit_payload(user),
        )
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete_user(self, hotel_id: str, user_id: str, actor: User) -> None:
        if user_id == actor.id:
            raise bad_request("You cannot delete your own account")
        user = self.get_user(hotel_id, user_id)
        if self._is_admin_user(user):
            self._ensure_not_last_admin(hotel_id)

        now = utcnow()
        old_payload = self._user_audit_payload(user)
        user.is_active = False
        user.is_deleted = True
        user.deleted_at = now
        user.deleted_by = actor.id

        self.db.execute(
            update(Ticket)
            .where(
                Ticket.hotel_id == hotel_id,
                Ticket.assigned_to == user_id,
                Ticket.deleted_at.is_(None),
                Ticket.stage.notin_(["approved", "cancelled", "closed"]),
            )
            .values(assigned_to=None, stage="created")
        )
        self.db.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        AuditService(self.db).log(
            hotel_id,
            "user.deleted",
            "user",
            user.id,
            actor.id,
            old_payload=old_payload,
            new_payload=self._user_audit_payload(user),
        )
        self.db.commit()

    def _replace_roles(self, hotel_id: str, user_id: str, role_ids: list[str]) -> None:
        for role_id in role_ids:
            if not self.roles.get_for_hotel(hotel_id, role_id):
                raise not_found("Role not found")
        self.db.execute(user_roles.delete().where(user_roles.c.user_id == user_id))
        if role_ids:
            self.roles.assign_user_roles(user_id, role_ids)

    def _ensure_not_last_admin(self, hotel_id: str) -> None:
        if self.users.count_hotel_admins(hotel_id) <= 1:
            raise bad_request("Cannot remove the last hotel admin")

    @staticmethod
    def _is_admin_shape(user_type: str | None, staff_level: str | None, is_owner: bool) -> bool:
        return bool(is_owner or user_type == ADMIN_USER_TYPE or staff_level == "admin")

    def _is_admin_user(self, user: User) -> bool:
        return self._is_admin_shape(user.user_type, user.staff_level, user.is_hotel_owner)

    @staticmethod
    def _user_audit_payload(user: User) -> dict[str, Any]:
        return {
            "name": user.name,
            "email": user.email,
            "department_id": user.department_id,
            "reports_to": user.reports_to,
            "user_type": user.user_type,
            "staff_level": user.staff_level,
            "job_role": user.job_role,
            "is_active": user.is_active,
            "is_deleted": user.is_deleted,
            "deleted_at": user.deleted_at.isoformat() if user.deleted_at else None,
            "deleted_by": user.deleted_by,
        }
