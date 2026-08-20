from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.department import Department
from app.models.ops import MediaFile
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ops import MediaFileCreate
from app.services.mobile_compat_service import MobileCompatService
from app.services.ops_service import MediaService


def _bootstrap(client: TestClient) -> tuple[str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"media-cleanup-{suffix}",
            "name": "Media Cleanup Hotel",
            "owner_name": "Media Owner",
            "owner_email": f"media-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["701"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"]


def _media_rows(hotel_id: str) -> list[MediaFile]:
    db = SessionLocal()
    try:
        return list(db.execute(select(MediaFile).where(MediaFile.hotel_id == hotel_id)).scalars().all())
    finally:
        db.close()


def _media_exists(hotel_id: str, file_url: str) -> bool:
    db = SessionLocal()
    try:
        return (
            db.execute(
                select(MediaFile.id).where(
                    MediaFile.hotel_id == hotel_id,
                    MediaFile.file_url == file_url,
                )
            ).scalar_one_or_none()
            is not None
        )
    finally:
        db.close()


def test_profile_media_replacement_removal_and_duplicate_upload_cleanup() -> None:
    with TestClient(app) as client:
        hotel_id, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}

        upload = {
            "file_type": "image/png",
            "file_name": "profile.png",
            "file_size_bytes": 8,
            "storage_provider": "database",
            "file_data_base64": "iVBORw0KGgo=",
        }
        first = client.post(f"/api/v1/hotels/{hotel_id}/media/upload", headers=headers, json=upload)
        second = client.post(f"/api/v1/hotels/{hotel_id}/media/upload", headers=headers, json=upload)
        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["data"]["id"] == second.json()["data"]["id"]

        profile = client.post("/api/v1/auth/me/profile-image", headers=headers, json=upload)
        assert profile.status_code == 200
        first_url = profile.json()["data"]["profile_image_url"]
        assert first_url == first.json()["data"]["file_url"]

        replacement = client.post(
            "/api/v1/auth/me/profile-image",
            headers=headers,
            json={
                **upload,
                "file_name": "profile-next.png",
                "file_size_bytes": 6,
                "file_data_base64": "R0lGODlh",
            },
        )
        assert replacement.status_code == 200
        second_url = replacement.json()["data"]["profile_image_url"]
        assert second_url and second_url != first_url
        assert not _media_exists(hotel_id, first_url)
        assert _media_exists(hotel_id, second_url)

        removed = client.delete("/api/v1/auth/me/profile-image", headers=headers)
        assert removed.status_code == 200
        assert removed.json()["data"]["profile_image_url"] is None
        assert not _media_exists(hotel_id, second_url)


def test_mobile_task_photo_cleanup_keeps_shared_media_until_last_reference_removed() -> None:
    with TestClient(app) as client:
        hotel_id, _ = _bootstrap(client)

    db = SessionLocal()
    try:
        user = db.execute(select(User).where(User.hotel_id == hotel_id, User.deleted_at.is_(None))).scalars().first()
        department = db.execute(select(Department).where(Department.hotel_id == hotel_id)).scalars().first()
        assert user is not None
        assert department is not None

        media_service = MediaService(db)
        removed_media = media_service.register_file(
            hotel_id,
            MediaFileCreate(
                file_type="image/png",
                file_name="removed.png",
                file_data_base64="cmVtb3ZlZA==",
            ),
            user.id,
        )
        shared_media = media_service.register_file(
            hotel_id,
            MediaFileCreate(
                file_type="image/png",
                file_name="shared.png",
                file_data_base64="c2hhcmVk",
            ),
            user.id,
        )
        ticket = Ticket(
            hotel_id=hotel_id,
            ticket_code=f"REQ-{uuid4().hex[:8]}",
            department_id=department.id,
            stage="Open",
            mobile_workflow_step="Pending",
            mobile_payload={
                "TaskId": "",
                "WorkflowStep": "Pending",
                "EnRoutePhotos": [removed_media.file_url, shared_media.file_url],
            },
            type="Service",
            item_description="Photo cleanup task",
            source="MOBILE",
            followers=[],
            priority=2,
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        MobileCompatService(db).apply_mobile_patch(ticket, {"EnRoutePhotos": [shared_media.file_url]}, commit=True)
        assert db.get(MediaFile, removed_media.id) is None
        assert db.get(MediaFile, shared_media.id) is not None

        other_ticket = Ticket(
            hotel_id=hotel_id,
            ticket_code=f"REQ-{uuid4().hex[:8]}",
            department_id=department.id,
            stage="Open",
            mobile_workflow_step="Pending",
            mobile_payload={"TaskId": "", "AtLocationPhotos": [shared_media.file_url]},
            type="Service",
            item_description="Shared photo task",
            source="MOBILE",
            followers=[],
            priority=2,
        )
        db.add(other_ticket)
        db.commit()
        db.refresh(other_ticket)

        MobileCompatService(db).delete_task(hotel_id, ticket.id, user.id)
        assert db.get(MediaFile, shared_media.id) is not None

        MobileCompatService(db).apply_mobile_patch(other_ticket, {"AtLocationPhotos": []}, commit=True)
        assert db.get(MediaFile, shared_media.id) is None
    finally:
        db.close()


def test_direct_media_delete_blocks_referenced_file() -> None:
    with TestClient(app) as client:
        hotel_id, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}

        profile = client.post(
            "/api/v1/auth/me/profile-image",
            headers=headers,
            json={
                "file_type": "image/png",
                "file_name": "protected.png",
                "storage_provider": "database",
                "file_data_base64": "cHJvdGVjdGVk",
            },
        )
        assert profile.status_code == 200
        file_url = profile.json()["data"]["profile_image_url"]
        media_id = next(row.id for row in _media_rows(hotel_id) if row.file_url == file_url)

        blocked = client.delete(f"/api/v1/hotels/{hotel_id}/media/{media_id}", headers=headers)
        assert blocked.status_code == 400
        assert _media_exists(hotel_id, file_url)
