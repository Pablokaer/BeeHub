import Link from "next/link";
import type { PartnerEntity } from "@/server/partnerships";
import { EntityLogo } from "./ui/avatar";

export function PartnerList({ partners, wide }: { partners: { id: string; other: PartnerEntity }[]; wide?: boolean }) {
  if (partners.length === 0) return <p className="text-sm text-muted">No partners yet.</p>;
  return (
    <ul className={wide ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-2"}>
      {partners.map(({ id, other }) => (
        <li key={id}>
          <Link href={other.href} className="flex items-center gap-3 rounded-md border border-line p-3 hover:border-line-strong">
            <EntityLogo name={other.name} imageKey={other.logoKey} kind={other.kind} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{other.name}</span>
              <span className="block truncate text-xs text-muted">{other.kind === "project" ? "Project" : "Organization"}{other.summary ? ` · ${other.summary}` : ""}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
