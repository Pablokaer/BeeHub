import type {
  Availability,
  CollaborationType,
  Commitment,
  CompensationType,
  DurationEstimate,
  ExperienceLevel,
  MemberRole,
  OpportunityCategory,
  OpportunityStatus,
  OrgSize,
  OrgType,
  PostType,
  ProjectCategory,
  ProjectStage,
  ApplicationStatus,
  ReportReason,
  WorkMode,
  NotificationType,
} from "@/generated/prisma/enums";

export const siteConfig = {
  name: "BeeHub",
  tagline: "Turn skills, ideas and needs into real collaboration.",
  description:
    "BeeHub connects people, projects and organizations with complementary skills so they can form teams, partnerships and new projects.",
};

type Labels<T extends string> = Record<T, string>;

export const availabilityLabels: Labels<Availability> = {
  OPEN_TO_COLLABORATE: "Open to collaborate",
  LOOKING_FOR_PROJECTS: "Looking for projects",
  HIRING_FREELANCERS: "Looking for freelancers",
  OPEN_TO_PAID_WORK: "Available for paid work",
  OPEN_TO_VOLUNTEER: "Interested in volunteer projects",
  LOOKING_FOR_COFOUNDERS: "Looking for co-founders",
  OPEN_TO_NETWORKING: "Open to networking",
  UNAVAILABLE: "Not available right now",
};

export const experienceLabels: Labels<ExperienceLevel> = {
  BEGINNER: "Beginner / student",
  JUNIOR: "Junior",
  MID: "Mid-level",
  SENIOR: "Senior",
  EXPERT: "Expert / lead",
};

export const workModeLabels: Labels<WorkMode> = {
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  ONSITE: "On-site",
};

export const collaborationLabels: Labels<CollaborationType> = {
  PAID: "Paid work",
  FREELANCE: "Freelance",
  VOLUNTEER: "Volunteer",
  PROJECT_PARTNERSHIP: "Project partnership",
  BUSINESS_PARTNERSHIP: "Business partnership",
  COFOUNDER: "Co-founder",
  INTERNSHIP: "Internship",
  ACADEMIC: "Academic collaboration",
  MENTORSHIP: "Mentorship",
  SERVICE_EXCHANGE: "Service exchange",
};

export const opportunityCategoryLabels: Labels<OpportunityCategory> = {
  ENGINEERING: "Engineering",
  DESIGN: "Design",
  PRODUCT: "Product",
  MARKETING: "Marketing",
  SALES_BUSINESS: "Sales & business",
  OPERATIONS: "Operations",
  RESEARCH: "Research",
  CONTENT: "Content",
  INVESTMENT: "Investment",
  TESTING_QA: "Testing & QA",
  PARTNERSHIP: "Partnership",
  OTHER: "Other",
};

export const opportunityStatusLabels: Labels<OpportunityStatus> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
  FILLED: "Filled",
  ARCHIVED: "Archived",
  REMOVED: "Removed",
};

export const durationLabels: Labels<DurationEstimate> = {
  ONE_OFF: "One-off task",
  SHORT_TERM: "Under 3 months",
  MEDIUM_TERM: "3–6 months",
  LONG_TERM: "6+ months",
  ONGOING: "Ongoing",
};

export const commitmentLabels: Labels<Commitment> = {
  FEW_HOURS: "A few hours a week",
  PART_TIME: "Part-time",
  FULL_TIME: "Full-time",
  FLEXIBLE: "Flexible",
};

export const compensationLabels: Labels<CompensationType> = {
  NONE: "Unpaid",
  HOURLY: "Hourly rate",
  FIXED: "Fixed price",
  SALARY: "Salary",
  EQUITY: "Equity",
  STIPEND: "Stipend",
  NEGOTIABLE: "Negotiable",
};

export const applicationStatusLabels: Labels<ApplicationStatus> = {
  RECEIVED: "Received",
  IN_REVIEW: "In review",
  CONTACTED: "Contact started",
  ACCEPTED: "Accepted",
  REJECTED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export const projectStageLabels: Labels<ProjectStage> = {
  IDEA: "Idea",
  PLANNING: "Planning",
  PROTOTYPE: "Prototype",
  IN_DEVELOPMENT: "In development",
  MVP: "MVP",
  LAUNCHED: "Launched",
  SCALING: "Scaling",
  COMPLETED: "Completed",
  PAUSED: "Paused",
};

export const projectCategoryLabels: Labels<ProjectCategory> = {
  AI_ML: "AI & machine learning",
  WEB: "Web",
  MOBILE: "Mobile",
  GAMES: "Games",
  DEVTOOLS: "Developer tools",
  OPEN_SOURCE: "Open source",
  FINTECH: "Fintech",
  HEALTH: "Health",
  EDUCATION: "Education",
  SOCIAL_IMPACT: "Social impact",
  ECOMMERCE: "E-commerce",
  MEDIA: "Media",
  HARDWARE: "Hardware & IoT",
  BLOCKCHAIN: "Blockchain",
  RESEARCH: "Research",
  OTHER: "Other",
};

export const orgTypeLabels: Labels<OrgType> = {
  COMPANY: "Company",
  STARTUP: "Startup",
  NONPROFIT: "Non-profit",
  ASSOCIATION: "Association",
  COMMUNITY: "Community",
  ACADEMIC: "Academic institution",
  OTHER: "Other",
};

export const orgSizeLabels: Labels<OrgSize> = {
  SOLO: "1 person",
  S2_10: "2–10",
  S11_50: "11–50",
  S51_200: "51–200",
  S201_1000: "201–1,000",
  S1000_PLUS: "1,000+",
};

export const memberRoleLabels: Labels<MemberRole> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  MEMBER: "Member",
};

export const postTypeLabels: Labels<PostType> = {
  TEXT: "Post",
  PROJECT_UPDATE: "Project update",
  OPPORTUNITY: "Opportunity",
  PARTNERSHIP: "Partnership",
  ACHIEVEMENT: "Achievement",
  HELP_REQUEST: "Asking for help",
  DISCUSSION: "Discussion",
  LAUNCH: "Launch",
};

export const reportReasonLabels: Labels<ReportReason> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or bullying",
  HATE: "Hateful content",
  MISINFORMATION: "Misinformation",
  INAPPROPRIATE: "Inappropriate content",
  IMPERSONATION: "Impersonation",
  SCAM: "Scam or fraud",
  OTHER: "Something else",
};

export const notificationTypeLabels: Labels<NotificationType> = {
  CONNECTION_REQUEST: "Connection requests",
  CONNECTION_ACCEPTED: "Accepted connection requests",
  FOLLOW_REQUEST: "Follow requests",
  NEW_FOLLOWER: "New followers",
  POST_COMMENT: "Comments on your posts",
  COMMENT_REPLY: "Replies to your comments",
  POST_LIKE: "Likes on your posts",
  POST_SHARE: "Shares of your posts",
  MENTION: "Mentions",
  NEW_MESSAGE: "New messages",
  APPLICATION_RECEIVED: "New applications",
  APPLICATION_STATUS: "Application status changes",
  OPPORTUNITY_MATCH: "Relevant new opportunities",
  INVITATION: "Team invitations",
  INVITATION_ACCEPTED: "Accepted invitations",
  PARTNERSHIP_REQUEST: "Partnership requests",
  PARTNERSHIP_ACCEPTED: "Accepted partnerships",
  ENTITY_UPDATE: "Updates from projects and organizations you follow",
};

export const PAGE_SIZE = 20;

export function enumKeys<T extends string>(labels: Labels<T>): T[] {
  return Object.keys(labels) as T[];
}
