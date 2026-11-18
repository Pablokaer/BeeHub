/** Editorial configuration until a campaign-management and payment flow is added. */
export type ProjectPromotion = {
  id: string;
  projectSlug: string;
  sponsorName: string;
  headline: string;
  description: string;
  startsAt: string;
  endsAt: string;
};

// Only approved, paid campaigns belong here. Empty means no ad is displayed.
export const projectPromotions: readonly ProjectPromotion[] = [];
