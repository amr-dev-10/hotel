from fastapi.testclient import TestClient

from app.main import app


def test_validation_errors_return_structured_detail() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/hotels/bootstrap", json={})

    assert response.status_code == 422
    payload = response.json()
    assert payload["success"] is False
    assert payload["message"] == "Request validation failed."
    assert payload["detail"]["code"] == "request_validation_failed"
    assert payload["detail"]["cause"]
    assert payload["detail"]["hint"]
    assert payload["detail"]["request_id"]
    assert any(field["field"] == "slug" for field in payload["detail"]["fields"])
