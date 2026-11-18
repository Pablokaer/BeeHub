import { getViewer } from "@/server/auth/viewer";
import { canReadMedia } from "@/server/media-access";
import { readMedia } from "@/server/uploads";

/** Re-authorize every read so removed/private attachments cannot remain in public caches. */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const { key } = await ctx.params;
  const mediaKey = key.join("/");
  if (!(await canReadMedia(await getViewer(), mediaKey))) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const data = await readMedia(mediaKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
