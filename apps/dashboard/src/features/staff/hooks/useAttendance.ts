import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  AttendanceDashboard,
  AttendanceLog,
  AttendanceToday,
  BulkDefaultShiftAssignmentResult,
  ShiftAssignment,
  ShiftTemplate,
} from "@/types/domain";
import type {
  BulkDefaultShiftAssignmentValues,
  ShiftAssignmentValues,
  ShiftTemplateValues,
} from "@/features/staff/schemas/attendance.schema";

export type AttendanceLogFilters = {
  employee_id?: string;
  start_date?: string;
  end_date?: string;
};

export type AttendanceActionPayload = {
  method?: string;
  device_info?: string | null;
  gps_location?: string | null;
  notes?: string | null;
};

export function useShiftTemplates(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.templates(hotelId),
    queryFn: () => apiGet<ShiftTemplate[]>(`/hotels/${hotelId}/attendance/templates`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateShiftTemplate(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ShiftTemplateValues) =>
      apiPost<ShiftTemplate>(`/hotels/${hotelId}/attendance/templates`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance.templates(hotelId) }),
  });
}

export function useUpdateShiftTemplate(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, payload }: { templateId: string; payload: Partial<ShiftTemplateValues> }) =>
      apiPatch<ShiftTemplate>(`/hotels/${hotelId}/attendance/templates/${templateId}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.attendance.templates(hotelId) }),
  });
}

export function useShiftAssignments(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.assignments(hotelId),
    queryFn: () => apiGet<ShiftAssignment[]>(`/hotels/${hotelId}/attendance/assignments`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateShiftAssignment(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ShiftAssignmentValues) =>
      apiPost<ShiftAssignment>(`/hotels/${hotelId}/attendance/assignments`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.assignments(hotelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today(hotelId) });
    },
  });
}

export function useBulkAssignDefaultShift(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: BulkDefaultShiftAssignmentValues) =>
      apiPost<BulkDefaultShiftAssignmentResult>(`/hotels/${hotelId}/attendance/assignments/bulk-default`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.templates(hotelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.assignments(hotelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today(hotelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.dashboard(hotelId) });
    },
  });
}

export function useUpdateShiftAssignment(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assignmentId, payload }: { assignmentId: string; payload: Partial<ShiftAssignmentValues> }) =>
      apiPatch<ShiftAssignment>(`/hotels/${hotelId}/attendance/assignments/${assignmentId}`, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.assignments(hotelId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today(hotelId) });
    },
  });
}

export function useAttendanceToday(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.attendance.today(hotelId),
    queryFn: () => apiGet<AttendanceToday>(`/hotels/${hotelId}/attendance/today`),
    enabled: Boolean(hotelId),
  });
}

export function useCheckIn(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AttendanceActionPayload = { method: "web" }) =>
      apiPost<AttendanceLog>(`/hotels/${hotelId}/attendance/check-in`, payload),
    onSuccess: () => invalidateAttendanceState(queryClient, hotelId),
  });
}

export function useCheckOut(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AttendanceActionPayload = { method: "web" }) =>
      apiPost<AttendanceLog>(`/hotels/${hotelId}/attendance/check-out`, payload),
    onSuccess: () => invalidateAttendanceState(queryClient, hotelId),
  });
}

export function useAttendanceLogs(hotelId: string, filters: AttendanceLogFilters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value)));

  return useQuery({
    queryKey: queryKeys.attendance.logs(hotelId, params),
    queryFn: () => apiGet<AttendanceLog[]>(`/hotels/${hotelId}/attendance/logs`, { params }),
    enabled: Boolean(hotelId),
  });
}

export function useAttendanceDashboard(hotelId: string, attendanceDate?: string) {
  return useQuery({
    queryKey: queryKeys.attendance.dashboard(hotelId, attendanceDate),
    queryFn: () =>
      apiGet<AttendanceDashboard>(`/hotels/${hotelId}/attendance/dashboard`, {
        params: attendanceDate ? { attendance_date: attendanceDate } : undefined,
      }),
    enabled: Boolean(hotelId),
  });
}

function invalidateAttendanceState(queryClient: ReturnType<typeof useQueryClient>, hotelId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.attendance.today(hotelId) });
  void queryClient.invalidateQueries({ queryKey: ["attendance", hotelId, "logs"] });
  void queryClient.invalidateQueries({ queryKey: ["attendance", hotelId, "dashboard"] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.staff(hotelId) });
}
