import type { ProjectCategory } from "@/generated/prisma/enums";
import { mediaUrl } from "@/lib/media";
import { EntityLogo } from "../ui/avatar";
import { GlyphBadge, type PixelIconName } from "./pixel-icon";

/** Pixel glyph and a calm tile colour per project category (used when there is no image). */
const CATEGORY_ART: Record<ProjectCategory, { icon: PixelIconName; bg: string }> = {
  AI_ML: { icon: "chip", bg: "#5c6f8a" },
  WEB: { icon: "screen", bg: "#4f7a74" },
  MOBILE: { icon: "phone", bg: "#6a5c8a" },
  GAMES: { icon: "gamepad", bg: "#8a5a6f" },
  DEVTOOLS: { icon: "screen", bg: "#5f6b52" },
  OPEN_SOURCE: { icon: "harbor", bg: "#3f6e7a" },
  FINTECH: { icon: "coin", bg: "#7a6a3c" },
  HEALTH: { icon: "heart", bg: "#8a5450" },
  EDUCATION: { icon: "study", bg: "#8a7aa8" },
  SOCIAL_IMPACT: { icon: "garden", bg: "#6b8264" },
  ECOMMERCE: { icon: "jar", bg: "#9a6a3c" },
  MEDIA: { icon: "image", bg: "#6f5a7a" },
  HARDWARE: { icon: "chip", bg: "#5a5f66" },
  BLOCKCHAIN: { icon: "coin", bg: "#5a6a8a" },
  RESEARCH: { icon: "search", bg: "#4f6a7a" },
  OTHER: { icon: "bee", bg: "#8a6a3c" },
};

/** Warm tint derived from the project name, behind a logo. */
function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 30% 42%)`;
}

/**
 * Project tile image, in order of preference: the project's cover (served through /api/media,
 * which applies the project's visibility), its logo on a tint of its own, or the category glyph.
 */
export function ProjectThumb({ project }: { project: { name: string; logoKey: string | null; coverKey: string | null; category: ProjectCategory } }) {
  const cover = mediaUrl(project.coverKey);
  if (cover) {
    return (
      <div className="cm-thumb" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover} alt="" loading="lazy" className="cm-thumb-cover" />
      </div>
    );
  }
  if (project.logoKey) {
    return (
      <div className="cm-thumb" style={{ background: tintFor(project.name) }} aria-hidden>
        <EntityLogo name={project.name} imageKey={project.logoKey} kind="project" size="lg" />
      </div>
    );
  }
  const art = CATEGORY_ART[project.category];
  return (
    <div className="cm-thumb" style={{ background: art.bg }} aria-hidden>
      <GlyphBadge name={art.icon} size={36} className="!h-[58px] !w-[62px]" />
    </div>
  );
}
