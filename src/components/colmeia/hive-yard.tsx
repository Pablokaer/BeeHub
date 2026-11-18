/**
 * The little apiary at the bottom of the navigation rail (104 × 77 pixel scene from the
 * approved prototype), rendered as crisp SVG rectangles. Purely decorative.
 */
type Rect = [color: string, x: number, y: number, w: number, h: number];

function scene(): Rect[] {
  const out: Rect[] = [];
  const rect = (color: string, x: number, y: number, w: number, h: number) => out.push([color, x, y, w, h]);
  const stripes = [[46, 14, 18, 3], [41, 17, 29, 4], [36, 21, 39, 5], [30, 26, 51, 8], [25, 34, 61, 9], [20, 43, 71, 11], [16, 54, 79, 12], [19, 66, 74, 6]] as const;
  for (const [x, y, w, h] of stripes) rect("#5b311b", x - 2, y - 2, w + 4, h + 4);
  for (const [x, y, w, h] of stripes) {
    rect("#dd882b", x, y, w, h);
    rect("#ffcb57", x + 2, y, w - 8, h - 2);
    rect("#ffe999", x + 6, y + 1, Math.max(4, w - 22), 2);
    rect("#a95220", x + 5, y + h - 2, w - 8, 2);
    rect("#f4ae44", x + w - 10, y + 2, 6, h - 4 > 0 ? h - 4 : 1);
  }
  rect("#68371d", 51, 11, 11, 3); rect("#e99c36", 54, 9, 5, 3); rect("#ffe484", 54, 9, 3, 1);
  rect("#6d381d", 40, 52, 29, 23); rect("#6d381d", 43, 47, 23, 7);
  rect("#f5a437", 43, 53, 23, 20); rect("#ffcf5a", 46, 49, 17, 7);
  rect("#63391f", 46, 57, 17, 16); rect("#63391f", 49, 54, 11, 5);
  rect("#3c2519", 48, 57, 13, 16); rect("#855537", 48, 58, 2, 13);
  rect("#b6783e", 54, 56, 1, 15); rect("#f7ba49", 57, 65, 2, 2);
  rect("#743c1b", 78, 58, 10, 8); rect("#ffd96e", 79, 59, 8, 6); rect("#9e4c20", 82, 59, 2, 6);
  for (let x = 0; x < 104; x += 2) {
    const ridge = 67 + Math.round(3 * Math.sin(x / 7) + 2 * Math.cos(x / 3.6));
    if (x < 42 || x > 66) rect("#50643a", x, ridge, 2, 77 - ridge);
    rect("#78873e", x, ridge + 4, 2, 8);
    if (x % 6) rect("#a2a750", x + 1, 74 + (x % 3), 2, 2);
  }
  rect("#a67543", 35, 72, 37, 5); rect("#eabb75", 43, 71, 22, 5);
  rect("#d59254", 47, 74, 9, 2); rect("#f7d691", 49, 72, 14, 2);
  for (const [x, y, color] of [[5, 65, "#f7a4a0"], [12, 70, "#fff0ae"], [22, 65, "#f4b2c1"], [31, 72, "#ffec9f"], [75, 71, "#f9c172"], [94, 68, "#f4a4a5"], [99, 72, "#fff0b3"], [82, 73, "#ffefa9"]] as const) {
    rect("#658c4b", x, y + 2, 1, 5); rect(color, x - 1, y + 1, 3, 1); rect(color, x, y, 1, 3);
    rect("#be7425", x, y + 1, 1, 1);
  }
  for (const [x, y] of [[25, 22], [20, 19], [16, 15], [17, 11], [21, 9], [27, 10], [33, 9], [38, 6], [43, 4]] as const) rect("#a56a34", x, y, 2, 1);
  return out;
}

/** Consecutive same-colour rects merged into one path; paint order is preserved. */
const PATHS: [string, string][] = (() => {
  const out: [string, string][] = [];
  for (const [c, x, y, w, h] of scene()) {
    const seg = `M${x} ${y}h${w}v${h}h${-w}z`;
    const last = out[out.length - 1];
    if (last && last[0] === c) last[1] += seg;
    else out.push([c, seg]);
  }
  return out;
})();

export function HiveYard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 104 77" className={className} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      {PATHS.map(([color, d], i) => (
        <path key={i} d={d} fill={color} />
      ))}
    </svg>
  );
}
