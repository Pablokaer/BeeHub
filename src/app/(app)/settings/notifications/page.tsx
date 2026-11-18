import type { Metadata } from "next";
import type { NotificationType } from "@/generated/prisma/enums";
import { requireViewerPage } from "@/server/auth/viewer";
import { getNotificationPreferences } from "@/server/notifications";
import { notificationTypeLabels } from "@/lib/constants";
import { updateNotificationPrefsAction } from "@/app/actions/settings";
import { Panel } from "@/components/ui/misc";
import { ActionForm, FormActions, SubmitButton } from "@/components/ui/form";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const viewer = await requireViewerPage("/settings/notifications");
  const prefs = await getNotificationPreferences(viewer);
  const byType = new Map(prefs.map((p) => [p.type, p]));
  const types = Object.keys(notificationTypeLabels) as NotificationType[];
  return (
    <Panel>
      <p className="mb-4 text-sm text-muted">Choose what reaches you. Email notifications are sent as a periodic summary to {viewer.email}.</p>
      <ActionForm action={updateNotificationPrefsAction}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 font-semibold">
                Activity
              </th>
              <th scope="col" className="w-20 py-2 text-center font-semibold">
                In-app
              </th>
              <th scope="col" className="w-20 py-2 text-center font-semibold">
                Email
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => {
              const p = byType.get(t);
              return (
                <tr key={t} className="border-b border-line last:border-0">
                  <th scope="row" className="py-2.5 text-left font-normal">
                    {notificationTypeLabels[t]}
                  </th>
                  <td className="text-center">
                    <input type="checkbox" name={`inApp:${t}`} defaultChecked={p ? p.inApp : true} aria-label={`${notificationTypeLabels[t]} in-app`} className="size-4 accent-[var(--c-accent)]" />
                  </td>
                  <td className="text-center">
                    <input type="checkbox" name={`email:${t}`} defaultChecked={p ? p.email : false} aria-label={`${notificationTypeLabels[t]} by email`} className="size-4 accent-[var(--c-accent)]" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <FormActions className="mt-4">
          <SubmitButton>Save preferences</SubmitButton>
        </FormActions>
      </ActionForm>
    </Panel>
  );
}
