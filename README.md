# CORDILLERA SAAS PRO v3.0

Plataforma de Monitoreo de Aprendizajes para establecimientos educacionales chilenos.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Backend API | NestJS 11 + Fastify |
| ORM | Prisma 6 |
| Base de datos | PostgreSQL 16 |
| Auth | JWT + refresh tokens + Passport |
| Documentación | Swagger/OpenAPI (auto-generado) |
| Frontend | React 18 + Vite + TypeScript (migrando a Next.js) |
| Charts | Recharts |
| HTTP Client | TanStack React Query |
| Import/Export | ExcelJS + Web Speech API |
| Infraestructura | Docker Compose |

---

## Requisitos previos

- Node.js 20+
- Docker Desktop
- npm 10+

---

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar PostgreSQL
docker compose up -d postgres

# 3. Ejecutar migraciones y seed
npm run db:setup

# 4. Iniciar en modo desarrollo
npm run dev
```

---

## Servicios

| Servicio | URL |
|---|---|
| API Backend | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |
| Health Check | http://localhost:4000/health |
| Frontend | http://localhost:5173 |
| pgAdmin (dev) | http://localhost:5050 |

---

## Credenciales demo

| Rol | Email | Contraseña |
|---|---|---|
| Alumno | alexis.{curso}@cordillera.cl | Alexis2026* |

> 24 alumnos "Alexis", uno por curso (ej: `alexis.1a@cordillera.cl`, `alexis.4m_a@cordillera.cl`).

---

## Scripts principales

```bash
# Desarrollo
npm run dev              # Backend + Frontend en paralelo
npm run dev:backend      # Solo backend (NestJS watch)
npm run dev:frontend     # Solo frontend (Vite)

# Base de datos
npm run db:up            # Levantar PostgreSQL
npm run db:setup         # Migraciones + seed
npm run db:reset         # Resetear BD y volver a seed
npm run db:migrate       # Solo migraciones
npm run db:seed          # Solo seed
npm run db:studio        # Prisma Studio (explorador visual)

# Build
npm run build            # Build producción (backend + frontend)
npm run lint             # TypeScript type-check backend
npm run security:audit   # Auditoría de seguridad npm
```

---

## Estructura del proyecto

```
CORDILLERA_SAAS_VERSION_FINAL/
├── backend/                          # NestJS API
│   ├── prisma/
│   │   ├── schema.prisma             # 35 modelos PostgreSQL
│   │   ├── migrations/               # Migraciones autogeneradas
│   │   └── seeds/seed.ts             # Datos demo (~390 registros)
│   ├── src/
│   │   ├── main.ts                   # Entry point (+ multipart + Swagger)
│   │   ├── app.module.ts             # Módulo raíz (8 dominios)
│   │   ├── health.controller.ts      # Health check mejorado
│   │   ├── config/                   # Configuración tipada
│   │   ├── common/                   # Decorators, guards, filters, DTOs, utils
│   │   └── modules/
│   │       ├── prisma/               # PrismaModule (global)
│   │       ├── identity/             # auth, users
│   │       ├── academic/             # 9 submódulos + calculations
│   │       ├── curriculum/           # 5 submódulos (OA, ejes, preguntas)
│   │       ├── assessments/          # 3 submódulos (CRUD + attempts + grading)
│   │       ├── insights/             # 3 submódulos (reports + alerts + remedial)
│   │       ├── resources/            # 2 submódulos (guides + lessons)
│   │       ├── data-ops/             # 3 submódulos (imports + exports + files)
│   │       └── audit-logs/           # Auditoría avanzada
│   ├── Dockerfile                    # Producción multi-stage
│   ├── package.json
│   └── tsconfig.json
├── frontend/                         # React + Vite
│   └── src/
│       ├── components/
│       │   ├── voice/                # Asistente de dictado (7 archivos)
│       │   ├── charts/               # Gráficos Recharts
│       │   └── common/               # Layout, KPIs
│       ├── features/                 # Dashboard por rol
│       ├── hooks/                    # Hooks (auth, voice)
│       ├── services/                 # API client + voice service
│       ├── lib/                      # API client tipado
│       └── styles/                   # CSS global
├── docker-compose.yml                # PostgreSQL + backend
├── nginx.conf                        # Reverse proxy (producción)
└── README.md
```

---

## Arquitectura por dominios

| Dominio | Módulos | Endpoints | Descripción |
|---|---|---|---|
| **Identity** | auth, users | 10 | JWT, refresh tokens, roles, CRUD usuarios |
| **Academic** | institutions, years, periods, courses, students, teachers, enrollments, subjects, calculations | 53 | Núcleo académico + promedios ponderados |
| **Curriculum** | axes, skills, units, learning-objectives, question-bank | 23 | OA, ejes, habilidades, banco de preguntas |
| **Assessments** | assessments, attempts, grading | 36 | Evaluaciones + aplicación online + corrección |
| **Insights** | reports, alerts, remedial-plans | 18 | Reportes, alertas, rutas remediales |
| **Resources** | learning-resources, lessons | 17 | Guías, presentaciones, planificación de clases |
| **Data-Ops** | imports, exports, files | 12 | Importar/Exportar Excel/CSV, archivos |
| **Audit** | audit-logs | 2 | Auditoría avanzada con summary |
| **TOTAL** | **28 módulos** | **171** | |

---

## Modelo de datos (35 tablas PostgreSQL)

```
institutions          academic_years        periods
users                 refresh_tokens        teachers
students              courses               enrollments
teacher_course_assignments
subjects              curriculum_rules
axes                  curriculum_units      skills
learning_objectives   learning_objective_skills
evaluation_indicators
questions             question_options
assessments           assessment_questions
assessment_attempts   student_answers
grades                reports
remedial_plans        learning_resources    guides
presentations         lessons               lesson_resources
import_jobs           export_jobs           audit_logs
file_assets
```

---

## Máquinas de estado

### Assessment
`DRAFT → PUBLISHED → ACTIVE → CLOSED → IN_GRADING → GRADED → REPORTED → ARCHIVED`

### AssessmentAttempt
`IN_PROGRESS → COMPLETED / TIMED_OUT / CLOSED / CANCELLED`

### StudentAnswer
`PENDING → CORRECT / INCORRECT / PARTIAL / OMITTED / MANUAL_REVIEW`

### RemedialPlan
`PENDING → IN_PROGRESS → COMPLETED → EFFECTIVE / NOT_EFFECTIVE`

### Report
`PENDING → GENERATING → GENERATED → SENT / OUTDATED / ERROR`

---

## Características principales

- **Autenticación** JWT con refresh tokens rotativos, rate limiting, política de contraseñas
- **Roles** SUPER_ADMIN, ADMIN, DIRECTION, UTP, TEACHER, STUDENT
- **Evaluaciones online** con control de tiempo, auto-guardado, auto-corrección
- **Corrección manual** individual y masiva de preguntas abiertas
- **Ponderaciones** por evaluación y periodo, validación 100% antes de cierre
- **Promedios** ponderados por periodo y anuales con niveles de desempeño
- **Reportes** individuales, por curso e institucionales con detección de brechas
- **Alertas** por estudiante en riesgo, OA descendidos, cursos sin evaluaciones
- **Rutas remediales** con detección automática y sugerencia de recursos
- **Importación** Excel/CSV con validación por fila, vista previa y rollback
- **Exportación** XLSX/CSV/JSON con headers estilizados
- **Asistente de dictado** Web Speech API para crear contenido por voz
- **Auditoría** completa con filtros avanzados y resumen de actividad
- **Swagger** auto-generado en `/api/docs`
- **Docker** multi-stage build con health checks
- **Seed data** con ~390 registros (institución, cursos, estudiantes, evaluaciones, recursos)

---

## Deploy con Docker

```bash
# Build y levantar todos los servicios
docker compose up -d --build

# Solo base de datos (desarrollo)
docker compose up -d postgres

# Ver logs
docker compose logs -f backend

# Ejecutar migraciones en producción
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx tsx prisma/seeds/seed.ts
```

---

## Escala de notas chilena

```
Nota = 1.0 + (porcentaje / 100) × 6.0
Rango: 1.0 - 7.0

Niveles de desempeño:
  < 4.0  → Crítico
  4.0-4.9 → Básico
  5.0-5.9 → Adecuado
  ≥ 6.0  → Avanzado
```

---

## Reglas de negocio implementadas

- **ACA**: 9 reglas de años/periodos/cierre
- **ASM**: 12 reglas de evaluación/aplicación
- **CUR**: 7 reglas de preguntas/banco
- **GRD**: 8 reglas de corrección/resultados
- **SEC**: 8 reglas de seguridad/acceso
- **DOP**: 6 reglas de importación/exportación
- **INS**: 7 reglas de reportes/alertas/remediales

---

## Próximos pasos

- [ ] Frontend Next.js con App Router
- [ ] Exportación PDF server-side con Puppeteer (cliente: jsPDF implementado)
- [x] App móvil PWA para rendición offline (Service Worker + manifest)
- [x] Lector de hojas de respuesta (OMR) — `frontend/src/lib/omr.ts` + `OMRReader`
- [x] Notificaciones por email — 7 tipos de notificación HTML
- [x] Redis para caché y sesiones distribuidas — CacheModule con fallback in-memory
- [x] Tests unitarios y e2e — 288 tests (168 backend + 120 frontend) + e2e smoke test
