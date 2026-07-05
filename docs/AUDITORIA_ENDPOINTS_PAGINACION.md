# Auditoria automatica de endpoints sin paginacion

Fecha: 2026-06-27

## Implementado

- Auditor AST en `scripts/audit-pagination.mjs`.
- Comando `npm run audit:pagination` incluido en `prerelease:check`.
- Linea base con huella SHA-256 por consulta en `scripts/pagination-audit-baseline.json`.
- Una consulta `findMany` nueva o modificada sin `take` falla automaticamente.
- Los limites variables expuestos se normalizan entre 1 y 100.

## Endpoints paginados en esta pasada

- `GET /attempts/assessment/:assessmentId`
- `GET /attempts/student/:studentId`
- `GET /observations`

Estos endpoints ahora responden con `data` y `meta`. La capa `frontend/src/lib/api.ts` mantiene compatibilidad con las pantallas actuales devolviendo `data`.

## Limites endurecidos

Se agrego maximo de 100 a usuarios, estudiantes, evaluaciones, SIMCE, reportes, banco de preguntas, recursos, lecciones, auditoria, jobs y notificaciones.

## Resultado del auditor

- 117 llamadas Prisma `findMany` inventariadas.
- 22 consultas con `take` explicito.
- 95 consultas internas o de dominio sin `take`.
- 81 consultas alcanzables desde controladores registradas en la linea base.
- 0 consultas nuevas o modificadas sin revisar.

Las excepciones corresponden a catalogos institucionales, relaciones acotadas por curso/alumno/evaluacion, comandos por lote y agregaciones que requieren el conjunto completo. Si cambia su contenido, la huella deja de coincidir y el prerelease falla para exigir una nueva revision.

## Uso

```bash
npm run audit:pagination
```

Solo despues de revisar una excepcion deliberada:

```bash
npm run audit:pagination:baseline
```