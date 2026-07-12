/**
 * Escalation service — every task carries a department time frame; when it is
 * exceeded the department manager is notified, and when it doubles the hotel
 * owner is notified. Notifications land both in-app (local notification +
 * ringtone + the Alerts tab) and on the web dashboard, via a single shared
 * record at {hotelId}/Notifications/Escalations/{taskId}.
 *
 *   • scanTasksForEscalation — runs every 60s while a manager/owner has the
 *     app open. Time-based, per-department:
 *       - elapsed ≥ limit + 1min  → level 1: write Escalations(level "manager"),
 *         set EscalationLevel/ManagerEscalatedAt, push dept manager
 *       - elapsed ≥ 2×limit + 1min → level 2: update Escalations(level "admin"),
 *         set EscalationLevel/AdminEscalatedAt, push owners
 *     The Arcadia WhatsApp bot runs the same sweep server-side; both write the
 *     same fields/keys, so a duplicate at worst overwrites with identical data.
 *   • scanGuestChatsForEscalation — unread guest messages: manager immediately,
 *     owners after 5min if still unread.
 *   • startEscalationAlerts — listens to Escalations and fires a local
 *     notification + ringtone (and a badge callback) when a *new* relevant
 *     escalation appears.
 *
 * Firebase atomic updates + the `EscalationLevel < n` guard prevent duplicate
 * pushes when multiple devices run the checker simultaneously.
 */
import { ref as dbRef, get, update, onValue } from 'firebase/database';
import { rtdb } from './firebaseConfig';
import { TenantManager } from './tenant';
import { presentLocalEscalationNotification } from './notifications';
import { getDepartmentResolutionMs } from './departmentService';
import { startTaskAlert, isTaskAlertActive } from './taskAlert';
import { Task, EscalationNotification } from '../types';

const GRACE_MS = 60 * 1000;                // detection lag — matches the dashboard/bot sweep
const ESCALATION_DELAY_MS = 5 * 60 * 1000; // guest-chat: owner escalation delay
const CHECK_INTERVAL_MS = 60 * 1000;       // task/chat scan cadence
const ALERT_ARM_DELAY_MS = 3500;           // ignore the initial backlog burst on (re)connect

const CLOSED_STAGES = new Set(['completed', 'delivered', 'cancelled', 'closed']);

let intervalId: ReturnType<typeof setInterval> | null = null;

function isClosed(task: Task): boolean {
  return CLOSED_STAGES.has((task.Stage ?? '').toString().trim().toLowerCase());
}

const normDept = (v: unknown) =>
  (v ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');

// ── Task SLA escalation ────────────────────────────────────────────────────
async function scanTasksForEscalation(hotelId: string): Promise<void> {
  try {
    const tasksRef = dbRef(rtdb, TenantManager.rtdbPath('Tickets/Created'));
    const snap = await get(tasksRef);
    if (!snap.exists()) return;

    const all = snap.val() as Record<string, Task>;
    const now = Date.now();

    await Promise.all(
      Object.entries(all).map(async ([taskId, task]) => {
        if (!task || isClosed(task)) return;

        const startMs = Number(task.TimerStartTime || task.AssignedTime || 0);
        if (!startMs) return; // not yet assigned/started — no clock running

        const limitMs = await getDepartmentResolutionMs(hotelId, task.Department);
        const elapsed = now - startMs;
        const level = Number(task.EscalationLevel ?? 0);

        const dept = (task.Department ?? '').toString();
        const room = (task.UpdatedRoomNo || task.RoomNo || '?').toString();
        const item = (task.ItemOrdered || task.Note || 'Task').toString();
        const guest = (task.GuestName || '').toString();
        const limitMinutes = Math.max(1, Math.round(limitMs / 60000));
        const ticketPath = `${TenantManager.rtdbPath('Tickets/Created')}/${taskId}`;
        const escalPath = `${TenantManager.rtdbPath('Notifications/Escalations')}/${taskId}`;

        // Step 1 — department time frame exceeded → notify the dept manager.
        if (elapsed >= limitMs + GRACE_MS && level < 1) {
          await update(dbRef(rtdb, ticketPath), {
            EscalationLevel: 1,
            ManagerEscalatedAt: String(now),
            ManagerNotifiedAt: String(now), // legacy field, kept for older UI
            SlaAlertSent: true,
          });
          await update(dbRef(rtdb, escalPath), {
            level: 'manager',
            department: dept,
            itemOrdered: item,
            roomNo: room,
            guestName: guest,
            timeLimitMinutes: limitMinutes,
            ticketStartedAt: startMs,
            managerEscalatedAt: now,
            adminEscalatedAt: null,
            updatedAt: now,
            stage: task.Stage || 'Assigned',
          });
          // The push is sent server-side by the onEscalationWritten Cloud
          // Function (triggered by the write above) so it reaches managers even
          // when their app is closed.
          return; // don't also fire the admin step in the same tick
        }

        // Step 2 — time frame doubled → escalate to the hotel owner.
        if (elapsed >= limitMs * 2 + GRACE_MS && level < 2) {
          const managerEscalatedAt =
            Number(task.ManagerEscalatedAt || task.ManagerNotifiedAt || 0) || now;
          await update(dbRef(rtdb, ticketPath), {
            EscalationLevel: 2,
            AdminEscalatedAt: String(now),
            OwnerNotifiedAt: String(now), // legacy field, kept for older UI
            SlaAlertSent: true,
          });
          await update(dbRef(rtdb, escalPath), {
            level: 'admin',
            department: dept,
            itemOrdered: item,
            roomNo: room,
            guestName: guest,
            timeLimitMinutes: limitMinutes,
            ticketStartedAt: startMs,
            managerEscalatedAt,
            adminEscalatedAt: now,
            updatedAt: now,
            stage: task.Stage || 'Assigned',
          });
          // Owner push is sent server-side by onEscalationWritten (the write
          // above promotes the record to level "admin").
        }
      })
    );
  } catch (e) {
    console.warn('[escalation] scanTasks failed:', e);
  }
}

// ── Guest chat escalation ──────────────────────────────────────────────────
type GuestChatMeta = {
  managerNotifiedAt?: number;
  ownerNotifiedAt?: number;
  lastMessageAt?: number;
  unread?: boolean;
};

async function scanGuestChatsForEscalation(hotelId: string): Promise<void> {
  try {
    const guestChatsRef = dbRef(rtdb, TenantManager.rtdbPath('Tickets/AllChatsTest/Guest'));
    const snap = await get(guestChatsRef);
    if (!snap.exists()) return;

    const all = snap.val() as Record<string, any>;
    const now = Date.now();

    await Promise.all(
      Object.entries(all).map(async ([guestId, threadData]) => {
        if (!threadData || typeof threadData !== 'object') return;

        // Find latest guest message timestamp
        const messages = threadData.messages ?? threadData;
        let latestGuestMsgMs = 0;
        let hasUnreadFromGuest = false;
        if (messages && typeof messages === 'object') {
          for (const m of Object.values<any>(messages)) {
            if (!m || typeof m !== 'object') continue;
            const senderType = (m.senderType ?? m.SenderType ?? '').toString().toLowerCase();
            if (senderType !== 'guest') continue;
            const ts = Number(m.timestamp ?? m.Timestamp ?? 0);
            if (ts > latestGuestMsgMs) latestGuestMsgMs = ts;
            if (m.read === false || m.Read === false) hasUnreadFromGuest = true;
          }
        }
        if (latestGuestMsgMs === 0) return;

        const metaRef = dbRef(rtdb, `${TenantManager.rtdbPath('Tickets/AllChatsTest/Guest')}/${guestId}/__escalation`);
        const metaSnap = await get(metaRef);
        const meta = (metaSnap.val() as GuestChatMeta) ?? {};

        // If a newer guest message arrived after last notification, reset
        if (meta.lastMessageAt && meta.lastMessageAt < latestGuestMsgMs) {
          meta.managerNotifiedAt = undefined;
          meta.ownerNotifiedAt = undefined;
        }

        // Stage 1: notify manager
        if (!meta.managerNotifiedAt) {
          await update(metaRef, {
            managerNotifiedAt: now,
            lastMessageAt: latestGuestMsgMs,
            unread: hasUnreadFromGuest,
          });
          // Push sent server-side by onGuestEscalation (triggered by the
          // managerNotifiedAt write above).
          return;
        }

        // Stage 2: 5min later → owners
        if (
          !meta.ownerNotifiedAt &&
          now - meta.managerNotifiedAt >= ESCALATION_DELAY_MS
        ) {
          await update(metaRef, { ownerNotifiedAt: now });
          // Owner push sent server-side by onGuestEscalation (ownerNotifiedAt write).
        }
      })
    );
  } catch (e) {
    console.warn('[escalation] scanGuestChats failed:', e);
  }
}

export function startEscalationChecker(hotelId: string): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) {
    return () => undefined;
  }
  stopEscalationChecker();

  const tick = () => {
    void scanTasksForEscalation(hotelId);
    void scanGuestChatsForEscalation(hotelId);
  };
  tick(); // run once immediately
  intervalId = setInterval(tick, CHECK_INTERVAL_MS);

  return stopEscalationChecker;
}

export function stopEscalationChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ── Reading escalations (Alerts tab + badge + foreground alerts) ────────────

/** Should this escalation be shown to the given user? */
export function isEscalationForUser(
  e: EscalationNotification,
  opts: { isOwner: boolean; department?: string | null },
): boolean {
  // Owner/admin sits at the top of the hierarchy — sees every department's
  // escalations (both manager- and admin-level).
  if (opts.isOwner) return true;
  // Department manager / front desk: any escalation level for their own
  // department (i.e. the attendants below them in that department).
  return !!e.department && normDept(e.department) === normDept(opts.department);
}

function parseEscalations(raw: Record<string, any> | null | undefined): EscalationNotification[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([ticketId, data]) => ({ ticketId, ...(data as object) } as EscalationNotification))
    .filter((e) => e && (e.level === 'manager' || e.level === 'admin'))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

/**
 * Live list of escalation records relevant to the given user.
 * Returns an unsubscribe function.
 */
export function subscribeToEscalations(
  hotelId: string,
  opts: { isOwner: boolean; department?: string | null },
  callback: (list: EscalationNotification[]) => void,
): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) {
    callback([]);
    return () => undefined;
  }
  const escalRef = dbRef(rtdb, TenantManager.rtdbPath('Notifications/Escalations'));
  const unsub = onValue(escalRef, (snap) => {
    const list = parseEscalations(snap.val()).filter((e) => isEscalationForUser(e, opts));
    callback(list);
  });
  return () => unsub();
}

/**
 * Foreground alert: when a *new* escalation relevant to this user appears
 * (a new ticket breach, or a manager-level entry promoted to admin), fire a
 * local notification + ringtone and report it via `onNew` (e.g. to bump a
 * badge). Skips the backlog burst on first connect.
 */
export function startEscalationAlerts(
  hotelId: string,
  opts: { isOwner: boolean; department?: string | null },
  onNew?: (e: EscalationNotification) => void,
): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) return () => undefined;

  const seen = new Set<string>();
  let armed = false;
  const armTimer = setTimeout(() => { armed = true; }, ALERT_ARM_DELAY_MS);

  // Track active escalations + the last time we rang, so a still-unresolved
  // ticket re-rings only after a fixed quiet gap (not continuously).
  let activeCount = 0;
  let lastRingAt = 0;
  const ring = () => {
    lastRingAt = Date.now();
    void startTaskAlert();
  };

  const escalRef = dbRef(rtdb, TenantManager.rtdbPath('Notifications/Escalations'));
  const unsub = onValue(escalRef, (snap) => {
    const list = parseEscalations(snap.val()).filter((e) => isEscalationForUser(e, opts));
    activeCount = list.length;

    for (const e of list) {
      const key = `${e.ticketId}:${e.level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!armed) continue; // initial backlog — record, don't alert

      const isAdmin = e.level === 'admin';
      const room = e.roomNo ? ` — Room ${e.roomNo}` : '';
      const dept = e.department ? ` (${e.department})` : '';
      void presentLocalEscalationNotification(
        isAdmin ? '🚨 Critical: ticket still unresolved' : '⏰ Ticket overdue',
        `${e.itemOrdered || 'Ticket'}${room}${dept}`,
      );
      // Ring on a genuinely NEW escalation (key not seen before).
      ring();
      onNew?.(e);
    }
  });

  // Re-ring a still-active escalation after a 120s quiet gap. If the manager
  // taps "Stop" (or the 10s ring times out) but the ticket is still
  // unresolved, the alarm returns once 120s have elapsed since it last rang.
  // Polled every 15s so the gap is honoured regardless of when it stopped.
  const RE_RING_GAP_MS = 120_000;
  const reRingInterval = setInterval(() => {
    if (
      armed &&
      activeCount > 0 &&
      !isTaskAlertActive() &&
      Date.now() - lastRingAt >= RE_RING_GAP_MS
    ) {
      ring();
    }
  }, 15_000);

  return () => {
    clearTimeout(armTimer);
    clearInterval(reRingInterval);
    unsub();
  };
}
