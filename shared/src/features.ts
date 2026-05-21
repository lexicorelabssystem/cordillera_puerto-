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

export const FEATURE_LABELS: Record<FeatureFlag, string> = {
  simce_bank: "Banco SIMCE",
  remedial_routes: "Rutas remediales",
  voice_input: "Dictado por voz",
  online_assessments: "Evaluaciones en línea",
  parent_portal: "Portal de apoderados",
  advanced_reports: "Reportes avanzados",
  grade_change_requests: "Solicitudes de cambio de nota",
};
