import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger, ValidationPipe, VersioningType, VERSION_NEUTRAL } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";
import compress from "@fastify/compress";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter.js";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor.js";
import { TimeoutInterceptor } from "./common/interceptors/timeout.interceptor.js";
import { CsrfGuard } from "./common/guards/csrf.guard.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  await app.register(multipart as never, {
    limits: {
      files: 1,
      fileSize: 50 * 1024 * 1024,
    },
  } as never);
  await app.register(cookie as never, {
    secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || "",
    parseOptions: {},
  });

  await app.register(compress as never, {
    encodings: ["gzip", "deflate", "br"],
    threshold: 1024,
  });

  await app.register(helmet as never, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-origin" },
    hsts: {
      maxAge: 15552000,
      includeSubDomains: true,
    },
  });

  const logger = new Logger("Bootstrap");

  app.setGlobalPrefix("api", { exclude: ["health"] });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  const rawOrigins = [
    ...(process.env.CORS_ORIGINS || "http://localhost:5173").split(","),
    process.env.FRONTEND_URL,
    "https://cordillera-puerto-frontend.vercel.app",
    "https://cordillera-puerto-frontend-lexicorelabssystemgmailcoms-projects.vercel.app",
    "*.vercel.app",
  ].map((o) => o?.trim()).filter((o): o is string => Boolean(o));
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && rawOrigins.some((o) => o.includes("localhost"))) {
    logger.warn("CORS_ORIGINS contiene localhost en produccion — cambiar a dominio real antes del despliegue");
  }

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || rawOrigins.length === 0) {
        return cb(null, true);
      }
      const allowed = rawOrigins.some((o) => {
        if (o === "*") return true;
        if (o.startsWith("*.")) {
          const domain = o.slice(2);
          try {
            const host = new URL(origin).hostname;
            return host === domain || host.endsWith("." + domain);
          } catch {
            return false;
          }
        }
        return o === origin;
      });
      if (allowed) return cb(null, true);
      cb(new Error(`Origen ${origin} no permitido por CORS`), false);
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new TimeoutInterceptor());

  const csrfGuard = new CsrfGuard();
  app.useGlobalGuards(csrfGuard);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Cordillera SaaS API")
    .setDescription(
      "Plataforma de Monitoreo de Aprendizajes — API profesional para gestión escolar, evaluaciones, reportes y rutas remediales.",
    )
    .setVersion("3.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "JWT" }, "access-token")
    .addTag("Auth", "Autenticación y gestión de sesiones")
    .addTag("Users", "Gestión de usuarios del sistema")
    .addTag("Institutions", "Establecimientos educacionales")
    .addTag("Academic Years", "Años académicos")
    .addTag("Courses", "Cursos y niveles")
    .addTag("Students", "Estudiantes")
    .addTag("Teachers", "Docentes")
    .addTag("Enrollments", "Matrículas")
    .addTag("Subjects", "Asignaturas")
    .addTag("Curriculum", "Currículum, OA, ejes y habilidades")
    .addTag("Question Bank", "Banco de preguntas")
    .addTag("Assessments", "Evaluaciones")
    .addTag("Assessment Attempts", "Aplicación online")
    .addTag("Grading", "Corrección y notas")
    .addTag("Reports", "Reportes pedagógicos")
    .addTag("Imports", "Importación de datos")
    .addTag("Exports", "Exportación de datos")
    .addTag("Remedial Plans", "Rutas remediales")
    .addTag("Audit Logs", "Auditoría")
    .addTag("Files", "Archivos y documentos")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 4000;
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen(port, host);

  const shutdown = async (signal: string) => {
    logger.log(`Recibido ${signal} — cerrando servidor...`);
    await app.close();
    logger.log("Servidor cerrado correctamente");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason instanceof Error ? reason.stack : String(reason));
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error.stack);
    process.exit(1);
  });

  logger.log(`API listening on http://${host}:${port}`);
  logger.log(`Swagger docs on http://${host}:${port}/api/docs`);
  if (isProd) {
    logger.log("Modo produccion — Helmet + HSTS + CSRF activos");
  }
}

bootstrap();
