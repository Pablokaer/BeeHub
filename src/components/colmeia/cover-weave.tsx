/**
 * Neutral cover for members who have not chosen one: a pixel honeycomb texture (small cells
 * in offset rows, two fills and a shaded base) in one of three calm tones. Decorative only.
 */
const CELL = ["..XXXX..", ".XaaaaX.", "XaaaaaaX", "XaaaaaaX", "XssssssX", ".XssssX.", "..XXXX.."];
// Low contrast between cells and background keeps the texture calm; a few honey cells give
// the brand accent without competing with chosen artwork elsewhere on the page.
const TONES = [
  { bg: "#4a3858", edge: "#5e4870", fills: ["#56426a", "#634d78"], shade: "#4f3c60", honey: "#d9a24a" },
  { bg: "#1f4744", edge: "#2d5f5a", fills: ["#285651", "#31655f"], shade: "#234e4a", honey: "#d9a24a" },
  { bg: "#4e361d", edge: "#6a4a27", fills: ["#5b4022", "#684a29"], shade: "#523a1f", honey: "#e7b04f" },
] as const;
const W = 120;
const H = 42;

function build(t: (typeof TONES)[number]) {
  const paths = { edge: "", a: "", b: "", shade: "", honey: "" };
  let n = 0;
  for (let row = 0, y = -2; y < H; row++, y += 6) {
    for (let x = row % 2 ? -5 : 0; x < W; x += 10) {
      n++;
      // Deterministic sprinkle: some cells are left empty, the rest alternate between two fills.
      if ((n * 7 + row * 3) % 11 === 0) continue;
      const fill = (n * 13 + row * 5) % 17 === 0 ? "honey" : (n * 5 + row) % 3 === 0 ? "b" : "a";
      CELL.forEach((line, dy) =>
        [...line].forEach((ch, dx) => {
          if (ch === ".") return;
          const key = ch === "X" ? "edge" : ch === "s" && fill !== "honey" ? "shade" : fill;
          paths[key as keyof typeof paths] += `M${x + dx} ${y + dy}h1v1h-1z`;
        }),
      );
    }
  }
  return [
    [t.edge, paths.edge],
    [t.fills[0], paths.a],
    [t.fills[1], paths.b],
    [t.shade, paths.shade],
    [t.honey, paths.honey],
  ] as const;
}

const RENDERED = TONES.map(build);

export function CoverWeave({ tone }: { tone: number }) {
  const t = TONES[tone % TONES.length]!;
  return (
    <svg className="absolute inset-0 size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges" aria-hidden="true" focusable="false" style={{ background: t.bg }}>
      {RENDERED[tone % TONES.length]!.map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}
