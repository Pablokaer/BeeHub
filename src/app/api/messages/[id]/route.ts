import { NextResponse, type NextRequest } from "next/server";
import { handleApi } from "@/server/http";
import { requireViewer } from "@/server/auth/viewer";
import { messagesSince } from "@/server/messaging";

/** Polling endpoint for an open conversation: GET /api/messages/:id?after=<iso> */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/messages/[id]">) {
  return handleApi(async () => {
    const viewer = await requireViewer();
    const { id } = await ctx.params;
    const afterRaw = req.nextUrl.searchParams.get("after");
    const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : new Date(0);
    const messages = await messagesSince(viewer, id, after);
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  });
}
