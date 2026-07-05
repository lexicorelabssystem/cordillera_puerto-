import { Injectable } from "@nestjs/common";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { QueueService } from "../queue/queue.service.js";

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: "cordillera_http_requests_total",
    help: "Total de solicitudes HTTP procesadas",
    labelNames: ["method", "route", "status_code"] as const,
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: "cordillera_http_request_duration_seconds",
    help: "Duracion de solicitudes HTTP en segundos",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 2, 5, 10],
    registers: [this.registry],
  });

  private readonly databaseUp = new Gauge({
    name: "cordillera_database_up",
    help: "Estado de conexion con PostgreSQL (1 disponible, 0 no disponible)",
    registers: [this.registry],
  });

  private readonly databaseLatency = new Gauge({
    name: "cordillera_database_healthcheck_duration_seconds",
    help: "Duracion del healthcheck de PostgreSQL",
    registers: [this.registry],
  });

  private readonly queueJobs = new Gauge({
    name: "cordillera_bullmq_jobs",
    help: "Cantidad de jobs BullMQ por cola y estado",
    labelNames: ["queue", "state"] as const,
    registers: [this.registry],
  });

  private readonly queueWorkers = new Gauge({
    name: "cordillera_bullmq_workers",
    help: "Cantidad de workers BullMQ conectados por cola",
    labelNames: ["queue"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentInfo = new Gauge({
    name: "cordillera_active_assessment_info",
    help: "Evaluaciones activas visibles en el dashboard",
    labelNames: ["assessment_id", "title", "course"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentAttempts = new Gauge({
    name: "cordillera_active_assessment_attempts",
    help: "Intentos por evaluacion activa y estado",
    labelNames: ["assessment_id", "title", "course", "status"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentConnected = new Gauge({
    name: "cordillera_active_assessment_students_connected",
    help: "Intentos en progreso con actividad durante los ultimos cinco minutos",
    labelNames: ["assessment_id", "title", "course"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentAnswers = new Gauge({
    name: "cordillera_active_assessment_answers_saved",
    help: "Respuestas guardadas para una evaluacion activa",
    labelNames: ["assessment_id", "title", "course"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentRecentAnswers = new Gauge({
    name: "cordillera_active_assessment_answers_saved_last_5m",
    help: "Respuestas guardadas o actualizadas durante los ultimos cinco minutos",
    labelNames: ["assessment_id", "title", "course"] as const,
    registers: [this.registry],
  });

  private readonly activeAssessmentQuestions = new Gauge({
    name: "cordillera_active_assessment_questions",
    help: "Cantidad de preguntas de una evaluacion activa",
    labelNames: ["assessment_id", "title", "course"] as const,
    registers: [this.registry],
  });
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {
    this.registry.setDefaultLabels({ service: "cordillera-api" });
    collectDefaultMetrics({ register: this.registry, prefix: "cordillera_node_" });
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number) {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequests.inc(labels);
    this.httpDuration.observe(labels, durationSeconds);
  }

  async render(): Promise<string> {
    await Promise.allSettled([
      this.collectDatabaseMetrics(),
      this.collectQueueMetrics(),
      this.collectActiveAssessmentMetrics(),
    ]);
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }


  private async collectDatabaseMetrics() {
    const startedAt = process.hrtime.bigint();
    const isUp = await this.prisma.healthCheck();
    this.databaseUp.set(isUp ? 1 : 0);
    this.databaseLatency.set(Number(process.hrtime.bigint() - startedAt) / 1_000_000_000);
  }

  private async collectQueueMetrics() {
    const health = await this.queueService.getHealth();
    for (const queue of health.queues) {
      this.queueWorkers.set({ queue: queue.name }, queue.workers);
      for (const [state, count] of Object.entries(queue.counts)) {
        this.queueJobs.set({ queue: queue.name, state }, count);
      }
    }
  }

  private async collectActiveAssessmentMetrics() {
    type ActiveAssessmentRow = {
      assessmentId: string;
      title: string;
      course: string;
      questions: bigint;
      inProgress: bigint;
      completed: bigint;
      timedOut: bigint;
      closed: bigint;
      cancelled: bigint;
      connected: bigint;
      answersSaved: bigint;
      answersRecent: bigint;
    };

    const rows = await this.prisma.$queryRaw<ActiveAssessmentRow[]>(Prisma.sql`
      SELECT
        a.id::text AS "assessmentId",
        a.title,
        c.name AS course,
        (SELECT COUNT(*) FROM assessment_questions aq WHERE aq."assessmentId" = a.id) AS questions,
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'IN_PROGRESS') AS "inProgress",
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'COMPLETED') AS completed,
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'TIMED_OUT') AS "timedOut",
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'CLOSED') AS closed,
        COUNT(DISTINCT aa.id) FILTER (WHERE aa.status = 'CANCELLED') AS cancelled,
        COUNT(DISTINCT aa.id) FILTER (
          WHERE aa.status = 'IN_PROGRESS'
            AND (aa."startedAt" >= NOW() - INTERVAL '5 minutes' OR sa."answeredAt" >= NOW() - INTERVAL '5 minutes')
        ) AS connected,
        COUNT(sa.id) AS "answersSaved",
        COUNT(sa.id) FILTER (WHERE sa."answeredAt" >= NOW() - INTERVAL '5 minutes') AS "answersRecent"
      FROM assessments a
      JOIN courses c ON c.id = a."courseId"
      LEFT JOIN assessment_attempts aa ON aa."assessmentId" = a.id
      LEFT JOIN student_answers sa ON sa."attemptId" = aa.id
      WHERE a."isActive" = true
        AND a.status IN ('PUBLISHED', 'ACTIVE')
        AND a."startDate" <= NOW()
        AND (a."endDate" IS NULL OR a."endDate" >= NOW())
      GROUP BY a.id, a.title, c.name
    `);

    this.activeAssessmentInfo.reset();
    this.activeAssessmentAttempts.reset();
    this.activeAssessmentConnected.reset();
    this.activeAssessmentAnswers.reset();
    this.activeAssessmentRecentAnswers.reset();
    this.activeAssessmentQuestions.reset();

    for (const row of rows) {
      const labels = { assessment_id: row.assessmentId, title: row.title, course: row.course };
      this.activeAssessmentInfo.set(labels, 1);
      this.activeAssessmentConnected.set(labels, Number(row.connected));
      this.activeAssessmentAnswers.set(labels, Number(row.answersSaved));
      this.activeAssessmentRecentAnswers.set(labels, Number(row.answersRecent));
      this.activeAssessmentQuestions.set(labels, Number(row.questions));
      const statuses = {
        IN_PROGRESS: row.inProgress,
        COMPLETED: row.completed,
        TIMED_OUT: row.timedOut,
        CLOSED: row.closed,
        CANCELLED: row.cancelled,
      };
      for (const [status, count] of Object.entries(statuses)) {
        this.activeAssessmentAttempts.set({ ...labels, status }, Number(count));
      }
    }
  }
}