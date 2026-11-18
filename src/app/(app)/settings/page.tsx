import type { Metadata } from "next";
import { requireViewerPage, getSessionToken } from "@/server/auth/viewer";
import { listSessions } from "@/server/auth/service";
import { sha256 } from "@/server/security/crypto";
import { timeAgo } from "@/lib/format";
import { changeEmailAction, changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from "@/app/actions/settings";
import { resendVerificationAction } from "@/app/actions/auth";
import { ActionButton } from "@/components/ui/action-button";
import { Badge, Panel, SectionTitle } from "@/components/ui/misc";
import { ActionForm, Field, Input, SubmitButton } from "@/components/ui/form";

export const metadata: Metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const viewer = await requireViewerPage("/settings");
  const [sessions, token] = await Promise.all([listSessions(viewer), getSessionToken()]);
  const currentHash = token ? sha256(token) : null;
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <SectionTitle>Email</SectionTitle>
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {viewer.email} {viewer.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warn">Not verified</Badge>}
          {!viewer.emailVerified && (
            <ActionButton action={resendVerificationAction} variant="ghost">
              Resend confirmation
            </ActionButton>
          )}
        </p>
        <ActionForm action={changeEmailAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="New email" name="email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Current password" name="currentPassword">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton variant="secondary">Change email</SubmitButton>
        </ActionForm>
      </Panel>
      <Panel>
        <SectionTitle>Password</SectionTitle>
        <ActionForm action={changePasswordAction} resetOnSuccess className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label="Current password" name="currentPassword">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="New password" name="password">
            <Input name="password" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <Field label="Repeat new password" name="confirm">
            <Input name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          <div className="sm:col-span-3 flex justify-end">
            <SubmitButton variant="secondary">Change password</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
      <Panel>
        <SectionTitle action={sessions.length > 1 && <ActionButton action={revokeOtherSessionsAction} variant="ghost">Sign out other sessions</ActionButton>}>Active sessions</SectionTitle>
        <ul className="divide-y divide-line">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-muted">
                  {s.ip ?? "unknown IP"} · active {timeAgo(s.lastSeenAt)}
                </p>
              </div>
              {s.tokenHash === currentHash ? (
                <Badge tone="accent">This device</Badge>
              ) : (
                <ActionButton action={revokeSessionAction} fields={{ id: s.id }} variant="ghost">
                  Sign out
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <SectionTitle>Sign-in methods</SectionTitle>
        <p className="text-sm text-muted">Email and password. Signing in with external providers (GitHub, Google) is planned; the account model already supports linked accounts.</p>
      </Panel>
    </div>
  );
}
