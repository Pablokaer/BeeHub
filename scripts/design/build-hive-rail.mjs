import sharp from "sharp";

/**
 * Cuts the navigation-rail artwork (honeycomb cells, two bees with dotted trails, the skep
 * hive with its flag, flowers and path) out of the approved concept image and removes the
 * panel's cream background, so the same art sits on the day and night rails.
 *
 *   node scripts/design/build-hive-rail.mjs
 */
const SOURCE = "docs/design/references/hive-rail-concept.png";
const OUT = "public/brand/hive-rail.webp";
// Inside the concept's left panel: below the last navigation item, left of the panel border.
const CROP = { left: 2, top: 505, width: 272, height: 581 }; // skips the 2-px panel border
const BG = [254, 239, 208]; // panel cream
const CLEAR = 14; // colour distance treated as pure background
const FEATHER = 52; // distance where the background fades into the art (comb cells sit at ~63)

const { data, info } = await sharp(SOURCE).extract(CROP).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const dist = (i) => Math.hypot(data[i * 3] - BG[0], data[i * 3 + 1] - BG[1], data[i * 3 + 2] - BG[2]);

// Flood-fill the background from the crop edges, so light colours inside the art stay opaque.
const inBg = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
while (stack.length) {
  const p = stack.pop();
  if (inBg[p] || dist(p) >= FEATHER) continue;
  inBg[p] = 1;
  const x = p % w;
  if (x > 0) stack.push(p - 1);
  if (x < w - 1) stack.push(p + 1);
  if (p >= w) stack.push(p - w);
  if (p < w * (h - 1)) stack.push(p + w);
}

const rgba = Buffer.alloc(w * h * 4);
for (let p = 0; p < w * h; p++) {
  rgba[p * 4] = data[p * 3];
  rgba[p * 4 + 1] = data[p * 3 + 1];
  rgba[p * 4 + 2] = data[p * 3 + 2];
  const d = dist(p);
  rgba[p * 4 + 3] = inBg[p] ? Math.round(255 * Math.min(1, Math.max(0, (d - CLEAR) / (FEATHER - CLEAR)))) : 255;
}
await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(OUT);
console.log(`${OUT} ${w}x${h}`);
