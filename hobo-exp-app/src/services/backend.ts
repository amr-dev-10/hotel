import { Task, User, ChatMessage, InventoryItem, ProfileDetails, Department } from '../types';
import { TenantManager } from './tenant';
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from './apiClient';

function hotelId() {
  const id = TenantManager.getHotelId();
  if (!TenantManager.isValidHotelId(id)) {
    throw new Error('Hotel is not selected');
  }
  return id;
}

function q(params: Record<string, string | number | boolean | undefined | null>) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return entries.length ? `?${entries.join('&')}` : '';
}

function subscribePoll<T>(
  fetcher: () => Promise<T>,
  callback: (value: T) => void,
  intervalMs = 3000,
): () => void {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = async () => {
    try {
      const value = await fetcher();
      if (active) callback(value);
    } catch (e) {
      console.warn('[api subscribe] polling failed:', e);
    } finally {
      if (active) timer = setTimeout(tick, intervalMs);
    }
  };

  void tick();
  return () => {
    active = false;
    if (timer) clearTimeout(timer);
  };
}

// Kept as a small logout hook. Authentication now uses backend JWTs.
export const BackendAuth = {
  getCurrentUser() {
    return null;
  },
  async signOut() {
    return undefined;
  },
};

export const UsersService = {
  async getUser(employeeId: string): Promise<User | null> {
    return apiGet<User | null>(`/hotels/${hotelId()}/users/${encodeURIComponent(employeeId)}`);
  },

  async updateUser(employeeId: string, data: Partial<User>) {
    await apiPatch<User>(`/hotels/${hotelId()}/users/${encodeURIComponent(employeeId)}`, data);
  },

  async getAllEmployees(): Promise<ProfileDetails[]> {
    return apiGet<ProfileDetails[]>(`/hotels/${hotelId()}/users`);
  },

  subscribeToAllEmployees(callback: (employees: ProfileDetails[]) => void): () => void {
    return subscribePoll(() => UsersService.getAllEmployees(), callback);
  },

  async getEmployeesByDepartment(department: Department): Promise<ProfileDetails[]> {
    const employees = await UsersService.getAllEmployees();
    return employees.filter((employee) => {
      const status = employee.Status === true;
      if (!status) return false;
      if (department === 'ALL') return true;
      return norm(employee.Department) === norm(department);
    });
  },

  subscribeToUser(employeeId: string, callback: (user: User | null) => void) {
    return subscribePoll(() => UsersService.getUser(employeeId), callback, 2500);
  },

  async setActiveStatus(employeeId: string, name: string, department: string, active: boolean) {
    await apiPost<User>(`/hotels/${hotelId()}/users/${encodeURIComponent(employeeId)}/active-status`, {
      name,
      department,
      active,
    });
  },

  async deleteUser(employeeId: string) {
    await apiDelete(`/hotels/${hotelId()}/users/${encodeURIComponent(employeeId)}`);
  },

  async uploadProfilePicture(employeeId: string, uri: string): Promise<string> {
    const uploaded = await apiUpload(`/hotels/${hotelId()}/media/upload`, uri);
    return uploaded.url || uploaded.file_url;
  },
};

export const TasksService = {
  async createTask(task: Omit<Task, 'TaskId'>): Promise<string> {
    const created = await apiPost<Task>(`/hotels/${hotelId()}/tasks`, task);
    return created.TaskId;
  },

  async getTask(taskId: string): Promise<Task | null> {
    return apiGet<Task | null>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}`);
  },

  async updateTask(taskId: string, data: Partial<Task>) {
    await apiPatch<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}`, data);
  },

  async assignTaskByManager(taskId: string, attendantId: string, attendantName: string) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/assign`, {
      attendantId,
      attendantName,
    });
  },

  async transferTicket(
    taskId: string,
    newDepartment: string,
    assignTo?: { id: string; name: string } | null,
  ) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/transfer`, {
      newDepartment,
      assignTo,
    });
  },

  async markTaskEnRoute(taskId: string) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/workflow-step`, {
      step: 'EnRoute',
    });
  },

  async markTaskAtLocation(taskId: string) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/workflow-step`, {
      step: 'AtLocation',
    });
  },

  async markTaskSlaExceeded(taskId: string) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/sla-exceeded`);
  },

  async rejectTask(taskId: string, employeeId: string) {
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/reject`, { employeeId });
  },

  async deleteTask(taskId: string, _taskData?: Task) {
    await apiDelete(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}`);
  },

  async getActiveTaskCounts(): Promise<Record<string, number>> {
    return apiGet<Record<string, number>>(`/hotels/${hotelId()}/tasks/counts`);
  },

  subscribeToAllTasks(callback: (tasks: Task[]) => void) {
    return subscribePoll(() => apiGet<Task[]>(`/hotels/${hotelId()}/tasks`), callback);
  },

  subscribeToTasksByStage(stage: string, callback: (tasks: Task[]) => void) {
    return subscribePoll(
      () => apiGet<Task[]>(`/hotels/${hotelId()}/tasks${q({ stage })}`),
      callback,
    );
  },

  subscribeToTasksForAttendant(employeeId: string, callback: (tasks: Task[]) => void) {
    return subscribePoll(
      () => apiGet<Task[]>(`/hotels/${hotelId()}/tasks${q({ assigned_to: employeeId })}`),
      callback,
    );
  },

  subscribeToTask(taskId: string, callback: (task: Task | null) => void) {
    return subscribePoll(
      () => TasksService.getTask(taskId),
      callback,
      2500,
    );
  },

  async uploadTaskImage(taskId: string, uri: string, index: number): Promise<string> {
    const uploaded = await apiUpload(`/hotels/${hotelId()}/media/upload${q({ taskId, index })}`, uri);
    return uploaded.url || uploaded.file_url;
  },

  async markTaskEnRouteWithPhotos(taskId: string, photoUris: string[]): Promise<void> {
    const photoUrls = await Promise.all(photoUris.map((uri, i) => TasksService.uploadTaskImage(taskId, uri, i)));
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/workflow-step`, {
      step: 'EnRoute',
      photoUrls,
    });
  },

  async markTaskAtLocationWithPhotos(taskId: string, photoUris: string[]): Promise<void> {
    const photoUrls = await Promise.all(photoUris.map((uri, i) => TasksService.uploadTaskImage(taskId, uri, i)));
    await apiPost<Task>(`/hotels/${hotelId()}/tasks/${encodeURIComponent(taskId)}/workflow-step`, {
      step: 'AtLocation',
      photoUrls,
    });
  },
};

export const ChatService = {
  async sendMessage(
    senderId: string,
    receiverId: string,
    message: string,
    chatType: 'USER' | 'GUEST' = 'USER',
  ) {
    await apiPost<ChatMessage>(`/hotels/${hotelId()}/chat/messages`, {
      senderId,
      receiverId,
      message,
      chatType,
    });
  },

  subscribeToMessages(
    userId1: string,
    userId2: string,
    callback: (messages: ChatMessage[]) => void,
    chatType: 'USER' | 'GUEST' = 'USER',
  ) {
    return subscribePoll(
      () => apiGet<ChatMessage[]>(`/hotels/${hotelId()}/chat/messages${q({ userId1, userId2, chatType })}`),
      callback,
      2500,
    );
  },

  async updateUnreadCount(currentUserId: string, targetUserId: string, name: string, increment: boolean) {
    await apiPost(`/hotels/${hotelId()}/chat/unread`, {
      currentUserId,
      targetUserId,
      name,
      increment,
    });
  },

  subscribeToGuestThreads(callback: (threads: { userId: string; name: string; lastMessage?: string; timestamp?: string }[]) => void) {
    return subscribePoll(() => apiGet<any[]>(`/hotels/${hotelId()}/chat/guest-threads`), callback, 3000);
  },
};

export const DeletedTasksService = {
  subscribeToDeletedTasks(callback: (tasks: Task[]) => void) {
    return subscribePoll(() => apiGet<Task[]>(`/hotels/${hotelId()}/deleted-tasks`), callback);
  },
};

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
    callback: (notifications: ClaimNotification[]) => void,
  ): () => void {
    return subscribePoll(() => apiGet<ClaimNotification[]>(`/hotels/${hotelId()}/notifications/claims`), callback);
  },

  async markRead(notificationId: string, employeeId: string) {
    await apiPost(`/hotels/${hotelId()}/notifications/claims/${encodeURIComponent(notificationId)}/read`, { employeeId });
  },
};

export const InventoryService = {
  subscribeToInventory(callback: (items: InventoryItem[]) => void) {
    return subscribePoll(() => apiGet<InventoryItem[]>(`/hotels/${hotelId()}/inventory`), callback);
  },

  async addInventoryItem(name: string): Promise<string> {
    const item = await apiPost<InventoryItem>(`/hotels/${hotelId()}/inventory`, { name });
    return item.id;
  },

  async updateAvailability(itemId: string, available: boolean) {
    await apiPatch<InventoryItem>(`/hotels/${hotelId()}/inventory/${encodeURIComponent(itemId)}`, { available });
  },
};

function norm(v: unknown) {
  return (v ?? '').toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
}
