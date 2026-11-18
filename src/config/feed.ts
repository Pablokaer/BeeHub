/**
 * Rule-based feed ranking. Each candidate post gets a relevance score from simple,
 * explainable signals, multiplied by a recency decay. Swapping in a learned ranker
 * later only requires another implementation of `FeedRanker` (src/server/feed.ts).
 */
export const FEED_CONFIG = {
  /** How far back the "For you" feed looks for candidates. */
  windowDays: 21,
  /** Max candidates scored per request. */
  maxCandidates: 400,
  pageSize: 15,
  weights: {
    ownPost: 2,
    connection: 6,
    followedPerson: 5,
    followedEntity: 4, // followed project or organization
    teamEntity: 5, // a project/org the viewer belongs to
    matchingOpportunity: 4, // opportunity post whose skills match the viewer's tags
    tagOverlap: 1.5, // per shared hashtag/skill (capped)
    tagOverlapCap: 3,
    discovery: 0.5, // everything else (keeps the feed from being empty)
    engagement: 0.6, // × log1p(likes + 2×comments + 3×shares)
  },
  /** Hours for the score to halve. */
  halfLifeHours: 36,
} as const;
