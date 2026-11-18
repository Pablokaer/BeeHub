/**
 * Matching configuration. The scoring model is deterministic and explainable:
 * each factor contributes up to its weight (weights sum to 100), and every
 * contribution is reported as a human-readable reason.
 *
 * Only professional signals are used (skills, interests, collaboration preferences,
 * availability, work mode, experience, location when the role is on-site).
 * No sensitive or protected attributes are stored or considered.
 */
export const MATCH_WEIGHTS = {
  requiredSkills: 40,
  topicTags: 10,
  interests: 10,
  collaborationType: 10,
  availability: 15,
  workMode: 5,
  experience: 5,
  location: 5,
} as const;

export type MatchWeights = { [K in keyof typeof MATCH_WEIGHTS]: number };

export const MATCH_THRESHOLDS = {
  /** Minimum score to show an item in recommendation lists. */
  recommend: 35,
  /** Minimum score to send an OPPORTUNITY_MATCH notification when an opportunity is published. */
  notify: 60,
  /** Maximum users notified per published opportunity. */
  maxNotified: 50,
} as const;
