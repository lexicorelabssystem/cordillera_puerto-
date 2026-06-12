export const FEATURE_FLAGS = ["parent_portal"] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const DEFAULT_FEATURES: Record<FeatureFlag, boolean> = {
  parent_portal: false,
};