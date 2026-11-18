/**
 * Choices offered by the avatar builder. Order matters: an avatar is stored as the list of
 * indices below (see code.ts), so new options are appended, never inserted or removed.
 */

export type Option = { id: string; label: string };
export type ColorOption = Option & { color: string };

const o = (pairs: string): Option[] => pairs.split("|").map((p) => ({ id: p.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: p.trim() }));
const c = (list: [string, string][]): ColorOption[] => list.map(([label, color]) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, color }));

export const SKIN_TONES = c([
  ["Porcelain", "#ffe3cc"], ["Ivory", "#f9d4b4"], ["Peach", "#f2c29f"], ["Sand", "#e9b089"], ["Honey", "#dc9c6e"], ["Golden", "#cc8a59"],
  ["Caramel", "#b97549"], ["Bronze", "#a3633c"], ["Chestnut", "#8c5132"], ["Cocoa", "#734229"], ["Espresso", "#5c3420"], ["Ebony", "#47281a"],
  ["Rose beige", "#f4cdb8"], ["Olive", "#c8a27a"], ["Deep olive", "#9a7550"], ["Mahogany", "#6b3a2a"],
]);

export const HAIR_COLORS = c([
  ["Black", "#2b1e1b"], ["Dark brown", "#4a2e1f"], ["Brown", "#6f4429"], ["Chestnut", "#8b4e2b"], ["Auburn", "#a3452b"], ["Ginger", "#d06d2c"],
  ["Copper", "#bb5a23"], ["Honey blonde", "#d9a441"], ["Blonde", "#ebc86d"], ["Platinum", "#efe2c4"], ["Gray", "#9c968f"], ["White", "#ece7df"],
  ["Pink", "#f0a3c0"], ["Lavender", "#b39be6"], ["Teal", "#46ab9e"], ["Blue", "#4d78d6"], ["Green", "#69a84f"], ["Red", "#c8333a"],
]);

export const EYE_COLORS = c([
  ["Brown", "#5c3a24"], ["Dark", "#2b1d16"], ["Hazel", "#8a6a2f"], ["Amber", "#c98a2b"], ["Green", "#4f8a4a"], ["Blue", "#3f74c9"],
  ["Gray", "#7d8a96"], ["Violet", "#8a5fc0"], ["Teal", "#2f9c95"], ["Light blue", "#7fb2e8"], ["Honey", "#d9a441"],
]);

export const CLOTHING_COLORS = c([
  ["Honey", "#f2b23a"], ["Cocoa", "#6b4226"], ["Cream", "#f1e2bd"], ["Sage", "#8bae7a"], ["Forest", "#3f6b3a"], ["Teal", "#3f8f8a"],
  ["Navy", "#2f4a7a"], ["Sky", "#6fa8dc"], ["Coral", "#e07a5f"], ["Red", "#c0453a"], ["Rose", "#d9748f"], ["Lavender", "#a58ad6"],
  ["Mustard", "#c9a227"], ["Charcoal", "#3e3a3a"], ["White", "#f5f1e8"], ["Terracotta", "#c2673f"],
  ["Olive", "#7d8a3c"], ["Plum", "#7a3f6e"], ["Peach", "#f2b28e"], ["Black", "#26201e"],
]);

export const BACKGROUNDS = o(
  "Amber|Lavender|Turquoise|Coral|Sage|Rose|Sky|Cream|Honeycomb|Mint honeycomb|Sunset|Starry night|Meadow|Azulejo tiles|Honey stripes|Polka dots|Peach|Mint|Lilac|Butter|Slate|Terracotta",
);
export const FACES = o("Round|Oval|Square|Long|Heart|Wide");
export const HAIRSTYLES = o(
  "Short|Buzz cut|Side part|Bangs|Curly short|Afro|Long straight|Long wavy|Long curly|Bob|Pixie|Ponytail|Bun|Space buns|Braids|Mohawk|Locs|Undercut|Top knot|Bald|Curtain bangs|Afro puff",
);
export const EYES = o("Round|Almond|Big and bright|Dot|Sleepy|Happy|Wink|Lashes");
export const BROWS = o("Natural|Thick|Arched|Thin|Raised");
export const NOSES = o("Button|Line|Round|Pointed|Wide|Small");
export const MOUTHS = o("Smile|Big smile|Neutral|Laugh|Smirk|Calm|Tongue out");
export const FACIAL_HAIR = o("None|Stubble|Mustache|Handlebar mustache|Goatee|Short beard|Full beard|Chinstrap");
export const FACE_DETAILS = o("None|Blush|Freckles|Blush and freckles|Beauty mark|Bee face paint");
export const CLOTHING = o(
  "T-shirt|V-neck|Hoodie|Sweater|Turtleneck|Collared shirt|Blazer|Overalls|Beekeeper suit|Tank top|Zip jacket|Apron",
);
export const GLASSES = o("None|Round glasses|Square glasses|Sunglasses|Cat-eye glasses|Half-rim glasses|Heart sunglasses");
export const ACCESSORIES = o("None|Headphones|Scarf|Bee pin|Flower behind ear|Pencil behind ear|Earbuds|Bow tie|Bee on shoulder");
export const JEWELRY = o("None|Stud earrings|Hoop earrings|Drop earrings|Nose ring|Necklace|Honey pendant|Pearls");
export const HATS = o("None|Beekeeper hat|Beanie|Cap|Bee antennae|Straw hat|Bandana|Beret|Crown|Flower crown|Headscarf|Graduation cap|Party hat");

/** Everything the builder lets you choose, in storage order. */
export const AVATAR_FIELDS = [
  { key: "background", label: "Background", options: BACKGROUNDS },
  { key: "skin", label: "Skin tone", options: SKIN_TONES },
  { key: "face", label: "Face shape", options: FACES },
  { key: "hair", label: "Hairstyle", options: HAIRSTYLES },
  { key: "hairColor", label: "Hair color", options: HAIR_COLORS },
  { key: "eyes", label: "Eyes", options: EYES },
  { key: "eyeColor", label: "Eye color", options: EYE_COLORS },
  { key: "brows", label: "Eyebrows", options: BROWS },
  { key: "nose", label: "Nose", options: NOSES },
  { key: "mouth", label: "Mouth", options: MOUTHS },
  { key: "facialHair", label: "Beard & mustache", options: FACIAL_HAIR },
  { key: "details", label: "Face details", options: FACE_DETAILS },
  { key: "clothing", label: "Clothing", options: CLOTHING },
  { key: "clothingColor", label: "Clothing color", options: CLOTHING_COLORS },
  { key: "glasses", label: "Glasses", options: GLASSES },
  { key: "accessory", label: "Accessories", options: ACCESSORIES },
  { key: "jewelry", label: "Jewelry", options: JEWELRY },
  { key: "hat", label: "Hat", options: HATS },
] as const;

export type AvatarFieldKey = (typeof AVATAR_FIELDS)[number]["key"];
export type AvatarConfig = Record<AvatarFieldKey, number>;

export const DEFAULT_AVATAR: AvatarConfig = {
  background: 0, skin: 4, face: 0, hair: 0, hairColor: 2, eyes: 0, eyeColor: 0, brows: 0, nose: 0, mouth: 0,
  facialHair: 0, details: 0, clothing: 0, clothingColor: 0, glasses: 0, accessory: 0, jewelry: 0, hat: 0,
};
