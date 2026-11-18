import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { canReadMedia } from "@/server/media-access";
import { getPublicProfile } from "@/server/profiles";
import { profileSchema } from "@/lib/validation";
import { AVATAR_ART, COVER_ART } from "@/lib/art-catalog";
import { createUser, resetDb, setSkills, viewerOf } from "../helpers";
import { readMedia, storeImage } from "@/server/uploads";
import { syntheticPortrait } from "../fixtures/portrait";
import { CUSTOM_PREFIX, encodeAvatar } from "@/lib/avatar/code";
import { DEFAULT_AVATAR } from "@/lib/avatar/options";
import { GET } from "@/app/api/avatars/[code]/route";

const key = "2026/security-test-image-key.webp";
describe("media visibility", () => {
  beforeEach(resetDb);
  it("denies unknown and unattached images except to their owner", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    expect(await canReadMedia(null, key)).toBe(false);
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    expect(await canReadMedia(null, key)).toBe(false);
    expect(await canReadMedia(stranger, key)).toBe(false);
    expect(await canReadMedia(owner, key)).toBe(true);
  });
  it("withdraws public access when a project becomes private; retains member access", async () => {
    const owner = await createUser();
    const member = await createUser();
    const stranger = await createUser();
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    const p = await db.project.create({ data: { slug: "media-test", name: "Media", summary: "Test", logoKey: key, createdById: owner.id, members: { create: { userId: member.id, role: "MEMBER" } } } });
    expect(await canReadMedia(null, key)).toBe(true);
    await db.project.update({ where: { id: p.id }, data: { visibility: "PRIVATE" } });
    expect(await canReadMedia(null, key)).toBe(false);
    expect(await canReadMedia(stranger, key)).toBe(false);
    expect(await canReadMedia(member, key)).toBe(true);
  });
  it("withdraws post images after deletion and respects blocks", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    const post = await db.post.create({ data: { authorId: owner.id, body: "Test", images: { create: { key } } } });
    expect(await canReadMedia(null, key)).toBe(true);
    await db.block.create({ data: { blockerId: owner.id, blockedId: stranger.id } });
    expect(await canReadMedia(stranger, key)).toBe(false);
    await db.post.delete({ where: { id: post.id } });
    expect(await canReadMedia(null, key)).toBe(false);
  });
});

describe("profile catalog art", () => {
  beforeEach(resetDb);
  const avatar = AVATAR_ART[0]!.id;
  const cover = COVER_ART[0]!.id;
  const art = async (userId: string) => db.profile.findUniqueOrThrow({ where: { userId }, select: { avatarKey: true, avatarArt: true, coverKey: true, coverArt: true } });

  it("persists a chosen illustration, replaces it in both directions and removes it", async () => {
    const owner = await createUser();
    await setSkills(owner, [], { avatarArt: avatar, coverArt: cover });
    expect(await art(owner.id)).toEqual({ avatarKey: null, avatarArt: avatar, coverKey: null, coverArt: cover });

    // Art → own upload (profile photos are stored as pixel portraits).
    const portrait = "2026/security-test-image-key.px.webp";
    await db.mediaAsset.create({ data: { key: portrait, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    await setSkills(owner, [], { avatarKey: portrait, coverArt: cover });
    expect(await art(owner.id)).toEqual({ avatarKey: portrait, avatarArt: null, coverKey: null, coverArt: cover });

    // Upload → art.
    await setSkills(owner, [], { avatarArt: AVATAR_ART[1]!.id, coverArt: cover });
    expect(await art(owner.id)).toMatchObject({ avatarKey: null, avatarArt: AVATAR_ART[1]!.id });

    // Removal.
    await setSkills(owner, []);
    expect(await art(owner.id)).toEqual({ avatarKey: null, avatarArt: null, coverKey: null, coverArt: null });
  });

  it("shows the chosen illustration to another account", async () => {
    const owner = await createUser();
    const visitor = await createUser();
    await setSkills(owner, [], { avatarArt: avatar, coverArt: cover });
    const p = await getPublicProfile(viewerOf(visitor), owner.username);
    expect(p && !p.restricted && { avatarArt: p.avatarArt, coverArt: p.coverArt }).toEqual({ avatarArt: avatar, coverArt: cover });
  });

  it("rejects unknown ids and ids from the other category, at the boundary and in the service", async () => {
    const owner = await createUser();
    const base = { displayName: "Ana Art" };
    expect(profileSchema.safeParse({ ...base, avatarArt: avatar, coverArt: cover }).success).toBe(true);
    for (const bad of [{ avatarArt: "not-in-catalog" }, { avatarArt: cover }, { coverArt: avatar }, { coverArt: "../../etc/passwd" }]) {
      const parsed = profileSchema.safeParse({ ...base, ...bad });
      expect(parsed.success, JSON.stringify(bad)).toBe(false);
      await expect(setSkills(owner, [], bad)).rejects.toMatchObject({ code: "VALIDATION" });
    }
    expect(await art(owner.id)).toEqual({ avatarKey: null, avatarArt: null, coverKey: null, coverArt: null });
  });

  it("refuses an upload and an illustration for the same slot", async () => {
    const owner = await createUser();
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    expect(profileSchema.safeParse({ displayName: "Ana Art", avatarKey: key, avatarArt: avatar }).success).toBe(false);
    await expect(setSkills(owner, [], { avatarKey: key, avatarArt: avatar })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("keeps upload ownership checks when art is available", async () => {
    const owner = await createUser();
    const thief = await createUser();
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    await expect(setSkills(thief, [], { avatarKey: key, coverArt: cover })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setSkills(thief, [], { coverKey: key, avatarArt: avatar })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await art(thief.id)).toEqual({ avatarKey: null, avatarArt: null, coverKey: null, coverArt: null });
    // Catalog art never grants access to uploaded media, and its paths are not media keys.
    expect(await canReadMedia(viewerOf(thief), key)).toBe(false);
    expect(await canReadMedia(null, COVER_ART[0]!.src)).toBe(false);
  });
});

describe("profile photos", () => {
  beforeEach(resetDb);
  const upload = async (actor: Parameters<typeof storeImage>[0], purpose: Parameters<typeof storeImage>[2]) =>
    storeImage(actor, new File([new Uint8Array(await syntheticPortrait())], "me.jpg", { type: "image/jpeg" }), purpose);

  it("are stored as photos (no pixel filter) and served once attached", async () => {
    const owner = await createUser();
    const stranger = await createUser();
    const stored = await upload(owner, "avatar");
    expect(stored.key).not.toMatch(/\.px\.webp$/);
    expect([stored.width, stored.height]).toEqual([400, 400]);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { key: stored.key } });
    expect(asset.sourceKey).toBeNull();
    expect(await db.mediaAsset.count({ where: { ownerId: owner.id } })).toBe(1);
    expect(await readMedia(stored.key)).not.toBeNull();
    expect(await canReadMedia(viewerOf(stranger), stored.key)).toBe(false);
    await setSkills(owner, [], { avatarKey: stored.key });
    expect(await canReadMedia(null, stored.key)).toBe(true);
    expect(await canReadMedia(viewerOf(stranger), stored.key)).toBe(true);
  });

  it("keeps pixel portraits made before the filter was removed", async () => {
    const owner = await createUser();
    const legacy = "2026/legacy-portrait-key-0000001.px.webp";
    await db.mediaAsset.create({ data: { key: legacy, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    await setSkills(owner, [], { avatarKey: legacy });
    expect((await db.profile.findUniqueOrThrow({ where: { userId: owner.id } })).avatarKey).toBe(legacy);
  });
});

describe("avatars made in the avatar builder", () => {
  beforeEach(resetDb);
  it("are saved on the profile, shown to visitors and served as SVG", async () => {
    const owner = await createUser();
    const code = encodeAvatar({ ...DEFAULT_AVATAR, hair: 4, hat: 2, background: 9 });
    await setSkills(owner, [], { avatarArt: CUSTOM_PREFIX + code });
    const p = await getPublicProfile(null, owner.username);
    expect(p && !p.restricted && p.avatarArt).toBe(CUSTOM_PREFIX + code);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ code }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/image\/svg\+xml/);
    expect(res.headers.get("Cache-Control")).toMatch(/immutable/);
    expect(await res.text()).toMatch(/^<svg/);
    expect((await GET(new Request("http://x"), { params: Promise.resolve({ code: "v1-nope" }) })).status).toBe(404);
  });

  it("cannot be combined with an uploaded photo", async () => {
    const owner = await createUser();
    await db.mediaAsset.create({ data: { key, ownerId: owner.id, mimeType: "image/webp", sizeBytes: 1 } });
    await expect(setSkills(owner, [], { avatarKey: key, avatarArt: CUSTOM_PREFIX + encodeAvatar(DEFAULT_AVATAR) })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
