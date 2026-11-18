const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dateFmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const monthFmt = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });

export function timeAgo(date: Date | string, now = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return dateFmt.format(d);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return dateFmt.format(typeof date === "string" ? new Date(date) : date);
}

export function formatMonth(date: Date | string | null | undefined): string {
  if (!date) return "";
  return monthFmt.format(typeof date === "string" ? new Date(date) : date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Converts a Date to the yyyy-mm-dd value used by <input type="date">. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}
