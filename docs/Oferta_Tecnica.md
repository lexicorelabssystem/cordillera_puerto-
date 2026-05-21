# Oferta Técnica — Cordillera SaaS v3.0
## Plataforma de Monitoreo de Aprendizajes
### Escuela Mario Muñoz Silva — SLEP Puerto Cordillera

---

## 1. Alcance Funcional Punto a Punto vs Requerimiento

| # | Requerimiento Licitación | Estado | Evidencia |
|---|--------------------------|--------|-----------|
| 1 | Login real con roles y permisos | ✅ Cumple | JWT + refresh tokens, 7 roles, 56+ permisos granulares |
| 2 | Catálogo de cursos/asignaturas/OA | ✅ Cumple | 24 cursos, 4 asignaturas, 14 OA por grado, ejes y habilidades |
| 3 | Carga de instrumentos de evaluación | ✅ Cumple | CRUD de evaluaciones con banco de preguntas (5 tipos) |
| 4 | Rendición en línea (online assessment) | ✅ Cumple | Attempts con time tracking, 5 estados, múltiples intentos |
| 5 | Reportes históricos por estudiante/curso/asignatura/OA | ✅ Cumple | 6 tipos de reportes con estado de generación |
| 6 | Descarga PDF de pruebas y claves | ✅ Cumple | PDF export con jsPDF (pruebas, libro de clases, reportes) |
| 7 | Banco SIMCE: 10/10/10/10/8 ensayos | ✅ Cumple | 48 ensayos SIMCE con preguntas (Mat/Len 4° y 6°, Cie 6°) |
| 8 | Corrección rápida masiva | ✅ Cumple | Edición inline en libro de clases + bulk grading |
| 9 | Ruta remedial automática | ✅ Cumple | Detección automática, planes remediales, recursos sugeridos |
| 10 | Notificaciones por email | ✅ Cumple | Nodemailer con plantillas HTML (alertas, reportes, bienvenida) |
| 11 | Libro de clases digital | ✅ Cumple | Vista tipo libro con notas, promedios, semaforización |
| 12 | Filtros obligatorios (15 tipos) | ✅ Cumple | Año, período, curso, nivel, asignatura, tipo, estado, OA, etc. |
| 13 | Evaluaciones tipo SIMCE, Diagnóstica, Proceso, Cierre, Parcial, Final | ✅ Cumple | 6 tipos de evaluación en enum AssessmentType |
| 14 | Módulo de importación/exportación de datos | ✅ Cumple | Excel/CSV import con validación + export XLSX/CSV/JSON |
| 15 | Auditoría completa | ✅ Cumple | AuditLog con filtros, resumen, trazabilidad por usuario |

**Cumplimiento total: 15/15 (100%)**

---

## 2. Plan de Implementación con Hitos y Fechas

### Fase 1: Base Productiva (Semanas 1-4) ✅ COMPLETADA
- Semana 1-2: Infraestructura, auth, catálogo académico
- Semana 3: Carga de instrumentos y evaluación en línea
- Semana 4: Reportes históricos y dashboard

### Fase 2: Cumplimiento Licitación (Semanas 5-9) ✅ COMPLETADA
- Semana 5-6: PDF export, banco SIMCE
- Semana 7: Corrección rápida masiva
- Semana 8: Rutas remediales automáticas
- Semana 9: Notificaciones email, integración final

### Fase 3: Calidad y Operación (Semanas 10-12) ✅ COMPLETADA
- Semana 10: Pruebas de carga y seguridad, tests automatizados
- Semana 11: Documentación, manuales y capacitación
- Semana 12: Evidencias, demo y puesta en producción

---

## 3. Metodología de Soporte y Capacitación

### 3.1 Capacitación Presencial (3 sesiones)

| Sesión | Duración | Participantes | Contenido |
|--------|----------|---------------|-----------|
| Sesión 1 | 2 horas | Directivos y UTP | Dashboard, reportes, filtros, monitoreo institucional |
| Sesión 2 | 3 horas | Docentes | Creación de evaluaciones, libro de clases, ingreso de notas, corrección |
| Sesión 3 | 2 horas | Administrador | Gestión de usuarios, permisos, importación/exportación, SIMCE |

### 3.2 Mesa de Ayuda

- **Horario**: Lunes a Viernes, 8:30-17:30 hrs
- **Canales**: Correo soporte@cordillera.cl, WhatsApp (+56 9 XXXX XXXX)
- **Tiempo de respuesta**: < 4 horas hábiles
- **Resolución**: < 24 horas para incidentes, < 48 horas para consultas

### 3.3 Material de Apoyo

- Manual de Usuario impreso y digital
- Videos tutoriales (5-10 min cada uno)
- Guías rápidas por rol (Docente, UTP, Directivo, Admin)

---

## 4. SLA y Tiempos de Respuesta

| Nivel | Descripción | Respuesta Inicial | Resolución |
|-------|-------------|-------------------|------------|
| Crítico | Plataforma no disponible | < 1 hora | < 4 horas |
| Alto | Funcionalidad principal afectada | < 2 horas | < 8 horas |
| Medio | Funcionalidad secundaria afectada | < 4 horas | < 24 horas |
| Bajo | Consulta o mejora | < 8 horas | < 48 horas |

**Disponibilidad objetivo**: 99.5% mensual (horario hábil)

---

## 5. Matriz de Cumplimiento

| Criterio de Aceptación | Cumple | Parcial | No Aplica | Evidencia |
|------------------------|--------|---------|-----------|-----------|
| Docente crea/aplica evaluación online en <5 min | ✅ | | | Demo grabada |
| Directivo descarga reporte PDF con histórico | ✅ | | | PDF generado |
| Admin carga banco de ensayos SIMCE | ✅ | | | 48 ensayos en seed |
| Sistema sugiere acciones remediales <60% | ✅ | | | Pantalla remedial |
| Plataforma usable en desktop y celular | ✅ | | | Responsive design |
| Login seguro con roles | ✅ | | | JWT + refresh tokens |
| Libro de clases digital completo | ✅ | | | GradebookPage |
| Filtros obligatorios implementados | ✅ | | | 15 tipos de filtro |
| Corrección rápida masiva | ✅ | | | Bulk grading |
| Importación/exportación datos | ✅ | | | Excel/CSV/JSON |
| Auditoría completa | ✅ | | | AuditLog |
| Notificaciones email | ✅ | | | Nodemailer |
| Pruebas automatizadas | ✅ | | | 200+ tests |

**Resultado: 13/13 criterios = 100% cumplimiento**

---

## 6. Arquitectura Técnica

### Stack Tecnológico
- **Backend**: NestJS 11 + Fastify + Prisma 6 + PostgreSQL 16
- **Frontend**: React 18 + Vite + TypeScript + TanStack Query + Recharts
- **Infraestructura**: Docker Compose (PostgreSQL, Backend, Backup, Nginx)
- **Autenticación**: JWT (access 15min + refresh 7d) + bcrypt
- **PDF**: jsPDF + jspdf-autotable (cliente)
- **Email**: Nodemailer con plantillas HTML inline
- **Testing**: Jest (backend) + Vitest (frontend)

### Modelos de Datos
- 50 modelos/tablas
- 14 enums
- 6 máquinas de estado (Assessment, Attempt, RemedialPlan, Report, GradeChange, Lesson)

### Endpoints API
- 171 endpoints REST documentados con Swagger en `/api/docs`

---

*Documento generado para la Fase 3 — Calidad y Operación*
*Cordillera SaaS v3.0 — Mayo 2026*
