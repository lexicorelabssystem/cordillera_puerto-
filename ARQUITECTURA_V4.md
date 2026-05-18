# Arquitectura V4 (React + Node.js + PostgreSQL)

## 1) Objetivo funcional

Sistema de gestion academica con escala de notas `0.0 a 7.0`, registro por profesor en planilla por curso, KPI pedagogicos por curso/asignatura y panel de alumno con historico personal y promedio.

## 2) Stack tecnologico

- Frontend: `React + Vite + TypeScript + React Query + Recharts`.
- Backend: `Node.js + Express + TypeScript + JWT + Zod`.
- Base de datos: `PostgreSQL`.
- Seguridad: `bcryptjs`, tokens JWT, middleware por rol.

## 3) Capas principales

### Frontend
- `features/auth`: login y control de sesion.
- `features/profesor`: planilla de notas y KPI por curso.
- `features/alumno`: KPI personal e historial de notas.
- `features/admin`: base para gestion institucional.
- `lib/api`: cliente HTTP tipado.

### Backend
- `modules/auth`: login y emision de JWT.
- `modules/teachers`: asignaciones profesor-curso-asignatura.
- `modules/grades`: alta de evaluaciones y notas.
- `modules/kpi`: calculos KPI de curso y alumno.
- `modules/students` / `modules/courses`: consultas maestras.

## 4) Modelo de datos (PostgreSQL)

Tablas clave:
- `users` (`ADMIN`, `DIRECTION`, `TEACHER`, `STUDENT`).
- `teachers`, `students`.
- `school_years`, `courses`, `subjects`.
- `teacher_course_assignments`.
- `enrollments`.
- `assessments`.
- `grades` con restriccion: `grade >= 0.0 AND grade <= 7.0`.

## 5) Endpoints API base

- `POST /api/auth/login`
- `GET /api/courses`
- `GET /api/teacher/assignments`
- `GET /api/teacher/courses/:courseId/students`
- `GET /api/teacher/courses/:courseId/kpi`
- `POST /api/teacher/assessments`
- `GET /api/students/me/kpi`
- `GET /api/students/:studentId/grades`

## 6) KPI incluidos

- Promedio curso (nota 0-7).
- Equivalente porcentual (0-100).
- Nivel de desempeno (`Critico`, `Basico`, `Adecuado`, `Avanzado`).
- Cantidad de notas registradas.
- KPI personal del alumno.

## 7) Flujo principal de profesor

1. Inicia sesion.
2. Selecciona curso/asignatura asignada.
3. Carga planilla con notas por alumno.
4. Guarda evaluacion y notas.
5. Visualiza KPI y grafico de notas.

## 8) Flujo principal de alumno

1. Inicia sesion.
2. Visualiza su promedio general y KPI.
3. Revisa historial de evaluaciones y notas.
