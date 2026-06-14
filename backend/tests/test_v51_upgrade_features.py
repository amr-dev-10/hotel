from datetime import timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.services.escalation_service import EscalationService


def _bootstrap(client: TestClient) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"v51-hotel-{suffix}",
            "name": "Arcadia V51 Hotel",
            "owner_name": "V51 Owner",
            "owner_email": f"v51-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000511111",
            "whatsapp_phone_number_id": f"v51_phone_{suffix}",
            "seed_rooms": ["5101"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["owner"]["id"], data["access_token"]


def _department_id(client: TestClient, hotel_id: str, headers: dict[str, str], key: str) -> str:
    response = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
    assert response.status_code == 200
    return next(item["id"] for item in response.json()["data"] if item["key"] == key)


def _create_user(
    client: TestClient,
    hotel_id: str,
    headers: dict[str, str],
    suffix: str,
    name: str,
    department_id: str,
    staff_level: str,
    reports_to: str | None = None,
) -> tuple[str, str]:
    email = f"{name.lower().replace(' ', '-')}-{suffix}@example.com"
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/users",
        headers=headers,
        json={
            "name": name,
            "email": email,
            "password": "secretpass123",
            "department_id": department_id,
            "reports_to": reports_to,
            "staff_level": staff_level,
            "job_role": staff_level.title(),
            "is_on_duty": True,
        },
    )
    assert response.status_code == 200
    return response.json()["data"]["id"], email


def test_v51_operational_hierarchy_acceptance_escalation_and_ai_settings() -> None:
    with TestClient(app) as client:
        hotel_id, owner_id, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}
        suffix = uuid4().hex[:8]
        housekeeping_id = _department_id(client, hotel_id, headers, "housekeeping")

        manager_id, _ = _create_user(
            client,
            hotel_id,
            headers,
            suffix,
            "HK Manager",
            housekeeping_id,
            "manager",
            reports_to=owner_id,
        )
        supervisor_id, _ = _create_user(
            client,
            hotel_id,
            headers,
            suffix,
            "HK Supervisor",
            housekeeping_id,
            "supervisor",
            reports_to=manager_id,
        )
        attendant_id, attendant_email = _create_user(
            client,
            hotel_id,
            headers,
            suffix,
            "HK Attendant",
            housekeeping_id,
            "attendant",
            reports_to=supervisor_id,
        )

        role = client.post(
            f"/api/v1/hotels/{hotel_id}/roles",
            headers=headers,
            json={
                "name": f"Ticket Staff {suffix}",
                "permission_codes": ["ticket.view"],
            },
        )
        assert role.status_code == 200
        assigned = client.post(
            f"/api/v1/hotels/{hotel_id}/roles/users/{attendant_id}",
            headers=headers,
            json={"role_ids": [role.json()["data"]["id"]]},
        )
        assert assigned.status_code == 200
        login = client.post(
            "/api/v1/auth/login",
            json={"email": attendant_email, "password": "secretpass123"},
        )
        assert login.status_code == 200
        attendant_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        hierarchy = client.get(
            f"/api/v1/hotels/{hotel_id}/departments/{housekeeping_id}/hierarchy",
            headers=headers,
        )
        assert hierarchy.status_code == 200
        assert hierarchy.json()["data"]["manager"]["id"] == manager_id
        assert hierarchy.json()["data"]["supervisors"][0]["attendants"][0]["id"] == attendant_id

        slas = client.get(
            f"/api/v1/hotels/{hotel_id}/departments/{housekeeping_id}/task-slas",
            headers=headers,
        )
        assert slas.status_code == 200
        towel_sla = next(item for item in slas.json()["data"] if item["task_category"] == "towel_request")
        assert towel_sla["sla_minutes"] == 10
        assert towel_sla["accept_timeout_minutes"] == 2

        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_id": housekeeping_id,
                "assigned_to": attendant_id,
                "task_category": "towel_request",
                "item_description": "Need fresh towels",
                "priority": 2,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]
        assert ticket.json()["data"]["stage"] == "pending_accept"
        assert ticket.json()["data"]["assigned_to"] == attendant_id

        acceptances = client.get(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/acceptances",
            headers=headers,
        )
        assert acceptances.status_code == 200
        assert acceptances.json()["data"][0]["response"] == "pending"

        accepted = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/accept",
            headers=attendant_headers,
        )
        assert accepted.status_code == 200
        assert accepted.json()["data"]["stage"] == "accepted"
        assert accepted.json()["data"]["sla_due_at"]

        completed = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/complete",
            headers=attendant_headers,
        )
        assert completed.status_code == 200
        assert completed.json()["data"]["stage"] == "pending_approval"
        approved = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/approve",
            headers=headers,
        )
        assert approved.status_code == 200
        assert approved.json()["data"]["stage"] == "approved"
        assert approved.json()["data"]["resolved_at"]

        escalation_ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_id": housekeeping_id,
                "assigned_to": attendant_id,
                "task_category": "towel_request",
                "item_description": "Need extra blanket",
                "priority": 2,
            },
        )
        assert escalation_ticket.status_code == 200
        escalation_ticket_id = escalation_ticket.json()["data"]["id"]
        assert client.post(
            f"/api/v1/hotels/{hotel_id}/tickets/{escalation_ticket_id}/accept",
            headers=attendant_headers,
        ).status_code == 200
        db = SessionLocal()
        try:
            row = db.get(Ticket, escalation_ticket_id)
            assert row is not None
            row.created_at = utcnow() - timedelta(minutes=11)
            db.commit()
            fired = EscalationService(db).check_escalations(hotel_id)
            assert len(fired) == 1
        finally:
            db.close()
        escalations = client.get(
            f"/api/v1/hotels/{hotel_id}/tickets/{escalation_ticket_id}/escalations",
            headers=headers,
        )
        assert escalations.status_code == 200
        assert escalations.json()["data"][0]["escalated_to"] == supervisor_id

        complaint = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_id": housekeeping_id,
                "type": "complaint",
                "item_description": "Guest complaint needs owner attention",
            },
        )
        assert complaint.status_code == 200
        assert complaint.json()["data"]["priority"] == 1
        assert complaint.json()["data"]["assigned_to"] == owner_id

        routing_rules = client.get(f"/api/v1/hotels/{hotel_id}/routing-rules", headers=headers)
        assert routing_rules.status_code == 200
        assert any(item["ticket_type"] == "complaint" for item in routing_rules.json()["data"])
        escalation_rules = client.get(f"/api/v1/hotels/{hotel_id}/escalation-rules", headers=headers)
        assert escalation_rules.status_code == 200
        assert {item["target_staff_level"] for item in escalation_rules.json()["data"]} >= {
            "supervisor",
            "manager",
            "admin",
        }

        ai_default = client.get(f"/api/v1/hotels/{hotel_id}/settings/ai", headers=headers)
        assert ai_default.status_code == 200
        assert ai_default.json()["data"]["status"] == "default"
        ai_update = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=headers,
            json={"provider": "local", "model": "local-test"},
        )
        assert ai_update.status_code == 200
        assert ai_update.json()["data"]["status"] == "connected"
        ai_test = client.post(f"/api/v1/hotels/{hotel_id}/settings/ai/test", headers=headers)
        assert ai_test.status_code == 200
        assert ai_test.json()["data"]["success"] is True
