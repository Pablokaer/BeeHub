import Link from "next/link";
import { connection } from "next/server";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { growingProjects, sponsoredProjects } from "@/server/project-highlights";
import { EntityLogo } from "./ui/avatar";
import { Module } from "./colmeia/blocks";

/** Real recent team joins, not an invented popularity score. */
export async function GrowingProjects() {
  await connection();
  const projects = await growingProjects();
  if (!projects.length) return null;
  return (
    <Module id="growing-projects-title" title="Growing projects" icon="garden" more={{ href: "/discover?type=projects", label: "Explore projects" }}>
      <p className="pt-2 text-xs text-muted">New teammates in the last 30 days</p>
      <ul>
        {projects.map((project) => (
          <li key={project.id} className="cm-row">
            <Link href={`/p/${project.slug}`} className="flex items-start gap-2.5 hover:[&_strong]:underline">
              <EntityLogo name={project.name} imageKey={project.logoKey} kind="project" size="sm" />
              <span className="min-w-0">
                <strong className="block text-sm">{project.name}</strong>
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink-2">{project.summary}</span>
                <span className="mt-0.5 block text-xs font-semibold text-accent">
                  +{project.newTeammates} {project.newTeammates === 1 ? "teammate" : "teammates"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Module>
  );
}

/** Ads only appear for active campaigns attached to public, active projects. */
export async function SponsoredProjects() {
  await connection();
  const campaigns = await sponsoredProjects();
  return (
    <>
      {campaigns.map((campaign) => {
        const { project } = campaign;
        return (
          <section key={campaign.id} className="panel p-4" aria-labelledby={`promotion-${campaign.id}`}>
            <p className="mb-3 flex items-center gap-2 text-xs text-muted">
              <Megaphone className="size-3.5" aria-hidden /> Sponsored · {campaign.sponsorName}
            </p>
            <div className="flex items-center gap-2">
              <EntityLogo name={project.name} imageKey={project.logoKey} kind="project" size="sm" />
              <span className="text-sm font-semibold">{project.name}</span>
            </div>
            <h2 id={`promotion-${campaign.id}`} className="mt-3 text-base font-bold">
              {campaign.headline}
            </h2>
            <p className="mt-2 text-sm text-ink-2">{campaign.description}</p>
            <Link href={`/p/${project.slug}`} rel="sponsored" className="link mt-2 inline-flex min-h-10 items-center gap-2 text-sm font-semibold">
              Discover project <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </section>
        );
      })}
    </>
  );
}
