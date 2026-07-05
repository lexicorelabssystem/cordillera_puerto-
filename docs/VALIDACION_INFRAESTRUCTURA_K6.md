# Validacion de infraestructura y carga

Fecha: 2026-06-27

## Infraestructura validada

- Docker Desktop 4.78.0 instalado y operativo.
- `docker compose config --quiet`: correcto.
- PostgreSQL 16: healthy.
- Redis 7: healthy.
- MinIO: healthy.
- API NestJS: healthy.
- Worker BullMQ: operativo con seis colas y un worker por cola.
- Migraciones aplicadas, incluyendo `archive_records`.
- MinIO inicializo los buckets desde API y worker.

## Escenario

- 50 alumnos concurrentes.
- 30 preguntas por evaluación.
- Tres guardados parciales por alumno.
- Entrega final y cálculo de nota.
- Una iteración exacta por VU.

## Hallazgos corregidos durante la validacion

1. El script usaba `ramping-vus` y repetía el examen. Se cambió a `per-vu-iterations`.
2. `startAttempt` enviaba cuerpo vacío con JSON. Ahora envía `{}`.
3. Login permitía solo 20 solicitudes por minuto por IP y bloqueaba escuelas tras NAT. Se ajustó a 100/min.
4. `bcryptjs` bloqueaba el event loop con 50 logins. Se sustituyó por `bcrypt` nativo, compatible con hashes existentes.

## Resultado final k6

- Iteraciones: 50/50.
- Checks: 350/350.
- Errores HTTP: 0.00%.
- HTTP p95: 850 ms.
- HTTP p99: 1.21 s.
- Login p95: 1.28 s.
- Inicio de intento p95: 511 ms.
- Guardado de respuestas p95: 916 ms.
- Envío final p95: 57 ms.
- Solicitudes sobre 2 segundos: 0%.
- Solicitudes sobre 5 segundos: 0%.

## Verificacion PostgreSQL

- Intentos: 50.
- Respuestas: 1.500.
- Notas: 50.

El resumen de máquina quedó en `.tmp/k6-summary-50-final.json` y no se versiona.