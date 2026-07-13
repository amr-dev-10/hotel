/**
 * Read-only view of the hotel's rooms + maintenance blocks.
 *
 * Rooms are served by the backend API. A room can carry:
 *   • `maintenance: { active, reason, since, clearedAt }` — the legacy
 *     open-ended "out of order" flag (covers every date while active).
 *   • `maintenanceBlocks: [{ id, from, to, reason, createdBy, createdByName,
 *     createdAt }]` — discrete date ranges (inclusive yyyy-mm-dd) the room is
 *     out of service.
 *
 * The mobile app is read-only here — scheduling/clearing happens on the
 * dashboard. This service mirrors the dashboard's roomUtils helpers.
 */
import { apiGet } from './apiClient';

export interface MaintenanceBlock {
  id: string;
  from: string; // yyyy-mm-dd, inclusive
  to: string;   // yyyy-mm-dd, inclusive
  reason?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface RoomDoc {
  id: string;
  hotel_id?: string;
  roomNo: string;
  floor?: string;
  roomType?: string;
  maintenance?: { active?: boolean; reason?: string; since?: string; clearedAt?: string };
  maintenanceBlocks?: MaintenanceBlock[];
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isRoomOutOfOrderIndefinitely(room: RoomDoc | null | undefined): boolean {
  return !!(room && room.maintenance && room.maintenance.active === true);
}

/** Normalised, sorted list of date-range maintenance blocks (not the legacy flag). */
export function roomMaintenanceBlocks(room: RoomDoc | null | undefined): MaintenanceBlock[] {
  const list = Array.isArray(room?.maintenanceBlocks) ? room!.maintenanceBlocks! : [];
  return list
    .filter((b) => b && YMD_RE.test(b.from) && YMD_RE.test(b.to) && b.to >= b.from)
    .slice()
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

export function isRoomBlockedOn(room: RoomDoc | null | undefined, ymd: string): boolean {
  if (!room) return false;
  if (isRoomOutOfOrderIndefinitely(room)) return true;
  if (!ymd) return false;
  return roomMaintenanceBlocks(room).some((b) => b.from <= ymd && ymd <= b.to);
}

export function isRoomBlockedToday(room: RoomDoc | null | undefined): boolean {
  return isRoomBlockedOn(room, todayYmd());
}

/** Subscribe to this hotel's rooms. Returns an unsubscribe function. */
export function subscribeToRooms(
  hotelId: string,
  callback: (rooms: RoomDoc[]) => void,
): () => void {
  if (!hotelId) {
    callback([]);
    return () => undefined;
  }
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const tick = async () => {
    try {
      const rooms = await apiGet<RoomDoc[]>(`/hotels/${hotelId}/rooms`);
      rooms.sort((a, b) => String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }));
      if (active) callback(rooms);
    } catch (err) {
      console.warn('[roomsService] subscribeToRooms error:', err);
      if (active) callback([]);
    } finally {
      if (active) timer = setTimeout(tick, 5000);
    }
  };
  void tick();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}
