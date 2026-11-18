import { circles, ellipse, Grid, intersect, mix, OUTLINE, pixels, polygon, rect, rows, subtract, union, type Mask } from "./pixels";
import { CLOTHING_COLORS, EYE_COLORS, HAIR_COLORS, SKIN_TONES, AVATAR_FIELDS, type AvatarConfig } from "./options";

/**
 * Draws a 48 × 48 pixel portrait from an avatar config: flat or patterned backdrop, bust with
 * clothing, face, features, hair, jewelry, glasses, accessories and hat, in that order.
 */
const N = 48;
const CX = 24;

type Head = { cx: number; cy: number; rx: number; ry: number; top: number; mask: Mask };

const id = (field: (typeof AVATAR_FIELDS)[number]["key"], c: AvatarConfig) => AVATAR_FIELDS.find((f) => f.key === field)!.options[c[field]]!.id;

/** Small pixel stamps: '.' empty, other letters map to colours. */
function stamp(g: Grid, x0: number, y0: number, rowsArt: string[], colors: Record<string, string>, mirror = false) {
  rowsArt.forEach((row, dy) => {
    const chars = mirror ? [...row].reverse() : [...row];
    chars.forEach((ch, dx) => {
      const col = colors[ch];
      if (col) g.set(x0 + dx, y0 + dy, col);
    });
  });
}

// ───────── Background ─────────

function background(g: Grid, bg: string) {
  const flat: Record<string, string> = {
    amber: "#f3c06a", lavender: "#c9a7e0", turquoise: "#7fc4b8", coral: "#f0a08c", sage: "#a9c98a", rose: "#e8aabe", sky: "#9cc8ec", cream: "#f6e7c4",
    peach: "#f6c3a2", mint: "#b9e3cf", lilac: "#d9c6ef", butter: "#f8e19a", slate: "#9aa7b8", terracotta: "#d98a66",
  };
  if (flat[bg]) return g.fill(rect(N, 0, 0, N, N), flat[bg]);
  const all = rect(N, 0, 0, N, N);
  switch (bg) {
    case "honeycomb":
    case "mint-honeycomb": {
      const [base, line, glint] = bg === "honeycomb" ? ["#f5c662", "#df9c35", "#ffe39a"] : ["#a8dcc8", "#6fb39d", "#d6f2e6"];
      g.fill(all, base);
      for (let row = -1; row < 9; row++)
        for (let col = -1; col < 7; col++) {
          const cx = col * 9 + (row % 2 ? 4.5 : 0);
          const cy = row * 6;
          const cell = ellipse(N, cx, cy, 4.6, 3.6);
          const inner = ellipse(N, cx, cy, 3.6, 2.6);
          g.fill(subtract(cell, inner), line);
          g.fill(intersect(inner, rows(N, inner, Math.floor(cy - 3), Math.floor(cy - 1))), glint);
        }
      return;
    }
    case "sunset": {
      const bands = ["#5e4a8c", "#9a5a9c", "#d0708a", "#ee9a6a", "#f7c36a", "#fbe29a"];
      for (let y = 0; y < N; y++) {
        const t = (y / N) * bands.length;
        const i = Math.min(bands.length - 1, Math.floor(t));
        const next = bands[Math.min(bands.length - 1, i + 1)]!;
        for (let x = 0; x < N; x++) g.set(x, y, t - i > 0.7 && (x + y) % 2 === 0 ? next : bands[i]!);
      }
      g.paint(ellipse(N, 38, 30, 6, 6), "#ffe08a", { outline: false });
      return;
    }
    case "starry-night": {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.set(x, y, y < 20 ? "#1f2547" : y < 34 ? "#29305a" : "#33396a");
      for (const [x, y] of [[4, 5], [11, 13], [40, 4], [44, 15], [7, 28], [36, 22], [19, 3], [29, 8], [2, 40], [45, 36]] as const) {
        g.set(x, y, "#fff3c4");
        if ((x + y) % 3 === 0) {
          g.set(x - 1, y, "#c9b77a");
          g.set(x + 1, y, "#c9b77a");
        }
      }
      g.paint(subtract(ellipse(N, 40, 9, 4, 4), ellipse(N, 42, 7.5, 3.6, 3.6)), "#ffe9a8", { outline: false });
      return;
    }
    case "meadow": {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.set(x, y, y < 30 ? (y < 14 ? "#a9d4f2" : "#c4e3f5") : "#7db35e");
      g.paint(union(ellipse(N, 8, 9, 5, 2.2), ellipse(N, 12, 8, 3.5, 2.5)), "#ffffff", { outline: false, shade: false });
      for (let x = 0; x < N; x++) {
        const h = 30 - Math.round(1.5 * Math.sin(x / 4));
        for (let y = h; y < 34; y++) g.set(x, y, "#93c46b");
      }
      for (const [x, y, col] of [[4, 38, "#f6a5b5"], [10, 44, "#fff0a8"], [41, 40, "#c9a7e0"], [45, 45, "#f6a5b5"], [3, 46, "#fff0a8"]] as const) {
        g.set(x, y, col);
        g.set(x - 1, y + 1, col);
        g.set(x + 1, y + 1, col);
        g.set(x, y + 2, col);
        g.set(x, y + 1, "#e8a33a");
      }
      return;
    }
    case "azulejo-tiles": {
      g.fill(all, "#f4f1e8");
      for (let ty = 0; ty < 4; ty++)
        for (let tx = 0; tx < 4; tx++) {
          const ox = tx * 12;
          const oy = ty * 12;
          const blue = "#3c66a8";
          g.fill(subtract(rect(N, ox, oy, 12, 12), rect(N, ox + 1, oy + 1, 10, 10)), "#9fb4d6");
          g.fill(polygon(N, [[ox + 6, oy + 2], [ox + 10, oy + 6], [ox + 6, oy + 10], [ox + 2, oy + 6]]), blue);
          g.fill(ellipse(N, ox + 6, oy + 6, 1.6, 1.6), "#f4f1e8");
          for (const [dx, dy] of [[1, 1], [10, 1], [1, 10], [10, 10]]) g.set(ox + dx, oy + dy, blue);
        }
      return;
    }
    case "honey-stripes": {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) g.set(x, y, Math.floor((x + y) / 6) % 2 ? "#f8d27e" : "#f2b23a");
      return;
    }
    case "polka-dots": {
      g.fill(all, "#f6b8c4");
      for (let y = 2; y < N; y += 8) for (let x = (y / 8) % 2 ? 6 : 2; x < N; x += 8) g.fill(ellipse(N, x + 0.5, y + 0.5, 1.6, 1.6), "#fff1f2");
      return;
    }
    default:
      g.fill(all, "#f3c06a");
  }
}

// ───────── Face shapes ─────────

function head(shape: string): Head {
  const cy = 20;
  const base = (rx: number, ry: number, mask: Mask): Head => ({ cx: CX, cy, rx, ry, top: Math.round(cy - ry), mask });
  switch (shape) {
    case "oval":
      return base(8.5, 11, ellipse(N, CX, cy, 8.5, 11));
    case "square":
      return base(9, 10.5, polygon(N, [[16, 11], [32, 11], [33.5, 14], [33.5, 25], [30, 30.5], [18, 30.5], [14.5, 25], [14.5, 14]]));
    case "long":
      return base(8, 11.5, union(ellipse(N, CX, cy - 1, 8, 10.5), ellipse(N, CX, cy + 4, 6.5, 7.5)));
    case "heart":
      return base(9.5, 10.5, union(ellipse(N, CX, cy - 1.5, 9.5, 8.5), polygon(N, [[15.5, 21], [32.5, 21], [27, 29.5], [24, 31], [21, 29.5]])));
    case "wide":
      return base(10, 9.5, ellipse(N, CX, cy + 0.5, 10, 9.5));
    default:
      return base(9, 10, ellipse(N, CX, cy, 9, 10));
  }
}

// ───────── Body and clothing ─────────

function torso(): Mask {
  return polygon(N, [[5, 48], [7, 42], [11, 38.5], [18, 35.5], [30, 35.5], [37, 38.5], [41, 42], [43, 48]]);
}

function clothing(g: Grid, style: string, color: string, skin: string) {
  const body = torso();
  const light = "#f5f1e8";
  const neckHole = ellipse(N, CX, 35, 3.6, 2.6);
  switch (style) {
    case "v-neck":
      g.paint(subtract(body, polygon(N, [[19.5, 35], [28.5, 35], [24, 41]])), color);
      return;
    case "hoodie": {
      g.paint(body, color);
      g.paint(subtract(union(ellipse(N, CX, 36, 9, 3.6), rect(N, 15, 34, 18, 3)), neckHole), mix(color, OUTLINE, 0.12));
      g.fill(neckHole, skin);
      g.fill(union(rect(N, 21, 38, 1, 5), rect(N, 26, 38, 1, 5)), light);
      g.fill(pixels(N, [[21, 43], [26, 43]]), "#c9a227");
      return;
    }
    case "sweater":
      g.paint(subtract(body, neckHole), color);
      g.paint(subtract(ellipse(N, CX, 35, 5, 3.4), neckHole), mix(color, OUTLINE, 0.2), { outline: false });
      for (let x = 10; x < 39; x += 3) g.set(x, 46, mix(color, OUTLINE, 0.18));
      return;
    case "turtleneck":
      g.paint(body, color);
      g.paint(rect(N, 19, 30, 10, 7), mix(color, OUTLINE, 0.08));
      for (let x = 20; x < 28; x += 2) for (let y = 31; y < 36; y++) g.set(x, y, mix(color, OUTLINE, 0.2));
      return;
    case "collared-shirt":
      g.paint(subtract(body, polygon(N, [[21, 35], [27, 35], [24, 39]])), color);
      g.paint(polygon(N, [[18.5, 34.5], [23.5, 35.5], [21.5, 39.5]]), light);
      g.paint(polygon(N, [[29.5, 34.5], [24.5, 35.5], [26.5, 39.5]]), light);
      for (const y of [41, 44, 47]) g.set(24, y, mix(color, OUTLINE, 0.35));
      return;
    case "blazer":
      g.paint(body, color);
      g.paint(polygon(N, [[20, 35], [28, 35], [24, 47]]), light, { outline: false });
      g.paint(polygon(N, [[18, 35.5], [22, 36], [24, 46], [20, 41]]), mix(color, OUTLINE, 0.18));
      g.paint(polygon(N, [[30, 35.5], [26, 36], [24, 46], [28, 41]]), mix(color, OUTLINE, 0.18));
      g.set(24, 37, "#3e3a3a");
      g.set(24, 38, "#3e3a3a");
      return;
    case "overalls": {
      g.paint(subtract(body, neckHole), light);
      g.paint(polygon(N, [[16, 48], [17, 40], [31, 40], [32, 48]]), color);
      g.paint(union(rect(N, 17, 36, 2, 5), rect(N, 29, 36, 2, 5)), color, { outline: false });
      g.fill(pixels(N, [[18, 40], [30, 40]]), "#e5b84a");
      g.fill(rect(N, 21, 43, 6, 3), mix(color, OUTLINE, 0.15));
      return;
    }
    case "beekeeper-suit": {
      g.paint(subtract(body, neckHole), "#f3ecda");
      g.paint(subtract(ellipse(N, CX, 35.5, 7, 3.4), neckHole), color);
      g.fill(rect(N, 24, 38, 1, 10), "#b9ad93");
      g.fill(pixels(N, [[30, 42], [31, 42], [30, 43]]), "#f2b23a");
      g.set(31, 43, OUTLINE);
      return;
    }
    case "tank-top":
      g.paint(body, skin);
      g.paint(polygon(N, [[12, 48], [14, 40], [17, 36], [20, 37], [24, 40], [28, 37], [31, 36], [34, 40], [36, 48]]), color);
      return;
    case "zip-jacket":
      g.paint(subtract(body, neckHole), color);
      g.paint(subtract(ellipse(N, CX, 35, 5.4, 3.2), neckHole), mix(color, OUTLINE, 0.15), { outline: false });
      g.fill(rect(N, 24, 37, 1, 11), "#d9d4c8");
      g.fill(rect(N, 12, 44, 5, 1), mix(color, OUTLINE, 0.3));
      g.fill(rect(N, 31, 44, 5, 1), mix(color, OUTLINE, 0.3));
      return;
    case "apron":
      g.paint(subtract(body, neckHole), color);
      g.paint(polygon(N, [[18, 48], [18.5, 39], [29.5, 39], [30, 48]]), "#f2b23a");
      g.fill(union(rect(N, 19, 35, 1, 4), rect(N, 28, 35, 1, 4)), "#f2b23a");
      g.fill(polygon(N, [[24, 42], [26, 43.5], [24, 45], [22, 43.5]]), "#c97c1c");
      return;
    default:
      g.paint(subtract(body, neckHole), color);
  }
}

// ───────── Hair ─────────

function capMask(h: Head, extra = 1.3, until = h.cy - 4): Mask {
  return rows(N, ellipse(N, h.cx, h.cy - 0.5, h.rx + extra, h.ry + extra + 0.3), 0, until);
}
function sideburns(h: Head, until = h.cy - 1): Mask {
  const x0 = Math.round(h.cx - h.rx - 1);
  const x1 = Math.round(h.cx + h.rx - 1);
  return union(rect(N, x0, h.cy - 6, 2, until - (h.cy - 6)), rect(N, x1, h.cy - 6, 2, until - (h.cy - 6)));
}
function curlyRing(h: Head, from: number, to: number, r = 2.7, grow = 0.6): Mask {
  const list: [number, number, number][] = [];
  for (let a = from; a <= to; a += 18) {
    const t = (a * Math.PI) / 180;
    list.push([h.cx + (h.rx + grow) * Math.cos(t), h.cy - 1 + (h.ry + grow) * Math.sin(t), r]);
  }
  return circles(N, list);
}

function hairBack(g: Grid, style: string, h: Head, color: string) {
  const dark = mix(color, OUTLINE, 0.18);
  switch (style) {
    case "afro":
      g.paint(union(ellipse(N, h.cx, h.cy - 3, h.rx + 6.5, h.ry + 4.5), curlyRing({ ...h, rx: h.rx + 5, ry: h.ry + 3 }, 150, 390, 3.2)), color);
      return;
    case "long-straight":
      g.paint(union(ellipse(N, h.cx, h.cy - 2, h.rx + 2.5, h.ry + 2), rect(N, Math.round(h.cx - h.rx - 2.5), h.cy - 2, Math.round(2 * h.rx + 5), 20)), color);
      return;
    case "long-wavy": {
      const pts: [number, number][] = [];
      for (let y = h.cy - 2; y <= h.cy + 18; y++) pts.push([h.cx - h.rx - 2.5 - Math.sin(y / 2.2) * 1.2, y]);
      for (let y = h.cy + 18; y >= h.cy - 2; y--) pts.push([h.cx + h.rx + 2.5 + Math.sin(y / 2.2) * 1.2, y]);
      g.paint(union(ellipse(N, h.cx, h.cy - 2, h.rx + 2.8, h.ry + 2), polygon(N, pts)), color);
      return;
    }
    case "long-curly": {
      const list: [number, number, number][] = [];
      for (let y = h.cy - 4; y <= h.cy + 16; y += 3.4) list.push([h.cx - h.rx - 1.5, y, 3.3], [h.cx + h.rx + 1.5, y, 3.3]);
      g.paint(union(ellipse(N, h.cx, h.cy - 2, h.rx + 4, h.ry + 3), circles(N, list)), color);
      return;
    }
    case "bob":
      g.paint(rows(N, ellipse(N, h.cx, h.cy + 1, h.rx + 3, h.ry + 2.5), 0, h.cy + 10), color);
      return;
    case "ponytail":
      g.paint(union(ellipse(N, h.cx + h.rx + 1.5, h.cy + 5, 3, 8.5), ellipse(N, h.cx, h.cy - 1, h.rx + 1.5, h.ry + 1.5)), color);
      g.fill(rect(N, Math.round(h.cx + h.rx), h.cy - 3, 3, 2), "#e05a6a");
      return;
    case "locs": {
      g.paint(union(ellipse(N, h.cx, h.cy - 2, h.rx + 3, h.ry + 2), rect(N, Math.round(h.cx - h.rx - 3), h.cy - 2, Math.round(2 * h.rx + 6), 19)), color);
      for (let x = Math.round(h.cx - h.rx - 2); x < h.cx + h.rx + 3; x += 2) for (let y = h.cy; y < h.cy + 17; y++) g.set(x, y, dark);
      return;
    }
  }
}

function hairFront(g: Grid, style: string, h: Head, color: string, skin: string) {
  const dark = mix(color, OUTLINE, 0.22);
  const cap = capMask(h);
  switch (style) {
    case "short":
      g.paint(union(cap, sideburns(h)), color);
      return;
    case "buzz-cut":
      g.paint(rows(N, h.mask, 0, h.cy - 5), mix(skin, color, 0.72), { outline: false });
      for (let y = h.top; y < h.cy - 5; y++) for (let x = 0; x < N; x++) if ((x + y) % 2 === 0 && h.mask[y * N + x]) g.set(x, y, mix(skin, color, 0.9));
      return;
    case "side-part":
      g.paint(union(cap, sideburns(h), polygon(N, [[h.cx - h.rx, h.cy - 6], [h.cx + 2, h.cy - 10], [h.cx + h.rx + 1, h.cy - 6], [h.cx + h.rx, h.cy - 3], [h.cx + 3, h.cy - 6], [h.cx - h.rx + 1, h.cy - 3]])), color);
      g.fill(rect(N, h.cx - 4, h.top - 1, 1, 3), dark);
      return;
    case "bangs": {
      const fringe = rect(N, Math.round(h.cx - h.rx), h.cy - 8, Math.round(2 * h.rx), 4);
      const jag = pixels(N, Array.from({ length: 10 }, (_, i) => [Math.round(h.cx - h.rx) + i * 2, h.cy - 5] as [number, number]));
      g.paint(subtract(union(cap, fringe, sideburns(h, h.cy + 2)), jag), color);
      return;
    }
    case "curly-short":
    case "afro":
      g.paint(union(cap, curlyRing(h, 190, 350)), color);
      return;
    case "long-straight":
    case "locs":
      g.paint(union(cap, rect(N, Math.round(h.cx - h.rx - 1.5), h.cy - 6, 3, 14), rect(N, Math.round(h.cx + h.rx - 1.5), h.cy - 6, 3, 14)), color);
      g.fill(rect(N, h.cx, h.top - 1, 1, 4), dark);
      return;
    case "long-wavy":
      g.paint(union(cap, polygon(N, [[h.cx - h.rx - 1, h.cy - 7], [h.cx + 4, h.cy - 9], [h.cx - 2, h.cy - 4], [h.cx - h.rx + 2, h.cy + 2], [h.cx - h.rx - 1.5, h.cy + 6]]), rect(N, Math.round(h.cx + h.rx - 1.5), h.cy - 6, 3, 12)), color);
      return;
    case "long-curly":
      g.paint(union(cap, curlyRing(h, 180, 360, 2.8)), color);
      return;
    case "bob":
      g.paint(union(cap, rect(N, Math.round(h.cx - h.rx), h.cy - 8, Math.round(2 * h.rx), 3), rect(N, Math.round(h.cx - h.rx - 2), h.cy - 6, 3, 15), rect(N, Math.round(h.cx + h.rx - 1), h.cy - 6, 3, 15)), color);
      return;
    case "pixie":
      g.paint(union(cap, sideburns(h, h.cy - 2), polygon(N, [[h.cx - h.rx, h.cy - 7], [h.cx + h.rx, h.cy - 8], [h.cx - 1, h.cy - 4], [h.cx - h.rx + 1, h.cy - 3]])), color);
      return;
    case "ponytail":
      g.paint(capMask(h, 1, h.cy - 5), color);
      return;
    case "bun":
      g.paint(union(capMask(h, 1, h.cy - 5), ellipse(N, h.cx, h.top - 2, 4.2, 3.6)), color);
      return;
    case "space-buns":
      g.paint(union(capMask(h, 1, h.cy - 5), ellipse(N, h.cx - h.rx + 1.5, h.top + 0.5, 3.6, 3.6), ellipse(N, h.cx + h.rx - 1.5, h.top + 0.5, 3.6, 3.6)), color);
      return;
    case "braids":
      g.paint(capMask(h, 1, h.cy - 4), color);
      g.fill(rect(N, h.cx, h.top - 1, 1, 4), dark);
      return;
    case "mohawk":
      g.paint(rows(N, h.mask, 0, h.cy - 5), mix(skin, color, 0.45), { outline: false, light: false });
      g.paint(polygon(N, [[h.cx - 2.5, h.cy - 5], [h.cx - 2.5, h.top - 1], [h.cx - 1, h.top - 5], [h.cx + 0.5, h.top - 2], [h.cx + 1.5, h.top - 6], [h.cx + 2.5, h.top - 1], [h.cx + 2.5, h.cy - 5]]), color);
      return;
    case "undercut":
      g.paint(rows(N, h.mask, h.cy - 7, h.cy - 2), mix(skin, color, 0.5), { outline: false, light: false });
      g.paint(union(capMask(h, 1.3, h.cy - 6), polygon(N, [[h.cx - h.rx - 1, h.cy - 8], [h.cx + h.rx + 1, h.cy - 9], [h.cx + h.rx - 2, h.cy - 5], [h.cx - 3, h.cy - 6]])), color);
      return;
    case "curtain-bangs":
      g.paint(union(cap, sideburns(h, h.cy + 1), polygon(N, [[h.cx - h.rx, h.cy - 7], [h.cx - 0.5, h.cy - 8], [h.cx - 3, h.cy - 4], [h.cx - h.rx + 0.5, h.cy - 1]]), polygon(N, [[h.cx + h.rx, h.cy - 7], [h.cx + 0.5, h.cy - 8], [h.cx + 3, h.cy - 4], [h.cx + h.rx - 0.5, h.cy - 1]])), color);
      g.fill(rect(N, h.cx, h.top - 1, 1, 5), dark);
      return;
    case "afro-puff":
      g.paint(union(capMask(h, 0.8, h.cy - 5), curlyRing({ ...h, cx: h.cx, cy: h.top - 1, rx: 5, ry: 4 }, 0, 360, 2.6, 0)), color);
      g.fill(rect(N, h.cx - 4, h.top + 1, 8, 1), "#e05a6a");
      return;
    case "top-knot":
      g.paint(union(cap, sideburns(h), ellipse(N, h.cx, h.top - 1.5, 3, 2.6)), color);
      return;
    case "bald":
      g.fill(pixels(N, [[h.cx - 3, h.top + 2], [h.cx - 2, h.top + 2], [h.cx - 4, h.top + 3]]), mix(skin, "#ffffff", 0.35));
      return;
  }
}

function braids(g: Grid, h: Head, color: string) {
  for (const x of [h.cx - h.rx - 0.5, h.cx + h.rx + 0.5]) {
    const list: [number, number, number][] = [];
    for (let y = h.cy - 2; y <= h.cy + 22; y += 3) list.push([x, y, 2]);
    g.paint(circles(N, list), color);
    for (let y = h.cy - 1; y <= h.cy + 22; y += 3) g.set(Math.round(x - 1), y, mix(color, OUTLINE, 0.3));
    g.fill(rect(N, Math.round(x - 1), h.cy + 23, 2, 1), "#e05a6a");
  }
}

// ───────── Face ─────────

function eyes(g: Grid, style: string, h: Head, iris: string) {
  const k = "#2b1a12";
  const colors = { k, w: "#fffaf0", i: iris, h: "#ffffff", d: mix(iris, k, 0.4) };
  const y = h.cy;
  const lx = h.cx - 6;
  const rx = h.cx + 3;
  const art: Record<string, string[]> = {
    round: ["kkk", "wih", "wid"],
    almond: [".kk.", "wiik", ".kk."],
    "big-and-bright": ["kkkk", "wihi", "wiii", ".kk."],
    dot: ["hk", "kk"],
    sleepy: ["...", "kkk", ".d."],
    happy: [".k.", "k.k"],
    lashes: ["k..k", "kkkk", "wih.", "wid."],
  };
  if (style === "wink") {
    stamp(g, lx, y, art.round!, colors);
    stamp(g, rx, y, art.happy!, colors);
    return;
  }
  const a = art[style] ?? art.round!;
  const yy = style === "lashes" ? y - 1 : y;
  stamp(g, lx, yy, a, colors);
  stamp(g, rx + (a[0]!.length > 3 ? 0 : 0), yy, a, colors, true);
}

function brows(g: Grid, style: string, h: Head, hair: string) {
  const c = mix(hair, OUTLINE, 0.35);
  const y = h.cy - 3;
  const art: Record<string, string[]> = {
    natural: ["ccc"],
    thick: ["cccc", "ccc."],
    arched: [".cc.", "c..c"],
    thin: [".cc"],
    raised: ["cc..", "..cc"].reverse(),
  };
  const a = art[style] ?? art.natural!;
  stamp(g, h.cx - 6, y - (a.length - 1), a, { c });
  stamp(g, h.cx + 3, y - (a.length - 1), a, { c }, true);
}

function nose(g: Grid, style: string, h: Head, skin: string) {
  const d = mix(skin, OUTLINE, 0.38);
  const y = h.cy + 3;
  const art: Record<string, string[]> = {
    button: [".d", "dd"],
    line: ["d.", "d.", "dd"],
    round: [".d.", "ddd"],
    pointed: ["d..", "d..", "ddd"],
    wide: ["d..d", "dddd"],
    small: ["d"],
  };
  const a = art[style] ?? art.button!;
  stamp(g, h.cx - Math.floor(a[0]!.length / 2), y + (3 - a.length), a, { d });
}

function mouth(g: Grid, style: string, h: Head, skin: string) {
  const colors = { m: "#6e2a24", t: "#fffaf0", r: "#e0707a", l: mix(skin, "#c0453a", 0.35) };
  const y = h.cy + 6 + (h.ry > 10.5 ? 1 : 0);
  const art: Record<string, string[]> = {
    smile: ["m...m", ".mmm."],
    "big-smile": ["mmmmm", "mtttm", ".mmm."],
    neutral: [".mmm."],
    laugh: [".mmm.", "mrrrm", ".mmm."],
    smirk: ["....m", ".mmm."],
    calm: [".ll.", ".mm."],
    "tongue-out": ["mmmmm", ".mrm.", "..r.."],
  };
  const a = art[style] ?? art.smile!;
  stamp(g, h.cx - 2, y, a, colors);
}

function facialHair(g: Grid, style: string, h: Head, hair: string, skin: string) {
  const c = mix(hair, OUTLINE, 0.1);
  const jaw = intersect(h.mask, rows(N, h.mask, h.cy + 3, N));
  const my = h.cy + 6 + (h.ry > 10.5 ? 1 : 0);
  const mustache = polygon(N, [[h.cx - 4, my], [h.cx - 1, my - 1.5], [h.cx + 1, my - 1.5], [h.cx + 4, my], [h.cx + 3, my + 0.6], [h.cx - 3, my + 0.6]]);
  switch (style) {
    case "stubble":
      for (let i = 0; i < jaw.length; i++) if (jaw[i] && ((i % N) + Math.floor(i / N)) % 2 === 0) g.px[i] = mix(skin, hair, 0.45);
      return;
    case "mustache":
      g.paint(mustache, c, { outline: false });
      return;
    case "handlebar-mustache":
      g.paint(union(mustache, pixels(N, [[h.cx - 5, my - 1], [h.cx + 4, my - 1], [h.cx - 5, my - 2], [h.cx + 4, my - 2]])), c, { outline: false });
      return;
    case "goatee":
      g.paint(union(mustache, rect(N, h.cx - 2, my + 2, 4, 3)), c, { outline: false });
      return;
    case "short-beard":
      g.paint(union(subtract(jaw, ellipse(N, h.cx, h.cy + 2, 6.4, 4.4)), mustache), c, { outline: false });
      return;
    case "full-beard":
      g.paint(union(subtract(jaw, ellipse(N, h.cx, h.cy + 2, 5.6, 3.6)), ellipse(N, h.cx, h.cy + h.ry - 1, h.rx - 2, 4.2), mustache), c);
      return;
    case "chinstrap":
      g.paint(subtract(jaw, ellipse(N, h.cx, h.cy + 2, h.rx - 1.5, h.ry - 2.5)), c, { outline: false });
      return;
  }
}

function details(g: Grid, style: string, h: Head, skin: string) {
  const blush = () => {
    for (const x of [h.cx - 7, h.cx + 4]) g.fill(rect(N, x, h.cy + 3, 3, 1), mix(skin, "#e8606f", 0.45));
  };
  const freckles = () => g.fill(pixels(N, [[h.cx - 6, h.cy + 3], [h.cx - 4, h.cy + 4], [h.cx - 5, h.cy + 5], [h.cx + 4, h.cy + 3], [h.cx + 6, h.cy + 4], [h.cx + 5, h.cy + 5]]), mix(skin, OUTLINE, 0.35));
  switch (style) {
    case "blush":
      return blush();
    case "freckles":
      return freckles();
    case "blush-and-freckles":
      blush();
      return freckles();
    case "beauty-mark":
      return g.set(h.cx + 4, h.cy + 7, "#3a2216");
    case "bee-face-paint":
      for (const [x, col] of [[h.cx - 7, "#f2b23a"], [h.cx - 6, OUTLINE], [h.cx - 5, "#f2b23a"]] as const) g.fill(rect(N, x, h.cy + 3, 1, 2), col);
      return;
  }
}

// ───────── Extras ─────────

function jewelry(g: Grid, style: string, h: Head) {
  const gold = "#e5b84a";
  const earY = h.cy + 4;
  const ears = [Math.round(h.cx - h.rx - 1), Math.round(h.cx + h.rx)];
  switch (style) {
    case "stud-earrings":
      for (const x of ears) g.set(x, earY, gold);
      return;
    case "hoop-earrings":
      for (const x of ears) g.fill(subtract(ellipse(N, x + 0.5, earY + 2, 1.6, 2), ellipse(N, x + 0.5, earY + 2, 0.7, 1.1)), gold);
      return;
    case "drop-earrings":
      for (const x of ears) {
        g.set(x, earY, gold);
        g.fill(ellipse(N, x + 0.5, earY + 2.5, 1, 1.3), "#f2b23a");
      }
      return;
    case "nose-ring":
      g.set(h.cx + 1, h.cy + 5, gold);
      return;
    case "necklace":
      for (let x = 19; x <= 29; x++) if (x % 2) g.set(x, 36 + (Math.abs(x - 24) < 3 ? 1 : 0), gold);
      return;
    case "honey-pendant":
      for (let x = 20; x <= 28; x += 2) g.set(x, 36 + (Math.abs(x - 24) < 3 ? 1 : 0), gold);
      g.paint(polygon(N, [[24, 37.5], [26, 40], [24, 42], [22, 40]]), "#f2b23a");
      return;
    case "pearls":
      for (let x = 18; x <= 30; x += 2) g.set(x, 36 + (Math.abs(x - 24) < 4 ? 1 : 0), "#fbf7ee");
      return;
  }
}

function glasses(g: Grid, style: string, h: Head) {
  const frame = "#3a2216";
  const y = h.cy + 1;
  const l = h.cx - 5;
  const r = h.cx + 4;
  const ring = (cx: number, rx = 3.2, ry = 2.8) => subtract(ellipse(N, cx, y, rx, ry), ellipse(N, cx, y, rx - 1, ry - 1));
  const box = (cx: number) => subtract(rect(N, Math.round(cx - 3), y - 2, 6, 5), rect(N, Math.round(cx - 2), y - 1, 4, 3));
  const bridge = rect(N, h.cx - 1, y - 1, 2, 1);
  switch (style) {
    case "round-glasses":
      return g.fill(union(ring(l), ring(r + 1), bridge), frame);
    case "square-glasses":
      return g.fill(union(box(l), box(r + 1), bridge), frame);
    case "sunglasses":
      g.fill(union(rect(N, l - 3, y - 2, 6, 4), rect(N, r - 2, y - 2, 6, 4), bridge), "#241a1e");
      g.fill(pixels(N, [[l - 2, y - 1], [r - 1, y - 1]]), "#8f86a8");
      return;
    case "cat-eye-glasses":
      g.fill(union(box(l), box(r + 1), bridge, pixels(N, [[l - 3, y - 3], [r + 4, y - 3]])), "#a3452b");
      return;
    case "half-rim-glasses":
      return g.fill(union(rect(N, l - 3, y - 2, 6, 1), rect(N, r - 2, y - 2, 6, 1), bridge, pixels(N, [[l - 3, y - 1], [r + 3, y - 1]])), frame);
    case "heart-sunglasses": {
      const heart = (cx: number) => union(ellipse(N, cx - 1.2, y - 0.5, 1.6, 1.6), ellipse(N, cx + 1.2, y - 0.5, 1.6, 1.6), polygon(N, [[cx - 2.8, y], [cx + 2.8, y], [cx, y + 2.6]]));
      g.fill(union(heart(l), heart(r + 1), bridge), "#e0507a");
      g.fill(pixels(N, [[l - 2, y - 1], [r, y - 1]]), "#ffd0de");
      return;
    }
  }
}

function accessory(g: Grid, style: string, h: Head, skin: string) {
  switch (style) {
    case "headphones":
      g.paint(subtract(ellipse(N, h.cx, h.cy - 1, h.rx + 3, h.ry + 3), ellipse(N, h.cx, h.cy - 1, h.rx + 1.8, h.ry + 1.8), rows(N, rect(N, 0, 0, N, N), h.cy, N)), "#3e3a3a");
      for (const x of [h.cx - h.rx - 2, h.cx + h.rx + 2]) g.paint(ellipse(N, x, h.cy + 1, 2.2, 3.2), "#5fb3a1");
      return;
    case "scarf":
      g.paint(union(rect(N, 16, 33, 16, 4), rect(N, 26, 36, 4, 9)), "#c0453a");
      for (let x = 17; x < 32; x += 3) g.set(x, 34, "#f2b23a");
      return;
    case "bee-pin":
      stamp(g, 30, 41, [".ww.", "kyky", ".kk."], { w: "#e8f2ff", k: OUTLINE, y: "#f2b23a" });
      return;
    case "flower-behind-ear": {
      const x = Math.round(h.cx + h.rx);
      g.paint(circles(N, [[x, h.cy - 2, 1.4], [x + 2, h.cy - 2, 1.4], [x + 1, h.cy - 3.5, 1.4], [x + 1, h.cy - 0.5, 1.4]]), "#f6a5b5");
      g.set(x + 1, h.cy - 2, "#f2b23a");
      return;
    }
    case "pencil-behind-ear": {
      const x = Math.round(h.cx + h.rx);
      for (let i = 0; i < 7; i++) g.set(x - 2 + i, h.cy - 5 + Math.floor(i / 2), i < 5 ? "#f2b23a" : "#e8c9a0");
      g.set(x + 5, h.cy - 2, OUTLINE);
      return;
    }
    case "bow-tie":
      g.paint(union(polygon(N, [[19.5, 35], [24, 37], [19.5, 39]]), polygon(N, [[28.5, 35], [24, 37], [28.5, 39]])), "#c0453a");
      g.set(24, 37, "#8e2f27");
      return;
    case "bee-on-shoulder":
      stamp(g, 33, 33, [".ww.", "wwww", "kyky", "ykyk", ".kk."], { w: "#e8f2ff", k: OUTLINE, y: "#f2b23a" });
      return;
    case "earbuds":
      for (const x of [Math.round(h.cx - h.rx - 1), Math.round(h.cx + h.rx)]) g.fill(rect(N, x, h.cy + 1, 1, 3), "#fbf7ee");
      return;
  }
  void skin;
}

function hat(g: Grid, style: string, h: Head, accent: string) {
  const t = h.top;
  switch (style) {
    case "beekeeper-hat": {
      for (let y = t + 2; y < 38; y++)
        for (let x = 4; x < 44; x++) {
          const outsideFace = Math.abs(x + 0.5 - h.cx) > h.rx + 1.5;
          if (outsideFace && (x + y) % 2 === 0 && Math.abs(x + 0.5 - h.cx) < h.rx + 7 - (y - t) * 0.1) g.set(x, y, "#e9e4d6");
        }
      g.paint(union(rows(N, ellipse(N, h.cx, t + 1, h.rx - 1, 5), 0, t + 2), ellipse(N, h.cx, t + 2, h.rx + 8, 2.2)), "#f3ead6");
      g.fill(rect(N, Math.round(h.cx - h.rx + 1), t, Math.round(2 * h.rx - 2), 1), "#d9b26a");
      return;
    }
    case "beanie": {
      const dome = rows(N, ellipse(N, h.cx, t + 4, h.rx + 1.8, 7), 0, t + 4);
      g.paint(union(dome, rect(N, Math.round(h.cx - h.rx - 1.5), t + 2, Math.round(2 * h.rx + 3), 4)), accent);
      for (let x = Math.round(h.cx - h.rx - 1); x < h.cx + h.rx + 2; x += 2) for (let y = t + 2; y < t + 6; y++) g.set(x, y, mix(accent, OUTLINE, 0.18));
      g.paint(ellipse(N, h.cx, t - 3.5, 2.4, 2.2), "#f5f1e8");
      return;
    }
    case "cap": {
      g.paint(union(rows(N, ellipse(N, h.cx, t + 4, h.rx + 1.5, 6.5), 0, t + 5), polygon(N, [[h.cx - h.rx - 7, t + 5.5], [h.cx, t + 3.5], [h.cx, t + 6], [h.cx - h.rx - 6, t + 7]])), accent);
      g.set(h.cx, t - 2, mix(accent, OUTLINE, 0.3));
      return;
    }
    case "bee-antennae": {
      g.fill(intersect(subtract(ellipse(N, h.cx, h.cy - 1, h.rx + 1.6, h.ry + 1.6), ellipse(N, h.cx, h.cy - 1, h.rx + 0.6, h.ry + 0.6)), rows(N, rect(N, 0, 0, N, N), t - 1, t + 4)), OUTLINE);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 6; i++) g.set(h.cx + s * (3 + Math.floor(i / 2)), t - 1 - i, OUTLINE);
        g.paint(ellipse(N, h.cx + s * 6.5, t - 7.5, 1.8, 1.8), "#f2b23a");
      }
      return;
    }
    case "straw-hat":
      g.paint(union(polygon(N, [[h.cx - h.rx + 0.5, t + 3], [h.cx - h.rx + 2.5, t - 4], [h.cx + h.rx - 2.5, t - 4], [h.cx + h.rx - 0.5, t + 3]]), ellipse(N, h.cx, t + 3, h.rx + 9, 2.6)), "#e2b866");
      g.fill(rect(N, Math.round(h.cx - h.rx + 1), t, Math.round(2 * h.rx - 2), 2), accent);
      for (let x = Math.round(h.cx - h.rx - 6); x < h.cx + h.rx + 7; x += 3) g.set(x, t + 3, "#c79a4a");
      return;
    case "bandana":
      g.paint(union(intersect(ellipse(N, h.cx, h.cy - 1, h.rx + 1.4, h.ry + 1.4), rows(N, rect(N, 0, 0, N, N), h.cy - 8, h.cy - 5)), polygon(N, [[h.cx + h.rx, h.cy - 7], [h.cx + h.rx + 4, h.cy - 9], [h.cx + h.rx + 4, h.cy - 4]])), accent);
      for (let x = Math.round(h.cx - h.rx); x < h.cx + h.rx; x += 3) g.set(x, h.cy - 7, "#f5f1e8");
      return;
    case "beret":
      g.paint(union(ellipse(N, h.cx + 1.5, t + 1.5, h.rx + 2.5, 4), rect(N, h.cx + 1, t - 4, 1, 2)), accent);
      return;
    case "crown": {
      const pts: [number, number][] = [[h.cx - 7, t + 2], [h.cx - 7, t - 4], [h.cx - 4, t - 1], [h.cx, t - 6], [h.cx + 4, t - 1], [h.cx + 7, t - 4], [h.cx + 7, t + 2]];
      g.paint(polygon(N, pts), "#f2c14e");
      g.fill(pixels(N, [[h.cx - 4, t], [h.cx, t - 1], [h.cx + 3, t]]), "#c0453a");
      g.fill(pixels(N, [[h.cx - 7, t - 5], [h.cx, t - 7], [h.cx + 6, t - 5]]), "#fff3b0");
      return;
    }
    case "flower-crown": {
      const cols = ["#f6a5b5", "#fff0a8", "#c9a7e0", "#f6a5b5", "#9cc8ec", "#fff0a8", "#f6a5b5"];
      g.fill(intersect(subtract(ellipse(N, h.cx, h.cy - 1, h.rx + 1.5, h.ry + 1.5), ellipse(N, h.cx, h.cy - 1, h.rx + 0.5, h.ry + 0.5)), rows(N, rect(N, 0, 0, N, N), t, t + 4)), "#5f9a4a");
      cols.forEach((col, i) => {
        const x = h.cx - 9 + i * 3;
        const y = t + 1 + (i === 0 || i === 6 ? 2 : i === 1 || i === 5 ? 0 : -1);
        g.paint(circles(N, [[x, y, 1.5]]), col);
        g.set(Math.round(x - 0.5), Math.round(y - 0.5), "#e8a33a");
      });
      return;
    }
    case "graduation-cap":
      g.paint(union(rows(N, ellipse(N, h.cx, t + 3, h.rx, 4), 0, t + 4), polygon(N, [[h.cx - 11, t], [h.cx, t - 4], [h.cx + 11, t], [h.cx, t + 3]])), "#26201e");
      for (let i = 0; i < 6; i++) g.set(h.cx + 7 + (i > 2 ? 1 : 0), t + i, "#f2b23a");
      return;
    case "party-hat":
      g.paint(polygon(N, [[h.cx - 5, t + 2], [h.cx, t - 9], [h.cx + 5, t + 2]]), accent);
      for (let y = t - 6; y < t + 2; y += 3) g.fill(rect(N, h.cx - 2, y, 4, 1), "#fff3b0");
      g.paint(ellipse(N, h.cx, t - 9.5, 1.6, 1.6), "#f2b23a");
      return;
    case "headscarf": {
      const scarf = union(ellipse(N, h.cx, h.cy, h.rx + 3, h.ry + 3), polygon(N, [[h.cx - h.rx - 3, h.cy], [h.cx + h.rx + 3, h.cy], [h.cx + h.rx + 6, 40], [h.cx - h.rx - 6, 40]]));
      g.paint(subtract(scarf, ellipse(N, h.cx, h.cy + 1.5, h.rx - 0.8, h.ry - 0.8)), accent);
      g.fill(subtract(ellipse(N, h.cx, h.cy + 1.5, h.rx, h.ry), ellipse(N, h.cx, h.cy + 1.5, h.rx - 0.8, h.ry - 0.8)), mix(accent, OUTLINE, 0.3));
      return;
    }
  }
}

const HAIR_HIDDEN_BY = new Set(["headscarf"]);
const BACK_STYLES = new Set(["afro", "long-straight", "long-wavy", "long-curly", "bob", "ponytail", "locs"]);

export function renderAvatar(c: AvatarConfig): Grid {
  const g = new Grid(N);
  const skin = SKIN_TONES[c.skin]!.color;
  const hairColor = HAIR_COLORS[c.hairColor]!.color;
  const iris = EYE_COLORS[c.eyeColor]!.color;
  const clothColor = CLOTHING_COLORS[c.clothingColor]!.color;
  const accent = CLOTHING_COLORS[(c.clothingColor + 8) % CLOTHING_COLORS.length]!.color;
  const hairStyle = id("hair", c);
  const hatStyle = id("hat", c);
  const showHair = !HAIR_HIDDEN_BY.has(hatStyle);
  const h = head(id("face", c));

  background(g, id("background", c));
  if (showHair && BACK_STYLES.has(hairStyle)) hairBack(g, hairStyle, h, hairColor);
  g.paint(rect(N, 20, 27, 8, 10), skin, { light: false });
  clothing(g, id("clothing", c), clothColor, skin);
  if (showHair && hairStyle === "braids") braids(g, h, hairColor);
  for (const x of [h.cx - h.rx - 0.3, h.cx + h.rx + 0.3]) g.paint(ellipse(N, x, h.cy + 2, 1.9, 2.6), skin);
  g.paint(h.mask, skin);
  details(g, id("details", c), h, skin);
  facialHair(g, id("facialHair", c), h, hairColor, skin);
  eyes(g, id("eyes", c), h, iris);
  brows(g, id("brows", c), h, hairColor);
  nose(g, id("nose", c), h, skin);
  mouth(g, id("mouth", c), h, skin);
  if (showHair) hairFront(g, hairStyle, h, hairColor, skin);
  jewelry(g, id("jewelry", c), h);
  accessory(g, id("accessory", c), h, skin);
  glasses(g, id("glasses", c), h);
  hat(g, hatStyle, h, accent);
  return g;
}

/** Bust framing: the portrait is drawn on 48 × 48 and shown as this 40 × 40 window. */
export const AVATAR_CROP = { x: 4, y: 3, size: 40 } as const;

export function avatarSvg(c: AvatarConfig): string {
  return renderAvatar(c).toSvg(AVATAR_CROP);
}
