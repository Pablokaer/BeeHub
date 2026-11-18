import type { Metadata } from "next";
import { orNotFound } from "@/server/page-utils";
import { requireViewerPage } from "@/server/auth/viewer";
import { getProjectForManage } from "@/server/projects";
import { mediaUrl } from "@/lib/media";
import { addProjectImageAction, removeProjectImageAction } from "@/app/actions/teams";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState, Panel, SectionTitle } from "@/components/ui/misc";
import { GalleryUploadForm } from "@/components/gallery-upload";

export const metadata: Metadata = { title: "Gallery" };

export default async function ProjectGalleryPage({ params }: PageProps<"/projects/[slug]/manage/gallery">) {
  const { slug } = await params;
  const viewer = await requireViewerPage(`/projects/${slug}/manage/gallery`);
  const { project: p } = await orNotFound(getProjectForManage(viewer, decodeURIComponent(slug)));
  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <SectionTitle>Add an image</SectionTitle>
        <GalleryUploadForm action={addProjectImageAction} projectId={p.id} />
      </Panel>
      <Panel>
        <SectionTitle>Gallery ({p.images.length}/12)</SectionTitle>
        {p.images.length === 0 ? (
          <EmptyState title="No images yet">Screenshots, mockups and photos help people understand your project at a glance.</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.images.map((img) => (
              <li key={img.id} className="flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(img.key)!} alt={img.caption ?? ""} className="aspect-video w-full rounded-md border border-line object-cover" />
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted">{img.caption ?? "No caption"}</span>
                  <ActionButton action={removeProjectImageAction} fields={{ projectId: p.id, imageId: img.id }} variant="ghost" confirm="Remove?">
                    Remove
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
