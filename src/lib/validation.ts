import { z } from "zod";
import { normalizeProfileLink } from "./profile-links";
import {
  ApplicationStatus,
  Availability,
  AudienceSetting,
  CollaborationType,
  Commitment,
  CompensationType,
  DurationEstimate,
  ExperienceLevel,
  MemberRole,
  MessagePermission,
  OpportunityCategory,
  OrgSize,
  OrgType,
  PostType,
  ProfileVisibility,
  ProjectCategory,
  ProjectStage,
  ProjectVisibility,
  ReportReason,
  ReportTarget,
  WorkMode,
} from "@/generated/prisma/enums";
import { HANDLE_RE, RESERVED_HANDLES } from "./slug";
import { MAX_TAG_LENGTH } from "./tags";
import { isArtId, type ArtKind } from "./art-catalog";

// ───────────── Primitives ─────────────

/** Optional trimmed string: "" becomes undefined. */
export const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters`)
    .transform((v) => (v ? v : undefined))
    .optional();

export const reqStr = (min: number, max: number, label = "This field") =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const optUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v ? v : undefined))
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full URL starting with https://")
  .optional();

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

const tagList = (max: number) =>
  z
    .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
    .max(max, `Choose at most ${max}`)
    .default([]);

const optEnum = <T extends Record<string, string>>(e: T) =>
  z
    .union([z.enum(e), z.literal("")])
    .transform((v) => (v ? (v as T[keyof T]) : undefined))
    .optional();

const optDate = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return d;
  })
  .optional();

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(HANDLE_RE, "3–40 characters: lowercase letters, numbers and dashes")
  .refine((v) => !RESERVED_HANDLES.has(v), "That name is reserved")
  .refine((v) => !v.includes("--"), "Avoid consecutive dashes");

export const emailSchema = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "Use at most 200 characters");

/** "user" | "org:<id>" | "project:<id>" – who is acting (posting, publishing). */
export const actingAsSchema = z
  .string()
  .trim()
  .regex(/^(user|org:[a-z0-9]+|project:[a-z0-9]+)$/i, "Invalid identity")
  .default("user");

export const profileLinkSchema = z.object({ label: reqStr(1, 40, "Label"), url: z.string().trim().min(1, "Enter a profile link").max(500) }).transform((link, ctx) => {
  try { return normalizeProfileLink(link); }
  catch (error) { ctx.addIssue({ code: "custom", path: ["url"], message: error instanceof Error ? error.message : "Enter a valid profile link" }); return z.NEVER; }
});

// ───────────── Auth ─────────────

/** Core credentials plus optional public profile links; the username is generated. */
export const signupSchema = z.object({
  displayName: reqStr(2, 80, "Name"),
  email: emailSchema,
  password: passwordSchema,
  links: z.array(profileLinkSchema).max(8).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), password: passwordSchema, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const changeEmailSchema = z.object({ email: emailSchema, currentPassword: z.string().min(1, "Enter your password") });

export const confirmPasswordSchema = z.object({ currentPassword: z.string().min(1, "Enter your password") });

// ───────────── Profile ─────────────



/** Optional catalog illustration id of one kind; unknown ids and ids of the other kind fail. */
const artId = (kind: ArtKind) =>
  optStr(80).refine((v) => v === undefined || isArtId(kind, v), kind === "avatar" ? "Choose an avatar from the illustration catalog" : "Choose a cover from the illustration catalog");

export const ART_CONFLICT_MESSAGE = "Use either an uploaded image or an illustration, not both";

export const profileSchema = z.object({
  displayName: reqStr(2, 80, "Name"),
  headline: optStr(120),
  bio: optStr(2000),
  location: optStr(80),
  languages: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  links: z.array(profileLinkSchema).max(8).default([]),
  availability: z.array(z.enum(Availability)).max(8).default([]),
  experienceLevel: optEnum(ExperienceLevel),
  preferredWorkModes: z.array(z.enum(WorkMode)).max(3).default([]),
  preferredCollabs: z.array(z.enum(CollaborationType)).max(10).default([]),
  skills: tagList(30),
  interests: tagList(20),
  avatarKey: optStr(200),
  coverKey: optStr(200),
  avatarArt: artId("avatar"),
  coverArt: artId("cover"),
}).superRefine((d, ctx) => {
  if (d.avatarKey && d.avatarArt) ctx.addIssue({ code: "custom", path: ["avatarArt"], message: ART_CONFLICT_MESSAGE });
  if (d.coverKey && d.coverArt) ctx.addIssue({ code: "custom", path: ["coverArt"], message: ART_CONFLICT_MESSAGE });
});

export const privacySchema = z.object({
  visibility: z.enum(ProfileVisibility),
  showLocation: checkbox,
  connectionsVisible: z.enum(AudienceSetting),
  messagePermission: z.enum(MessagePermission),
  followApproval: checkbox,
  searchable: checkbox,
});

export const experienceSchema = z
  .object({
    id: optStr(40),
    title: reqStr(2, 100, "Title"),
    company: reqStr(1, 100, "Company"),
    location: optStr(80),
    startDate: z.string().trim().min(1, "Start date is required").transform((v) => new Date(v)),
    endDate: optDate,
    description: optStr(1500),
  })
  .refine((d) => !d.endDate || d.endDate >= d.startDate, { message: "End date must be after start date", path: ["endDate"] });

const year = z.coerce.number().int().min(1950).max(2100);
export const educationSchema = z
  .object({
    id: optStr(40),
    school: reqStr(2, 120, "School"),
    degree: optStr(100),
    field: optStr(100),
    startYear: z.union([year, z.literal("")]).transform((v) => (v === "" ? undefined : v)).optional(),
    endYear: z.union([year, z.literal("")]).transform((v) => (v === "" ? undefined : v)).optional(),
    description: optStr(1000),
  })
  .refine((d) => !d.startYear || !d.endYear || d.endYear >= d.startYear, { message: "End year must be after start year", path: ["endYear"] });

// ───────────── Organizations ─────────────

export const organizationSchema = z.object({
  name: reqStr(2, 100, "Name"),
  slug: handleSchema,
  type: z.enum(OrgType),
  tagline: optStr(140),
  description: optStr(5000),
  industry: optStr(80),
  website: optUrl,
  location: optStr(80),
  size: optEnum(OrgSize),
  tags: tagList(20),
  logoKey: optStr(200),
  coverKey: optStr(200),
});

// ───────────── Projects ─────────────

export const projectSchema = z.object({
  name: reqStr(2, 100, "Name"),
  slug: handleSchema,
  summary: reqStr(10, 200, "Summary"),
  description: optStr(10000),
  goals: optStr(3000),
  needs: optStr(3000),
  category: z.enum(ProjectCategory),
  stage: z.enum(ProjectStage),
  visibility: z.enum(ProjectVisibility),
  websiteUrl: optUrl,
  repoUrl: optUrl,
  isOpenSource: checkbox,
  acceptsBeginners: checkbox,
  organizationId: optStr(40),
  tech: tagList(20),
  topics: tagList(15),
  logoKey: optStr(200),
  coverKey: optStr(200),
});

export const memberRoleSchema = z.enum(MemberRole);

export const inviteSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter a username").max(40),
  role: z.enum(MemberRole).refine((r) => r !== "OWNER", "Invite as admin, editor or member"),
  title: optStr(80),
  message: optStr(500),
});

// ───────────── Opportunities ─────────────

export const opportunitySchema = z.object({
  owner: actingAsSchema,
  title: reqStr(5, 120, "Title"),
  description: reqStr(20, 8000, "Description"),
  category: z.enum(OpportunityCategory),
  collaborationType: z.enum(CollaborationType),
  workMode: z.enum(WorkMode),
  location: optStr(80),
  experienceLevel: optEnum(ExperienceLevel),
  duration: optEnum(DurationEstimate),
  commitment: optEnum(Commitment),
  compensationType: z.enum(CompensationType).default("NONE"),
  compensation: optStr(120),
  deadline: optDate,
  skills: tagList(15).refine((v) => v.length > 0, "Add at least one skill"),
  topics: tagList(10),
  publish: checkbox,
});

export const applicationSchema = z.object({
  opportunityId: z.string().min(1).max(40),
  message: reqStr(20, 3000, "Message"),
  portfolioUrl: optUrl,
  organizationId: optStr(40),
});

export const applicationStatusSchema = z.object({
  applicationId: z.string().min(1).max(40),
  status: z.enum(ApplicationStatus),
  note: optStr(500),
});

// ───────────── Social ─────────────

export const postSchema = z
  .object({
    actingAs: actingAsSchema,
    type: z.enum(PostType).default("TEXT"),
    body: z.string().trim().max(3000, "Posts can be at most 3,000 characters").default(""),
    linkUrl: optUrl,
    imageKeys: z.array(z.string().max(200)).max(4, "Up to 4 images").default([]),
    opportunityId: optStr(40),
    repostOfId: optStr(40),
  })
  .refine((d) => d.body.length > 0 || d.imageKeys.length > 0 || !!d.repostOfId || !!d.linkUrl, {
    message: "Write something or add an image",
    path: ["body"],
  });

export const commentSchema = z.object({
  postId: z.string().min(1).max(40),
  parentId: optStr(40),
  body: reqStr(1, 1500, "Comment"),
});

export const messageSchema = z.object({ body: reqStr(1, 4000, "Message") });

export const reportSchema = z.object({
  targetType: z.enum(ReportTarget),
  targetId: z.string().min(1).max(40),
  reason: z.enum(ReportReason),
  details: optStr(1000),
});

export const partnershipRequestSchema = z.object({
  from: actingAsSchema,
  targetType: z.enum(["project", "org"]),
  targetId: z.string().min(1).max(40),
  message: optStr(1000),
});

// ───────────── Form helpers ─────────────

/**
 * Converts FormData into a plain object. Fields listed in `arrays` are always arrays
 * (from repeated inputs). Fields named `foo[].bar` are collected into arrays of objects.
 */
export function formToObject(formData: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const grouped: Record<string, Record<string, string[]>> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    const m = key.match(/^(\w+)\[\]\.(\w+)$/);
    if (m) {
      grouped[m[1]] ??= {};
      (grouped[m[1]][m[2]] ??= []).push(value);
      continue;
    }
    if (arrays.includes(key)) {
      const arr = (out[key] as string[] | undefined) ?? [];
      arr.push(value);
      out[key] = arr;
    } else {
      out[key] = value;
    }
  }
  for (const a of arrays) if (!(a in out)) out[a] = [];
  for (const [name, cols] of Object.entries(grouped)) {
    const len = Math.max(...Object.values(cols).map((c) => c.length));
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, string> = {};
      let empty = true;
      for (const [col, vals] of Object.entries(cols)) {
        row[col] = vals[i] ?? "";
        if (row[col].trim()) empty = false;
      }
      if (!empty) rows.push(row);
    }
    out[name] = rows;
  }
  return out;
}

/** Flattens zod issues into { field: firstMessage }. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? String(issue.path[0]) : "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
