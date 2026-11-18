import { decodeAvatar } from "@/lib/avatar/code";
import { avatarSvg } from "@/lib/avatar/render";

/**
 * Pixel avatar made in the avatar builder, drawn from its code. The code fully determines the
 * image (no user data), so responses are public and cached for a year.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/avatars/[code]">) {
  const { code } = await ctx.params;
  const config = decodeAvatar(code);
  if (!config) return new Response("Not found", { status: 404 });
  return new Response(avatarSvg(config), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
