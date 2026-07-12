/**
 * HoBo Experience — server-side push notifications.
 *
 * Why this exists: the app can only ring / show alerts while it is open. When
 * the app is fully closed (killed), the ONLY thing that can wake the device is
 * a real FCM push delivered by the OS. These Cloud Functions trigger on the
 * Realtime Database writes the app/bot already make and send those pushes from
 * the server — so they arrive even when every app is closed.
 *
 * Triggers (all on the asia-southeast1 default RTDB instance):
 *   1. onTicketCreated   — new ticket → notify the department's attendants + managers
 *   2. onEscalationWritten — SLA escalation → notify dept managers (level "manager")
 *                            or hotel owners (level "admin")
 *   3. onGuestEscalation — unanswered guest chat → managers, then owners
 *
 * Pushes go through the loud `tasks-high` Android channel (created in the app),
 * so a closed app rings with the custom ringtone + vibration.
 */
const { onValueCreated, onValueWritten } = require("firebase-functions/v2/database");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// The RTDB instance + region the app uses. RTDB triggers must point at the same
// instance, and the function should run in the same region as the database.
const DB_INSTANCE = "hobo-experience-default-rtdb";
const REGION = "asia-southeast1";
const CHANNEL_ID = "tasks-high"; // must match ensureTasksChannel() in the app

const db = admin.database();
const fs = admin.firestore();

// Collapse separators/case so "Food_and_beverages" == "food and beverages".
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase().replace(/[\s_-]+/g, ""));

// ── Token lookup ────────────────────────────────────────────────────────────
// Each staffer's device FCM token lives at {hotelId}/FcmToken/{employeeId}.
async function tokensForEmployees(hotelId, ids) {
  const unique = [...new Set(ids)];
  const tokens = [];
  await Promise.all(
    unique.map(async (id) => {
      const snap = await db.ref(`${hotelId}/FcmToken/${id}`).get();
      if (snap.exists()) {
        const t = snap.val() && snap.val().FcmToken;
        if (t) tokens.push(t);
      }
    })
  );
  return [...new Set(tokens)];
}

// ── Recipient resolution (mirrors the app's collectTokens* logic) ────────────
async function newTicketRecipients(hotelId, department) {
  const taskDept = norm(department);
  const snap = await fs.collection("users").where("hotel_id", "==", hotelId).get();
  const ids = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const role = norm(d.Jobrole != null ? d.Jobrole : d.JobRole);
    const isManager = role === "manager" || role === "frontdesk";
    const isAttendant = role === "attendent" || role === "attendant";
    const isActive = d.Status === true || norm(d.Status) === "true";
    if (isManager) {
      ids.push(doc.id);
      return;
    }
    if (isAttendant && isActive) {
      if (!taskDept || taskDept === "all") ids.push(doc.id);
      else if (norm(d.Department) === taskDept) ids.push(doc.id);
    }
  });
  return ids;
}

async function escalationRecipients(hotelId, role, department) {
  const taskDept = norm(department);
  const snap = await fs.collection("users").where("hotel_id", "==", hotelId).get();
  const ids = [];
  snap.forEach((doc) => {
    const d = doc.data() || {};
    const userRole = norm(d.Jobrole != null ? d.Jobrole : d.JobRole);
    const isOwner = d.isHotelOwner === true;
    if (role === "owner") {
      if (isOwner) ids.push(doc.id);
    } else if ((userRole === "manager" || userRole === "frontdesk") && !isOwner) {
      if (!taskDept) ids.push(doc.id);
      else if (norm(d.Department) === taskDept) ids.push(doc.id);
    }
  });
  return ids;
}

// ── Sender ───────────────────────────────────────────────────────────────────
async function pushToTokens(tokens, title, body, data) {
  if (!tokens || tokens.length === 0) {
    logger.info("[push] no tokens — skipping", { title });
    return;
  }
  const stringData = {};
  Object.keys(data || {}).forEach((k) => {
    stringData[k] = String(data[k]);
  });

  const base = {
    notification: { title, body }, // notification message → shows + rings on a killed app
    data: stringData,
    android: {
      priority: "high",
      notification: {
        channelId: CHANNEL_ID, // Android 8+ takes the sound/vibration from this channel
        sound: "ringtone", // pre-Oreo fallback
        defaultVibrateTimings: true,
        notificationPriority: "PRIORITY_MAX",
        visibility: "PUBLIC",
      },
    },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
  };

  let success = 0;
  let failure = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    const res = await admin.messaging().sendEachForMulticast({ ...base, tokens: batch });
    success += res.successCount;
    failure += res.failureCount;
    // Prune dead tokens so we don't keep retrying them.
    res.responses.forEach((r, idx) => {
      if (r.success) return;
      const code = (r.error && r.error.code) || "";
      if (
        code.includes("registration-token-not-registered") ||
        code.includes("invalid-registration-token") ||
        code.includes("invalid-argument")
      ) {
        logger.warn("[push] dead token pruned", { token: batch[idx].slice(0, 12) + "…" });
      }
    });
  }
  logger.info(`[push] "${title}" → ${success} delivered, ${failure} failed`);
}

// ── Trigger 1: new ticket ────────────────────────────────────────────────────
exports.onTicketCreated = onValueCreated(
  { ref: "/{hotelId}/Tickets/Created/{taskId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const { hotelId, taskId } = event.params;
    const t = event.data.val();
    if (!t) return;
    const item = t.ItemOrdered || t.Note || "New request";
    const room = t.UpdatedRoomNo || t.RoomNo || "?";
    const ids = await newTicketRecipients(hotelId, t.Department || "");
    const tokens = await tokensForEmployees(hotelId, ids);
    await pushToTokens(tokens, "🔔 New Ticket", `${item} — Room ${room}`, {
      event: "new_ticket",
      taskId,
    });
  }
);

// ── Trigger 2: SLA escalation (manager- then admin-level) ────────────────────
exports.onEscalationWritten = onValueWritten(
  { ref: "/{hotelId}/Notifications/Escalations/{taskId}", instance: DB_INSTANCE, region: REGION },
  async (event) => {
    const { hotelId, taskId } = event.params;
    const before = event.data.before.val();
    const after = event.data.after.val();
    if (!after) return; // record removed

    const beforeLevel = before && before.level;
    const afterLevel = after.level;
    const dept = after.department || "";
    const item = after.itemOrdered || "Ticket";
    const room = after.roomNo ? ` — Room ${after.roomNo}` : "";
    const deptTxt = dept ? ` (${dept})` : "";

    // Manager-level (first appearance)
    if (afterLevel === "manager" && beforeLevel !== "manager" && beforeLevel !== "admin") {
      const ids = await escalationRecipients(hotelId, "manager", dept);
      const tokens = await tokensForEmployees(hotelId, ids);
      await pushToTokens(tokens, "⏰ Ticket overdue", `${item}${room}${deptTxt}`, {
        event: "escalation",
        taskId,
      });
      return;
    }
    // Admin-level (promoted)
    if (afterLevel === "admin" && beforeLevel !== "admin") {
      const ids = await escalationRecipients(hotelId, "owner", dept);
      const tokens = await tokensForEmployees(hotelId, ids);
      await pushToTokens(tokens, "🚨 Critical: ticket still unresolved", `${item}${room}${deptTxt}`, {
        event: "escalation",
        taskId,
      });
    }
  }
);

// ── Trigger 3: unanswered guest chat ─────────────────────────────────────────
exports.onGuestEscalation = onValueWritten(
  {
    ref: "/{hotelId}/Tickets/AllChatsTest/Guest/{guestId}/__escalation",
    instance: DB_INSTANCE,
    region: REGION,
  },
  async (event) => {
    const { hotelId, guestId } = event.params;
    const before = event.data.before.val() || {};
    const after = event.data.after.val();
    if (!after) return;

    // Manager notified for the first time
    if (after.managerNotifiedAt && !before.managerNotifiedAt) {
      const ids = await escalationRecipients(hotelId, "manager", ""); // all managers
      const tokens = await tokensForEmployees(hotelId, ids);
      await pushToTokens(tokens, "💬 Guest Message", `New message from guest ${guestId}`, {
        event: "guest_chat",
        guestId,
      });
      return;
    }
    // Escalated to owners
    if (after.ownerNotifiedAt && !before.ownerNotifiedAt) {
      const ids = await escalationRecipients(hotelId, "owner", "");
      const tokens = await tokensForEmployees(hotelId, ids);
      await pushToTokens(tokens, "🚨 Guest awaiting reply", `Guest ${guestId} unanswered for 5+ min`, {
        event: "guest_chat",
        guestId,
      });
    }
  }
);
