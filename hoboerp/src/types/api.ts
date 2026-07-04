export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  detail?: {message?: string; hint?: string};
  meta?: {total?: number; has_more?: boolean; next_cursor?: string};
};
