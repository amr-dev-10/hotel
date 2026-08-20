from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.main import app
from app.models.ticket import Ticket


def test_mobile_escalation_reassigns_task_to_senior_and_removes_from_current_user() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        bootstrap = client.post(
            "/api/v1/hotels/bootstrap",
            json={
                "slug": f"mobile-escalation-{suffix}",
                "name": "Mobile Escalation Hotel",
                "owner_name": "Mobile Owner",
                "owner_email": f"mobile-owner-{suffix}@example.com",
                "owner_password": "secretpass123",
                "seed_rooms": ["901"],
            },
        )
        assert bootstrap.status_code == 200
        data = bootstrap.json()["data"]
        hotel_id = data["hotel"]["id"]
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        departments = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
        assert departments.status_code == 200
        housekeeping_id = next(item["id"] for item in departments.json()["data"] if item["key"] == "housekeeping")

        manager_code = f"MGR{suffix[:5].upper()}"
        manager = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "Mobile Escalation Manager",
                "email": f"mobile-manager-{suffix}@example.com",
                "password": "secretpass123",
                "employee_code": manager_code,
                "department_id": housekeeping_id,
                "staff_level": "manager",
                "job_role": "Manager",
                "is_on_duty": True,
            },
        )
        assert manager.status_code == 200
        manager_id = manager.json()["data"]["id"]

        attendant_code = f"ATT{suffix[:5].upper()}"
        attendant = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "Mobile Escalation Attendant",
                "email": f"mobile-attendant-{suffix}@example.com",
                "password": "secretpass123",
                "employee_code": attendant_code,
                "department_id": housekeeping_id,
                "reports_to": manager_id,
                "staff_level": "attendant",
                "job_role": "Attendant",
                "is_on_duty": True,
            },
        )
        assert attendant.status_code == 200
        attendant_id = attendant.json()["data"]["id"]

        task = client.post(
            f"/api/v1/mobile/hotels/{hotel_id}/tasks",
            headers=headers,
            json={
                "Department": "housekeeping",
                "AssignedToID": attendant_code,
                "ItemOrdered": "Extra towels",
                "Priority": "Important",
                "RoomNo": "901",
            },
        )
        assert task.status_code == 200
        task_data = task.json()["data"]
        task_id = task_data["TaskId"]
        assert task_data["AssignedToID"] == attendant_code

        escalated = client.patch(
            f"/api/v1/mobile/hotels/{hotel_id}/tasks/{task_id}",
            headers=headers,
            json={
                "Escalated": True,
                "EscalationLevel": 1,
                "ManagerEscalatedAt": "1700000000000",
                "SlaAlertSent": True,
            },
        )
        assert escalated.status_code == 200
        escalated_data = escalated.json()["data"]
        assert escalated_data["AssignedToID"] == manager_code
        assert escalated_data["AssignedToName"] == "Mobile Escalation Manager"
        assert escalated_data["EscalationLevel"] == 1
        assert escalated_data["AssignmentHistory"][-1]["EmployeeId"] == attendant_code

        attendant_tasks = client.get(
            f"/api/v1/mobile/hotels/{hotel_id}/tasks?assigned_to={attendant_code}",
            headers=headers,
        )
        assert attendant_tasks.status_code == 200
        assert task_id not in {item["TaskId"] for item in attendant_tasks.json()["data"]}

        manager_tasks = client.get(
            f"/api/v1/mobile/hotels/{hotel_id}/tasks?assigned_to={manager_code}",
            headers=headers,
        )
        assert manager_tasks.status_code == 200
        assert task_id in {item["TaskId"] for item in manager_tasks.json()["data"]}

    db = SessionLocal()
    try:
        db_ticket = db.get(Ticket, task_id)
        assert db_ticket is not None
        assert db_ticket.assigned_to == manager_id
        assert db_ticket.assigned_to != attendant_id
    finally:
        db.close()
