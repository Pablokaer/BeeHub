import Link from "next/link";
import { MessageSquare, UserCheck, UserPlus } from "lucide-react";
import type { RelationshipState } from "@/server/social/graph";
import {
  blockAction, cancelConnectionAction, connectAction, followAction, removeConnectionAction, respondConnectionAction, startConversationAction, unfollowAction,
} from "@/app/actions/social";
import { ActionButton } from "./ui/action-button";
import { ButtonLink } from "./ui/button";
import { ReportButton } from "./report-dialog";

/** Connect / follow / message controls for someone else's profile. */
export function RelationshipActions({ userId, name, rel, canMessage, verified }: { userId: string; name: string; rel: RelationshipState; canMessage: boolean; verified: boolean }) {
  if (rel.isSelf) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ButtonLink href="/profile/edit">
          Edit profile <span aria-hidden="true">▸</span>
        </ButtonLink>
        <Link href="/saved" className="link inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Saved items
        </Link>
      </div>
    );
  }
  const connection = rel.connection === "ACCEPTED" ? "connected" : rel.connection === "PENDING" ? (rel.connectionRequestedByViewer ? "sent" : "received") : "none";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {connection === "none" &&
        (verified ? (
          <ActionButton action={connectAction} fields={{ userId }} variant="primary" ariaLabel={`Connect with ${name}`}>
            <UserPlus className="size-4" aria-hidden /> Connect
          </ActionButton>
        ) : (
          <span className="text-xs text-muted">Verify your email to connect</span>
        ))}
      {connection === "sent" && (
        <ActionButton action={cancelConnectionAction} fields={{ userId }} confirm="Withdraw request?">
          Request sent
        </ActionButton>
      )}
      {connection === "received" && (
        <>
          <ActionButton action={respondConnectionAction} fields={{ userId, accept: "true" }} variant="primary">
            Accept request
          </ActionButton>
          <ActionButton action={respondConnectionAction} fields={{ userId, accept: "false" }}>
            Decline
          </ActionButton>
        </>
      )}
      {connection === "connected" && (
        <ActionButton action={removeConnectionAction} fields={{ userId }} confirm="Remove connection?" title="Remove connection">
          <UserCheck className="size-4" aria-hidden /> Connected
        </ActionButton>
      )}
      {rel.follow ? (
        <ActionButton action={unfollowAction} fields={{ kind: "user", id: userId }}>
          {rel.follow === "PENDING" ? "Follow requested" : "Following"}
        </ActionButton>
      ) : (
        <ActionButton action={followAction} fields={{ kind: "user", id: userId }}>
          Follow
        </ActionButton>
      )}
      {canMessage && (
        <ActionButton action={startConversationAction} fields={{ userId }}>
          <MessageSquare className="size-4" aria-hidden /> Message
        </ActionButton>
      )}
      <span className="flex items-center gap-3 pl-1">
        <ActionButton action={blockAction} fields={{ userId }} variant="ghost" confirm={`Block ${name}?`} className="text-muted">
          Block
        </ActionButton>
        <ReportButton targetType="USER" targetId={userId} />
      </span>
    </div>
  );
}
