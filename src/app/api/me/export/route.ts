import { NextResponse } from "next/server";
import { handleApi } from "@/server/http";
import { requireViewer } from "@/server/auth/viewer";
import { exportAccountData } from "@/server/auth/service";
import { audit } from "@/server/audit";

/** GDPR data portability: downloads everything we hold about the signed-in user as JSON. */
export async function GET() {
  return handleApi(async () => {
    const viewer = await requireViewer();
    const data = await exportAccountData(viewer);
    await audit({ actorId: viewer.id, action: "account.exported", entityType: "User", entityId: viewer.id });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="collab-hub-${viewer.username}-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
