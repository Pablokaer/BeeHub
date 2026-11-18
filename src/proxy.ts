import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: signed-out visitors hitting member-only pages are redirected
 * to /login before rendering. The real check (session lookup) still happens on the
 * server in every page, action and route handler.
 */
const PROTECTED = [
  /^\/analytics(?:\/|$)/,
  /^\/feed/,
  /^\/network/,
  /^\/messages/,
  /^\/notifications/,
  /^\/my-projects/,
  /^\/applications/,
  /^\/saved/,
  /^\/settings/,
  /^\/profile\/edit/,
  /^\/moderation/,
  /^\/projects\/new/,
  /^\/projects\/[^/]+\/manage/,
  /^\/orgs\/new/,
  /^\/orgs\/[^/]+\/manage/,
  /^\/opportunities\/new/,
  /^\/opportunities\/manage/,
  /^\/opportunities\/[^/]+\/edit/,
];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PROTECTED.some((re) => re.test(pathname)) && !req.cookies.get("ch_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
