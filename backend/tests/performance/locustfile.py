from __future__ import annotations

import os
from random import choice

from locust import HttpUser, between, task


class ArcadiaDashboardUser(HttpUser):
    wait_time = between(0.5, 2.0)

    token: str | None = None
    hotel_id: str | None = None

    def on_start(self) -> None:
        self.hotel_id = os.getenv("ARCADIA_HOTEL_ID")
        email = os.getenv("ARCADIA_LOAD_EMAIL", "owner@arcadia.demo")
        password = os.getenv("ARCADIA_LOAD_PASSWORD", "DemoPass123!")
        response = self.client.post("/api/v1/auth/login", json={"email": email, "password": password})
        response.raise_for_status()
        self.token = response.json()["data"]["access_token"]

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(4)
    def list_tickets(self) -> None:
        if not self.hotel_id:
            return
        self.client.get(
            f"/api/v1/hotels/{self.hotel_id}/tickets",
            headers=self.headers,
            params={"limit": choice([25, 50, 100]), "stage": choice(["created", "accepted", "in_progress", None])},
            name="/hotels/:hotel_id/tickets",
        )

    @task(3)
    def list_guests(self) -> None:
        if not self.hotel_id:
            return
        self.client.get(
            f"/api/v1/hotels/{self.hotel_id}/guests",
            headers=self.headers,
            params={"limit": choice([25, 50, 100])},
            name="/hotels/:hotel_id/guests",
        )

    @task(2)
    def list_reservations(self) -> None:
        if not self.hotel_id:
            return
        self.client.get(
            f"/api/v1/hotels/{self.hotel_id}/reservations",
            headers=self.headers,
            params={"limit": choice([25, 50, 100])},
            name="/hotels/:hotel_id/reservations",
        )

    @task(1)
    def escalations(self) -> None:
        if not self.hotel_id:
            return
        self.client.get(
            f"/api/v1/hotels/{self.hotel_id}/tickets/escalations",
            headers=self.headers,
            params={"scope": "all"},
            name="/hotels/:hotel_id/tickets/escalations",
        )
