import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { getPost, listComments, listLikers } from "@/server/posts";
import { PostCard } from "@/components/post-card";
import { Panel, SectionTitle } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/avatar";
import { Comments } from "./comments";

export const metadata: Metadata = { title: "Post" };

export default async function PostPage({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const viewer = await getViewer();
  const post = await getPost(viewer, id);
  if (!post) notFound();
  const [comments, likers] = await Promise.all([listComments(viewer, post.id), listLikers(post.id, 12)]);
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-4">
        <PostCard post={post} signedIn={!!viewer} standalone />
        <Panel>
          <SectionTitle>Comments ({post.commentCount})</SectionTitle>
          <Comments
            postId={post.id}
            viewerId={viewer?.id ?? null}
            canComment={!!viewer?.emailVerified}
            canModerate={post.canDelete}
            comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), replies: c.replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) }))}
          />
          {!viewer && (
            <p className="mt-3 text-sm text-muted">
              <Link href={`/login?next=/posts/${post.id}`} className="link">
                Sign in
              </Link>{" "}
              to join the conversation.
            </p>
          )}
        </Panel>
      </div>
      {likers.length > 0 && (
        <aside>
          <Panel>
            <SectionTitle>Liked by</SectionTitle>
            <ul className="flex flex-col gap-2">
              {likers.map((l) => (
                <li key={l.user.username} className="flex items-center gap-2">
                  <Avatar name={l.user.profile?.displayName ?? l.user.username} imageKey={l.user.profile?.avatarKey} art={l.user.profile?.avatarArt} size="xs" />
                  <Link href={`/u/${l.user.username}`} className="truncate text-sm hover:underline">
                    {l.user.profile?.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      )}
    </div>
  );
}
