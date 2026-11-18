import { cn } from "../ui/cn";

/**
 * Small pixel-art glyphs from the approved Colmeia prototype, drawn as crisp SVG (no canvas,
 * so they render on the server and scale without blur). Always decorative: pair them with
 * visible text or an accessible name on the control.
 */
const PALETTE: Record<string, string> = {
  k: "#321d12", d: "#57321b", a: "#9f541e", p: "#c67a29", g: "#edac38",
  h: "#ffd46a", w: "#fff0b7", c: "#fce3a0", e: "#56825d", m: "#749e69", l: "#afd099", o: "#9f541e",
};
const OUTLINE = "#54311e";

const GLYPHS = {
  house: [".....hh.....", "....hwwh....", "...hwwwwh...", "..hwhhhwwh..", ".hwhggghwwh.", "gwhggggghwwg", "..hgpddpgh..", "..hgpwwpgh..", "..hgpwwpgh..", "..ggpggpgg..", "..pppppppp.."],
  compass: ["....ghhh....", "..ghwwwwhg..", ".hg......gh.", ".h.....hh.h.", "h.....hwg..h", "g....hwgp..g", "g...hwgp...g", "h..gogp....h", ".h.pg.....h.", ".hg......gh.", "..ghwwwwhg..", "....ghhh...."],
  briefcase: ["....ghhg....", "...gw..wg...", "...gw..wg...", ".ggghhhhggg.", "ghwwwwwwwwhg", "ghhgggggghhg", "gghgwhwghggg", "gppgwhwgppgg", "gppgggggppgg", "gpppppppppgg", ".gggggggggg."],
  users: ["...hhh......", "..hwwwh.hh..", "..hgwwh.hwh.", "..gghg..hgh.", "...gg....g..", "..ghhg..gg..", ".gwwwgg.ggg.", "gwhhhgpg.gg.", "ghgggggg.gg.", "gppppppg.gg.", ".gggggg..g.."],
  envelope: ["............", ".ghhhhhhhhg.", "ghwwwwwwwwhg", "gwhgwwgwhwhg", "gwhhghghhwhg", "gwhhhgghhwhg", "gwghghghgwhg", "gwhhhhhhhwhg", "gwwwwwwwwwhg", ".gggggggggg."],
  bookmark: ["..ghhhhhh...", "..gwwwwwg...", "..gwhhhwg...", "..gwhhhwg...", "..gwhhhwg...", "..gwhhhwg...", "..gwhhhwg...", "..gwhhhwg...", "..gwgggwg...", "..gg...gg...", "..g.....g..."],
  bell: [".....hh.....", "....ghhg....", "...hwwwwh...", "..hwwhwwwg..", "..hwhhhwwg..", "..hwhhhwwg..", "..hwhhhwwg..", ".ghwhhhwwgg.", "gwwwwwwwwwwg", ".gggggggggg.", ".....gg....."],
  search: ["...ghhh.....", "..hwwwwh....", ".hw....wh...", ".hw....wh...", ".hw....wh...", "..hwwwwh....", "...ghhhgp...", ".......pwg..", "........pwg.", ".........ggh", "..........gh"],
  heart: ["............", "..hhh..hhh..", ".hwwggggwwh.", "hwwggggggwwh", "hgghgggggggh", "ghgggggggghg", ".ghgggggghg.", "..gggggggg..", "...gggggg...", "....gggg....", ".....gg....."],
  comment: [".gggggggggg.", "ghwwwwwwwwhg", "gwccccccccwg", "gwcggcggccwg", "gwccccccccwg", "gwccccccccwg", "gwwwwwwwwwhg", ".gggggggggg.", "..gwg.......", "..gg........", "..g........."],
  jar: ["...gggggg...", "..ghwwwwhg..", "..gaapaagg..", "...gwwwwg...", "..ggwwwwgg..", ".gwcggggcwg.", ".gwghwhgcwg.", ".gwghhhgcwg.", ".gwcggggcwg.", ".gwwwwwwwwg.", "..gggggggg.."],
  bee: ["................", "................", "....ww...ww.....", "...wccw.wccw....", "...wccw.wccw....", "....wwwwwww.....", ".d..kggkgghk.d..", "..dkkggkgghkd...", "...kwwgkgggkk...", "...kkkkkggghk...", "....kggkgggk....", ".....kkkkkk.....", "......kd.d......", "................", "................", "................"],
  // From the approved prototype.
  image: [".gggggggggg.", "gwccccccccwg", "gwcghgccccwg", "gwcghgcgccwg", "gwccccgegcwg", "gwcgcgmemgwg", "gwgemmemeewg", "gwmemememewg", "gwwwwwwwwwwg", ".gggggggggg."],
  study: ["................", "...........w....", "..........www...", "..ggggg.gggwgg..", ".gwwwwgggwwwwwg.", ".gwwggwcwwgwwg..", ".gwwwwgcgwwwwg..", ".gwgwwgcgwggwg..", ".gwwwwgcgwwwwg..", ".gwggwgcwwwgwg..", ".gwwwwgcggwwwg..", ".gwwwwgggwwwwg..", "..ggggg.ggggg...", "................"],
  harbor: ["................", "......hhh.......", ".....h...h......", ".....h...h......", "......hhh.......", ".......h........", "....ggghgggg....", ".......h........", "..gg...h...gg...", "..g....h....g...", "..gg...h...gg...", "...gghhhhhgg....", ".....ggggg......", "................"],
  // Category and action glyphs drawn for the app in the same 12-px grid.
  screen: ["gggggggggggg", "gwwwwwwwwwwg", "gwhhhhhhhhwg", "gwhppphhhhwg", "gwhhhhpphhwg", "gwhhhhhhhhwg", "gwwwwwwwwwwg", "gggggggggggg", "....gddg....", "..gggggggg.."],
  phone: ["..gggggggg..", "..gwwwwwwg..", "..gwhhhhwg..", "..gwhpphwg..", "..gwhhhhwg..", "..gwhhpwwg..", "..gwhhhhwg..", "..gwwwwwwg..", "..gwwddwwg..", "..gggggggg.."],
  gamepad: [".gggggggggg.", "ghhhhhhhhhhg", "ghdhhhhhhwhg", "gdddhhhhwhwg", "ghdhhhhhhwhg", "ghhhhhhhhhhg", "ghhgggggghhg", ".gg......gg."],
  coin: ["...gggggg...", "..ghhhhhhg..", ".ghwhhhhhpg.", "ghwhhgghhhpg", "ghwhgwwghhpg", "ghhhgwwghhpg", "ghhhhgghhhpg", ".ghhhhhhhpg.", "..gpppppppg.", "...gggggg..."],
  chip: ["..g..g..g...", ".ggggggggg..", "gghwwwwwhgg.", ".ghwpppwhg..", "gghwpdpwhgg.", ".ghwpppwhg..", "gghwwwwwhgg.", ".ggggggggg..", "..g..g..g..."],
  share: [".......g....", "gggggggwg...", "ghwwwwwwwg..", "gggggggwg...", ".......g....", "....g.......", "...gwggggggg", "..gwwwwwwwhg", "...gwggggggg", "....g......."],
  more: ["ggg.ggg.ggg", "gwg.gwg.gwg", "ggg.ggg.ggg"],
  link: ["......gggg..", ".....gwwwwg.", "....gw..gwg.", "...g.g.gwg..", "..gwg.g.g...", ".gwg..wg....", ".gwwwwg.....", "..gggg......"],
  crown: ["................", "................", ".......ww.......", ".......hh.......", "..ww..hhgh..ww..", "..hg..hggh..gh..", "..hghhhgghhhgh..", "..hgggggghgggh..", "...hgwhwgwghg...", "...hgghgghggg...", "....hhhhhhhh....", "....gppppppg....", "................", "................", "................", "................"],
  garden: ["................", ".......w........", "......www.......", ".......w...l....", "..........lml...", "....em.....e....", "...emme...eml...", "...eem....ee....", "....eg....g.....", "..gpgppgpppgp...", "..ppgppgpggpgp..", ".aappppappappa..", ".aaaaaaaaaaaaa..", "..ddaaaddaadd...", "....ddddddd.....", "................"],
} as const;

export type PixelIconName = keyof typeof GLYPHS;

type Rendered = { size: number; outline: string; fills: [string, string][] };

function render(rows: readonly string[]): Rendered {
  const width = Math.max(...rows.map((r) => r.length));
  const size = Math.max(width, rows.length) + 2;
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - rows.length) / 2);
  let outline = "";
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = PALETTE[ch];
      if (!color) return;
      const px = left + x;
      const py = top + y;
      // One-pixel outline around every filled pixel, as in the prototype's sprite painter.
      outline += `M${px - 1} ${py}h3v1h-3zM${px} ${py - 1}h1v3h-1z`;
      byColor.set(color, (byColor.get(color) ?? "") + `M${px} ${py}h1v1h-1z`);
    });
  });
  return { size, outline, fills: [...byColor.entries()] };
}

const CACHE = new Map<PixelIconName, Rendered>();
function glyph(name: PixelIconName): Rendered {
  let r = CACHE.get(name);
  if (!r) {
    r = render(GLYPHS[name]);
    CACHE.set(name, r);
  }
  return r;
}

export function PixelIcon({ name, size = 20, className }: { name: PixelIconName; size?: number; className?: string }) {
  const g = glyph(name);
  return (
    <svg
      viewBox={`0 0 ${g.size} ${g.size}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path d={g.outline} fill={OUTLINE} />
      {g.fills.map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

/** Pixel glyph inside a small honeycomb badge (module rows, project tiles). */
export function GlyphBadge({ name, className, size = 20 }: { name: PixelIconName; className?: string; size?: number }) {
  return (
    <span className={cn("cm-glyph", className)} aria-hidden="true">
      <PixelIcon name={name} size={size} />
    </span>
  );
}
