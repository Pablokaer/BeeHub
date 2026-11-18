import type { Metadata } from "next";
import { requireViewerPage } from "@/server/auth/viewer";
import { getPrivacySettings } from "@/server/profiles";
import { updatePrivacyAction } from "@/app/actions/settings";
import { Panel } from "@/components/ui/misc";
import { ActionForm, Checkbox, Field, FormActions, Select, SubmitButton } from "@/components/ui/form";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const viewer = await requireViewerPage("/settings/privacy");
  const p = await getPrivacySettings(viewer);
  return (
    <Panel>
      <ActionForm action={updatePrivacyAction} className="flex flex-col gap-5">
        <Field label="Who can see your profile" name="visibility">
          <Select name="visibility" defaultValue={p.visibility}>
            <option value="PUBLIC">Everyone, including people who aren&apos;t signed in</option>
            <option value="MEMBERS">Signed-in members only</option>
          </Select>
        </Field>
        <Field label="Who can see your connections" name="connectionsVisible">
          <Select name="connectionsVisible" defaultValue={p.connectionsVisible}>
            <option value="EVERYONE">Everyone who can see your profile</option>
            <option value="CONNECTIONS">Only your connections</option>
            <option value="ONLY_ME">Only me</option>
          </Select>
        </Field>
        <Field label="Who can message you" name="messagePermission" hint="People you've exchanged applications with or share a team with can always reach you.">
          <Select name="messagePermission" defaultValue={p.messagePermission}>
            <option value="EVERYONE">Any member</option>
            <option value="CONNECTIONS">Only my connections</option>
          </Select>
        </Field>
        <div className="flex flex-col gap-3">
          <Checkbox name="showLocation" label="Show my location on my profile" description="Hidden locations are also excluded from location filters." defaultChecked={p.showLocation} />
          <Checkbox name="searchable" label="Show me in search and recommendations" defaultChecked={p.searchable} />
          <Checkbox name="followApproval" label="Approve new followers" description="People who aren't connected with you need your approval to follow you." defaultChecked={p.followApproval} />
        </div>
        <FormActions>
          <SubmitButton>Save privacy settings</SubmitButton>
        </FormActions>
      </ActionForm>
    </Panel>
  );
}
