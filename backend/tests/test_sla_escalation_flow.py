from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.models.user import User
from app.services.escalation_service import EscalationService


@pytest.mark.integration
@pytest.mark.sla
def test_overdue_ticket_triggers_escalation_without_waiting() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        bootstrap = client.post(
            "/api/v1/hotels/bootstrap",
            json={
                "slug": f"sla-flow-{suffix}",
                "name": "SLA Flow Hotel",
                "owner_name": "SLA Owner",
                "owner_email": f"sla-owner-{suffix}@example.com",
                "owner_password": "secretpass123",
                "seed_rooms": ["801"],
            },
        )
        assert bootstrap.status_code == 200
        data = bootstrap.json()["data"]
        hotel_id = data["hotel"]["id"]
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        departments = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
        assert departments.status_code == 200
        housekeeping_id = next(item["id"] for item in departments.json()["data"] if item["key"] == "housekeeping")

        supervisor = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "SLA Supervisor",
                "email": f"sla-supervisor-{suffix}@example.com",
                "password": "secretpass123",
                "department_id": housekeeping_id,
                "staff_level": "supervisor",
                "job_role": "Housekeeping Supervisor",
                "is_on_duty": True,
            },
        )
        assert supervisor.status_code == 200
        supervisor_id = supervisor.json()["data"]["id"]

        attendant = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "SLA Attendant",
                "email": f"sla-attendant-{suffix}@example.com",
                "password": "secretpass123",
                "department_id": housekeeping_id,
                "staff_level": "attendant",
                "job_role": "Room Attendant",
                "is_on_duty": True,
            },
        )
        assert attendant.status_code == 200
        attendant_id = attendant.json()["data"]["id"]

        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_id": housekeeping_id,
                "assigned_to": attendant_id,
                "task_category": "towel_request",
                "item_description": "SLA escalation towel request",
                "source": "DASHBOARD",
                "priority": 3,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]

    db = SessionLocal()
    try:
        db_ticket = db.get(Ticket, ticket_id)
        assert db_ticket is not None
        db_ticket.sla_due_at = utcnow() - timedelta(minutes=1)
        db.commit()

        fired = EscalationService(db).check_escalations(hotel_id)
        assert len(fired) == 1
        assert fired[0].ticket_id == ticket_id
        assert fired[0].escalated_to == supervisor_id

        escalated_ticket = db.get(Ticket, ticket_id)
        assert escalated_ticket is not None
        assert escalated_ticket.assigned_to == supervisor_id
        supervisor_user = db.execute(select(User).where(User.id == supervisor_id)).scalar_one()
        assert supervisor_user.staff_level == "supervisor"
    finally:
        db.close()
