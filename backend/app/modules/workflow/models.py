from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, UuidPrimaryKeyMixin


class Workflow(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "workflows"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_workflows_hotel_name"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False)


class WorkflowStage(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "workflow_stages"
    __table_args__ = (UniqueConstraint("hotel_id", "workflow_id", "sequence", name="uq_workflow_stage_sequence"),)

    workflow_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)


class WorkflowTransition(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "workflow_transitions"
    __table_args__ = (
        UniqueConstraint("hotel_id", "workflow_id", "from_stage_id", "to_stage_id", name="uq_workflow_transition"),
    )

    workflow_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    from_stage_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    to_stage_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
