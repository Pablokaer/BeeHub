import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, ArrowUpRight, Building2, FolderGit2, Handshake, Megaphone, Sparkles, UserRound } from "lucide-react";
import { getViewer } from "@/server/auth/viewer";
import { latestOpportunities } from "@/server/opportunities";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { BeeMascot } from "@/components/bee-mascot";
import { OpportunityRow } from "@/components/opportunity-card";

async function RedirectIfSignedIn() {
  if (await getViewer()) redirect("/feed");
  return null;
}

async function LiveOpportunities() {
  await connection(); // live data, rendered per request
  const items = await latestOpportunities(3);
  if (items.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        No open opportunities yet. Be the first to publish what your project is looking for.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((o) => (
        <li key={o.id}>
          <OpportunityRow opportunity={o} />
        </li>
      ))}
    </ul>
  );
}

const steps = [
  { icon: UserRound, title: "Show what you bring", body: "Skills, interests, availability and the kind of collaboration you want — paid, volunteer, co-founder, mentorship." },
  { icon: Megaphone, title: "Say what you're looking for", body: "Projects and organizations publish concrete needs: a frontend developer, a marketing partner, testers, investors." },
  { icon: Sparkles, title: "Get matched, with reasons", body: "Recommendations explain themselves: shared skills, compatible availability, the right type of collaboration." },
  { icon: Handshake, title: "Form teams and partnerships", body: "Apply, start a conversation, join the team, or link two projects as formal partners visible on both pages." },
];

const entities = [
  { icon: UserRound, title: "People", body: "A profile that is part CV, part portfolio: what you know, what you've built, what you want to do next." },
  { icon: FolderGit2, title: "Projects", body: "From idea to launch, with a team, a stage, technologies, a gallery and what it needs right now." },
  { icon: Building2, title: "Organizations", body: "Startups, companies, associations and communities, with members, projects and partners." },
  { icon: Megaphone, title: "Opportunities", body: "Jobs are just one case: partnerships, freelance, volunteering, internships, academic work, service exchange." },
];

export default function LandingPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <section className="landing-hero border-b border-line">
        <div className="site-container landing-composition">
          <div className="flex flex-col justify-center">
            <h1 className="landing-title font-semibold text-ink">
              Great things start with <span className="text-accent">the right people.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-2">
              A home for people who make things happen. Meet your next collaborator, find a project you believe in, and turn “what if” into what’s next.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href="/signup">
                Find your people <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/opportunities" variant="secondary">
                Browse opportunities
              </ButtonLink>
            </div>
          </div>
          <section className="opportunity-board" aria-labelledby="open-doors">
            <div className="board-heading"><h2 id="open-doors">Open doors, right now</h2><BeeMascot className="board-bee" /></div>
            <Suspense fallback={<div className="py-6"><Skeleton className="h-48 w-full" /></div>}><LiveOpportunities /></Suspense>
            <Link href="/opportunities" className="board-link">All opportunities <ArrowUpRight className="size-4" aria-hidden /></Link>
          </section>
        </div>
      </section>

      <section className="site-container py-16">
        <h2 className="text-2xl font-semibold">How collaboration happens here</h2>
        <ol className="collaboration-steps mt-8">
          {steps.map((s) => (
            <li key={s.title} className="collaboration-step">
              <div className="flex items-center gap-2">
                <s.icon className="size-4 text-accent" aria-hidden />
              </div>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="site-container py-16">
          <h2 className="text-2xl font-semibold">Four building blocks, all connected</h2>
          <p className="mt-2 max-w-2xl text-ink-2">
            A person can run several projects and organizations from one account. Projects partner with other projects. Tags link skills,
            needs and interests across everything, so the right things find each other.
          </p>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {entities.map((e) => (
              <div key={e.title} className="border-t border-line pt-5">
                <e.icon className="size-5 text-accent" aria-hidden />
                <h3 className="mt-2 font-semibold">{e.title}</h3>
                <p className="mt-1 text-sm text-muted">{e.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="site-container closing-invitation text-left">
        <h2 className="text-2xl font-semibold">Students, freelancers, builders, startups and companies</h2>
        <p className="mt-4 max-w-xl text-ink-2">Whether you have an idea, a skill or a need, there is someone here who has the other half.</p>
        <div className="mt-6 flex flex-wrap justify-start gap-3">
          <ButtonLink href="/signup">Get started — it&apos;s free</ButtonLink>
          <ButtonLink href="/discover" variant="secondary">
            Explore projects
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
