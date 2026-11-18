import Link from "next/link";
import type { PartnerEntity } from "@/server/partnerships";
import type { PartnershipStatus } from "@/generated/prisma/enums";
import { timeAgo } from "@/lib/format";
import { cancelPartnershipAction, endPartnershipAction, respondPartnershipAction } from "@/app/actions/teams";
import { ActionButton } from "./ui/action-button";
import { EntityLogo } from "./ui/avatar";
import { EmptyState, Panel, SectionTitle } from "./ui/misc";

type Row = { id: string; status: PartnershipStatus; message: string | null; createdAt: Date; direction: "outgoing" | "incoming"; other: PartnerEntity };

function Item({ row, children }: { row: Row; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <EntityLogo name={row.other.name} imageKey={row.other.logoKey} kind={row.other.kind} size="sm" />
      <div className="min-w-0 flex-1">
        <Link href={row.other.href} className="text-sm font-medium hover:underline">
          {row.other.name}
        </Link>
        <p className="text-xs text-muted">
          {row.other.kind === "project" ? "Project" : "Organization"} · {timeAgo(row.createdAt)}
        </p>
        {row.message && <p className="prose-plain mt-1 text-[13px] text-ink-2">“{row.message}”</p>}
      </div>
      <div className="flex gap-1.5">{children}</div>
    </li>
  );
}

/** Incoming, outgoing and active partnerships for a project or organization. */
export function PartnershipManager({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const incoming = rows.filter((r) => r.status === "PENDING" && r.direction === "incoming");
  const outgoing = rows.filter((r) => r.status === "PENDING" && r.direction === "outgoing");
  const active = rows.filter((r) => r.status === "ACTIVE");
  return (
    <div className="flex flex-col gap-4">
      {incoming.length > 0 && (
        <Panel>
          <SectionTitle>Requests to review</SectionTitle>
          <ul className="divide-y divide-line">
            {incoming.map((r) => (
              <Item key={r.id} row={r}>
                {canManage && (
                  <>
                    <ActionButton action={respondPartnershipAction} fields={{ partnershipId: r.id, accept: "true" }} variant="primary">
                      Accept
                    </ActionButton>
                    <ActionButton action={respondPartnershipAction} fields={{ partnershipId: r.id, accept: "false" }}>
                      Decline
                    </ActionButton>
                  </>
                )}
              </Item>
            ))}
          </ul>
        </Panel>
      )}
      <Panel>
        <SectionTitle>Active partners</SectionTitle>
        {active.length === 0 ? (
          <EmptyState title="No partners yet">Partnerships appear on both pages. Find complementary projects below or in Discover, then propose a partnership from their page.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {active.map((r) => (
              <Item key={r.id} row={r}>
                {canManage && (
                  <ActionButton action={endPartnershipAction} fields={{ partnershipId: r.id }} variant="ghost" confirm="End partnership?">
                    End
                  </ActionButton>
                )}
              </Item>
            ))}
          </ul>
        )}
      </Panel>
      {outgoing.length > 0 && (
        <Panel>
          <SectionTitle>Sent requests</SectionTitle>
          <ul className="divide-y divide-line">
            {outgoing.map((r) => (
              <Item key={r.id} row={r}>
                {canManage && (
                  <ActionButton action={cancelPartnershipAction} fields={{ partnershipId: r.id }} variant="ghost">
                    Cancel
                  </ActionButton>
                )}
              </Item>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
