import { connection, NextResponse } from "next/server";
import { db } from "@/server/db";

/** Liveness + database check for load balancers and uptime monitors. */
export async function GET() {
  await connection(); // always evaluated per request, never prerendered
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "error", db: "unreachable" }, { status: 503 });
  }
}
