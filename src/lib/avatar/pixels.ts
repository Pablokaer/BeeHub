/**
 * Tiny pixel-art canvas used by the avatar builder. Shapes are boolean masks on a square
 * grid; painting a mask draws a 1-pixel cocoa contour around it and soft light/shade edges,
 * which gives the generated portraits the same look as the Colmeia catalog art.
 * Pure and isomorphic: runs in route handlers and in the browser.
 */

export const OUTLINE = "#3a2216";

export type Mask = Uint8Array;

export class Grid {
  readonly px: (string | null)[];
  constructor(readonly size: number) {
    this.px = new Array(size * size).fill(null);
  }
  mask(): Mask {
    return new Uint8Array(this.size * this.size);
  }
  set(x: number, y: number, color: string) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.px[(y | 0) * this.size + (x | 0)] = color;
  }
  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return null;
    return this.px[y * this.size + x];
  }

  /** Fills a mask with an optional contour and edge shading. */
  paint(m: Mask, color: string, opts: { outline?: string | false; shade?: boolean; light?: boolean } = {}) {
    const { outline = OUTLINE, shade = true, light = true } = opts;
    const n = this.size;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < n && y < n && m[y * n + x] === 1;
    if (outline) {
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
          if (!inside(x, y) && (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1))) this.px[y * n + x] = outline;
    }
    const dark = mix(color, OUTLINE, 0.26);
    const bright = mix(color, "#fff6dc", 0.28);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (!inside(x, y)) continue;
        let c = color;
        if (shade && (!inside(x, y + 1) || !inside(x + 1, y))) c = dark;
        else if (light && !inside(x, y - 1) && inside(x, y + 1)) c = bright;
        this.px[y * n + x] = c;
      }
    }
  }

  /** Flat fill, no contour or shading (details such as eyes and mouths). */
  fill(m: Mask, color: string) {
    for (let i = 0; i < m.length; i++) if (m[i]) this.px[i] = color;
  }

  /** SVG with one path per colour (runs merged per row); crisp at any size. `crop` frames a square. */
  toSvg(crop: { x: number; y: number; size: number } = { x: 0, y: 0, size: this.size }): string {
    const n = this.size;
    const byColor = new Map<string, string>();
    for (let y = crop.y; y < crop.y + crop.size; y++) {
      let x = crop.x;
      while (x < crop.x + crop.size) {
        const c = this.px[y * n + x];
        let end = x + 1;
        while (end < crop.x + crop.size && this.px[y * n + end] === c) end++;
        if (c) byColor.set(c, (byColor.get(c) ?? "") + `M${x - crop.x} ${y - crop.y}h${end - x}v1h-${end - x}z`);
        x = end;
      }
    }
    const paths = [...byColor].map(([c, d]) => `<path fill="${c}" d="${d}"/>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${crop.size} ${crop.size}" width="${crop.size * 8}" height="${crop.size * 8}" shape-rendering="crispEdges">${paths}</svg>`;
  }
}

// ───────── Mask helpers ─────────

export function ellipse(n: number, cx: number, cy: number, rx: number, ry: number): Mask {
  const m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) m[y * n + x] = 1;
    }
  return m;
}

export function rect(n: number, x0: number, y0: number, w: number, h: number): Mask {
  const m = new Uint8Array(n * n);
  for (let y = Math.max(0, y0); y < Math.min(n, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(n, x0 + w); x++) m[y * n + x] = 1;
  return m;
}

/** Point-in-polygon fill (pixel centres). */
export function polygon(n: number, pts: [number, number][]): Mask {
  const m = new Uint8Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) m[y * n + x] = 1;
    }
  return m;
}

export function union(...ms: Mask[]): Mask {
  const out = new Uint8Array(ms[0]!.length);
  for (const m of ms) for (let i = 0; i < m.length; i++) if (m[i]) out[i] = 1;
  return out;
}
export function subtract(a: Mask, ...bs: Mask[]): Mask {
  const out = new Uint8Array(a);
  for (const b of bs) for (let i = 0; i < b.length; i++) if (b[i]) out[i] = 0;
  return out;
}
export function intersect(a: Mask, b: Mask): Mask {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}
/** Keeps only rows in [y0, y1). */
export function rows(n: number, m: Mask, y0: number, y1: number): Mask {
  const out = new Uint8Array(m.length);
  for (let y = Math.max(0, y0); y < Math.min(n, y1); y++) for (let x = 0; x < n; x++) out[y * n + x] = m[y * n + x]!;
  return out;
}
export function pixels(n: number, pts: [number, number][]): Mask {
  const m = new Uint8Array(n * n);
  for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < n && y < n) m[y * n + x] = 1;
  return m;
}
export function circles(n: number, list: [number, number, number][]): Mask {
  return union(...list.map(([cx, cy, r]) => ellipse(n, cx, cy, r, r)));
}

// ───────── Colour ─────────

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${to(r1 + (r2 - r1) * t)}${to(g1 + (g2 - g1) * t)}${to(b1 + (b2 - b1) * t)}`;
}
