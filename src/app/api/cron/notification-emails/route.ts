import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { deliverQueuedNotificationEmails } from "@/server/notification-email";

/** Scheduler hook: POST with `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 });
  }
  const result = await deliverQueuedNotificationEmails();
  return NextResponse.json(result);
}
