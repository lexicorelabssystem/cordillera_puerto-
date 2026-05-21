import { Injectable, Inject, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { AppConfig } from "../../config/config.module.js";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly enabled: boolean;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(@Inject("APP_CONFIG") private readonly config: AppConfig) {
    this.enabled = config.notificationsEnabled;
    this.from = config.smtp.from;
    this.frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

    if (this.enabled && config.smtp.host) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });
      this.logger.log("Email service configured");
    } else {
      this.logger.warn("Email notifications disabled — set SMTP_HOST and NOTIFICATION_EMAILS_ENABLED=true to enable");
    }
  }

  async send(payload: EmailPayload): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      this.logger.debug(`Email not sent (disabled): ${payload.subject} -> ${payload.to}`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      this.logger.log(`Email sent: "${payload.subject}" -> ${payload.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async sendPasswordReset(email: string, resetToken: string, userName: string): Promise<boolean> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Restablecer Contraseña</h2>
        <p>Hola ${userName},</p>
        <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva:</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Restablecer Contraseña
        </a>
        <p style="color: #666; font-size: 0.85rem;">Este enlace expira en 15 minutos.</p>
        <p style="color: #666; font-size: 0.85rem;">Si no solicitaste este cambio, ignora este mensaje.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: email, subject: "Restablecer tu contraseña — Cordillera SaaS", html });
  }

  async sendWelcome(email: string, userName: string, tempPassword: string): Promise<boolean> {
    const loginUrl = `${this.frontendUrl}/login`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Bienvenido(a)</h2>
        <p>Hola ${userName},</p>
        <p>Tu cuenta ha sido creada en la plataforma Cordillera SaaS. Puedes acceder con las siguientes credenciales:</p>
        <div style="background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Usuario:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
        </div>
        <p style="color: #dc2626; font-weight: bold;">Deberás cambiar tu contraseña en el primer inicio de sesión.</p>
        <a href="${loginUrl}" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Iniciar Sesión
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: email, subject: "Bienvenido(a) a Cordillera SaaS", html });
  }

  async sendLowGradeAlert(
    studentEmail: string,
    studentName: string,
    subjectName: string,
    assessmentTitle: string,
    grade: number,
    courseName: string,
  ): Promise<boolean> {
    const gradeColor = grade < 4.0 ? "#dc2626" : "#f59e0b";
    const gradeLabel = grade.toFixed(1).replace(".", ",");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Alerta Académica</h2>
        <p>Hola,</p>
        <p>El estudiante <strong>${studentName}</strong> ha obtenido una calificación que requiere atención:</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Curso:</strong> ${courseName}</p>
          <p style="margin: 4px 0;"><strong>Asignatura:</strong> ${subjectName}</p>
          <p style="margin: 4px 0;"><strong>Evaluación:</strong> ${assessmentTitle}</p>
          <p style="margin: 4px 0; font-size: 1.2rem;"><strong>Nota:</strong> <span style="color: ${gradeColor};">${gradeLabel}</span></p>
        </div>
        <p>Se recomienda revisar el plan remedial asignado y tomar acciones pedagógicas oportunas.</p>
        <a href="${this.frontendUrl}/admin/remedial" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Ver Rutas Remediales
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: studentEmail, subject: `Alerta: Nota ${gradeLabel} en ${subjectName} — Cordillera SaaS`, html });
  }

  async sendAssessmentPublished(
    teacherEmail: string,
    courseName: string,
    subjectName: string,
    assessmentTitle: string,
    assessmentType: string,
    startDate: string,
  ): Promise<boolean> {
    const typeLabels: Record<string, string> = {
      "DIAGNOSTICA": "Diagnóstica",
      "PROCESO": "Proceso",
      "CIERRE": "Cierre",
      "PARCIAL": "Parcial",
      "FINAL": "Final",
      "SIMCE": "Ensayo SIMCE",
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Evaluación Publicada</h2>
        <p>Se ha publicado una nueva evaluación en la plataforma:</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Título:</strong> ${assessmentTitle}</p>
          <p style="margin: 4px 0;"><strong>Tipo:</strong> ${typeLabels[assessmentType] ?? assessmentType}</p>
          <p style="margin: 4px 0;"><strong>Curso:</strong> ${courseName}</p>
          <p style="margin: 4px 0;"><strong>Asignatura:</strong> ${subjectName}</p>
          <p style="margin: 4px 0;"><strong>Fecha inicio:</strong> ${startDate}</p>
        </div>
        <a href="${this.frontendUrl}/admin/evaluaciones" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Ver Evaluaciones
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: teacherEmail, subject: `Nueva evaluación: ${assessmentTitle} — Cordillera SaaS`, html });
  }

  async sendReportReady(
    userEmail: string,
    userName: string,
    reportType: string,
    reportId: string,
  ): Promise<boolean> {
    const typeLabels: Record<string, string> = {
      "STUDENT": "Reporte por Estudiante",
      "COURSE": "Reporte por Curso",
      "INSTITUTIONAL": "Reporte Institucional",
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Reporte Listo</h2>
        <p>Hola ${userName},</p>
        <p>Tu reporte <strong>${typeLabels[reportType] ?? reportType}</strong> ha sido generado exitosamente.</p>
        <a href="${this.frontendUrl}/admin/reportes" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Ver Reportes
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: userEmail, subject: "Tu reporte está listo — Cordillera SaaS", html });
  }

  async sendRemedialPlanAssigned(
    studentEmail: string,
    studentName: string,
    subjectName: string,
    oaDescription: string,
    resourcesCount: number,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — Plan Remedial Asignado</h2>
        <p>Hola ${studentName},</p>
        <p>Se ha generado un plan remedial personalizado para ti:</p>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Asignatura:</strong> ${subjectName}</p>
          <p style="margin: 4px 0;"><strong>Objetivo de Aprendizaje:</strong> ${oaDescription}</p>
          <p style="margin: 4px 0;"><strong>Recursos disponibles:</strong> ${resourcesCount}</p>
        </div>
        <p>Revisa tus materiales y actividades para mejorar tu aprendizaje.</p>
        <a href="${this.frontendUrl}/admin/remedial" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
          Ver Plan Remedial
        </a>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to: studentEmail, subject: "Plan remedial asignado — Cordillera SaaS", html });
  }

  async sendNotification(
    to: string,
    userName: string,
    title: string,
    message: string,
    actionUrl?: string,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">CORDILLERA SAAS — ${title}</h2>
        <p>Hola ${userName},</p>
        <p>${message}</p>
        ${actionUrl ? `<a href="${actionUrl}" style="display: inline-block; background: #1e40af; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Ir a la plataforma</a>` : ""}
        <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />
        <p style="color: #999; font-size: 0.75rem;">Cordillera SaaS — Plataforma de Monitoreo de Aprendizajes</p>
      </div>
    `;

    return this.send({ to, subject: `${title} — Cordillera SaaS`, html });
  }
}
