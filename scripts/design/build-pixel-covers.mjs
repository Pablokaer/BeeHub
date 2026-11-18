import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Generates the pixel-art profile covers added to the Colmeia catalog: apiary scenes drawn on a
 * 200 × 74 grid with posterized skies, dithered transitions, cocoa contours and the brand's honey
 * palette, scaled ×8 to 1600 × 592 WebP. Re-running is deterministic (seeded random).
 *
 *   node scripts/design/build-pixel-covers.mjs
 */
const W = 200;
const H = 74;
const SCALE = 8;
const OUT_DIR = "public/brand/colmeia/capas";
const MANIFEST = "public/brand/colmeia/catalogo.json";
const INK = "#3a2216";

let seed = 1;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const f = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${f(r1, r2)}${f(g1, g2)}${f(b1, b2)}`;
};

class Canvas {
  constructor() {
    this.px = new Array(W * H).fill("#000000");
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) this.px[y * W + x] = c;
  }
  get(x, y) {
    return this.px[Math.round(y) * W + Math.round(x)];
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Vertical sky: posterized bands with a checker dither between them. */
  sky(bands) {
    const step = H / bands.length;
    for (let y = 0; y < H; y++) {
      const t = y / step;
      const i = Math.min(bands.length - 1, Math.floor(t));
      const next = bands[Math.min(bands.length - 1, i + 1)];
      for (let x = 0; x < W; x++) this.set(x, y, t - i > 0.72 && (x + y) % 2 === 0 ? next : bands[i]);
    }
  }
  /** Shaded disc with an outline. */
  disc(cx, cy, r, c, { outline = INK, light = true } = {}) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) {
          const lit = light && x < cx - r * 0.2 && y < cy - r * 0.2 && d > r * 0.45;
          const dark = light && x > cx + r * 0.25 && y > cy + r * 0.1;
          this.set(x, y, lit ? mix(c, "#fff6dc", 0.3) : dark ? mix(c, INK, 0.22) : c);
        } else if (outline && d <= r + 1) this.set(x, y, outline);
      }
  }
  /** Ridge filled down to the bottom, with a lighter crest and dithered body. */
  hill(fn, top, body, { crest = mix(top, "#fff6dc", 0.25), dither = true } = {}) {
    for (let x = 0; x < W; x++) {
      const h = Math.round(fn(x));
      for (let y = Math.max(0, h); y < H; y++) {
        let c = y === h ? crest : y < h + 3 ? top : body;
        if (dither && y >= h + 3 && y < h + 5 && (x + y) % 2 === 0) c = top;
        this.set(x, y, c);
      }
    }
  }
  cloud(x, y, w, c = "#ffffff") {
    const shade = mix(c, "#9fb6d8", 0.35);
    for (let i = 0; i < w; i++) this.set(x + i, y + 2, shade);
    for (let i = 1; i < w - 1; i++) this.set(x + i, y + 1, c);
    for (let i = Math.floor(w * 0.25); i < Math.ceil(w * 0.7); i++) this.set(x + i, y, c);
    for (let i = Math.floor(w * 0.35); i < Math.ceil(w * 0.55); i++) this.set(x + i, y - 1, c);
  }
  stars(n, colors = ["#fff3c4", "#e9e2ff"]) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand() * W);
      const y = Math.floor(rand() * 34);
      const c = colors[i % colors.length];
      this.set(x, y, c);
      if (i % 7 === 0) {
        this.set(x - 1, y, mix(c, "#1f2547", 0.5));
        this.set(x + 1, y, mix(c, "#1f2547", 0.5));
        this.set(x, y - 1, mix(c, "#1f2547", 0.5));
        this.set(x, y + 1, mix(c, "#1f2547", 0.5));
      }
    }
  }
  /** Traditional straw skep: stacked rings with an arched door. */
  skep(cx, base, w = 17, rings = 7, { honey = "#e8a33a", light = "#f7c55a", door = "#4a2a17", glow = false } = {}) {
    for (let r = 0; r < rings; r++) {
      // Dome profile: wide base, rounded shoulders, narrow crown.
      const rw = Math.max(3, Math.round(w * (1 - 0.78 * Math.pow(r / (rings - 1), 1.8))));
      const y = base - r * 2;
      for (let i = -Math.floor(rw / 2) - 1; i <= Math.floor(rw / 2) + 1; i++) {
        this.set(cx + i, y, INK);
        this.set(cx + i, y - 1, INK);
      }
      for (let i = -Math.floor(rw / 2); i <= Math.floor(rw / 2); i++) {
        this.set(cx + i, y, r % 2 ? honey : mix(honey, INK, 0.12));
        this.set(cx + i, y - 1, i < 0 ? light : honey);
      }
    }
    this.set(cx, base - rings * 2, INK);
    this.rect(cx - 1, base - 3, 3, 3, glow ? "#ffe08a" : door);
    this.set(cx - 2, base - 2, INK);
    this.set(cx + 2, base - 2, INK);
    this.rect(cx - Math.floor(w / 2) - 1, base + 1, w + 2, 1, INK);
  }
  /** Painted wooden box hive with a roof and stand. */
  boxHive(x, base, w = 12, supers = 2, color = "#f1e2bd", roof = "#a3452b", { glow = false } = {}) {
    const top = base - supers * 4 - 2;
    this.rect(x - 1, top - 1, w + 2, base - top + 2, INK);
    for (let s = 0; s < supers; s++) {
      const y = base - (s + 1) * 4;
      this.rect(x, y, w, 4, s % 2 ? color : mix(color, "#f2b23a", 0.25));
      this.rect(x, y + 3, w, 1, mix(color, INK, 0.3));
      this.rect(x + 1, y, 1, 3, mix(color, "#ffffff", 0.3));
    }
    this.rect(x - 1, top, w + 2, 2, roof);
    this.rect(x - 1, top, w + 2, 1, mix(roof, "#ffffff", 0.25));
    this.rect(x + Math.floor(w / 2) - 2, base - 1, 4, 1, glow ? "#ffe08a" : INK);
    this.rect(x, base + 1, 1, 2, INK);
    this.rect(x + w - 1, base + 1, 1, 2, INK);
  }
  bee(x, y, trail = 0) {
    const art = [".ww.", "wwww", "kyky", "ykyk", ".kk."];
    const col = { w: "#e8f2ff", k: INK, y: "#f2b23a" };
    art.forEach((row, j) => [...row].forEach((ch, i) => col[ch] && this.set(x + i, y + j, col[ch])));
    for (let i = 1; i <= trail; i++) if (i % 2) this.set(x - 1 - i * 1.5, y + 3 + Math.round(Math.sin(i / 1.5) * 2), mix(INK, "#ffffff", 0.35));
  }
  flowers(y0, y1, colors, n) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand() * W);
      const y = y0 + Math.floor(rand() * (y1 - y0));
      const c = colors[i % colors.length];
      this.set(x, y + 1, "#4f7a3a");
      this.set(x, y, c);
      if (i % 3 === 0) {
        this.set(x - 1, y, c);
        this.set(x + 1, y, c);
        this.set(x, y - 1, c);
        this.set(x, y, "#f2b23a");
      }
    }
  }
  tree(cx, base, r, leaf, trunk = "#5b3a24", fruit) {
    this.rect(cx - 1, base - r, 3, r, INK);
    this.rect(cx, base - r, 1, r, trunk);
    this.disc(cx, base - r - r * 0.6, r, leaf);
    if (fruit) for (let i = 0; i < 6; i++) this.set(cx - r * 0.6 + rand() * r * 1.2, base - r - r * 0.9 + rand() * r, fruit);
  }
  mountain(peakX, peakY, base, w, rock, snow) {
    for (let y = peakY; y < base; y++) {
      const half = ((y - peakY) / (base - peakY)) * w;
      for (let x = Math.floor(peakX - half); x <= peakX + half; x++) {
        const lit = x < peakX;
        let c = lit ? mix(rock, "#ffffff", 0.12) : rock;
        if (snow && y < peakY + (base - peakY) * 0.28 + Math.sin(x) * 1.5) c = lit ? snow : mix(snow, "#9fb6d8", 0.3);
        this.set(x, y, c);
      }
      this.set(Math.floor(peakX - half) - 1, y, INK);
      this.set(Math.ceil(peakX + half) + 1, y, INK);
    }
  }
  honeycomb(base, line, glint, ox = 0, oy = 0) {
    for (let row = -1; row < 12; row++)
      for (let col = -1; col < 26; col++) {
        const cx = ox + col * 9 + (row % 2 ? 4.5 : 0);
        const cy = oy + row * 6.5;
        for (let y = Math.floor(cy - 4); y <= cy + 4; y++)
          for (let x = Math.floor(cx - 5); x <= cx + 5; x++) {
            const dx = Math.abs(x + 0.5 - cx);
            const dy = Math.abs(y + 0.5 - cy);
            const inside = dx / 4.6 + dy / 3.8 <= 1.25 && dy <= 3.6;
            const edge = dx / 4.6 + dy / 3.8 <= 1.55 && dy <= 4.3 && !inside;
            if (edge) this.set(x, y, line);
            else if (inside) this.set(x, y, y < cy - 1.5 ? glint : base);
          }
      }
  }
  toRaw() {
    const buf = Buffer.alloc(W * H * 3);
    this.px.forEach((c, i) => buf.set(hex(c), i * 3));
    return buf;
  }
}

const meadowFlowers = ["#f6a5b5", "#fff0a8", "#c9a7e0", "#ffffff", "#f7a8a0"];

const SCENES = [
  {
    id: "prado-ao-meio-dia", label: "Prado ao meio-dia", alt: "Colmeias de palha num prado verde sob céu azul com nuvens e abelhas", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#7fb6ea", "#93c3ef", "#a9d0f2", "#bfdcf4", "#d4e8f5"]);
      c.disc(168, 12, 6, "#fff2a8", { outline: false });
      for (const [x, y, w] of [[18, 10, 16], [70, 6, 22], [120, 14, 14], [150, 5, 18]]) c.cloud(x, y, w);
      c.hill((x) => 40 + 5 * Math.sin(x / 23), "#8cc06b", "#79ad5a");
      c.hill((x) => 50 + 4 * Math.sin(x / 15 + 1), "#7db35e", "#689c4c");
      for (const [x, b] of [[60, 52], [80, 51], [100, 53]]) c.skep(x, b);
      c.hill((x) => 62 + 2 * Math.sin(x / 9), "#6aa84f", "#5b9442");
      c.flowers(56, 73, meadowFlowers, 70);
      c.tree(150, 52, 7, "#5f9a4a");
      c.bee(118, 30, 8);
      c.bee(40, 26, 6);
    },
  },
  {
    id: "mel-ao-por-do-sol", label: "Mel ao pôr do sol", alt: "Silhuetas de colmeias de madeira e colinas diante de um grande sol ao entardecer", focalPoint: { x: 0.55, y: 0.55 },
    draw(c) {
      c.sky(["#4e3a78", "#7a4d8e", "#b25c86", "#e07a6e", "#f3a35c", "#f9cd6c"]);
      c.disc(110, 46, 17, "#ffd773", { outline: false, light: false });
      for (const [x, y, w] of [[30, 16, 20], [150, 22, 16]]) c.cloud(x, y, w, "#f7b38f");
      c.hill((x) => 48 + 6 * Math.sin(x / 26 + 2), "#6e3d5a", "#5a3149", { crest: "#8a4f6e" });
      c.hill((x) => 58 + 3 * Math.sin(x / 13), "#3f2a33", "#33232b", { crest: "#5a3a44" });
      for (const x of [40, 56, 72, 140, 156]) c.boxHive(x, 59, 11, 2, "#4a3138", "#2b1d22", { glow: true });
      c.bee(96, 30, 10);
      c.bee(126, 22, 7);
    },
  },
  {
    id: "colmeias-sob-estrelas", label: "Colmeias sob as estrelas", alt: "Apiário noturno com colmeias iluminadas, lua crescente, estrelas e vagalumes", focalPoint: { x: 0.45, y: 0.6 },
    draw(c) {
      c.sky(["#141a38", "#1b2246", "#232b55", "#2c3563", "#38406f"]);
      c.stars(70);
      c.disc(160, 14, 7, "#fff1b8", { outline: false });
      c.disc(163, 12, 6, "#1b2246", { outline: false, light: false });
      c.hill((x) => 44 + 6 * Math.sin(x / 30), "#2a3b4a", "#22303d", { crest: "#3c5468" });
      c.hill((x) => 56 + 3 * Math.sin(x / 11), "#243328", "#1c2820", { crest: "#3a5440" });
      for (const [x, b] of [[50, 56], [70, 55], [92, 57]]) c.skep(x, b, 17, 7, { honey: "#8a5a2a", light: "#b47a38", glow: true });
      c.tree(130, 56, 8, "#2f4a34");
      for (let i = 0; i < 18; i++) c.set(20 + rand() * 170, 40 + rand() * 30, i % 2 ? "#e8ff8a" : "#fff3a8");
    },
  },
  {
    id: "campos-de-lavanda", label: "Campos de lavanda", alt: "Fileiras de lavanda em perspectiva até colmeias brancas, com sol suave e uma árvore", focalPoint: { x: 0.5, y: 0.5 },
    draw(c) {
      c.sky(["#f6d6c8", "#f8dfcf", "#f9e7d5", "#fbeedc"]);
      c.disc(60, 18, 8, "#ffe6a3", { outline: false });
      c.hill((x) => 34 + 3 * Math.sin(x / 31), "#a3b98a", "#93aa7a");
      for (let y = 38; y < H; y++)
        for (let x = 0; x < W; x++) {
          const t = (y - 38) / (H - 38);
          const lane = Math.floor(((x - 100) / (6 + t * 30) + 100)) % 2;
          c.set(x, y, lane ? (t > 0.5 && (x + y) % 3 === 0 ? "#9b7fd0" : "#8c6cc4") : y % 2 ? "#7a9a5a" : "#6d8c4f");
        }
      for (const x of [120, 136, 152]) c.boxHive(x, 38, 11, 2, "#f6f1e6", "#7a6aa8");
      c.tree(30, 38, 7, "#7a9a5a");
      c.bee(90, 22, 9);
    },
  },
  {
    id: "montanhas-em-flor", label: "Montanhas em flor", alt: "Picos nevados sobre um prado alpino florido com uma colmeia de palha", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#8fc2ec", "#a4cdef", "#bcdaf2", "#d2e6f4"]);
      c.mountain(55, 6, 46, 40, "#7b8aa6", "#f4f6fb");
      c.mountain(120, 2, 46, 48, "#6d7c9a", "#ffffff");
      c.mountain(175, 12, 46, 34, "#85939f", "#eef2f8");
      c.hill((x) => 44 + 3 * Math.sin(x / 17), "#8fc06e", "#7eae5d");
      c.hill((x) => 58 + 2 * Math.sin(x / 8), "#78b05a", "#69a04c");
      c.flowers(48, 73, ["#f6a5b5", "#ffffff", "#c9a7e0", "#fff0a8", "#f2b23a"], 110);
      c.skep(96, 58);
      c.bee(76, 36, 8);
    },
  },
  {
    id: "favo-dourado", label: "Favo dourado", alt: "Padrão de favos de mel dourados com mel escorrendo e abelhas", focalPoint: { x: 0.5, y: 0.5 },
    draw(c) {
      c.rect(0, 0, W, H, "#df9c35");
      c.honeycomb("#f5c662", "#c47d22", "#ffe39a");
      for (let x = 0; x < W; x++) {
        const len = 6 + Math.round(4 * Math.sin(x / 5) + 3 * Math.sin(x / 2.3));
        for (let y = 0; y < len; y++) c.set(x, y, y === len - 1 ? "#c97c1c" : y < 2 ? "#ffd877" : "#f2b23a");
      }
      for (const [x, y] of [[40, 30], [96, 44], [150, 26], [176, 52]]) c.bee(x, y, 8);
    },
  },
  {
    id: "falesias-e-colmeias", label: "Falésias e colmeias", alt: "Colmeias de madeira no alto de falésias sobre o mar azul com gaivotas", focalPoint: { x: 0.6, y: 0.55 },
    draw(c) {
      c.sky(["#79b8e6", "#8fc4ea", "#a6d0ee", "#c2def2"]);
      for (const [x, y, w] of [[20, 8, 18], [96, 12, 14]]) c.cloud(x, y, w);
      for (let y = 34; y < H; y++) for (let x = 0; x < W; x++) c.set(x, y, (x * 3 + y * 7) % 23 === 0 ? "#bfe6f2" : y < 40 ? "#3f9bc4" : "#2f86b2");
      for (let x = 0; x < W; x++) {
        if (x < 110) continue;
        const h = 30 - Math.round(4 * Math.sin((x - 110) / 14));
        for (let y = h; y < H; y++) c.set(x, y, y < h + 2 ? "#7db35e" : (x + y) % 5 === 0 ? "#b88a5a" : "#c99a68");
        c.set(x, h - 1, INK);
      }
      for (const x of [128, 146, 164]) c.boxHive(x, 28, 11, 2, "#f6f1e6", ["#3c66a8", "#c0453a", "#f2b23a"][(x / 18) % 3 | 0]);
      for (const [x, y] of [[40, 20], [52, 16], [70, 24]]) {
        c.set(x, y, "#ffffff");
        c.set(x - 1, y - 1, "#ffffff");
        c.set(x + 1, y - 1, "#ffffff");
      }
      c.bee(100, 22, 8);
    },
  },
  {
    id: "outono-no-apiario", label: "Outono no apiário", alt: "Árvores de outono alaranjadas, folhas caindo e colmeias num campo dourado", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#f2c27c", "#f5cf8e", "#f7dba3", "#f9e6b9"]);
      c.hill((x) => 42 + 4 * Math.sin(x / 21), "#c98a43", "#b97a36");
      for (const [x, r, col] of [[24, 9, "#d9672c"], [168, 10, "#c9502a"], [188, 7, "#e08a2e"], [44, 7, "#e3a33a"]]) c.tree(x, 52, r, col, "#5b3a24");
      c.hill((x) => 54 + 2 * Math.sin(x / 9), "#d6a24e", "#c48f40");
      for (const x of [76, 94, 112]) c.boxHive(x, 56, 12, 2, "#f1e2bd", "#8a4e2b");
      for (let i = 0; i < 30; i++) c.set(rand() * W, rand() * 50, ["#d9672c", "#e3a33a", "#c9502a"][i % 3]);
      c.bee(136, 30, 8);
    },
  },
  {
    id: "inverno-na-colmeia", label: "Inverno na colmeia", alt: "Colinas nevadas com colmeias cobertas de neve, pinheiros e flocos caindo", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#b9c9de", "#c6d4e6", "#d3deec", "#e0e8f2"]);
      c.hill((x) => 40 + 5 * Math.sin(x / 25), "#f4f7fb", "#e3eaf3", { crest: "#ffffff" });
      for (const x of [20, 34, 170, 186]) {
        for (let j = 0; j < 12; j++) for (let i = -Math.floor(j / 2); i <= Math.floor(j / 2); i++) c.set(x + i, 32 + j, j % 4 === 0 ? "#ffffff" : "#3f6b55");
        c.rect(x, 44, 1, 3, "#5b3a24");
      }
      for (const [x, b] of [[78, 54], [100, 53], [122, 55]]) {
        c.skep(x, b);
        for (let i = -5; i <= 5; i++) c.set(x + i, b - 13 + Math.abs(i) * 0.7, "#ffffff");
      }
      c.hill((x) => 60 + 2 * Math.sin(x / 7), "#ffffff", "#eef3f9");
      for (let i = 0; i < 90; i++) c.set(rand() * W, rand() * H, "#ffffff");
    },
  },
  {
    id: "jardim-no-telhado", label: "Jardim no telhado", alt: "Horta num telhado da cidade ao entardecer, com colmeias, vasos e prédios iluminados", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#3d3a6e", "#5e4a86", "#8c5a8e", "#c4708a", "#ee9a78"]);
      for (let i = 0; i < 16; i++) {
        const x = i * 13 + Math.floor(rand() * 4);
        const h = 12 + Math.floor(rand() * 20);
        c.rect(x, 50 - h, 11, h, i % 2 ? "#3a3350" : "#463c5e");
        for (let y = 52 - h; y < 48; y += 3) for (let k = 1; k < 10; k += 3) if (rand() > 0.45) c.set(x + k, y, "#ffd773");
      }
      c.rect(0, 50, W, H - 50, "#8a5a44");
      for (let x = 0; x < W; x += 4) c.rect(x, 50, 3, 1, "#a36a50");
      for (const x of [20, 46, 150, 176]) {
        c.rect(x, 54, 14, 6, "#6b4226");
        for (let i = 0; i < 14; i += 2) c.set(x + i, 53, i % 4 ? "#7db35e" : "#f6a5b5");
      }
      for (const x of [80, 98, 116]) c.boxHive(x, 58, 12, 2, "#f1e2bd", "#c0453a");
      c.bee(138, 34, 9);
    },
  },
  {
    id: "pomar-de-laranjeiras", label: "Pomar de laranjeiras", alt: "Pomar de laranjeiras carregadas, com colmeias pintadas entre as árvores", focalPoint: { x: 0.5, y: 0.6 },
    draw(c) {
      c.sky(["#9fd0ee", "#b2d9f0", "#c6e3f2", "#d9ecf4"]);
      c.cloud(140, 10, 18);
      c.hill((x) => 38 + 3 * Math.sin(x / 19), "#9cc77a", "#8bb76a");
      for (let i = 0; i < 9; i++) c.tree(10 + i * 23, 46 + (i % 2) * 2, 7, "#4f8a3f", "#5b3a24", "#f39a2b");
      c.hill((x) => 56 + 2 * Math.sin(x / 10), "#86ba62", "#76a854");
      for (const [x, col] of [[60, "#3c66a8"], [86, "#f2b23a"], [112, "#c0453a"], [138, "#8bae7a"]]) c.boxHive(x, 60, 11, 2, "#f6f1e6", col);
      c.flowers(60, 73, ["#ffffff", "#fff0a8"], 50);
      c.bee(42, 30, 8);
    },
  },
  {
    id: "arco-iris-na-chuva", label: "Arco-íris na chuva", alt: "Chuva leve sobre um prado com colmeias de palha e um arco-íris no céu", focalPoint: { x: 0.5, y: 0.55 },
    draw(c) {
      c.sky(["#8da3bb", "#9fb3c8", "#b2c3d5", "#c5d2e0"]);
      const bands = ["#e86a5a", "#f2a24a", "#f5d65a", "#7cc06a", "#5a9ad6", "#8a6ac6"];
      for (let x = 0; x < W; x++)
        for (let b = 0; b < bands.length; b++) {
          const r = 70 - b * 2.2;
          const dy = r * r - Math.pow(x - 100, 2);
          if (dy > 0) {
            const y = Math.round(78 - Math.sqrt(dy));
            c.set(x, y, bands[b]);
            c.set(x, y + 1, bands[b]);
          }
        }
      c.hill((x) => 46 + 4 * Math.sin(x / 18), "#78b05a", "#68a04c");
      for (const [x, b] of [[70, 50], [130, 51]]) c.skep(x, b);
      c.hill((x) => 60 + 2 * Math.sin(x / 9), "#6aa84f", "#5b9442");
      c.flowers(56, 73, meadowFlowers, 60);
      for (let i = 0; i < 120; i++) {
        const x = rand() * W;
        const y = rand() * 50;
        c.set(x, y, "#dbe6f2");
        c.set(x - 1, y + 1, "#c5d4e6");
      }
    },
  },
];

const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
for (const [i, scene] of SCENES.entries()) {
  seed = 1000 + i * 97;
  const c = new Canvas();
  scene.draw(c);
  const file = `${OUT_DIR}/${scene.id}.webp`;
  await sharp(c.toRaw(), { raw: { width: W, height: H, channels: 3 } }).resize(W * SCALE, H * SCALE, { kernel: "nearest" }).webp({ quality: 92 }).toFile(file);
  const entry = { id: scene.id, label: scene.label, src: `/brand/colmeia/capas/${scene.id}.webp`, width: W * SCALE, height: H * SCALE, alt: scene.alt, focalPoint: scene.focalPoint };
  const at = manifest.covers.findIndex((e) => e.id === scene.id);
  if (at >= 0) manifest.covers[at] = entry;
  else manifest.covers.push(entry);
  console.log(file);
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
