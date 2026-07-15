// ===== USER TYPES =====
export type JobRole = 'Owner' | 'Manager' | 'Attendent' | 'Front_desk';

// Department is now a dynamic string — each hotel defines its own departments
// via the Admin Dashboard/backend.
// 'ALL' is a reserved value meaning "no department filter".
export type Department = string;

export interface User {
  EmployeeId: string;
  Email: string;
  Name: string;
  Password?: string;
  ProfileImage?: string;
  Jobrole: JobRole;
  Status: boolean;
  Department?: Department;
  UnseenMessages?: UnreadMessageEntry[];
  OnlineForChat?: boolean;
}

export interface ProfileDetails {
  EmployeeId: string;
  Email: string;
  Name: string;
  JobRole: JobRole;
  Number?: string;
  Department?: Department;
  ProfileImage?: string;
  Status?: boolean;
  AllowToEdit?: boolean;
}

// ===== TASK TYPES =====
export type TaskStage = 'Created' | 'Assigned' | 'Executed' | 'Completed';
export type Priority = 'High' | 'Important' | 'Routine';
export type DeliveryStatus = 'Completed' | 'NotCompleted';
export type WorkflowStep = 'Pending' | 'Accepted' | 'EnRoute' | 'AtLocation' | 'Done';

export interface AddOn {
  name: string;
  quantity?: string;
}

// One entry per time a ticket leaves an assignee — appended (never dropped)
// whenever the ticket is reassigned to someone else, transferred to another
// department, or auto-released because the assignee went inactive. Lets the
// manager/owner see the full chain of who the ticket passed through.
export type AssignmentChangeReason = 'reassigned' | 'transferred' | 'inactive';
export interface AssignmentHistoryEntry {
  EmployeeId: string;
  Name: string;
  Department?: string;
  AssignedAt?: string;   // when this person was originally assigned
  ReplacedAt?: string;   // when they were removed/replaced
  Reason?: AssignmentChangeReason;
}

export interface Task {
  TaskId: string;
  RandomTaskId?: string;
  RoomNo: string;
  TaskAdderName: string;
  TaskAdderId: string;
  Priority: Priority;
  Note?: string;
  ItemOrdered?: string;
  PaidBy?: string;
  AddOns?: AddOn[];
  DesiredDate?: string;
  DesiredTime?: string;
  GuestName?: string;
  AssignedToID?: string;
  AssignedToName?: string;
  AssignedTime?: string;
  ApproveById?: string;
  ApproveByName?: string;
  ApprovalAppliedTime?: string;
  ApproveTime?: string;
  Stage: TaskStage;
  DeliveryStatus?: DeliveryStatus;
  NotDeliveredReason1?: string;
  NotDeliveredReason2?: string;
  NotDeliveredTime?: string;
  TaskImages?: string[];
  TaskImagesUnDelivered?: string[];
  UpdatedRoomNo?: string;
  Reattempt?: string;
  ReattemptSetById?: string;
  ReattemptSetByName?: string;
  NoteForManager?: string;
  TicketType?: string;
  Department?: Department;
  Question1?: string;
  Answer1?: string;
  Question2?: string;
  Answer2?: string;
  WorkflowStep?: WorkflowStep;
  CandidateIds?: string[];
  RejectedByIds?: string[];
  RoutingQueue?: string[];
  RoutingIndex?: number;
  RoutingOfferedAt?: string;
  AcceptedTime?: string;
  TimerStartTime?: string;
  EnRouteTime?: string;
  AtLocationTime?: string;
  EnRoutePhotos?: string[];
  AtLocationPhotos?: string[];
  SlaAlertSent?: boolean;
  ManagerNotifiedAt?: string;
  OwnerNotifiedAt?: string;
  // Escalation ladder — shared schema with the Arcadia dashboard/bot.
  // 0 = on time, 1 = breached → dept manager notified, 2 = doubled → owner notified.
  Escalated?: boolean;
  EscalationLevel?: number;
  ManagerEscalatedAt?: string;
  AdminEscalatedAt?: string;
  // Chain of prior assignees this ticket passed through (oldest → newest).
  // Appended on every reassign/transfer/inactive-release.
  AssignmentHistory?: AssignmentHistoryEntry[];
  CreatedTime?: any;
  hotel_id?: string;
  guest_id?: string;
  UserPhone?: string;
  timestamp?: any;
}

// ===== CHAT TYPES =====
export interface ChatMessage {
  msgId: string;
  senderId: string;
  message: string;
  timestamp?: any;
  // Display name of the sender, when present (e.g. a guest-chat message
  // relayed with the staff member's name). Optional — staff↔staff messages
  // don't carry it.
  senderName?: string;
  // System marker written by the WhatsApp bot / chatbot widget / staff
  // dashboards. `"chat_ended"` means the manager↔guest conversation has
  // been closed (from either side); the composer should lock until the
  // guest re-engages.
  _system?: string;
}

export interface ChatContact {
  userId: string;
  name: string;
  profileImage?: string;
  jobRole: JobRole;
  unreadCount?: number;
}

export interface UnreadMessageEntry {
  Count: number;
  Name: string;
  UserId: string;
}

// ===== INVENTORY TYPES =====
export interface InventoryItem {
  id: string;
  Name: string;
  Available: boolean;
}

// ===== ESCALATION TYPES =====
// One entry per overdue ticket, written to {hotelId}/Notifications/Escalations.
// `level` is "manager" once the department time frame is exceeded and "admin"
// once it doubles. Shared verbatim with the Arcadia dashboard + WhatsApp bot.
export interface EscalationNotification {
  ticketId: string;
  level: 'manager' | 'admin';
  department: string;
  itemOrdered?: string;
  roomNo?: string;
  guestName?: string;
  timeLimitMinutes?: number;
  ticketStartedAt?: number;
  managerEscalatedAt?: number | null;
  adminEscalatedAt?: number | null;
  updatedAt?: number;
  stage?: string;
}

// ===== NAVIGATION TYPES =====
export type RootStackParamList = {
  Splash: undefined;
  RoleSelect: undefined;
  Login: { userType: JobRole };
  SetupProfile: undefined;
  Main: undefined;
  Profile: undefined;
  TaskDetails: { taskId: string; task: Task };
  TaskUpdate: { taskId: string; task: Task; initialPhotoUri?: string };
  CreateTask: { roomNo?: string };
  ChatRoom: { userId: string; userName: string; userRole: JobRole; chatType?: 'USER' | 'GUEST' };
  ImageViewer: { images: string[]; initialIndex?: number };
  QRScan: undefined;
  Notifications: undefined;
  BlockedRooms: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tasks: undefined;
  AddTask: undefined;
  Chat: undefined;
  History: undefined;
  Inventory: undefined;
  Profile: undefined;
  Alerts: undefined;
};
