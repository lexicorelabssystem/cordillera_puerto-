export const DEFAULT_FEATURES = {
  parent_portal: false,
} as const;

export type FeatureFlag = keyof typeof DEFAULT_FEATURES;