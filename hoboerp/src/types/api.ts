export type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
  detail?:
    | string
    | {
        message?: string;
        hint?: string;
        [key: string]: unknown;
      }
    | Array<Record<string, unknown>>;
  meta?: {
    total?: number;
    has_more?: boolean;
    next_cursor?: string;
    [key: string]: unknown;
  };
};
