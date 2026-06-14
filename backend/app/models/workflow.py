from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class WorkflowDefinition(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "workflow_definitions"
    __table_args__ = (UniqueConstraint("hotel_id", "entity_type", "name", name="uq_workflow_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class WorkflowState(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "workflow_states"
    __table_args__ = (UniqueConstraint("workflow_id", "state_key", name="uq_workflow_state_key"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflow_definitions.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    state_key: Mapped[str] = mapped_column(String(80), index=True)
    state_type: Mapped[str] = mapped_column(String(40), default="intermediate")
    color: Mapped[str | None] = mapped_column(String(20))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    required_permission: Mapped[str | None] = mapped_column(String(120))
    auto_assign: Mapped[bool] = mapped_column(Boolean, default=False)


class WorkflowTransition(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "workflow_transitions"
    __table_args__ = (
        UniqueConstraint("workflow_id", "from_state_id", "to_state_id", name="uq_workflow_transition"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflow_definitions.id"), index=True)
    from_state_id: Mapped[str] = mapped_column(ForeignKey("workflow_states.id"), index=True)
    to_state_id: Mapped[str] = mapped_column(ForeignKey("workflow_states.id"), index=True)
    trigger_type: Mapped[str] = mapped_column(String(40), default="manual")
    required_permission: Mapped[str | None] = mapped_column(String(120))
    auto_timer_minutes: Mapped[int | None] = mapped_column(Integer)
    notify_roles: Mapped[list[str]] = mapped_column(JSON, default=list)
