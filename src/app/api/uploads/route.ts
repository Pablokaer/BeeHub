import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, handleApi } from "@/server/http";
import { requireViewer } from "@/server/auth/viewer";
import { storeImage, type UploadPurpose } from "@/server/uploads";
import { mediaUrl } from "@/lib/media";
import { ValidationError } from "@/server/errors";

const PURPOSES = new Set<UploadPurpose>(["avatar", "cover", "logo", "gallery", "post"]);

/** Image upload (multipart: file, purpose) → { key, url, width, height } */
export async function POST(req: NextRequest) {
  return handleApi(async () => {
    assertSameOrigin(req);
    const viewer = await requireViewer();
    const form = await req.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "") as UploadPurpose;
    if (!PURPOSES.has(purpose)) throw new ValidationError("Unknown upload type.");
    if (!(file instanceof File)) throw new ValidationError("Choose an image to upload.");
    const stored = await storeImage(viewer, file, purpose);
    return NextResponse.json({ ...stored, url: mediaUrl(stored.key) }, { status: 201 });
  });
}
