import type { Metadata } from "next";
import Link from "next/link";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProfileForEdit } from "@/server/profiles";
import { PageHeader } from "@/components/ui/misc";
import { FormAlert } from "@/components/ui/form";
import { ProfileForm } from "./profile-form";
import { EducationEditor, ExperienceEditor } from "./history-editors";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage({ searchParams }: PageProps<"/profile/edit">) {
  const { welcome } = await searchParams;
  const viewer = await requireViewerPage("/profile/edit");
  const data = await getProfileForEdit(viewer);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={welcome ? "Set up your profile" : "Edit profile"}
        description="Your skills, interests and availability power search and recommendations. Everything here is public unless you limit it in privacy settings."
        actions={
          <Link href={`/u/${viewer.username}`} className="link text-sm">
            View profile
          </Link>
        }
      />
      {welcome && (
        <FormAlert kind="info">
          Welcome aboard! Add a few skills and what you&apos;re open to — that&apos;s what lets the right projects find you.
        </FormAlert>
      )}
      <ProfileForm data={data} />
      <ExperienceEditor items={data.experiences} />
      <EducationEditor items={data.educations} />
    </div>
  );
}
