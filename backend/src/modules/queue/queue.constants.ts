export const QUEUE_NAMES = {
  EXPORTS: "exports",
  RECALCULATIONS: "recalculations",
  SIMCE_PDF: "simce-pdf",
  REPORTS: "reports",
  CLEANUP: "cleanup",
  ARCHIVES: "archives",
} as const;

export const JOB_NAMES = {
  EXPORT_DATA: "export-data",
  RECALCULATE_ASSESSMENT: "recalculate-assessment",
  PROCESS_SIMCE_PDF: "process-simce-pdf",
  GENERATE_REPORT: "generate-report",
  CLEANUP_TEMP: "cleanup-temp",
  ARCHIVE_SEMESTER: "archive-semester",
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
export const REPORTS_CONCURRENCY = 1;
export const ARCHIVES_CONCURRENCY = 1;

export function createRedisConnection(redisUrl: string) {
  const url = new URL(redisUrl);

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname ? Number(url.pathname.replace("/", "") || 0) : 0,
  };
}
