import "server-only";
import sharp from "sharp";

/**
 * Turns a photo into a Colmeia-style pixel portrait, entirely on our server (no external
 * service): square crop on the subject, a 48 × 48 grid, an adaptive palette of a dozen colours
 * nudged toward the brand's warm tones, a flat backdrop like the catalog avatars and selective
 * cocoa contours. Deterministic: the same photo always gives the same portrait.
 */

export type PixelPortraitOptions = { grid?: number; colors?: number; scale?: number };

type RGB = [number, number, number];

const GRID = 48;
const COLORS = 14;
const SCALE = 6; // 48 × 6 = 288 px, an integer scale so pixels stay square.

/** Warm Colmeia tones the palette leans toward (from the catalog art and the UI). */
const BRAND: RGB[] = [
  [52, 35, 21], [107, 78, 52], [164, 103, 36], [220, 138, 36], [255, 196, 76], [255, 232, 144],
  [255, 244, 215], [248, 223, 160], [215, 165, 205], [130, 195, 174], [86, 130, 93], [171, 76, 52],
];
/** Flat backdrops used by the catalog avatars (amber, lavender, turquoise, coral, sage, rose). */
const BACKDROPS: RGB[] = [[243, 192, 106], [201, 167, 224], [127, 196, 184], [240, 160, 140], [169, 201, 138], [232, 170, 190]];
const OUTLINE: RGB = [58, 34, 22];

const dist2 = (a: RGB, b: RGB) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const luma = (c: RGB) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (c: RGB): RGB => [Math.round(Math.min(255, Math.max(0, c[0]))), Math.round(Math.min(255, Math.max(0, c[1]))), Math.round(Math.min(255, Math.max(0, c[2])))];

/** Deterministic k-means (farthest-point seeding) on a small pixel set. */
export function quantize(pixels: RGB[], k: number): { palette: RGB[]; index: Uint8Array } {
  const centers: RGB[] = [];
  // Seed with the mean, then repeatedly the pixel farthest from every chosen center.
  const mean = pixels.reduce<RGB>((m, p) => [m[0] + p[0], m[1] + p[1], m[2] + p[2]], [0, 0, 0]).map((v) => v / pixels.length) as RGB;
  centers.push(mean);
  const nearest = new Float64Array(pixels.length).fill(Infinity);
  while (centers.length < k) {
    let best = -1;
    let bestD = -1;
    const last = centers[centers.length - 1]!;
    for (let i = 0; i < pixels.length; i++) {
      nearest[i] = Math.min(nearest[i]!, dist2(pixels[i]!, last));
      if (nearest[i]! > bestD) {
        bestD = nearest[i]!;
        best = i;
      }
    }
    if (bestD <= 0) break;
    centers.push([...pixels[best]!] as RGB);
  }
  const index = new Uint8Array(pixels.length);
  for (let iter = 0; iter < 12; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i++) {
      let bi = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = dist2(pixels[i]!, centers[c]!);
        if (d < bd) {
          bd = d;
          bi = c;
        }
      }
      index[i] = bi;
      const s = sums[bi]!;
      s[0]! += pixels[i]![0];
      s[1]! += pixels[i]![1];
      s[2]! += pixels[i]![2];
      s[3]! += 1;
    }
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c]!;
      if (s[3]! > 0) centers[c] = [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!];
    }
  }
  return { palette: centers, index };
}

/** 3 × 3 majority filter on palette indices: removes stray pixels so clusters read as drawn. */
export function smoothIndices(index: Uint8Array, grid: number): Uint8Array {
  const out = new Uint8Array(index);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const counts = new Map<number, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) continue;
          const v = index[ny * grid + nx]!;
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }
      const own = index[y * grid + x]!;
      let best = own;
      let bestN = counts.get(own) ?? 0;
      for (const [v, n] of counts) if (n > bestN) [best, bestN] = [v, n];
      // Only replace truly isolated pixels (no same-colour neighbour) inside a clear majority,
      // so two-pixel features such as eyes survive.
      if (best !== own && (counts.get(own) ?? 0) === 1 && bestN >= 6) out[y * grid + x] = best;
    }
  }
  return out;
}

/**
 * Backdrop = region grown from the top and side borders over smoothly varying colour (handles
 * studio gradients), staying close to the border's average colour. The bottom edge is left out:
 * that is where shoulders usually are.
 */
export function backgroundMask(pixels: RGB[], grid: number): Uint8Array {
  const border: number[] = [];
  for (let i = 0; i < grid; i++) border.push(i, i * grid, i * grid + grid - 1);
  const ref = border.reduce<RGB>((m, p) => [m[0] + pixels[p]![0], m[1] + pixels[p]![1], m[2] + pixels[p]![2]], [0, 0, 0]).map((v) => v / border.length) as RGB;
  const LOCAL = 26 ** 2;
  const GLOBAL = 95 ** 2;
  const mask = new Uint8Array(grid * grid);
  const stack = border.filter((p) => dist2(pixels[p]!, ref) < GLOBAL);
  for (const p of stack) mask[p] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % grid;
    const y = (p / grid) | 0;
    for (const n of [x > 0 ? p - 1 : -1, x < grid - 1 ? p + 1 : -1, y > 0 ? p - grid : -1, y < grid - 1 ? p + grid : -1]) {
      if (n < 0 || mask[n]) continue;
      if (dist2(pixels[n]!, pixels[p]!) < LOCAL && dist2(pixels[n]!, ref) < GLOBAL) {
        mask[n] = 1;
        stack.push(n);
      }
    }
  }
  return mask;
}

/** Core transform on a grid of RGB pixels; exported for unit tests. */
export function stylizeGrid(pixels: RGB[], grid: number, colors: number): RGB[] {
  let mask = backgroundMask(pixels, grid);
  const share = mask.reduce((n, v) => n + v, 0) / mask.length;
  // Only flatten when it is clearly a backdrop (not the subject filling the frame).
  if (share < 0.06 || share > 0.7) mask = new Uint8Array(mask.length);

  // Palette from the subject only, with the face area (upper middle) counted three times so
  // eyes, brows and mouth get their own colours instead of merging into skin.
  const sample: RGB[] = [];
  for (let i = 0; i < pixels.length; i++) {
    if (mask[i]) continue;
    const x = (i % grid) / grid;
    const y = Math.floor(i / grid) / grid;
    const face = x > 0.25 && x < 0.75 && y > 0.1 && y < 0.65;
    for (let r = face ? 3 : 1; r > 0; r--) sample.push(pixels[i]!);
  }
  const { palette } = quantize(sample.length ? sample : pixels, colors);
  const raw = new Uint8Array(pixels.length);
  pixels.forEach((p, i) => {
    let bi = 0;
    for (let c = 1; c < palette.length; c++) if (dist2(p, palette[c]!) < dist2(p, palette[bi]!)) bi = c;
    raw[i] = bi;
  });
  const index = smoothIndices(raw, grid);
  // Lean every palette colour toward the nearest brand tone, and enrich it a little.
  const warm = palette.map((c) => {
    const brand = BRAND.reduce((b, t) => (dist2(c, t) < dist2(c, b) ? t : b), BRAND[0]!);
    const l = luma(c);
    const gray: RGB = [l * 255, l * 255, l * 255];
    return clamp(mix(mix(gray, c, 1.22), brand, 0.08));
  });

  const subject: RGB[] = [];
  for (let i = 0; i < pixels.length; i++) if (!mask[i]) subject.push(warm[index[i]!]!);
  const subjectMean: RGB = subject.length ? subject.reduce<RGB>((m, p) => [m[0] + p[0], m[1] + p[1], m[2] + p[2]], [0, 0, 0]).map((v) => v / subject.length) as RGB : [128, 128, 128];
  const backdrop = BACKDROPS.reduce((b, t) => (dist2(subjectMean, t) > dist2(subjectMean, b) ? t : b), BACKDROPS[0]!);

  const out: RGB[] = pixels.map((_, i) => (mask[i] ? backdrop : warm[index[i]!]!));
  const result = out.map((c) => [...c] as RGB);
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const i = y * grid + x;
      if (mask[i]) continue;
      const neighbours = [x > 0 ? i - 1 : -1, x < grid - 1 ? i + 1 : -1, y > 0 ? i - grid : -1, y < grid - 1 ? i + grid : -1];
      // Silhouette: subject pixels touching the backdrop get the cocoa contour.
      if (neighbours.some((n) => n >= 0 && mask[n])) {
        result[i] = OUTLINE;
        continue;
      }
      // Selective inner contours: darken the darker side of strong tonal edges.
      const here = luma(out[i]!);
      for (const n of neighbours) {
        if (n < 0 || mask[n]) continue;
        if (luma(out[n]!) - here > 0.22) {
          result[i] = clamp(mix(out[i]!, OUTLINE, 0.55));
          break;
        }
      }
    }
  }
  return result;
}

/**
 * 2 × 2 → 1 reduction that keeps small, high-contrast features (eyes, brows, mouth): a block
 * becomes its most contrasting pixel when that pixel stands out, otherwise the block average.
 */
export function reduceKeepingFeatures(data: Uint8Array | Buffer, size: number): RGB[] {
  const grid = size / 2;
  const out: RGB[] = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const block: RGB[] = [];
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const i = ((y * 2 + dy) * size + (x * 2 + dx)) * 3;
          block.push([data[i]!, data[i + 1]!, data[i + 2]!]);
        }
      }
      const mean = block.reduce<RGB>((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4, m[2] + p[2] / 4], [0, 0, 0]);
      const darkest = block.reduce((a, b) => (luma(b) < luma(a) ? b : a));
      // Dark details win (they carry the face); light specks are averaged away.
      out.push(luma(mean) - luma(darkest) > 0.12 ? darkest : clamp(mean));
    }
  }
  return out;
}

export async function pixelPortrait(input: Buffer, opts: PixelPortraitOptions = {}): Promise<{ data: Buffer; width: number; height: number }> {
  const grid = opts.grid ?? GRID;
  const colors = opts.colors ?? COLORS;
  const scale = opts.scale ?? SCALE;
  // Normalize orientation first, then crop a bust: portrait photos keep the top of the frame
  // (where the head usually is) and most of the width, so the face gets enough grid cells.
  const upright = await sharp(input, { limitInputPixels: 40_000_000, animated: false }).rotate().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = upright.info;
  const side = Math.round(h > w * 1.05 ? w * 0.78 : Math.min(w, h));
  const left = Math.round((w - side) / 2);
  const top = h > w * 1.05 ? Math.round(Math.min(h - side, h * 0.02)) : Math.round((h - side) / 2);
  const { data } = await sharp(upright.data)
    .extract({ left, top, width: side, height: side })
    .resize(512, 512)
    .removeAlpha()
    // No histogram equalization: it shifts skin tones (notably lightens darker skin). A mild
    // sharpen keeps colours and helps eyes and mouth survive the reduction.
    .median(3)
    .sharpen({ sigma: 1.2 })
    .resize(grid * 2, grid * 2, { kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = reduceKeepingFeatures(data, grid * 2);
  const styled = stylizeGrid(pixels, grid, colors);
  const raw = Buffer.alloc(grid * grid * 3);
  styled.forEach((c, i) => raw.set(c, i * 3));
  const size = grid * scale;
  const out = await sharp(raw, { raw: { width: grid, height: grid, channels: 3 } })
    .resize(size, size, { kernel: "nearest" })
    .webp({ lossless: true })
    .toBuffer();
  return { data: out, width: size, height: size };
}
