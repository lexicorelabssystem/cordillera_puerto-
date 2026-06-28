# Politica de archivado semestral

Fecha: 2026-06-27

## Objetivo

Reducir el volumen de tablas calientes sin perder trazabilidad académica ni capacidad de restauración.

## Calendario

- Ejecución automática: 1 de enero y 1 de julio a las 03:00.
- Cada institución genera un manifiesto independiente.
- El corte automático corresponde al semestre terminado aproximadamente seis meses antes.
- También puede solicitarse un corte manual mediante `POST /archives`.

## Datos archivados

- Intentos de evaluaciones cerradas, calificadas o reportadas.
- Respuestas de estudiantes asociadas a esos intentos.
- Reportes históricos anteriores al corte.
- Metadatos de exportaciones completadas o fallidas anteriores al corte.

## Datos conservados en PostgreSQL

- Definición de la evaluación y sus preguntas.
- Notas finales (`grades`).
- Estudiantes, cursos, asignaturas y periodos.
- Manifiesto `ArchiveRecord`, checksum y conteos.

La evaluación queda con estado `ARCHIVED`, `isActive=false` y `archivedAt` informado.

## Almacenamiento

- Bucket: `educacore-archives`.
- Formato actual: snapshot JSON con versión de esquema.
- Integridad: checksum SHA-256 validado antes de restaurar.
- Escritura del snapshot: ocurre antes de eliminar filas calientes.

## Retención

- Valor predeterminado: 7 años desde la fecha de corte.
- Rango manual permitido: 1 a 20 años.
- `retentionUntil` informa cuándo termina la retención.
- No existe eliminación automática al vencer. La purga definitiva requiere una política legal aprobada y una acción administrativa futura.

## Restauración

1. `POST /archives/:id/restore` encola el trabajo.
2. El worker descarga el snapshot.
3. Verifica SHA-256.
4. Restaura intentos, respuestas, reportes y exportaciones con sus IDs originales.
5. Recupera estado e indicador activo de cada evaluación.
6. Marca el manifiesto como `RESTORED`.

La operación usa `skipDuplicates` para ser tolerante a reintentos y una transacción de base de datos.

## Seguridad

- Solo `ADMIN` y `SUPER_ADMIN` acceden a endpoints de archivo.
- Un administrador institucional solo puede crear, listar y restaurar archivos de su institución.
- Solo `SUPER_ADMIN` puede solicitar alcance global.

## Endpoints

- `POST /archives`
- `GET /archives`
- `GET /archives/:id`
- `POST /archives/:id/restore`

## Estados

- `PENDING`
- `PROCESSING`
- `ARCHIVED`
- `RESTORING`
- `RESTORED`
- `FAILED`