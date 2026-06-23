// Feature flags — mirror of shared/src/features.ts for Railway compatibility
// (Railway builds backend in isolation; shared package is not pre-compiled)
export type FeatureFlag =
  | "simce_bank"
  | "remedial_routes"
  | "voice_input"
  | "online_assessments"
  | "parent_portal"
  | "advanced_reports"
  | "grade_change_requests";

export const DEFAULT_FEATURES: Record<FeatureFlag, boolean> = {
  simce_bank: true,
  remedial_routes: true,
  voice_input: true,
  online_assessments: true,
  parent_portal: false,
  advanced_reports: true,
  grade_change_requests: true,
};
