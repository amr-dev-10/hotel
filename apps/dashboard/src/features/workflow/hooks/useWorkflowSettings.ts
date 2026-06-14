import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  EscalationRule,
  RoutingRule,
  TaskTypeSLA,
  WorkflowDefinition,
  WorkflowState,
  WorkflowTransition,
} from "@/types/domain";

export interface EscalationRulePayload {
  department_id?: string | null;
  ticket_type?: string | null;
  task_category?: string | null;
  escalation_level: number;
  trigger_after_minutes: number;
  action: string;
  target_staff_level?: string | null;
  auto_reassign: boolean;
  send_notification: boolean;
  notification_channels: string[];
  is_active: boolean;
}

export interface TaskSlaPayload {
  task_category: string;
  sla_minutes: number;
  accept_timeout_minutes: number;
  description?: string | null;
  is_active: boolean;
}

export interface RoutingRulePayload {
  ticket_type: string;
  target_staff_level?: string | null;
  target_user_id?: string | null;
  skip_normal_assignment: boolean;
  priority_override?: number | null;
  notify_immediately: boolean;
  notification_channels: string[];
  is_active: boolean;
}

export function useWorkflows(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.definitions(hotelId),
    queryFn: () => apiGet<WorkflowDefinition[]>(`/hotels/${hotelId}/workflows`),
    enabled: Boolean(hotelId),
  });
}

export function useWorkflowStates(hotelId: string, workflowId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.states(hotelId, workflowId),
    queryFn: () => apiGet<WorkflowState[]>(`/hotels/${hotelId}/workflows/${workflowId}/states`),
    enabled: Boolean(hotelId && workflowId),
  });
}

export function useWorkflowTransitions(hotelId: string, workflowId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.transitions(hotelId, workflowId),
    queryFn: () =>
      apiGet<WorkflowTransition[]>(`/hotels/${hotelId}/workflows/${workflowId}/transitions`),
    enabled: Boolean(hotelId && workflowId),
  });
}

export function useEscalationRules(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.escalationRules(hotelId),
    queryFn: () => apiGet<EscalationRule[]>(`/hotels/${hotelId}/escalation-rules`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateEscalationRule(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EscalationRulePayload) =>
      apiPost<EscalationRule>(`/hotels/${hotelId}/escalation-rules`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflow.escalationRules(hotelId) }),
  });
}

export function useTaskSlas(hotelId: string, departmentId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.taskSlas(hotelId, departmentId),
    queryFn: () => apiGet<TaskTypeSLA[]>(`/hotels/${hotelId}/departments/${departmentId}/task-slas`),
    enabled: Boolean(hotelId && departmentId),
  });
}

export function useCreateTaskSla(hotelId: string, departmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TaskSlaPayload) =>
      apiPost<TaskTypeSLA>(`/hotels/${hotelId}/departments/${departmentId}/task-slas`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflow.taskSlas(hotelId, departmentId) }),
  });
}

export function useRoutingRules(hotelId: string) {
  return useQuery({
    queryKey: queryKeys.workflow.routingRules(hotelId),
    queryFn: () => apiGet<RoutingRule[]>(`/hotels/${hotelId}/routing-rules`),
    enabled: Boolean(hotelId),
  });
}

export function useCreateRoutingRule(hotelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RoutingRulePayload) =>
      apiPost<RoutingRule>(`/hotels/${hotelId}/routing-rules`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflow.routingRules(hotelId) }),
  });
}
