import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL as Level) || "info";
  return order[lvl] ?? order.info;
}

function serializeError(err: unknown) {
  if (process.env.NODE_ENV === "production") {
    // Driver/SMTP exceptions can embed queries, input values or credentials.
    return { name: err instanceof Error ? err.name : "UnknownError" };
  }
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
  return err;
}

/** Structured JSON-lines logger. One line per event, safe to ship to any log collector. */
function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (order[level] < threshold()) return;
  const entry: Record<string, unknown> = { ts: new Date().toISOString(), level, event };
  for (const [k, v] of Object.entries(fields)) entry[k] = k === "err" ? serializeError(v) : v;
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => log("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => log("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => log("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => log("error", event, fields),
};
