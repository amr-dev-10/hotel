from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _bootstrap(client: TestClient) -> tuple[str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"v5-hotel-{suffix}",
            "name": "Arcadia V5 Hotel",
            "owner_name": "V5 Owner",
            "owner_email": f"v5-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000055555",
            "whatsapp_phone_number_id": f"v5_phone_{suffix}",
            "seed_rooms": ["1501"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"]


def test_v5_final_platform_gaps() -> None:
    with TestClient(app) as client:
        hotel_id, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}
        tomorrow = date.today() + timedelta(days=1)
        checkout = tomorrow + timedelta(days=2)

        deluxe = client.post(
            f"/api/v1/hotels/{hotel_id}/room-types",
            headers=headers,
            json={"name": "V5 Deluxe", "max_occupancy": 3, "base_price": "7000.00"},
        )
        assert deluxe.status_code == 200
        deluxe_type_id = deluxe.json()["data"]["id"]
        room = client.post(
            f"/api/v1/hotels/{hotel_id}/rooms",
            headers=headers,
            json={"room_number": "1502", "room_type_id": deluxe_type_id, "floor": "15"},
        )
        assert room.status_code == 200
        deluxe_room_id = room.json()["data"]["id"]

        reservation = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            json={
                "guest_name": "Room Type Guest",
                "phone": "+919555000001",
                "room_type_id": deluxe_type_id,
                "checkin_date": tomorrow.isoformat(),
                "checkout_date": checkout.isoformat(),
                "source": "ota",
            },
        )
        assert reservation.status_code == 200
        reservation_id = reservation.json()["data"]["id"]
        assert reservation.json()["data"]["room_id"] is None

        booked_types = client.get(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/room-types",
            headers=headers,
        )
        assert booked_types.status_code == 200
        assert booked_types.json()["data"][0]["room_type_id"] == deluxe_type_id

        double_booking = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            json={
                "guest_name": "Blocked Guest",
                "room_type_id": deluxe_type_id,
                "checkin_date": tomorrow.isoformat(),
                "checkout_date": checkout.isoformat(),
            },
        )
        assert double_booking.status_code == 400

        calendar = client.get(
            f"/api/v1/hotels/{hotel_id}/availability/calendar",
            headers=headers,
            params={"month": tomorrow.replace(day=1).isoformat()},
        )
        assert calendar.status_code == 200
        assert calendar.json()["data"][tomorrow.isoformat()]["V5 Deluxe"]["available"] == 0

        checkin = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-in",
            headers=headers,
            json={"auto_assign": True},
        )
        assert checkin.status_code == 200
        assert checkin.json()["data"]["room_id"] == deluxe_room_id
        assigned_types = client.get(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/room-types",
            headers=headers,
        )
        assert assigned_types.json()["data"][0]["assigned_room_id"] == deluxe_room_id

        folios = client.get(f"/api/v1/hotels/{hotel_id}/folios", headers=headers)
        assert folios.status_code == 200
        folio_id = folios.json()["data"][0]["id"]
        payment = client.post(
            f"/api/v1/hotels/{hotel_id}/folios/{folio_id}/payments",
            headers=headers,
            json={"amount": "1000.00", "payment_method": "manual"},
        )
        assert payment.status_code == 200
        transactions = client.get(f"/api/v1/hotels/{hotel_id}/folios/payment-transactions", headers=headers)
        assert transactions.status_code == 200
        assert any(item["gateway"] == "manual" and item["gateway_status"] == "captured" for item in transactions.json()["data"])

        active_guest = client.post(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            json={"name": "Consent Guest", "phone": "+919555000002", "whatsapp_phone": "+919555000002", "status": "checked_in"},
        )
        assert active_guest.status_code == 200
        guest_id = active_guest.json()["data"]["id"]
        skipped_campaign = client.post(
            f"/api/v1/hotels/{hotel_id}/campaigns",
            headers=headers,
            json={"name": "No Consent", "template_name": "promo", "target_type": "specific", "target_guest_id": guest_id},
        )
        assert skipped_campaign.status_code == 200
        assert skipped_campaign.json()["data"]["sent_count"] == 0
        consent = client.put(
            f"/api/v1/hotels/{hotel_id}/guests/{guest_id}/consent",
            headers=headers,
            json={"whatsapp_opt_in": True, "marketing_opt_in": True, "consent_source": "manual"},
        )
        assert consent.status_code == 200
        sent_campaign = client.post(
            f"/api/v1/hotels/{hotel_id}/campaigns",
            headers=headers,
            json={"name": "With Consent", "template_name": "promo", "target_type": "specific", "target_guest_id": guest_id},
        )
        assert sent_campaign.status_code == 200
        assert sent_campaign.json()["data"]["sent_count"] == 1

        export_job = client.post(
            f"/api/v1/hotels/{hotel_id}/exports",
            headers=headers,
            json={"export_type": "guests", "format": "csv", "filters": {"status": "checked_in"}},
        )
        assert export_job.status_code == 200
        assert export_job.json()["data"]["status"] == "completed"
        assert export_job.json()["data"]["row_count"] >= 1
        download = client.get(
            f"/api/v1/hotels/{hotel_id}/exports/{export_job.json()['data']['id']}/download",
            headers=headers,
        )
        assert download.status_code == 200
        assert download.json()["data"]["download_url"].startswith("memory://exports/")

        import_job = client.post(
            f"/api/v1/hotels/{hotel_id}/imports",
            headers=headers,
            json={
                "import_type": "guests",
                "source_file_url": "inline://guests.csv",
                "rows": [
                    {"name": "Imported Guest", "phone": "+919555000003"},
                    {"name": "Missing Phone"},
                ],
            },
        )
        assert import_job.status_code == 200
        assert import_job.json()["data"]["status"] == "validated"
        assert import_job.json()["data"]["failed_rows"] == 1
        executed_import = client.post(
            f"/api/v1/hotels/{hotel_id}/imports/{import_job.json()['data']['id']}/execute",
            headers=headers,
        )
        assert executed_import.status_code == 200
        assert executed_import.json()["data"]["successful_rows"] == 1

        jobs = client.get(f"/api/v1/hotels/{hotel_id}/jobs", headers=headers)
        assert jobs.status_code == 200
        job_names = {item["job_name"] for item in jobs.json()["data"]}
        assert {"generate_export", "validate_import", "execute_import"}.issubset(job_names)

        limits = client.get(f"/api/v1/hotels/{hotel_id}/rate-limits", headers=headers)
        assert limits.status_code == 200
        assert any(item["endpoint_group"] == "tickets" for item in limits.json()["data"])
        updated_limit = client.put(
            f"/api/v1/hotels/{hotel_id}/rate-limits",
            headers=headers,
            json={"endpoint_group": "general", "max_requests": 250, "window_seconds": 60},
        )
        assert updated_limit.status_code == 200
        assert updated_limit.json()["data"]["max_requests"] == 250
