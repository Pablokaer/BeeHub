import { NextResponse, type NextRequest } from "next/server";
import { suggestTags } from "@/server/tags";
import { handleApi } from "@/server/http";

/** Tag autocomplete: GET /api/tags?q=rea → { tags: [{ slug, name, usageCount }] } */
export async function GET(req: NextRequest) {
  return handleApi(async () => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40);
    const tags = await suggestTags(q, 8);
    return NextResponse.json({ tags });
  });
}
