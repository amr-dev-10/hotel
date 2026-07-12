import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Query,
  DocumentData,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
  ref as dbRef,
  set,
  remove,
  get,
  push,
  update,
  onValue,
  runTransaction,
  query as rtdbQuery,
  orderByChild,
  equalTo,
} from 'firebase/database';
import { signOut } from 'firebase/auth';
import { db, storage, rtdb, auth } from './firebaseConfig';
import { COLLECTIONS, STORAGE_PATHS } from '../utils/constants';
import { Task, User, ChatMessage, InventoryItem, ProfileDetails, Department, AssignmentHistoryEntry, AssignmentChangeReason } from '../types';
import { TenantManager } from './tenant';

function tenantPath(path: string) {
  return TenantManager.rtdbPath(path);
}

function normalize(value: unknown) {
  return (value ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isAttendantRole(rawRole: unknown) {
  const role = normalize(rawRole);
  return role === 'attendent' || role === 'attendant';
}

function isFrontDeskRole(rawRole: unknown) {
  const role = normalize(rawRole);
  return role === 'frontdesk';
}

function isManagerRole(rawRole: unknown) {
  const role = normalize(rawRole);
  return role === 'manager' || isFrontDeskRole(rawRole);
}

// 4-tier hierarchy for assignment:
//   Tier 1: Same-dept Attendant (rank 0)
//   Tier 2: Same-dept Manager (rank 1)
//   Tier 3: Front Desk attendant/manager (rank 0 or 1 in frontdesk dept)
//   Tier 4: Owner/Admin (rank 2, isHotelOwner === true)
// Tickets are assigned to the lowest available tier first.
function roleRank(data: Record<string, unknown>): number {
  if (isAttendantRole(data.Jobrole)) return 0;       // Attendant — assigned first
  if (isManagerRole(data.Jobrole) && !data.isHotelOwner) return 1; // Manager — fallback
  if (data.isHotelOwner) return 2;                    // Owner — last resort
  return 99;                                           // Unknown role — skip
}

function departmentMatches(userDepartment: unknown, taskDepartment: unknown) {
  const taskDept = canonDept(normalize(taskDepartment));
  if (!taskDept || taskDept === 'all') return true;
  return canonDept(normalize(userDepartment)) === taskDept;
}

/** Canonicalize normalized department strings so aliases resolve to the same value. */
function canonDept(normalized: string): string {
  const FNB = new Set(['fnb', 'roomservice', 'inroomdining', 'foodandbeverage', 'foodandbeverages', 'foodbeveragesupport', 'foodandbeveragesupport']);
  if (FNB.has(normalized)) return 'foodandbeverages';
  const ENG = new Set(['engineersupport', 'technicalsupport', 'maintenance', 'technical', 'engineering', 'maintainance']);
  if (ENG.has(normalized)) return 'engineering';
  const FD = new Set(['emergencyservices', 'emergencyresponse', 'handlegeneralinquiries', 'safety', 'frontdesk']);
  if (FD.has(normalized)) return 'frontdesk';
  const HK = new Set(['housekeeping']);
  if (HK.has(normalized)) return 'housekeeping';
  return normalized;
}

function generateRandomTaskId() {
  return `TN${String(Date.now() % 10000000).padStart(7, '0')}`;
}

console.log('[firebase service] module loaded');


function taskTimestamp(task: Task): number {
  const ts: any = task.timestamp;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Number(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (ts && typeof ts === 'object' && typeof ts.seconds === 'number') {
    return ts.seconds * 1000;
  }
  return 0;
}

function mapRtdbTasks(raw: any): Task[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .map(([taskId, value]) => ({ TaskId: taskId, ...(value as object) } as Task))
    .sort((a, b) => taskTimestamp(b) - taskTimestamp(a));
}

async function assignPendingTicketsToAttendant(department: string): Promise<void> {
  console.log('[assignPendingTickets] scanning unassigned tickets for department:', department);
  const allTicketsSnap = await get(dbRef(rtdb, tenantPath('Tickets/Created')));
  if (!allTicketsSnap.exists()) return;

  const unassigned = Object.entries(allTicketsSnap.val() as Record<string, Task>)
    .filter(([, t]) => {
      const stage = normalize(t.Stage);
      const assignedTo = (t.AssignedToID ?? '').toString().trim();
      return stage === 'created' && !assignedTo && departmentMatches(department, t.Department);
    })
    .sort(([, a], [, b]) => taskTimestamp(a) - taskTimestamp(b));

  console.log('[assignPendingTickets] found', unassigned.length, 'unassigned ticket(s)');

  for (const [taskId, task] of unassigned) {
    await autoAssignTaskToAttendant(taskId, task.Department as string || department);
  }
}

async function autoAssignTaskToAttendant(taskId: string, department: string): Promise<void> {
  console.log('[autoAssignTask] START - taskId:', taskId, 'department:', department);
  
  if (!department) {
    console.log('[autoAssignTask] SKIP - no department provided');
    return;
  }

  const hotelId = TenantManager.getHotelId();
  console.log('[autoAssignTask] hotelId:', hotelId, 'isValid:', TenantManager.isValidHotelId(hotelId));
  
  if (!TenantManager.isValidHotelId(hotelId)) {
    console.log('[autoAssignTask] SKIP - invalid hotelId');
    return;
  }

  const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`);
  const snap = await get(taskRef);
  
  if (!snap.exists()) {
    console.log('[autoAssignTask] SKIP - task does not exist');
    return;
  }
  
  const task = snap.val() as Task;
  const stage = normalize(task.Stage);
  const assignedTo = (task.AssignedToID ?? '').toString().trim();
  
  console.log('[autoAssignTask] task found - stage:', stage, 'already assigned to:', assignedTo || 'NONE');
  
  if (assignedTo) {
    console.log('[autoAssignTask] SKIP - already assigned');
    return;
  }
  
  if (stage !== 'created') {
    console.log('[autoAssignTask] SKIP - stage is not created, is:', stage);
    return;
  }

  try {
    console.log('[autoAssignTask] querying active employees for hotel:', hotelId);
    
    // Get ALL active users in the hotel (not just attendants)
    const usersQ = query(
      collection(db, COLLECTIONS.USERS),
      where('hotel_id', '==', hotelId),
      where('Status', '==', true)
    );
    const usersSnap = await getDocs(usersQ);
    console.log('[autoAssignTask] found', usersSnap.docs.length, 'total active employees in hotel');
    
    // Build candidates with role rank and department info
    const allCandidates = usersSnap.docs
      .map((d) => {
        const userData = d.data();
        const rank = roleRank(userData);
        return {
          id: d.id,
          name: (userData.Name as string) || '',
          rank,
          department: normalize(userData.Department as string),
        };
      })
      .filter((c) => c.rank < 99); // Exclude unknown roles

    // Walk the hierarchy:
    //   Tier 1: Same-dept Attendant
    //   Tier 2: Same-dept Manager
    //   Tier 3: Front Desk (any active attendant/manager in Front Desk dept)
    //   Tier 4: Owner/Admin (last resort)
    const normalizedDept = canonDept(normalize(department));

    // Step 1: Same-department attendants (rank 0)
    let candidates = allCandidates.filter(
      (c) => c.rank === 0 && canonDept(c.department) === normalizedDept
    );
    let assignLabel = 'same-dept attendant';

    // Step 2: Same-department managers (rank 1)
    if (candidates.length === 0) {
      candidates = allCandidates.filter(
        (c) => c.rank === 1 && canonDept(c.department) === normalizedDept
      );
      assignLabel = 'same-dept manager';
    }

    // Step 3: Front Desk employees (skip if ticket is already from front_desk)
    if (candidates.length === 0 && normalizedDept !== 'frontdesk') {
      candidates = allCandidates.filter(
        (c) => (c.rank === 0 || c.rank === 1) && canonDept(c.department) === 'frontdesk'
      );
      assignLabel = 'front-desk';
    }

    // Step 4: Owner/Admin (last resort)
    if (candidates.length === 0) {
      candidates = allCandidates.filter((c) => c.rank === 2);
      assignLabel = 'owner';
    }

    console.log('[autoAssignTask] filtered to', candidates.length, 'candidates via:', assignLabel);
    
    if (candidates.length === 0) {
      console.log('[autoAssignTask] No active employees available at all');
      return;
    }

    // Count active tickets per candidate for load balancing
    const ticketCounts: Record<string, number> = {};
    const allTicketsSnap = await get(dbRef(rtdb, tenantPath('Tickets/Created')));
    
    if (allTicketsSnap.exists()) {
      Object.values(allTicketsSnap.val() as Record<string, Task>).forEach((t) => {
        const tStage = normalize(t.Stage);
        const tAssignedId = (t.AssignedToID ?? '').toString().trim();
        if (
          tAssignedId &&
          (tStage === 'assigned' || tStage === 'executed')
        ) {
          ticketCounts[tAssignedId] = (ticketCounts[tAssignedId] || 0) + 1;
        }
      });
    }
    
    console.log('[autoAssignTask] ticket counts:', ticketCounts);

    // Find candidate with fewest active tickets
    const best = candidates.reduce((prev, curr) => {
      const prevCount = ticketCounts[prev.id] ?? 0;
      const currCount = ticketCounts[curr.id] ?? 0;
      return currCount < prevCount ? curr : prev;
    });

    console.log('[autoAssignTask] ASSIGNING to', best.name, '(', assignLabel, ') with', ticketCounts[best.id] ?? 0, 'active tickets');

    const now = Date.now();
    await update(taskRef, {
      AssignedToID: best.id,
      AssignedToName: best.name,
      Stage: 'Assigned',
      WorkflowStep: 'Accepted',
      AssignedTime: String(now),
      AcceptedTime: String(now),
      TimerStartTime: String(now),
      SlaAlertSent: false,
      CandidateIds: [],
    });
    console.log('[autoAssignTask] SUCCESS - Assigned task', taskId, 'to', best.name, 'via', assignLabel);
  } catch (e) {
    console.error('[autoAssignTask] ERROR:', e);
  }
}

/**
 * Build the next AssignmentHistory array by appending the ticket's CURRENT
 * assignee (the one about to be replaced) along with why it changed. Returns
 * undefined when there is no current assignee to record, so callers can spread
 * it conditionally. Append-only — prior entries are preserved.
 */
function appendAssignmentHistory(
  task: Partial<Task> | null | undefined,
  reason: AssignmentChangeReason,
): AssignmentHistoryEntry[] | undefined {
  const prevId = (task?.AssignedToID ?? '').toString().trim();
  const prevName = (task?.AssignedToName ?? '').toString().trim();
  if (!prevId && !prevName) return undefined; // first assignment — nothing to record
  const prior = Array.isArray(task?.AssignmentHistory) ? task!.AssignmentHistory! : [];
  return [
    ...prior,
    {
      EmployeeId: prevId,
      Name: prevName || 'Unknown',
      Department: (task?.Department ?? '').toString() || undefined,
      AssignedAt: task?.AssignedTime ? String(task.AssignedTime) : undefined,
      ReplacedAt: String(Date.now()),
      Reason: reason,
    },
  ];
}

/**
 * Reassign all open tickets from an employee who just went inactive.
 * Resets each ticket to 'Created' and re-runs auto-assign with hierarchy.
 */
async function reassignTicketsFromInactiveEmployee(employeeId: string, department: string): Promise<void> {
  console.log('[reassignFromInactive] scanning tickets for employee:', employeeId);
  const hotelId = TenantManager.getHotelId();
  if (!TenantManager.isValidHotelId(hotelId)) return;

  const allTicketsSnap = await get(dbRef(rtdb, tenantPath('Tickets/Created')));
  if (!allTicketsSnap.exists()) return;

  const allTickets = allTicketsSnap.val() as Record<string, Task>;
  const openTickets = Object.entries(allTickets).filter(([, t]) => {
    const assignedTo = (t.AssignedToID ?? '').toString().trim();
    const stage = normalize(t.Stage);
    const isClosed = ['completed', 'delivered', 'cancelled', 'closed'].includes(stage);
    return assignedTo === employeeId && !isClosed;
  });

  if (openTickets.length === 0) {
    console.log('[reassignFromInactive] no open tickets for', employeeId);
    return;
  }

  console.log('[reassignFromInactive]', openTickets.length, 'ticket(s) to reassign');
  for (const [ticketId, task] of openTickets) {
    const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${ticketId}`);
    // Atomic read-modify-write: only release the ticket if it's STILL assigned
    // to the now-inactive employee (guards against a manager reassigning it at
    // the same moment), and append history off the latest server value so no
    // entry is lost under concurrency.
    await runTransaction(taskRef, (current: Task | null) => {
      if (!current) return current; // ticket gone — leave as-is
      if ((current.AssignedToID ?? '').toString().trim() !== employeeId) return current;
      const history = appendAssignmentHistory(current, 'inactive');
      return {
        ...current,
        AssignedToID: '',
        AssignedToName: '',
        Stage: 'Created',
        WorkflowStep: 'Pending',
        ...(history ? { AssignmentHistory: history } : {}),
      };
    });
    await autoAssignTaskToAttendant(ticketId, (task.Department as string) || department);
  }
}

// ===== AUTH =====
export const FirebaseAuth = {
  getCurrentUser() {
    return auth.currentUser;
  },
  async signOut() {
    await signOut(auth);
  },
};

// ===== USERS =====
export const UsersService = {
  async getUser(employeeId: string): Promise<User | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, employeeId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const hotelId = TenantManager.getHotelId();
    if (TenantManager.isValidHotelId(hotelId) && normalize(data.hotel_id) !== normalize(hotelId)) {
      return null;
    }
    return { EmployeeId: snap.id, ...data } as User;
  },

  async updateUser(employeeId: string, data: Partial<User>) {
    await setDoc(doc(db, COLLECTIONS.USERS, employeeId), data, { merge: true });
  },

  async getAllEmployees(): Promise<ProfileDetails[]> {
    const hotelId = TenantManager.getHotelId();
    if (!TenantManager.isValidHotelId(hotelId)) return [];
    const usersQ = query(collection(db, COLLECTIONS.USERS), where('hotel_id', '==', hotelId));
    const snap = await getDocs(usersQ);
    return snap.docs.map((d) => ({ EmployeeId: d.id, ...d.data() } as ProfileDetails));
  },

  // Real-time listener — mirrors DashBoardFragmentManager.teammemberslist()
  // Uses Firestore onSnapshot with ADDED/MODIFIED change types
  subscribeToAllEmployees(callback: (employees: ProfileDetails[]) => void): () => void {
    const hotelId = TenantManager.getHotelId();
    if (!TenantManager.isValidHotelId(hotelId)) {
      callback([]);
      return () => {};
    }
    const list: ProfileDetails[] = [];
    const usersQ = query(collection(db, COLLECTIONS.USERS), where('hotel_id', '==', hotelId));
    return onSnapshot(usersQ, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const profile = { EmployeeId: change.doc.id, ...change.doc.data() } as ProfileDetails;
        if (change.type === 'added') {
          list.push(profile);
        } else if (change.type === 'modified') {
          const idx = list.findIndex((e) => e.EmployeeId === profile.EmployeeId);
          if (idx !== -1) list[idx] = profile;
        } else if (change.type === 'removed') {
          const idx = list.findIndex((e) => e.EmployeeId === profile.EmployeeId);
          if (idx !== -1) list.splice(idx, 1);
        }
      });
      callback([...list]);
    });
  },

  async getEmployeesByDepartment(department: Department): Promise<ProfileDetails[]> {
    const hotelId = TenantManager.getHotelId();
    if (!TenantManager.isValidHotelId(hotelId)) return [];
    let q: Query<DocumentData> = query(
      collection(db, COLLECTIONS.USERS),
      where('hotel_id', '==', hotelId),
      where('Status', '==', true)
    );
    if (department !== 'ALL') {
      q = query(q, where('Department', '==', department));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ EmployeeId: d.id, ...d.data() } as ProfileDetails));
  },

  subscribeToUser(employeeId: string, callback: (user: User | null) => void) {
    return onSnapshot(doc(db, COLLECTIONS.USERS, employeeId), (snap) => {
      if (!snap.exists()) { callback(null); return; }
      callback({ EmployeeId: snap.id, ...snap.data() } as User);
    });
  },

  async setActiveStatus(employeeId: string, name: string, department: string, active: boolean) {
    const activeRef = dbRef(rtdb, tenantPath(`ActiveAttendants/${department}/${employeeId}`));
    if (active) {
      await set(activeRef, { id: employeeId, name });
    } else {
      await remove(activeRef);
    }
    // Mark "self" so the bot/dashboard knows this was a voluntary offline
    // toggle — admin-deactivation writes "admin" instead. Only "admin"
    // triggers ticket reassignment; "self" keeps existing tasks in place.
    await setDoc(doc(db, COLLECTIONS.USERS, employeeId), {
      Status: active,
      DeactivatedBy: active ? '' : 'self',
    }, { merge: true });

    if (active && department) {
      // When an employee comes online, assign any unassigned tickets waiting in their department
      assignPendingTicketsToAttendant(department).catch((e) => {
        console.error('[setActiveStatus] pending ticket assignment error:', e);
      });
    }
    // When going offline from the app (self), do NOT reassign existing tasks.
    // The employee keeps their assigned tickets and must complete them.
    // Only admin/manager deactivation (DeactivatedBy === "admin") triggers reassignment.
  },

  async deleteUser(employeeId: string) {
    await deleteDoc(doc(db, COLLECTIONS.USERS, employeeId));
  },

  async uploadProfilePicture(employeeId: string, uri: string): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ref = storageRef(storage, `${STORAGE_PATHS.PROFILE_PICTURES}/${employeeId}`);
    await uploadBytes(ref, blob);
    return getDownloadURL(ref);
  },
};

// ===== TASKS =====
export const TasksService = {
  async createTask(task: Omit<Task, 'TaskId'>): Promise<string> {
    console.log('[createTask] START - creating task with department:', task.Department);
    
    // Complaints always go to Front Desk for escalation handling
    const ticketType = (task as any).TicketType || '';
    if (normalize(ticketType) === 'complaints' || normalize(ticketType) === 'complaint') {
      (task as any).Department = 'Front_desk';
      console.log('[createTask] Complaint detected — routing to Front_desk');
    }
    
    const colRef = dbRef(rtdb, tenantPath('Tickets/Created'));
    const newTaskRef = push(colRef);
    const taskId = newTaskRef.key;
    if (!taskId) throw new Error('Failed to create task ID');

    const now = Date.now();
    const randomTaskId = generateRandomTaskId();
    const hotelId = TenantManager.getHotelId();

    console.log('[createTask] taskId:', taskId, 'randomTaskId:', randomTaskId, 'hotelId:', hotelId);

    // CandidateIds: [] means open to all active attendants in the department.
    // Department filtering is applied client-side when attendants subscribe.
    await set(newTaskRef, {
      ...task,
      TaskId: taskId,
      RandomTaskId: randomTaskId,
      Stage: task.Stage || 'Created',
      WorkflowStep: 'Pending',
      CandidateIds: [],
      RejectedByIds: [],
      SlaAlertSent: false,
      hotel_id: hotelId,
      timestamp: now,
      CreatedTime: now,
    });

    console.log('[createTask] ticket saved to RTDB');

    // Auto-assign ticket to the available attendant with fewest active tickets
    if (task.Department) {
      console.log('[createTask] calling autoAssignTaskToAttendant for department:', task.Department);
      // Fire and forget — don't block on auto-assign
      autoAssignTaskToAttendant(taskId, task.Department).catch((e) => {
        console.error('[createTask] auto-assign error:', e);
      });
    } else {
      console.log('[createTask] SKIP auto-assign - no department');
    }

    // New-ticket push is sent server-side by the onTicketCreated Cloud Function
    // (so it arrives even when the app is closed) — nothing to do here.

    return taskId;
  },

  async getTask(taskId: string): Promise<Task | null> {
    const snap = await get(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`));
    if (!snap.exists()) return null;
    return { TaskId: taskId, ...(snap.val() as object) } as Task;
  },

  async updateTask(taskId: string, data: Partial<Task>) {
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), data as object);
  },

  async assignTaskByManager(taskId: string, attendantId: string, attendantName: string) {
    const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`);
    // Warm the local cache so the transaction's first pass sees real data
    // (avoids a spurious abort on a cold cache).
    await get(taskRef);
    const now = Date.now();
    // Atomic read-modify-write: appends the outgoing assignee to history off
    // the LATEST server value. If another manager reassigns at the same time,
    // Firebase re-runs this updater with the fresh value — so no history entry
    // is ever lost or duplicated.
    await runTransaction(taskRef, (current: Task | null) => {
      if (!current) return current; // ticket gone — abort, don't recreate
      const history = appendAssignmentHistory(current, 'reassigned');
      return {
        ...current,
        AssignedToID: attendantId,
        AssignedToName: attendantName,
        Stage: 'Assigned',
        WorkflowStep: 'Accepted',
        AssignedTime: String(now),
        AcceptedTime: String(now),
        TimerStartTime: String(now),
        SlaAlertSent: false,
        CandidateIds: [],
        ...(history ? { AssignmentHistory: history } : {}),
      };
    });
  },

  // Transfer a ticket to another department, optionally to a specific person.
  // Atomically records the outgoing assignee in AssignmentHistory.
  //   • assignTo provided → stamp them directly (Assigned/Accepted, SLA running)
  //   • assignTo omitted   → reset to Created and auto-assign the lightest-loaded
  //                          attendant in the destination department
  async transferTicket(
    taskId: string,
    newDepartment: string,
    assignTo?: { id: string; name: string } | null,
  ) {
    const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`);
    await get(taskRef); // warm cache for the transaction's first pass
    const now = Date.now();
    const manual = !!(assignTo && assignTo.id);
    await runTransaction(taskRef, (current: Task | null) => {
      if (!current) return current; // ticket gone — abort
      const history = appendAssignmentHistory(current, 'transferred');
      if (manual) {
        return {
          ...current,
          Department: newDepartment,
          CandidateIds: [],
          RejectedByIds: [],
          AssignedToID: assignTo!.id,
          AssignedToName: assignTo!.name,
          Stage: 'Assigned',
          WorkflowStep: 'Accepted',
          AssignedTime: String(now),
          AcceptedTime: String(now),
          TimerStartTime: String(now),
          SlaAlertSent: false,
          ...(history ? { AssignmentHistory: history } : {}),
        };
      }
      return {
        ...current,
        Department: newDepartment,
        CandidateIds: [],
        RejectedByIds: [],
        AssignedToID: '',
        AssignedToName: '',
        Stage: 'Created',
        WorkflowStep: 'Pending',
        ...(history ? { AssignmentHistory: history } : {}),
      };
    });
    // Auto path: kick off client-side auto-assign immediately (best-effort) so
    // the manager doesn't have to wait for a server routing tick.
    if (!manual) {
      try { await autoAssignTaskToAttendant(taskId, newDepartment); } catch {}
    }
  },

  async markTaskEnRoute(taskId: string) {
    const now = String(Date.now());
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), {
      WorkflowStep: 'EnRoute',
      EnRouteTime: now,
    });
  },

  async markTaskAtLocation(taskId: string) {
    const now = String(Date.now());
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), {
      WorkflowStep: 'AtLocation',
      AtLocationTime: now,
    });
  },

  async markTaskSlaExceeded(taskId: string) {
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), {
      SlaAlertSent: true,
    });
  },



  async rejectTask(taskId: string, employeeId: string) {
    const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`);
    const snap = await get(taskRef);
    if (!snap.exists()) throw new Error('Task not found');

    const task = snap.val() as Task;
    const rejected = [...(task.RejectedByIds ?? [])];
    if (!rejected.includes(employeeId)) rejected.push(employeeId);

    // Ticket stays visible to all other attendants in the department.
    // Only the rejecting attendant is excluded via RejectedByIds.
    await update(taskRef, { RejectedByIds: rejected });
  },

  async deleteTask(taskId: string, taskData: Task) {
    await set(dbRef(rtdb, `${tenantPath('Tickets/Deleted_Tasks')}/${taskId}`), taskData);
    await remove(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`));
  },

  subscribeToAllTasks(callback: (tasks: Task[]) => void) {
    const tasksRef = dbRef(rtdb, tenantPath('Tickets/Created'));
    return onValue(tasksRef, (snap) => {
      callback(mapRtdbTasks(snap.val()));
    });
  },

  subscribeToTasksByStage(stage: string, callback: (tasks: Task[]) => void) {
    const q = rtdbQuery(dbRef(rtdb, tenantPath('Tickets/Created')), orderByChild('Stage'), equalTo(stage));
    return onValue(q, (snap) => {
      callback(mapRtdbTasks(snap.val()));
    });
  },

  subscribeToTasksForAttendant(employeeId: string, callback: (tasks: Task[]) => void) {
    const q = rtdbQuery(dbRef(rtdb, tenantPath('Tickets/Created')), orderByChild('AssignedToID'), equalTo(employeeId));
    return onValue(q, (snap) => {
      callback(mapRtdbTasks(snap.val()));
    });
  },

  subscribeToTask(taskId: string, callback: (task: Task | null) => void) {
    const taskRef = dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`);
    return onValue(taskRef, (snap) => {
      if (!snap.exists()) { callback(null); return; }
      callback({ TaskId: taskId, ...(snap.val() as object) } as Task);
    });
  },

  async uploadTaskImage(taskId: string, uri: string, index: number): Promise<string> {
    const response = await fetch(uri);
    const blob = await response.blob();
    const ref = storageRef(storage, `${STORAGE_PATHS.TASK_IMAGES}/${taskId}_${index}_${Date.now()}`);
    await uploadBytes(ref, blob);
    return getDownloadURL(ref);
  },

  async markTaskEnRouteWithPhotos(taskId: string, photoUris: string[]): Promise<void> {
    const now = String(Date.now());
    const uploadedUrls = await Promise.all(
      photoUris.map((uri, i) => TasksService.uploadTaskImage(taskId, uri, i))
    );
    const patch: Record<string, any> = { WorkflowStep: 'EnRoute', EnRouteTime: now };
    if (uploadedUrls.length > 0) patch.EnRoutePhotos = uploadedUrls;
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), patch);
  },

  async markTaskAtLocationWithPhotos(taskId: string, photoUris: string[]): Promise<void> {
    const now = String(Date.now());
    const uploadedUrls = await Promise.all(
      photoUris.map((uri, i) => TasksService.uploadTaskImage(taskId, uri, i))
    );
    const patch: Record<string, any> = { WorkflowStep: 'AtLocation', AtLocationTime: now };
    if (uploadedUrls.length > 0) patch.AtLocationPhotos = uploadedUrls;
    await update(dbRef(rtdb, `${tenantPath('Tickets/Created')}/${taskId}`), patch);
  },
};

// ===== CHAT =====
function chatTimestampValue(raw: any): number {
  const t = raw?.timestamp;
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function mapRtdbMessages(raw: any): ChatMessage[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .map(([msgId, value]) => ({ msgId, ...(value as object) } as ChatMessage))
    .sort((a, b) => chatTimestampValue(a) - chatTimestampValue(b));
}

async function resolveUserRoomPath(currentUserId: string, otherUserId: string): Promise<string> {
  const roomId1 = `${otherUserId}+${currentUserId}`;
  const roomId2 = `${currentUserId}+${otherUserId}`;
  const ref1 = dbRef(rtdb, `${tenantPath('Tickets/AllChatsTest')}/${roomId1}`);
  const ref2 = dbRef(rtdb, `${tenantPath('Tickets/AllChatsTest')}/${roomId2}`);

  const [snap1, snap2] = await Promise.all([get(ref1), get(ref2)]);
  if (snap1.exists()) return `${tenantPath('Tickets/AllChatsTest')}/${roomId1}`;
  if (snap2.exists()) return `${tenantPath('Tickets/AllChatsTest')}/${roomId2}`;
  return `${tenantPath('Tickets/AllChatsTest')}/${roomId1}`;
}

export const ChatService = {
  async sendMessage(
    senderId: string,
    receiverId: string,
    message: string,
    chatType: 'USER' | 'GUEST' = 'USER'
  ) {
    const path =
      chatType === 'GUEST'
        ? `${tenantPath('Tickets/AllChatsTest')}/Guest/${receiverId}`
        : await resolveUserRoomPath(senderId, receiverId);

    const msgRef = push(dbRef(rtdb, path));
    await set(msgRef, {
      senderId,
      message,
      timestamp: String(Date.now()),
    });
  },

  subscribeToMessages(
    userId1: string,
    userId2: string,
    callback: (messages: ChatMessage[]) => void,
    chatType: 'USER' | 'GUEST' = 'USER'
  ) {
    if (chatType === 'GUEST') {
      const guestRef = dbRef(rtdb, `${tenantPath('Tickets/AllChatsTest')}/Guest/${userId2}`);
      return onValue(guestRef, (snap) => {
        callback(mapRtdbMessages(snap.val()));
      });
    }

    const roomId1 = `${userId2}+${userId1}`;
    const roomId2 = `${userId1}+${userId2}`;
    const ref1 = dbRef(rtdb, `${tenantPath('Tickets/AllChatsTest')}/${roomId1}`);
    const ref2 = dbRef(rtdb, `${tenantPath('Tickets/AllChatsTest')}/${roomId2}`);

    let msgs1: ChatMessage[] = [];
    let msgs2: ChatMessage[] = [];
    const emit = () => {
      const merged = [...msgs1, ...msgs2]
        .filter((m) => m && typeof m.message === 'string')
        .sort((a, b) => chatTimestampValue(a) - chatTimestampValue(b));
      callback(merged);
    };

    const unsub1 = onValue(ref1, (snap) => {
      msgs1 = mapRtdbMessages(snap.val());
      emit();
    });
    const unsub2 = onValue(ref2, (snap) => {
      msgs2 = mapRtdbMessages(snap.val());
      emit();
    });

    return () => {
      unsub1();
      unsub2();
    };
  },

  async updateUnreadCount(currentUserId: string, targetUserId: string, name: string, increment: boolean) {
    const userRef = doc(db, COLLECTIONS.USERS, currentUserId);
    const userSnap = await getDoc(userRef);
    const data = userSnap.data();
    let unseenMessages: any[] = data?.UnseenMessages ?? [];
    const idx = unseenMessages.findIndex((m: any) => m.UserId === targetUserId);
    if (increment) {
      if (idx >= 0) {
        unseenMessages[idx].Count += 1;
      } else {
        unseenMessages.push({ UserId: targetUserId, Name: name, Count: 1 });
      }
    } else {
      unseenMessages = unseenMessages.filter((m: any) => m.UserId !== targetUserId);
    }
    await setDoc(userRef, { UnseenMessages: unseenMessages }, { merge: true });
  },
};

// ===== DELETED TASKS =====
export const DeletedTasksService = {
  subscribeToDeletedTasks(callback: (tasks: Task[]) => void) {
    const deletedRef = dbRef(rtdb, tenantPath('Tickets/Deleted_Tasks'));
    return onValue(deletedRef, (snap) => {
      callback(mapRtdbTasks(snap.val()));
    });
  },
};

// ===== NOTIFICATIONS =====
export type ClaimNotification = {
  id: string;
  type: 'TICKET_CLAIMED';
  ticketId: string;
  attendantId: string;
  attendantName: string;
  itemOrdered: string;
  roomNo: string;
  timestamp: number;
  readBy: string[];
};

export const NotificationsService = {
  subscribeToClaimNotifications(
    callback: (notifications: ClaimNotification[]) => void
  ): () => void {
    const notifRef = dbRef(rtdb, tenantPath('Notifications'));
    return onValue(notifRef, (snap) => {
      if (!snap.exists()) { callback([]); return; }
      const raw = snap.val() as Record<string, Omit<ClaimNotification, 'id'>>;
      const list = Object.entries(raw)
        .map(([id, val]) => ({ id, ...val } as ClaimNotification))
        .filter((n) => n.type === 'TICKET_CLAIMED')
        .sort((a, b) => b.timestamp - a.timestamp);
      callback(list);
    });
  },

  async markRead(notificationId: string, employeeId: string) {
    const notifRef = dbRef(rtdb, `${tenantPath('Notifications')}/${notificationId}`);
    const snap = await get(notifRef);
    if (!snap.exists()) return;
    const data = snap.val() as ClaimNotification;
    const readBy: string[] = Array.isArray(data.readBy) ? data.readBy : [];
    if (!readBy.includes(employeeId)) {
      await update(notifRef, { readBy: [...readBy, employeeId] });
    }
  },
};

// ===== INVENTORY =====
export const InventoryService = {
  subscribeToInventory(callback: (items: InventoryItem[]) => void) {
    return onSnapshot(collection(db, COLLECTIONS.INVENTORY), (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)));
    });
  },

  async addInventoryItem(name: string): Promise<string> {
    const cleanName = name.trim();
    const itemRef = doc(db, COLLECTIONS.INVENTORY, cleanName);
    const exists = await getDoc(itemRef);
    if (exists.exists()) {
      throw new Error('Already exists');
    }
    await setDoc(itemRef, { Name: cleanName, Available: false });
    return cleanName;
  },

  async updateAvailability(itemId: string, available: boolean) {
    await setDoc(doc(db, COLLECTIONS.INVENTORY, itemId), { Available: available }, { merge: true });
  },
};
