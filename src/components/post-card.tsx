import Link from "next/link";
import { Briefcase } from "lucide-react";
import { PixelIcon } from "./colmeia/pixel-icon";
import type { HydratedPost, PostCore } from "@/server/posts";
import { collaborationLabels, postTypeLabels, workModeLabels } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { safeUrl } from "@/lib/text";
import { Avatar, EntityLogo } from "./ui/avatar";
import { Badge } from "./ui/misc";
import { RichText } from "./rich-text";
import { PostActions, PostMenu } from "./post-actions";
import { cn } from "./ui/cn";

const typeTone = (t: PostCore["type"]) => (t === "HELP_REQUEST" ? "warn" : t === "LAUNCH" || t === "ACHIEVEMENT" ? "success" : "accent");

/** Author hierarchy: who, then (compact) what kind of post, when, and why it is in your feed. */
function Byline({ post, size = "md", context }: { post: PostCore; size?: "sm" | "md"; context?: string | null }) {
  const authorName = post.author.profile?.displayName ?? post.author.username;
  const entity = post.project
    ? { name: post.project.name, href: `/p/${post.project.slug}`, logo: <EntityLogo name={post.project.name} imageKey={post.project.logoKey} kind="project" size={size} /> }
    : post.organization
      ? { name: post.organization.name, href: `/o/${post.organization.slug}`, logo: <EntityLogo name={post.organization.name} imageKey={post.organization.logoKey} kind="org" size={size} /> }
      : null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Link href={entity?.href ?? `/u/${post.author.username}`} tabIndex={-1} aria-hidden>
        {entity?.logo ?? <Avatar name={authorName} imageKey={post.author.profile?.avatarKey} art={post.author.profile?.avatarArt} size={size} />}
      </Link>
      <div className="min-w-0 leading-tight">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={entity?.href ?? `/u/${post.author.username}`} className="truncate text-[15px] font-bold hover:underline">
            {entity?.name ?? authorName}
          </Link>
          {post.type !== "TEXT" && post.type !== "OPPORTUNITY" && <Badge tone={typeTone(post.type)}>{postTypeLabels[post.type]}</Badge>}
        </span>
        <p className="text-xs text-muted [overflow-wrap:break-word]">
          {entity ? (
            <>
              by{" "}
              <Link href={`/u/${post.author.username}`} className="hover:text-ink hover:underline">
                {authorName}
              </Link>
            </>
          ) : (
            post.author.profile?.headline
          )}
          {" · "}
          <Link href={`/posts/${post.id}`} className="hover:text-ink hover:underline">
            <time dateTime={post.createdAt.toISOString()}>{timeAgo(post.createdAt)}</time>
          </Link>
          {context && <> · {context}</>}
        </p>
      </div>
    </div>
  );
}

function Images({ images }: { images: { key: string; alt: string | null }[] }) {
  if (images.length === 0) return null;
  return (
    // Single images keep their own proportions (panoramas use the full width, uncropped);
    // galleries use square cells.
    <div className={cn("cm-media mt-3 grid gap-[3px]", images.length > 1 && "grid-cols-2")}>
      {images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={img.key} src={mediaUrl(img.key)!} alt={img.alt ?? ""} loading="lazy" className={cn("object-cover", images.length > 1 ? "aspect-square" : "h-auto max-h-[520px]")} />
      ))}
    </div>
  );
}

function Content({ post }: { post: PostCore }) {
  const link = safeUrl(post.linkUrl);
  return (
    <>
      {post.body && <RichText text={post.body} mentions={post.mentions} className="mt-2 text-[14.5px] leading-relaxed text-ink" />}
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2.5 flex min-h-11 items-center gap-2 border border-line-strong bg-sunken px-3 py-2 text-sm hover:bg-accent-soft">
          <PixelIcon name="link" size={18} />
          <span className="truncate">{new URL(link).hostname}</span>
        </a>
      )}
      <Images images={post.images} />
      {post.opportunity && (
        <Link href={`/opportunities/${post.opportunity.id}`} className="cm-frame mt-3 block p-3 [--cm-panel-bg:var(--c-sunken)] hover:[--cm-panel-bg:var(--c-accent-soft)]">
          <p className="flex items-center gap-1.5 text-xs font-bold text-accent">
            <Briefcase className="size-3.5" aria-hidden /> Looking for
          </p>
          <p className="mt-0.5 font-semibold text-ink">{post.opportunity.title}</p>
          <p className="text-xs text-muted">
            {collaborationLabels[post.opportunity.collaborationType]} · {workModeLabels[post.opportunity.workMode]}
            {post.opportunity.isPaid ? " · Paid" : ""}
            {post.opportunity.status !== "OPEN" ? " · No longer open" : ""}
          </p>
          {post.opportunity.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {post.opportunity.tags.map((t) => (
                <span key={t.tag.slug} className="border border-line-strong bg-surface px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
                  {t.tag.name}
                </span>
              ))}
            </div>
          )}
        </Link>
      )}
    </>
  );
}

export function PostCard({ post, signedIn, reason, standalone, className }: { post: HydratedPost; signedIn: boolean; reason?: string | null; standalone?: boolean; className?: string }) {
  const isPlainShare = !!post.repostOf && !post.body && post.images.length === 0;
  const main: PostCore = isPlainShare && post.repostOf ? post.repostOf : post;
  const sharer = post.author.profile?.displayName ?? post.author.username;
  // Interactions on a plain share apply to the original post.
  const target = isPlainShare && post.repostOf ? { ...post.repostOf, liked: post.repostLiked, saved: post.repostSaved } : post;
  return (
    <article className={cn("panel cm-post", className)} aria-label={`Post by ${main.author.profile?.displayName ?? main.author.username}`}>
      {isPlainShare && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
          <PixelIcon name="share" size={14} />
          <Link href={`/u/${post.author.username}`} className="font-semibold text-ink-2 hover:underline">
            {sharer}
          </Link>{" "}
          shared this
        </p>
      )}
      <div className="flex items-start justify-between gap-2">
        <Byline post={main} context={isPlainShare ? null : reason} />
        <PostMenu postId={post.id} canDelete={post.canDelete} signedIn={signedIn} redirectAfterDelete={standalone} />
      </div>
      {isPlainShare && post.repostUnavailable ? (
        <p className="mt-3 border border-dashed border-line-strong p-3 text-sm text-muted">This post is no longer available.</p>
      ) : (
        <Content post={main} />
      )}
      {!isPlainShare && post.repostOf && (
        <div className="mt-3 border border-line-strong bg-sunken p-3">
          <Byline post={post.repostOf} size="sm" />
          <Content post={post.repostOf} />
        </div>
      )}
      {!isPlainShare && post.repostUnavailable && <p className="mt-3 border border-dashed border-line-strong p-3 text-sm text-muted">The shared post is no longer available.</p>}
      <div className="mt-2 border-t border-line pt-1">
        <PostActions
          postId={target.id}
          shareTargetId={main.id}
          liked={target.liked}
          likeCount={target.likeCount}
          commentCount={target.commentCount}
          shareCount={target.shareCount}
          saved={target.saved}
          signedIn={signedIn}
          commentsHref={`/posts/${target.id}#comments`}
        />
      </div>
    </article>
  );
}

export function PostList({ posts, signedIn, tiles }: { posts: HydratedPost[]; signedIn: boolean; tiles?: boolean }) {
  if (tiles) {
    // Profile layout: stepped tiles that reflow from two columns to one.
    return (
      <div className="cm-tiles">
        {posts.map((p, i) => (
          <PostCard key={p.id} post={p} signedIn={signedIn} className={cn("cm-comb-tile", i % 2 === 1 && "cm-tile-alt")} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} signedIn={signedIn} />
      ))}
    </div>
  );
}
