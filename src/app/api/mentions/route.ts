import { NextResponse, type NextRequest } from "next/server";
import { blockedUserIds } from "@/server/authz";
import { db } from "@/server/db";
import { handleApi } from "@/server/http";
import { requireViewer } from "@/server/auth/viewer";

/** @mention autocomplete across people, organizations and public projects (signed-in only). */
export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const viewer = await requireViewer();
    const blocked = await blockedUserIds(viewer.id);
    const q = (req.nextUrl.searchParams.get("q") ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40);
    if (q.length < 1) return NextResponse.json({ results: [] });
    const rows = await db.handle.findMany({
      where: { handle: { startsWith: q }, OR: [
        { user: { status: "ACTIVE", id: { notIn: blocked }, profile: { searchable: true } } },
        { organization: { status: "ACTIVE" } },
        { project: { status: "ACTIVE", visibility: "PUBLIC" } },
      ] },
      take: 20,
      select: {
        handle: true,
        user: { select: { status: true, profile: { select: { displayName: true, avatarKey: true, avatarArt: true } } } },
        organization: { select: { status: true, name: true, logoKey: true } },
        project: { select: { status: true, visibility: true, name: true, logoKey: true } },
      },
    });
    const results = rows
      .map((r) => {
        if (r.user?.status === "ACTIVE") return { handle: r.handle, kind: "user", name: r.user.profile?.displayName ?? r.handle, imageKey: r.user.profile?.avatarKey ?? null };
        if (r.organization?.status === "ACTIVE") return { handle: r.handle, kind: "org", name: r.organization.name, imageKey: r.organization.logoKey };
        if (r.project?.status === "ACTIVE" && r.project.visibility === "PUBLIC") return { handle: r.handle, kind: "project", name: r.project.name, imageKey: r.project.logoKey };
        return null;
      })
      .filter(Boolean)
      .slice(0, 8);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "private, no-store" } });
  });
}
