import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

// Derive all brand placements from the approved artwork, without stretching it.
const source = 'public/brand/bia-bee-v2.png';
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let left = info.width, top = info.height, right = 0, bottom = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] >= 180) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
}
const crop = { left, top, width: right - left + 1, height: bottom - top + 1 };
const bee = await sharp(source).extract(crop).png().toBuffer();
await sharp(bee).resize(256, 256, { fit: 'contain', kernel: 'nearest', background: '#00000000' }).png().toFile('public/brand/bia-logo-v2.png');
for (const [size, path] of [[192, 'src/app/icon.png'], [180, 'src/app/apple-icon.png']]) {
  const sprite = await sharp(bee).resize(Math.round(size * .84), Math.round(size * .84), { fit: 'inside', kernel: 'nearest' }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: '#f8f9f6' } }).composite([{ input: sprite, gravity: 'centre' }]).png().toFile(path);
}
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(size => sharp(bee).resize(size, size, { fit: 'contain', kernel: 'nearest', background: '#00000000' }).png().toBuffer()));
const header = Buffer.alloc(6 + sizes.length * 16); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
pngs.forEach((png, i) => { const pos = 6 + i * 16; header[pos] = sizes[i]; header[pos + 1] = sizes[i]; header.writeUInt16LE(1, pos + 4); header.writeUInt16LE(32, pos + 6); header.writeUInt32LE(png.length, pos + 8); header.writeUInt32LE(offset, pos + 12); offset += png.length; });
await writeFile('src/app/favicon.ico', Buffer.concat([header, ...pngs]));
const card = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#f8f9f6"/><rect x="48" y="48" width="1104" height="534" rx="24" fill="#f6f3e9" stroke="#e2e5dc"/><rect x="96" y="112" width="12" height="12" fill="#a8493c"/><text x="126" y="124" font-family="sans-serif" font-size="17" letter-spacing="3" fill="#2c624b">PEOPLE. PROJECTS. POSSIBILITIES.</text><text x="96" y="264" font-family="sans-serif" font-weight="700" font-size="76" fill="#27332d">BeeHub</text><text x="100" y="340" font-family="sans-serif" font-size="30" fill="#526057">Find your people.</text><text x="100" y="385" font-family="sans-serif" font-size="30" fill="#526057">Build something bigger, together.</text><rect x="100" y="462" width="64" height="6" fill="#2c624b"/><rect x="172" y="462" width="12" height="6" fill="#a8493c"/></svg>`);
const socialBee = await sharp(bee).resize(280, 280, { fit: 'contain', kernel: 'nearest', background: '#00000000' }).png().toBuffer();
await sharp(card).composite([{ input: socialBee, left: 818, top: 175 }]).png().toFile('src/app/opengraph-image.png');
await sharp('src/app/opengraph-image.png').png().toFile('src/app/twitter-image.png');
