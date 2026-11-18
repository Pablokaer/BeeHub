import sharp from "sharp";

/**
 * Synthetic "portrait" for tests (no real person): a studio-grey backdrop, shoulders, a face
 * with dark eyes and mouth, and hair. Enough structure to exercise the pixel-portrait filter.
 */
export async function syntheticPortrait(width = 600, height = 720): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 600 720">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d9aa6"/><stop offset="1" stop-color="#5f6c78"/></linearGradient></defs>
    <rect width="600" height="720" fill="url(#bg)"/>
    <path d="M90 720 C110 560 210 520 300 520 C390 520 490 560 510 720 Z" fill="#1f3b73"/>
    <ellipse cx="300" cy="300" rx="130" ry="165" fill="#8a5a3c"/>
    <path d="M165 290 C150 150 230 95 300 95 C380 95 455 150 435 290 C420 210 380 175 300 175 C220 175 180 210 165 290 Z" fill="#2a1a12"/>
    <ellipse cx="250" cy="300" rx="18" ry="11" fill="#140c08"/><ellipse cx="350" cy="300" rx="18" ry="11" fill="#140c08"/>
    <path d="M245 390 Q300 430 355 390" stroke="#4a1c16" stroke-width="14" fill="none"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
