"""
Diagnostic script - run from the Hotel Management backend directory.
Usage: python debug_guest_timeline.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.core.database import SessionLocal
from app.models.reservation import Reservation, ReservationGuest
from sqlalchemy import select, or_

HOTEL_ID = "329ba224-6af4-4eb8-a727-a74887e6c22e"
GUEST_WORKS   = "9cb723d1-8864-4d64-9887-e3b3fdaaf3d1"   # From reservation path - WORKS
GUEST_BROKEN  = "23b48145-c7ab-4c53-bf86-0abbc578eb50"   # From guest section - BROKEN

def check_guest(db, label, guest_id):
    print(f"\n{'='*60}")
    print(f"  {label}: {guest_id}")
    print(f"{'='*60}")

    # Direct guest_id on reservation
    direct = db.execute(
        select(Reservation).where(
            Reservation.hotel_id == HOTEL_ID,
            Reservation.guest_id == guest_id
        )
    ).scalars().all()
    print(f"\n  [Direct Reservation.guest_id match]: {len(direct)} found")
    for r in direct:
        print(f"    -> {r.reservation_no} | status={r.status} | created_at={r.created_at}")

    # Via ReservationGuest join table
    via_join_ids = db.execute(
        select(ReservationGuest.reservation_id).where(
            ReservationGuest.hotel_id == HOTEL_ID,
            ReservationGuest.guest_id == guest_id
        )
    ).scalars().all()
    print(f"\n  [Via ReservationGuest join table]: {len(via_join_ids)} found")
    for rid in via_join_ids:
        res = db.execute(select(Reservation).where(Reservation.id == rid)).scalar_one_or_none()
        if res:
            print(f"    -> {res.reservation_no} | status={res.status} | guest_id={res.guest_id}")
        else:
            print(f"    -> reservation_id={rid} NOT FOUND in reservations table!")

    # Total after union (what our new query returns)
    union_ids = set([r.id for r in direct]) | set(via_join_ids)
    print(f"\n  [TOTAL after union dedup]: {len(union_ids)} reservations")

db = SessionLocal()
try:
    check_guest(db, "WORKS (from reservation path)", GUEST_WORKS)
    check_guest(db, "BROKEN (from guest section)", GUEST_BROKEN)
finally:
    db.close()
