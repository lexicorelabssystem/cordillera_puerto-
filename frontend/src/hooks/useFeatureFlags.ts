import { DEFAULT_FEATURES, type FeatureFlag, FEATURE_LABELS } from "@cordillera/shared/features.js";

export type { FeatureFlag };
export { FEATURE_LABELS };

export function useFeatureFlags(): {
  isEnabled: (flag: FeatureFlag) => boolean;
  allFlags: () => Record<FeatureFlag, boolean>;
} {
  return {
    isEnabled: (flag: FeatureFlag) => DEFAULT_FEATURES[flag] ?? false,
    allFlags: () => ({ ...DEFAULT_FEATURES }),
  };
}
