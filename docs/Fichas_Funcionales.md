# Fichas Funcionales — Cordillera SaaS v3.0
## Plataforma de Monitoreo de Aprendizajes

---

## Ficha 1: Sistema de Autenticación y Roles

| Campo | Detalle |
|-------|---------|
| **Módulo** | Auth / Users |
| **Endpoint** | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/forgot-password` |
| **Roles** | SUPER_ADMIN, ADMIN, DIRECTION, UTP, TEACHER, STUDENT, PARENT |
| **Seguridad** | JWT (access 15min + refresh 7d), bcrypt (10 rounds), CSRF guard |
| **Permisos** | 56+ acciones granulares con asignación por rol |
| **Flujo** | Login → JWT access + httpOnly refresh cookie → Refresh automático |
| **Recuperación** | Forgot password → Email con link temporal (15 min) → Reset |

---

## Ficha 2: Catálogo Académico

| Campo | Detalle |
|-------|---------|
| **Módulo** | Academic Years, Periods, Courses, Subjects |
| **Cursos** | 1° a 8° básico, 1°M a 4°M (secciones A/B = 24 cursos) |
| **Asignaturas** | Lenguaje, Matemática, Ciencias, Historia y Geografía |
| **Períodos** | Semestre 1 y Semestre 2 (ponderación configurable) |
| **Año académico** | 2026 (activo), con fechas de inicio/término |
| **Curriculum Rules** | Reglas por asignatura y grado (1°-8°) |

---

## Ficha 3: Currículum y Objetivos de Aprendizaje

| Campo | Detalle |
|-------|---------|
| **Módulo** | Curriculum (Axes, Units, Skills, Learning Objectives) |
| **Ejes** | Comprensión Lectora, Producción Escrita, Comunicación Oral, Números y Operaciones, Geometría, Medición y Datos, Ciencias de la Vida, Ciencias Físicas y Químicas |
| **Habilidades** | Analizar, Interpretar, Resolver, Argumentar, Comparar, Clasificar, Inferir, Evaluar, Sintetizar, Aplicar |
| **OA** | 14 por grado (4 Lenguaje + 4 Matemática + 6 Ciencias), 112 total |
| **Indicadores** | 3 por OA de Ciencias (144 total) |
| **Unidades** | 4 por asignatura por grado (96 unidades) |

---

## Ficha 4: Banco de Preguntas

| Campo | Detalle |
|-------|---------|
| **Módulo** | Question Bank |
| **Tipos** | MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, ESSAY, MATCHING |
| **Campos** | Enunciado, explicación, dificultad (1-3), puntaje, opciones |
| **Vinculación** | Asignatura, Eje, OA, Habilidad |
| **SIMCE** | Preguntas generadas automáticamente para ensayos 4° y 6° |

---

## Ficha 5: Evaluaciones

| Campo | Detalle |
|-------|---------|
| **Módulo** | Assessments |
| **Tipos** | DIAGNOSTICA, PROCESO, CIERRE, PARCIAL, FINAL, SIMCE |
| **Modalidades** | ONLINE, PRINTED, VISUAL_PROJECTED, NOTEBOOK, MIXED |
| **Máquina de estados** | DRAFT → PUBLISHED → ACTIVE → CLOSED → IN_GRADING → GRADED → REPORTED → ARCHIVED |
| **Campos** | Título, curso, asignatura, profesor, semestre, ponderación, fecha inicio/término, tiempo límite, puntaje máximo |
| **Opciones** | Preguntas aleatorias, permitir reintentos |

---

## Ficha 6: Rendición en Línea

| Campo | Detalle |
|-------|---------|
| **Módulo** | Assessment Attempts |
| **Flujo** | Estudiante inicia intento → Responde preguntas → Envía → Calificación |
| **Estados** | NOT_STARTED, IN_PROGRESS, SUBMITTED, GRADED, EXPIRED |
| **Tracking** | Tiempo de inicio, tiempo de envío, duración |
| **Seguridad** | Validación de pertenencia al curso, fechas de vigencia |

---

## Ficha 7: Libro de Calificaciones

| Campo | Detalle |
|-------|---------|
| **Módulo** | Grading / GradebookPage |
| **Vista** | Matriz: Estudiantes (filas) × Evaluaciones (columnas) |
| **Edición** | Click en celda → ingreso de nota → guardado automático |
| **Validación** | Rango 1.0 - 7.0, formato decimal chileno (coma) |
| **Indicadores** | Color rojo (<4.0), verde (≥6.0), pendientes (naranja) |
| **KPI** | Promedio curso, % aprobación, en riesgo, pendientes, notas registradas |
| **Exportación** | PDF con tabla completa + KPIs |
| **Filtros** | Curso, asignatura, búsqueda, solo riesgo, solo pendientes, notas <4.0 |

---

## Ficha 8: Corrección Rápida

| Campo | Detalle |
|-------|---------|
| **Módulo** | Grading (bulkGradeAnswers, directGradeRecord) |
| **Métodos** | Nota individual, carga masiva, nota directa sin respuesta previa |
| **Endpoints** | `POST /grading/grade`, `POST /grading/bulk-grade`, `POST /grading/direct-grade` |
| **Validación** | Rango 1.0-7.0, pertenencia al curso |

---

## Ficha 9: Reportes

| Campo | Detalle |
|-------|---------|
| **Módulo** | Reports |
| **Tipos** | STUDENT, COURSE, INSTITUTIONAL |
| **Formatos** | JSON (datos), PDF (descarga), XLSX/CSV (exportación) |
| **Máquina de estados** | PENDING → PROCESSING → COMPLETED → FAILED → EXPIRED |
| **Contenido** | Promedios, niveles de logro, OA descendidos, estudiantes en riesgo |
| **Filtros** | Por estudiante, curso, asignatura, OA, período |

---

## Ficha 10: Planes Remediales

| Campo | Detalle |
|-------|---------|
| **Módulo** | Remedial Plans |
| **Detección** | Automática: estudiantes <60% en OA priorizados |
| **Estados** | PENDING → IN_PROGRESS → COMPLETED → EVALUATED (EFFECTIVE/NOT_EFFECTIVE) |
| **Recursos** | Vinculación a guías, presentaciones, fichas de trabajo |
| **Seguimiento** | Tracking de progreso y efectividad |

---

## Ficha 11: Banco SIMCE

| Campo | Detalle |
|-------|---------|
| **Módulo** | SIMCE Bank (via Assessments con assessmentType=SIMCE) |
| **Ensayos** | 48 total: 10 Mat 4°, 10 Len 4°, 10 Mat 6°, 10 Len 6°, 8 Cie 6° |
| **Cursos** | 4° A/B y 6° A/B |
| **Estado** | Todos PUBLICADOS, Semestre 2 |
| **Preguntas** | Generación automática alineada al currículum |
| **Feature Flag** | `simce_bank: true` |

---

## Ficha 12: Notificaciones Email

| Campo | Detalle |
|-------|---------|
| **Módulo** | Notifications (EmailService) |
| **Motor** | Nodemailer con SMTP configurable |
| **Tipos** | Bienvenida, recuperación de contraseña, alerta de nota baja, evaluación publicada, reporte listo, plan remedial asignado |
| **Plantillas** | HTML inline con branding Cordillera SaaS |
| **Configuración** | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NOTIFICATION_EMAILS_ENABLED |

---

## Ficha 13: Importación/Exportación

| Campo | Detalle |
|-------|---------|
| **Módulo** | Data Import / Data Export |
| **Importación** | Excel (.xlsx) y CSV con validación previa, preview y rollback |
| **Exportación** | XLSX, CSV, JSON para estudiantes, notas, preguntas, cursos |
| **Entidades** | Students, grades, questions, courses |

---

## Ficha 14: Auditoría

| Campo | Detalle |
|-------|---------|
| **Módulo** | Audit Logs |
| **Registro** | Usuario, acción, entidad, IP, timestamp, detalles |
| **Filtros** | Por usuario, acción, entidad, fecha |
| **Resumen** | Agregaciones por acción y entidad |

---

## Ficha 15: Infraestructura y Despliegue

| Campo | Detalle |
|-------|---------|
| **Contenedores** | PostgreSQL 16, Backend (NestJS), Nginx, Backup (cron), pgAdmin (dev) |
| **Orquestación** | Docker Compose con healthchecks y reinicio automático |
| **Backup** | Automático diario (3am), rotación 30 días |
| **Nginx** | Reverse proxy con security headers, serve frontend estático |
| **CI/CD** | Build multi-stage Docker, scripts npm para lint/typecheck/test/build |

---

*Documento generado para la Fase 3 — Calidad y Operación*
*Cordillera SaaS v3.0 — Mayo 2026*
