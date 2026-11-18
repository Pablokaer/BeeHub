import { followAction, unfollowAction } from "@/app/actions/social";
import { ActionButton } from "./ui/action-button";

export function FollowButton({ kind, id, status, name }: { kind: "user" | "org" | "project"; id: string; status: "ACTIVE" | "PENDING" | null; name: string }) {
  return status ? (
    <ActionButton action={unfollowAction} fields={{ kind, id }} ariaLabel={`Unfollow ${name}`}>
      Following
    </ActionButton>
  ) : (
    <ActionButton action={followAction} fields={{ kind, id }} variant="primary" ariaLabel={`Follow ${name}`}>
      Follow
    </ActionButton>
  );
}
