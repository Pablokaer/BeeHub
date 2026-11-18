import { describe, expect, it } from "vitest";
import { AVATAR_FIELDS, DEFAULT_AVATAR, type AvatarConfig } from "@/lib/avatar/options";
import { CUSTOM_PREFIX, decodeAvatar, encodeAvatar, isCustomAvatarId, randomAvatar } from "@/lib/avatar/code";
import { avatarSvg, renderAvatar } from "@/lib/avatar/render";
import { findArt, isArtId } from "@/lib/art-catalog";
import { profileSchema } from "@/lib/validation";

describe("avatar builder", () => {
  it("offers dozens of options per feature", () => {
    const count = (key: string) => AVATAR_FIELDS.find((f) => f.key === key)!.options.length;
    expect(count("skin")).toBeGreaterThanOrEqual(12);
    expect(count("hair")).toBeGreaterThanOrEqual(20);
    expect(count("hairColor")).toBeGreaterThanOrEqual(18);
    expect(count("background")).toBeGreaterThanOrEqual(16);
    expect(AVATAR_FIELDS.reduce((n, f) => n + f.options.length, 0)).toBeGreaterThan(200);
    for (const f of AVATAR_FIELDS) expect(new Set(f.options.map((o) => o.id)).size, f.key).toBe(f.options.length);
  });

  it("round-trips configs through short codes and rejects malformed or out-of-range ones", () => {
    let seed = 3;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 50; i++) {
      const c = randomAvatar(rand);
      expect(decodeAvatar(encodeAvatar(c))).toEqual(c);
    }
    const good = encodeAvatar(DEFAULT_AVATAR);
    expect(good).toMatch(/^v1-[0-9a-z]+$/);
    expect(decodeAvatar("v1-zz" + good.slice(5))).toBeNull(); // background index out of range
    expect(decodeAvatar(good + "0")).toBeNull();
    expect(decodeAvatar("<svg>")).toBeNull();
    expect(isCustomAvatarId(CUSTOM_PREFIX + good)).toBe(true);
    expect(isCustomAvatarId(CUSTOM_PREFIX + "v1-../../etc")).toBe(false);
  });

  it("renders every option of every feature, deterministically", () => {
    for (const f of AVATAR_FIELDS)
      for (let i = 0; i < f.options.length; i++) {
        const c: AvatarConfig = { ...DEFAULT_AVATAR, [f.key]: i };
        const g = renderAvatar(c);
        expect(g.px.every((p) => p !== null), `${f.key}=${f.options[i]!.id} leaves no gaps`).toBe(true);
      }
    const svg = avatarSvg({ ...DEFAULT_AVATAR, hair: 5, hat: 1, glasses: 2 });
    expect(svg).toBe(avatarSvg({ ...DEFAULT_AVATAR, hair: 5, hat: 1, glasses: 2 }));
    expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 40 40"/);
    expect(svg).not.toMatch(/script|href|on\w+=/i);
  });

  it("is accepted as a profile avatar (not as a cover) and resolves to the avatar route", () => {
    const id = CUSTOM_PREFIX + encodeAvatar({ ...DEFAULT_AVATAR, hair: 3 });
    expect(isArtId("avatar", id)).toBe(true);
    expect(isArtId("cover", id)).toBe(false);
    expect(findArt("avatar", id)?.src).toBe(`/api/avatars/${id.slice(CUSTOM_PREFIX.length)}`);
    expect(profileSchema.safeParse({ displayName: "Ana Art", avatarArt: id }).success).toBe(true);
    expect(profileSchema.safeParse({ displayName: "Ana Art", avatarArt: CUSTOM_PREFIX + "v1-00" }).success).toBe(false);
  });
});
