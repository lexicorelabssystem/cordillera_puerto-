export const QUEUE_NAMES = {
  EXPORTS: "exports",
  RECALCULATIONS: "recalculations",
  SIMCE_PDF: "simce-pdf",
  REPORTS: "reports",
  CLEANUP: "cleanup",
} as const;

export const JOB_NAMES = {
  EXPORT_DATA: "export-data",
  RECALCULATE_ASSESSMENT: "recalculate-assessment",
  PROCESS_SIMCE_PDF: "process-simce-pdf",
  GENERATE_REPORT: "generate-report",
  CLEANUP_TEMP: "cleanup-temp",
} as const;

export const DEFAULT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export const EXPORT_CONCURRENCY = 1;
export const RECALCULATION_CONCURRENCY = 1;
export const SIMCE_PDF_CONCURRENCY = 1;
