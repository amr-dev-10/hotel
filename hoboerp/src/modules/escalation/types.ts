import type {ArcadiaRecord} from '../../types/domain';

export type EscalationScope = 'all' | 'department' | 'mine';

export type EscalatedTicketRecord = {
  assigned_to_name: string | null;
  guest_name: string | null;
  id: string;
  item_description: string;
  priority: number;
  raw: ArcadiaRecord;
  room_number: string | null;
  stage: string;
  ticket_code: string;
};

export type EscalatedTicket = {
  escalation_id: string;
  escalation_level: number;
  escalated_at: string;
  escalated_from: string | null;
  escalated_from_name: string | null;
  escalated_to: string | null;
  escalated_to_name: string | null;
  notes: string | null;
  raw: ArcadiaRecord;
  reason: string;
  rule_id: string | null;
  ticket: EscalatedTicketRecord;
  ticket_id: string;
};

export type EscalationMetrics = {
  critical: number;
  pending: number;
  total: number;
};
