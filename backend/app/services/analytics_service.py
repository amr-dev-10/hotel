from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.feedback import Feedback
from app.models.folio import FolioItem
from app.models.ops import AnalyticsSnapshot
from app.models.reservation import Reservation
from app.models.room import Room
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppUsage
from app.repositories.ops_repository import AnalyticsSnapshotRepository


class AnalyticsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.snapshots = AnalyticsSnapshotRepository(db)

    def generate_daily_snapshot(self, hotel_id: str, snapshot_date: date) -> AnalyticsSnapshot:
        snapshot = self.snapshots.get_by_date(hotel_id, snapshot_date)
        if not snapshot:
            snapshot = AnalyticsSnapshot(hotel_id=hotel_id, snapshot_date=snapshot_date)
            self.db.add(snapshot)

        total_rooms = self._count(Room, hotel_id)
        occupied_rooms = self.db.execute(
            select(func.count()).select_from(Room).where(
                Room.hotel_id == hotel_id,
                Room.status == "occupied",
                Room.deleted_at.is_(None),
            )
        ).scalar_one()
        total_reservations = self._count(Reservation, hotel_id)
        new_checkins = self.db.execute(
            select(func.count()).select_from(Reservation).where(
                Reservation.hotel_id == hotel_id,
                Reservation.checkin_date == snapshot_date,
            )
        ).scalar_one()
        checkouts = self.db.execute(
            select(func.count()).select_from(Reservation).where(
                Reservation.hotel_id == hotel_id,
                Reservation.checkout_date == snapshot_date,
            )
        ).scalar_one()
        ticket_count = self._count(Ticket, hotel_id)
        revenue_rows = self.db.execute(
            select(FolioItem.item_type, func.coalesce(func.sum(FolioItem.total_amount), 0))
            .where(FolioItem.hotel_id == hotel_id, FolioItem.date == snapshot_date)
            .group_by(FolioItem.item_type)
        ).all()
        revenue_room = Decimal("0")
        revenue_food = Decimal("0")
        revenue_other = Decimal("0")
        for item_type, amount in revenue_rows:
            value = Decimal(amount or 0)
            if item_type == "room":
                revenue_room += value
            elif item_type == "food":
                revenue_food += value
            else:
                revenue_other += value
        feedback_avg = self.db.execute(
            select(func.avg(Feedback.rating)).where(Feedback.hotel_id == hotel_id)
        ).scalar()
        whatsapp_messages = self.db.execute(
            select(
                func.coalesce(
                    func.sum(WhatsAppUsage.messages_sent + WhatsAppUsage.messages_received),
                    0,
                )
            ).where(WhatsAppUsage.hotel_id == hotel_id)
        ).scalar()

        snapshot.total_rooms = total_rooms
        snapshot.occupied_rooms = occupied_rooms
        snapshot.occupancy_rate = (
            Decimal(occupied_rooms) / Decimal(total_rooms) * Decimal("100")
            if total_rooms
            else Decimal("0")
        )
        snapshot.total_reservations = total_reservations
        snapshot.new_checkins = new_checkins
        snapshot.checkouts = checkouts
        snapshot.ticket_count = ticket_count
        snapshot.guest_satisfaction_avg = Decimal(str(round(float(feedback_avg or 0), 2)))
        snapshot.revenue_room = revenue_room
        snapshot.revenue_food = revenue_food
        snapshot.revenue_other = revenue_other
        snapshot.revenue_total = revenue_room + revenue_food + revenue_other
        snapshot.whatsapp_messages = int(whatsapp_messages or 0)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot

    def list_or_generate(
        self,
        hotel_id: str,
        start_date: date,
        end_date: date,
    ) -> list[AnalyticsSnapshot]:
        rows = list(self.snapshots.list_range(hotel_id, start_date, end_date))
        if not rows and start_date <= end_date:
            rows = [self.generate_daily_snapshot(hotel_id, end_date)]
        return rows

    def _count(self, model, hotel_id: str) -> int:
        return self.db.execute(
            select(func.count()).select_from(model).where(model.hotel_id == hotel_id)
        ).scalar_one()
