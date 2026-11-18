import "server-only";
import { db } from "./db";
import { projectPromotions } from "@/config/promotions";

export async function growingProjects() {
  const since = new Date(Date.now() - 30 * 86400 * 1000);
  const joins = await db.projectMember.groupBy({
    by: ["projectId"],
    where: { joinedAt: { gte: since }, project: { status: "ACTIVE", visibility: "PUBLIC" } },
    _count: { projectId: true },
    orderBy: { _count: { projectId: "desc" } },
    take: 3,
  });
  if (!joins.length) return [];
  const projects = await db.project.findMany({
    where: { id: { in: joins.map(j => j.projectId) }, status: "ACTIVE", visibility: "PUBLIC" },
    select: { id: true, name: true, slug: true, logoKey: true, summary: true },
  });
  return joins.flatMap(join => {
    const project = projects.find(p => p.id === join.projectId);
    return project ? [{ ...project, newTeammates: join._count.projectId }] : [];
  });
}

export async function sponsoredProjects() {
  const now = Date.now();
  const campaigns = projectPromotions.filter(p => Date.parse(p.startsAt) <= now && Date.parse(p.endsAt) > now).slice(0, 2);
  if (!campaigns.length) return [];
  const projects = await db.project.findMany({
    where: { slug: { in: campaigns.map(p => p.projectSlug) }, status: "ACTIVE", visibility: "PUBLIC" },
    select: { slug: true, name: true, logoKey: true },
  });
  return campaigns.flatMap(campaign => {
    const project = projects.find(p => p.slug === campaign.projectSlug);
    return project ? [{ ...campaign, project }] : [];
  });
}
