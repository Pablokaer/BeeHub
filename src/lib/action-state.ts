/** Result shape returned by every server action (consumed by useActionState). */
export type ActionState<T = unknown> =
  | { ok: true; message?: string; data?: T; at?: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; at?: number }
  | null;
