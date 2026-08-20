import { TenantManager } from './tenant';
import { presentLocalEscalationNotification } from './notifications';
import { getDepartmentResolutionMs } from './departmentService';
import { startTaskAlert, isTaskAlertActive, stopTaskAlert } from './taskAlert';
import { Task, EscalationNotification } from '../types';
import { TasksService } from './backend';
import { apiGet } from './apiClient';

const GRACE_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const ALERT_ARM_DELAY_MS = 3500;
const CLOSED_STAGES = new Set(['completed', 'delivered', 'cancelled', 'closed']);
const ESCALATION_POLL_INTERVAL_MS = 15000;

let intervalId: ReturnType<typeof setInterval> | null = null;

type EscalationPollEntry = {
  callbacks: Set<(list: EscalationNotification[]) => void>;
  latest: EscalationNotification[];
  hasLatest: boolean;
  active: boolean;
  inFlight: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

const escalationPollers = new Map<string, EscalationPollEntry>();

function normDept(v: unknown) {
  return (v ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isClosed(task: Task): boolean {
  return CLOSED_STAGES.has((task.Stage ?? '').toString().trim().toLowerCase());
}

async function scanTasksForEscalation(hotelId: string): Promise<void> {
  try {
    const tasks = await apiGet<Task[]>(`/hotels/${hotelId}/tasks`);
    const now = Date.now();

    await Promise.all(tasks.map(async (task) => {
      if (!task || isClosed(task)) return;
      const startMs = Number(task.TimerStartTime || task.AssignedTime || 0);
      if (!startMs) return;
      const limitMs = await getDepartmentResolutionMs(hotelId, task.Department);
      const elapsed = now - startMs;
      const level = Number(task.EscalationLevel ?? 0);
      const limitMinutes = Math.max(1, Math.round(limitMs / 60000));

      if (elapsed >= limitMs + GRACE_MS && level < 1) {
        await TasksService.updateTask(task.TaskId, {
          Escalated: true,
          EscalationLevel: 1,
          ManagerEscalatedAt: String(now),
          ManagerNotifiedAt: String(now),
          SlaAlertSent: true,
          timeLimitMinutes: limitMinutes,
        } as any);
        return;
      }

      if (elapsed >= limitMs * 2 + GRACE_MS && level < 2) {
        await TasksService.updateTask(task.TaskId, {
          Escalated: true,
          EscalationLevel: 2,
          AdminEscalatedAt: String(now),
          OwnerNotifiedAt: String(now),
          SlaAlertSent: true,
          timeLimitMinutes: limitMinutes,
        } as any);
      }
    }));
  } catch (e) {
    console.warn('[escalation] scanTasks failed:', e);
  }
}

export function startEscalationChecker(hotelId: string): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) return () => undefined;
  stopEscalationChecker();
  const tick = () => { void scanTasksForEscalation(hotelId); };
  tick();
  intervalId = setInterval(tick, CHECK_INTERVAL_MS);
  return stopEscalationChecker;
}

export function stopEscalationChecker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function isEscalationForUser(
  e: EscalationNotification,
  opts: { isOwner: boolean; department?: string | null },
): boolean {
  if (opts.isOwner) return e.level === 'admin';
  return (
    e.level !== 'admin' &&
    !!e.department &&
    normDept(e.department) === normDept(opts.department)
  );
}

async function fetchEscalations(hotelId: string, opts: { isOwner: boolean; department?: string | null }) {
  const rows = await apiGet<EscalationNotification[]>(`/hotels/${hotelId}/notifications/escalations`);
  return rows.filter((e) => isEscalationForUser(e, opts));
}

export function subscribeToEscalations(
  hotelId: string,
  opts: { isOwner: boolean; department?: string | null },
  callback: (list: EscalationNotification[]) => void,
): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) {
    callback([]);
    return () => undefined;
  }
  const key = `${hotelId}:${opts.isOwner ? 'owner' : normDept(opts.department)}`;
  let entry = escalationPollers.get(key);

  if (!entry) {
    entry = {
      callbacks: new Set(),
      latest: [],
      hasLatest: false,
      active: true,
      inFlight: false,
      timer: null,
    };
    escalationPollers.set(key, entry);

    const tick = async () => {
      if (!entry?.active || entry.inFlight) return;
      entry.inFlight = true;
      try {
        const list = await fetchEscalations(hotelId, opts);
        entry.latest = list;
        entry.hasLatest = true;
        for (const listener of entry.callbacks) {
          try {
            listener(list);
          } catch {}
        }
      } catch (e) {
        console.warn('[escalation] subscribe failed:', e);
      } finally {
        if (entry) {
          entry.inFlight = false;
          if (entry.active) entry.timer = setTimeout(tick, ESCALATION_POLL_INTERVAL_MS);
        }
      }
    };
    void tick();
  }

  entry.callbacks.add(callback);
  if (entry.hasLatest) callback(entry.latest);

  return () => {
    const current = escalationPollers.get(key);
    if (!current) return;
    current.callbacks.delete(callback);
    if (current.callbacks.size === 0) {
      current.active = false;
      if (current.timer) clearTimeout(current.timer);
      escalationPollers.delete(key);
    }
  };
}

export function startEscalationAlerts(
  hotelId: string,
  opts: { isOwner: boolean; department?: string | null },
  onNew?: (e: EscalationNotification) => void,
): () => void {
  if (!hotelId || !TenantManager.isValidHotelId(hotelId)) return () => undefined;

  const seen = new Set<string>();
  let armed = false;
  let activeCount = 0;
  let lastRingAt = 0;
  const armTimer = setTimeout(() => { armed = true; }, ALERT_ARM_DELAY_MS);
  const ring = () => {
    lastRingAt = Date.now();
    void startTaskAlert();
  };

  const unsubscribe = subscribeToEscalations(hotelId, opts, (list) => {
    activeCount = list.length;
    if (activeCount === 0 && isTaskAlertActive()) {
      void stopTaskAlert();
    }
    for (const e of list) {
      const key = `${e.ticketId}:${e.level}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!armed) continue;

      const room = e.roomNo ? ` - Room ${e.roomNo}` : '';
      const dept = e.department ? ` (${e.department})` : '';
      void presentLocalEscalationNotification(
        e.level === 'admin' ? 'Critical: ticket still unresolved' : 'Ticket overdue',
        `${e.itemOrdered || 'Ticket'}${room}${dept}`,
      );
      ring();
      onNew?.(e);
    }
  });

  const reRingInterval = setInterval(() => {
    if (armed && activeCount > 0 && !isTaskAlertActive() && Date.now() - lastRingAt >= 120_000) {
      ring();
    }
  }, 15_000);

  return () => {
    clearTimeout(armTimer);
    clearInterval(reRingInterval);
    unsubscribe();
  };
}
