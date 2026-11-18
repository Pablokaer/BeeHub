export type SP = Record<string, string | string[] | undefined>;

export function str(sp: SP, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim().slice(0, 200) : undefined;
}

export function list(sp: SP, key: string): string[] {
  const v = sp[key];
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.flatMap((x) => x.split(",")).map((x) => x.trim()).filter(Boolean).slice(0, 20);
}

/** Keeps only values that belong to an enum's label map. */
export function enumList<T extends string>(sp: SP, key: string, labels: Record<T, string>): T[] {
  return list(sp, key).filter((x): x is T => x in labels);
}

export function page(sp: SP): number {
  const n = Number(str(sp, "page"));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function bool(sp: SP, key: string): boolean | undefined {
  const v = str(sp, key);
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return undefined;
}
