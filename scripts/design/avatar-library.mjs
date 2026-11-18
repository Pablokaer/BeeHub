import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Library of catalog portraits in the approved Colmeia style.
 *
 *   node scripts/design/avatar-library.mjs plan          # (re)creates the 80-portrait plan (only if missing)
 *   node scripts/design/avatar-library.mjs prompts       # writes the image-generation prompts, one per 2×2 sheet
 *   node scripts/design/avatar-library.mjs ingest <dir>  # imports sheets named lote-01.png … lote-20.png
 *   node scripts/design/avatar-library.mjs tag           # writes traits for the 8 original portraits
 *
 * Every portrait carries traits (skin, hair, beard, glasses, headwear…), stored in the catalog
 * manifest, so the avatar studio can filter the library while keeping the hand-made quality.
 */
const PLAN = "docs/design/colmeia/retratos-plano.json";
const PROMPTS = "docs/design/colmeia/prompts-retratos.md";
// Overridable for dry runs: AVATAR_MANIFEST=/tmp/x.json AVATAR_OUT=/tmp/avatars node … ingest <dir>
const MANIFEST = process.env.AVATAR_MANIFEST ?? "public/brand/colmeia/catalogo.json";
const OUT = process.env.AVATAR_OUT ?? "public/brand/colmeia/avatares";

// Trait vocabulary: id → [English for prompts, Portuguese for labels and alt text].
export const TRAITS = {
  presentation: { feminine: ["woman", "mulher"], masculine: ["man", "homem"], androgynous: ["person", "pessoa"] },
  age: { young: ["young adult", "jovem"], adult: ["adult", "adulta"], senior: ["older", "mais velha"] },
  skin: {
    light: ["fair skin", "pele clara"], "light-medium": ["light olive skin", "pele clara oliva"], medium: ["warm tan skin", "pele morena clara"],
    "medium-dark": ["light-brown skin", "pele morena"], dark: ["brown skin", "pele marrom"], deep: ["deep dark-brown skin", "pele retinta"],
  },
  hair: {
    short: ["short neat hair", "cabelo curto"], "curly-short": ["short curly hair", "cachos curtos"], afro: ["a big rounded afro", "black power"],
    "long-straight": ["long straight hair", "cabelo longo liso"], "long-wavy": ["long wavy hair", "cabelo longo ondulado"], "long-curly": ["long voluminous curls", "cachos longos"],
    braids: ["long box braids", "tranças"], locs: ["shoulder-length locs", "dreadlocks"], bun: ["hair in a high bun", "coque"], ponytail: ["a swinging ponytail", "rabo de cavalo"],
    bob: ["a chin-length bob", "chanel"], buzz: ["a close buzz cut", "raspado"], bald: ["a shaved bald head", "careca"], undercut: ["an undercut with a swept top", "undercut"],
    pixie: ["a short pixie cut", "pixie"], covered: ["hair fully covered by the headwear", "cabelo coberto"],
  },
  hairColor: {
    black: ["black", "preto"], "dark-brown": ["dark brown", "castanho escuro"], brown: ["chestnut brown", "castanho"], auburn: ["auburn", "acaju"],
    ginger: ["copper ginger", "ruivo"], blonde: ["honey blonde", "loiro"], gray: ["silver gray", "grisalho"], white: ["snow white", "branco"],
    pink: ["dyed pastel pink", "rosa"], blue: ["dyed cobalt blue", "azul"], purple: ["dyed lavender", "lilás"], green: ["dyed mint green", "verde"], none: ["", ""],
  },
  facialHair: { none: ["", ""], stubble: ["light stubble", "barba por fazer"], mustache: ["a tidy mustache", "bigode"], beard: ["a full trimmed beard", "barba cheia"], goatee: ["a small goatee", "cavanhaque"] },
  glasses: { none: ["", ""], round: ["round wire glasses", "óculos redondos"], square: ["chunky square glasses", "óculos quadrados"], sunglasses: ["honey-tinted sunglasses", "óculos escuros"] },
  headwear: {
    none: ["", ""], "beekeeper-hat": ["a beekeeper hat with a folded-up veil", "chapéu de apicultor"], "straw-hat": ["a woven straw sun hat", "chapéu de palha"],
    beanie: ["a knitted beanie", "gorro"], cap: ["a canvas cap", "boné"], bandana: ["a patterned bandana", "bandana"], headscarf: ["a softly draped headscarf", "lenço na cabeça"],
    "flower-crown": ["a small wildflower crown", "coroa de flores"], "bee-antennae": ["a bee antennae headband", "antenas de abelha"],
  },
  accessory: {
    none: ["", ""], earrings: ["small gold hoop earrings", "brincos"], "nose-ring": ["a tiny nose ring", "piercing no nariz"], necklace: ["a honey-drop pendant necklace", "colar"],
    headphones: ["headphones resting around the neck", "fones de ouvido"], flower: ["a flower tucked behind one ear", "flor na orelha"], "bee-pin": ["a tiny enamel bee pin", "broche de abelha"],
    freckles: ["freckles across the cheeks", "sardas"],
  },
  clothing: {
    "beekeeper-suit": ["a cream beekeeper jacket with {c} trim", "jaqueta de apicultor"], apron: ["a {c} work apron over a cream shirt", "avental"], hoodie: ["a cozy {c} hoodie", "moletom"],
    jacket: ["a {c} utility jacket", "jaqueta"], sweater: ["a chunky {c} knit sweater", "suéter"], shirt: ["a {c} collared shirt", "camisa"], overalls: ["{c} overalls over a cream shirt", "macacão"],
    scarf: ["a striped {c} scarf over a coat", "cachecol"], vest: ["a quilted {c} vest", "colete"], turtleneck: ["a {c} turtleneck", "gola alta"],
  },
  clothingColor: {
    honey: ["honey", "mel"], sage: ["sage green", "verde-sálvia"], teal: ["deep teal", "verde-azulado"], navy: ["navy", "azul-marinho"], coral: ["coral", "coral"],
    lavender: ["lavender", "lavanda"], mustard: ["mustard", "mostarda"], terracotta: ["terracotta", "terracota"], cream: ["cream", "creme"], plum: ["plum", "ameixa"],
    sky: ["soft sky blue", "azul-céu"], olive: ["olive green", "verde-oliva"],
  },
  background: {
    amber: ["warm amber", "âmbar"], sage: ["faded sage green", "verde-sálvia"], plum: ["plum", "ameixa"], coral: ["coral rose", "coral"], teal: ["deep teal", "verde-azulado"],
    sky: ["soft sky blue", "azul-céu"], lavender: ["lavender", "lavanda"], mint: ["mint", "menta"], peach: ["peach", "pêssego"], butter: ["butter yellow", "amarelo-manteiga"],
  },
};

const k = (field) => Object.keys(TRAITS[field]);

/** Balanced plan: each trait cycles with a different stride, then a few rules keep it coherent. */
function makePlan(n = 80) {
  const pick = (field, i, stride, offset = 0) => k(field)[(i * stride + offset) % k(field).length];
  const plan = [];
  for (let i = 0; i < n; i++) {
    const t = {
      presentation: pick("presentation", i, 1),
      age: ["adult", "young", "adult", "senior", "young"][i % 5],
      skin: pick("skin", i, 5, Math.floor(i / 6)),
      hair: pick("hair", i, 7).replace("covered", "short"),
      hairColor: ["black", "dark-brown", "brown", "black", "auburn", "ginger", "blonde", "dark-brown", "gray", "pink", "blue", "purple", "green", "brown", "white"][(i * 4 + 1) % 15],
      facialHair: "none",
      glasses: ["none", "none", "round", "none", "square", "none", "sunglasses"][(i * 3) % 7],
      headwear: ["none", "none", "beekeeper-hat", "none", "straw-hat", "beanie", "none", "bandana", "cap", "flower-crown", "none", "headscarf", "bee-antennae"][(i * 5 + 2) % 13],
      accessory: pick("accessory", i, 3, 1),
      clothing: pick("clothing", i, 3),
      clothingColor: pick("clothingColor", i, 7, 3),
      background: pick("background", i, 3, Math.floor(i / 10)),
    };
    if (t.presentation !== "feminine") t.facialHair = ["none", "beard", "stubble", "mustache", "none", "goatee"][Math.floor(i / 3) % 6];
    if (t.headwear === "headscarf") {
      t.hair = "covered";
      t.hairColor = "none";
    }
    if (t.hair === "bald" || t.hair === "buzz") {
      if (t.headwear === "headscarf") t.headwear = "none";
      if (t.hair === "bald") t.hairColor = "none";
    }
    if (t.age === "senior" && ["pink", "blue", "purple", "green"].includes(t.hairColor)) t.hairColor = i % 2 ? "gray" : "white";
    if (t.age === "senior" && t.headwear === "bee-antennae") t.headwear = "none";
    if (t.background === t.clothingColor) t.background = k("background")[(k("background").indexOf(t.background) + 4) % 10];
    // Four different backgrounds per sheet, so neighbours never blend into one another.
    const used = plan.filter((p) => p.batch === Math.floor(i / 4) + 1).map((p) => p.traits.background);
    while (used.includes(t.background) || t.background === t.clothingColor) t.background = k("background")[(k("background").indexOf(t.background) + 3) % k("background").length];
    plan.push({ id: `retrato-${String(i + 1).padStart(3, "0")}`, batch: Math.floor(i / 4) + 1, slot: ["top left", "top right", "bottom left", "bottom right"][i % 4], traits: t });
  }
  return plan;
}

const en = (field, v) => TRAITS[field][v]?.[0] ?? "";
const pt = (field, v) => TRAITS[field][v]?.[1] ?? "";

function describe(t) {
  const hair = t.hair === "covered" ? en("hair", t.hair) : t.hair === "bald" ? en("hair", "bald") : `${en("hair", t.hair)} in ${en("hairColor", t.hairColor)}`;
  const parts = [
    `${en("age", t.age)} ${en("presentation", t.presentation)} with ${en("skin", t.skin)}${t.age === "senior" ? " and a few smile lines" : ""}`,
    hair,
    en("facialHair", t.facialHair),
    en("glasses", t.glasses),
    en("headwear", t.headwear) && `wearing ${en("headwear", t.headwear)}`,
    en("clothing", t.clothing).replace("{c}", en("clothingColor", t.clothingColor)),
    en("accessory", t.accessory),
  ].filter(Boolean);
  return `${parts.join(", ")}, against a ${en("background", t.background)} tile`;
}

/** Short Portuguese label (catalog tiles) and alt text. */
function label(t) {
  const dyed = ["pink", "blue", "purple", "green", "white", "gray", "ginger", "blonde"].includes(t.hairColor);
  const hair = t.hair === "covered" ? pt("headwear", t.headwear) : `${pt("hair", t.hair)}${dyed && t.hair !== "bald" ? " " + pt("hairColor", t.hairColor) : ""}`;
  const extra = [t.hair === "covered" ? "none" : t.headwear, t.glasses, t.facialHair, t.accessory].map((v, i) => (v && v !== "none" ? pt(["headwear", "glasses", "facialHair", "accessory"][i], v) : "")).find(Boolean);
  const s = extra ? `${hair} e ${extra}` : `${hair}, ${pt("clothing", t.clothing)} ${pt("clothingColor", t.clothingColor)}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function alt(t) {
  const bits = [
    `${pt("presentation", t.presentation).replace(/^./, (c) => c.toUpperCase())} ${pt("age", t.age)} de ${pt("skin", t.skin)}`,
    t.hair === "covered" ? "" : t.hair === "bald" ? "careca" : `${pt("hair", t.hair)} ${pt("hairColor", t.hairColor)}`.trim(),
    pt("facialHair", t.facialHair),
    pt("glasses", t.glasses),
    pt("headwear", t.headwear),
    `${pt("clothing", t.clothing)} ${pt("clothingColor", t.clothingColor)}`,
    pt("accessory", t.accessory),
  ].filter(Boolean);
  return `${bits.join(", ")}, sobre fundo ${pt("background", t.background)}`;
}

const STYLE =
  "Use case stylized-concept. A new set of FOUR unique pixel art user avatar choices for a beehive community app. One square output divided precisely in a 2x2 grid with four equal square full-bleed tiles, no gutters and no grid line. Each tile one centered original bust, face centered in the quadrant with breathing room for cropping into a tight hex mask.";
const CLOSE =
  "Mature friendly faces and clearly different silhouettes. True chunky pixel-cluster portraits like a 48 by 48 grid, selective black brown contours, limited deliberately shaped palette, the size and framing of the attached approved portrait sheet. No text, no caps with writing, no words, no decor outside tiles, no logo or UI. Add no extra characters.";

function writePrompts(plan) {
  const batches = new Map();
  for (const p of plan) batches.set(p.batch, [...(batches.get(p.batch) ?? []), p]);
  let md = `# Prompts dos retratos do catálogo

Gere cada lote no mesmo gerador usado nos avatares atuais, **anexando \`reference/avatares-aprovados.png\`** como referência de estilo. Salve cada imagem como \`lote-01.png\`, \`lote-02.png\`… numa pasta e rode:

\`\`\`bash
node scripts/design/avatar-library.mjs ingest <pasta>
\`\`\`

O script recorta os quatro quadrantes na ordem do prompt (superior esquerdo, superior direito, inferior esquerdo, inferior direito), padroniza em 256 × 256 WebP e cadastra cada retrato no catálogo com as características do plano (\`retratos-plano.json\`). Se um retrato sair diferente do pedido (por exemplo, sem óculos), corrija as características dele no plano antes de importar, para os filtros ficarem certos. Um lote pode ser refeito e importado de novo; o retrato é substituído.

`;
  for (const [n, items] of batches) {
    const body = items.map((p) => `${p.slot.toUpperCase()} ${describe(p.traits)}.`).join(" ");
    md += `## Lote ${String(n).padStart(2, "0")}\n\n${items.map((p) => `- \`${p.id}\` (${p.slot}): ${label(p.traits)}`).join("\n")}\n\n> ${STYLE} ${body} ${CLOSE}\n\n`;
  }
  writeFileSync(PROMPTS, md);
  console.log(`${PROMPTS}: ${batches.size} prompts`);
}

async function ingest(dir) {
  const plan = JSON.parse(readFileSync(PLAN, "utf8"));
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  mkdirSync(OUT, { recursive: true });
  const sheets = readdirSync(dir).filter((f) => /^lote-\d+\.(png|jpe?g|webp)$/i.test(f)).sort();
  if (!sheets.length) throw new Error(`No lote-XX images in ${dir}`);
  for (const sheet of sheets) {
    const batch = Number(sheet.match(/\d+/)[0]);
    const items = plan.filter((p) => p.batch === batch);
    const img = sharp(path.join(dir, sheet));
    const { width, height } = await img.metadata();
    const side = Math.min(width, height);
    const half = Math.floor(side / 2);
    for (const [i, p] of items.entries()) {
      const left = Math.floor((width - side) / 2) + (i % 2) * half;
      const top = Math.floor((height - side) / 2) + Math.floor(i / 2) * half;
      // A thin inset avoids bleeding from the neighbouring tile.
      const inset = Math.round(half * 0.01);
      const file = `${OUT}/${p.id}.webp`;
      await sharp(path.join(dir, sheet))
        .extract({ left: left + inset, top: top + inset, width: half - 2 * inset, height: half - 2 * inset })
        .resize(256, 256, { kernel: "lanczos3" })
        .webp({ quality: 90 })
        .toFile(file);
      const entry = { id: p.id, label: label(p.traits), src: `/brand/colmeia/avatares/${p.id}.webp`, width: 256, height: 256, alt: alt(p.traits), traits: p.traits };
      const at = manifest.avatars.findIndex((a) => a.id === p.id);
      if (at >= 0) manifest.avatars[at] = entry;
      else manifest.avatars.push(entry);
      console.log(`${file}  ${entry.label}`);
    }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
}

/** Traits of the eight portraits that were drawn before the library existed. */
const ORIGINAL_TRAITS = {
  "apicultora-ambar": { presentation: "feminine", age: "young", skin: "medium-dark", hair: "long-curly", hairColor: "dark-brown", facialHair: "none", glasses: "none", headwear: "bee-antennae", accessory: "earrings", clothing: "scarf", clothingColor: "honey", background: "amber" },
  "flor-de-lavanda": { presentation: "feminine", age: "young", skin: "light", hair: "curly-short", hairColor: "ginger", facialHair: "none", glasses: "none", headwear: "none", accessory: "flower", clothing: "apron", clothingColor: "lavender", background: "plum" },
  "oculos-dourados": { presentation: "masculine", age: "adult", skin: "medium-dark", hair: "short", hairColor: "black", facialHair: "beard", glasses: "round", headwear: "none", accessory: "none", clothing: "shirt", clothingColor: "olive", background: "teal" },
  "chapeu-de-palha": { presentation: "masculine", age: "young", skin: "medium", hair: "short", hairColor: "black", facialHair: "none", glasses: "none", headwear: "beekeeper-hat", accessory: "none", clothing: "beekeeper-suit", clothingColor: "cream", background: "coral" },
  "bandana-verde": { presentation: "masculine", age: "adult", skin: "medium-dark", hair: "curly-short", hairColor: "dark-brown", facialHair: "beard", glasses: "none", headwear: "none", accessory: "none", clothing: "beekeeper-suit", clothingColor: "honey", background: "sage" },
  "oculos-terracota": { presentation: "feminine", age: "adult", skin: "light-medium", hair: "bob", hairColor: "black", facialHair: "none", glasses: "round", headwear: "none", accessory: "none", clothing: "hoodie", clothingColor: "cream", background: "plum" },
  "lenco-lilas": { presentation: "androgynous", age: "senior", skin: "medium", hair: "short", hairColor: "gray", facialHair: "none", glasses: "none", headwear: "none", accessory: "freckles", clothing: "hoodie", clothingColor: "sky", background: "coral" },
  "trancas-e-acafrao": { presentation: "feminine", age: "adult", skin: "dark", hair: "braids", hairColor: "black", facialHair: "none", glasses: "none", headwear: "none", accessory: "earrings", clothing: "vest", clothingColor: "mustard", background: "teal" },
};

const [cmd, arg] = process.argv.slice(2);
if (cmd === "plan") {
  if (existsSync(PLAN)) console.log(`${PLAN} exists; edit it by hand or delete it to regenerate.`);
  else {
    writeFileSync(PLAN, JSON.stringify(makePlan(), null, 2) + "\n");
    console.log(`${PLAN}: 80 portraits`);
  }
} else if (cmd === "prompts") writePrompts(JSON.parse(readFileSync(PLAN, "utf8")));
else if (cmd === "ingest") await ingest(arg ?? "incoming/avatar-sheets");
else if (cmd === "tag") {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  for (const a of manifest.avatars) if (ORIGINAL_TRAITS[a.id]) a.traits = ORIGINAL_TRAITS[a.id];
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log("Tagged the original portraits.");
} else console.log("Usage: avatar-library.mjs plan | prompts | ingest <dir> | tag");
