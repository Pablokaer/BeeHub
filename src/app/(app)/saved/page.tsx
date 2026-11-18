import type { Metadata } from "next";
import { Bookmark } from "lucide-react";
import { requireViewerPage } from "@/server/auth/viewer";
import { listSavedPosts } from "@/server/posts";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { PostList } from "@/components/post-card";

export const metadata: Metadata = { title: "Saved posts" };

export default async function SavedPage() {
  const viewer = await requireViewerPage("/saved");
  const posts = await listSavedPosts(viewer);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Saved posts" description="Only you can see what you've saved." />
      {posts.length === 0 ? <EmptyState icon={<Bookmark />} title="Nothing saved yet">Use the Save button on any post to keep it for later.</EmptyState> : <PostList posts={posts} signedIn />}
    </div>
  );
}
