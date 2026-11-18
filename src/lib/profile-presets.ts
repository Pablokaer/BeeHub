/**
 * Quick picks shown under the profile's Skills, Interests and Languages fields. Clicking
 * one adds it like a typed value; skills and interests go through the same tag
 * normalization (aliases, canonical names) as anything typed.
 */

export const SKILL_PRESETS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "Go", "SQL",
  "UI/UX", "Figma", "Product Management", "Project Management", "Data Science", "Machine Learning",
  "DevOps", "Mobile Development", "Marketing", "Copywriting", "Sales", "Fundraising",
  "Community Management", "Research",
];

export const INTEREST_PRESETS = [
  "AI", "Education", "Sustainability", "Climate", "Health", "Fintech", "Open Source", "Social Impact",
  "Game Development", "Developer Tools", "E-commerce", "Media", "Mobility", "Music", "Science", "Startups",
];

export const LANGUAGE_PRESETS = [
  "English", "Portuguese", "Spanish", "French", "German", "Italian", "Dutch",
  "Mandarin", "Japanese", "Arabic", "Hindi", "Russian",
];

/** Presets not chosen yet, compared by the field's normalization (tag slug or lowercase). */
export function availablePresets(presets: readonly string[], chosen: readonly string[], key: (value: string) => string): string[] {
  const taken = new Set(chosen.map(key));
  return presets.filter((p) => !taken.has(key(p)));
}
