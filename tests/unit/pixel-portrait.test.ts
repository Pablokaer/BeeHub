import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { backgroundMask, pixelPortrait, quantize, reduceKeepingFeatures, smoothIndices } from "@/server/media/pixel-portrait";
import { syntheticPortrait } from "../fixtures/portrait";

type RGB = [number, number, number];

describe("pixel portrait filter", () => {
  it("quantizes to at most k colours, deterministically", () => {
    const pixels: RGB[] = Array.from({ length: 400 }, (_, i) => [(i * 37) % 256, (i * 11) % 256, (i * 5) % 256]);
    const a = quantize(pixels, 8);
    const b = quantize(pixels, 8);
    expect(a.palette.length).toBeLessThanOrEqual(8);
    expect(a.palette).toEqual(b.palette);
    expect(Math.max(...a.index)).toBeLessThan(a.palette.length);
  });

  it("removes isolated pixels but keeps a 2-pixel feature", () => {
    const g = 6;
    const index = new Uint8Array(g * g);
    index[2 * g + 2] = 1; // lone speck
    index[4 * g + 1] = 2;
    index[4 * g + 2] = 2; // two-pixel "eye"
    const out = smoothIndices(index, g);
    expect(out[2 * g + 2]).toBe(0);
    expect(out[4 * g + 1]).toBe(2);
  });

  it("grows the backdrop over a gradient from the top and sides, not into the subject", () => {
    const g = 10;
    const pixels: RGB[] = [];
    for (let y = 0; y < g; y++) for (let x = 0; x < g; x++) pixels.push(x >= 3 && x <= 6 && y >= 3 ? [140, 60, 40] : [120 + y * 4, 130 + y * 4, 140 + y * 4]);
    const mask = backgroundMask(pixels, g);
    expect(mask[0]).toBe(1);
    expect(mask[9 * g + 0]).toBe(1);
    expect(mask[5 * g + 4]).toBe(0);
  });

  it("keeps a dark detail when reducing 2 × 2 blocks", () => {
    const size = 4;
    const data = new Uint8Array(size * size * 3).fill(220);
    data.set([10, 10, 10], 0); // one dark pixel in the first block
    const out = reduceKeepingFeatures(data, size);
    expect(out[0]).toEqual([10, 10, 10]);
    expect(out[1]).toEqual([220, 220, 220]);
  });

  it("turns a photo into a square, pixel-aligned portrait with a small palette", async () => {
    const photo = await syntheticPortrait();
    const out = await pixelPortrait(photo);
    expect([out.width, out.height]).toEqual([288, 288]);
    const { data, info } = await sharp(out.data).raw().toBuffer({ resolveWithObject: true });
    const colours = new Set<string>();
    for (let i = 0; i < data.length; i += info.channels) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    expect(colours.size).toBeLessThanOrEqual(40);
    // Every 6 × 6 cell is a single colour (48 × 48 grid scaled by 6).
    for (const [cx, cy] of [[0, 0], [20, 20], [30, 12]]) {
      const at = (x: number, y: number) => { const i = (y * info.width + x) * info.channels; return `${data[i]},${data[i + 1]},${data[i + 2]}`; };
      expect(at(cx * 6, cy * 6)).toBe(at(cx * 6 + 5, cy * 6 + 5));
    }
    // Same photo, same portrait.
    expect((await pixelPortrait(photo)).data.equals(out.data)).toBe(true);
  });
});
