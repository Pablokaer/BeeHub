import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { db } from "./db";
import { env } from "./env";
import { ForbiddenError, ValidationError } from "./errors";
import { randomToken } from "./security/crypto";
import { rateLimit } from "./security/rate-limit";
import type { Actor } from "./auth/types";

export type UploadPurpose = "avatar" | "cover" | "logo" | "gallery" | "post";

const SIZES: Record<UploadPurpose, { width: number; height?: number; fit: "cover" | "inside" }> = {
  avatar: { width: 400, height: 400, fit: "cover" },
  logo: { width: 400, height: 400, fit: "cover" },
  cover: { width: 1600, height: 400, fit: "cover" },
  gallery: { width: 1600, height: 1200, fit: "inside" },
  post: { width: 1600, height: 1600, fit: "inside" },
};

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);
const KEY_RE = /^\d{4}\/[A-Za-z0-9_-]{20,}(?:\.px)?\.webp$/;

function root() {
  return path.resolve(env().UPLOAD_DIR);
}

/**
 * Validates and re-encodes an uploaded image. The original bytes are never stored:
 * the image is decoded (which rejects non-images regardless of the declared type),
 * resized, stripped of metadata (EXIF/GPS) and saved as WebP under a random key.
 */
export async function storeImage(actor: Actor, file: File, purpose: UploadPurpose) {
  await rateLimit("upload", actor.id);
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) throw new ValidationError("Choose an image to upload.");
  if (file.size > maxBytes) throw new ValidationError(`Images must be smaller than ${env().UPLOAD_MAX_MB} MB.`);
  const input = Buffer.from(await file.arrayBuffer());

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new ValidationError("That file isn't a supported image (JPEG, PNG, WebP or GIF).");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new ValidationError("Use a JPEG, PNG, WebP or GIF image.");

  const size = SIZES[purpose];
  const output = await sharp(input, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize({ width: size.width, height: size.height, fit: size.fit, withoutEnlargement: size.fit === "inside" })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const key = newKey();
  await writeMedia(key, output.data);
  await db.mediaAsset.create({
    data: { ownerId: actor.id, key, mimeType: "image/webp", sizeBytes: output.info.size, width: output.info.width, height: output.info.height },
  });
  return { key, width: output.info.width, height: output.info.height };
}

function newKey() {
  return `${new Date().getUTCFullYear()}/${randomToken(18)}.webp`;
}

async function writeMedia(key: string, data: Buffer) {
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Ensures media keys referenced by a form were uploaded by the same user. */
export async function assertOwnedMedia(actor: Actor, keys: (string | null | undefined)[]) {
  const list = keys.filter((k): k is string => !!k);
  if (list.length === 0) return;
  const rows = await db.mediaAsset.findMany({ where: { key: { in: list } }, select: { key: true, ownerId: true } });
  for (const k of list) {
    const row = rows.find((r) => r.key === k);
    if (!row) throw new ValidationError("An uploaded image could not be found. Please upload it again.");
    if (row.ownerId !== actor.id) throw new ForbiddenError("You can only use images you uploaded.");
  }
}

/** Reads a stored file; returns null for unknown or malformed keys (no path traversal). */
export async function readMedia(key: string): Promise<Buffer | null> {
  if (!KEY_RE.test(key)) return null;
  const full = path.join(root(), key);
  if (!full.startsWith(root() + path.sep)) return null;
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}
