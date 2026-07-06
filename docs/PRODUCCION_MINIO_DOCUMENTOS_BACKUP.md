# Produccion: MinIO para documentos, versionado y recuperacion

Este runbook cubre el uso de MinIO para archivos del sistema educativo y su
operacion basica en produccion.

## Estado objetivo

PostgreSQL debe guardar metadata. MinIO debe guardar archivos pesados.

Buckets recomendados:

- `educacore-documents`: PDFs, materiales, documentos de evaluaciones y archivos asociados a entidades.
- `educacore-temp`: exportaciones temporales generadas por worker.
- `educacore-archives`: snapshots de archivado semestral.
- `educacore-backups`: backups de PostgreSQL creados por Coolify.

No mezclar documentos con backups de base de datos.

## Variables para API y worker

Estas variables deben existir tanto en el backend como en el worker:

```env
STORAGE_DRIVER=minio
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=change-me-access-key
MINIO_SECRET_KEY=change-me-generate-secure-random
MINIO_DOCUMENTS_BUCKET=educacore-documents
MINIO_TEMP_BUCKET=educacore-temp
MINIO_ARCHIVES_BUCKET=educacore-archives
```

`MINIO_ENDPOINT` va sin `https://`; el protocolo se define con `MINIO_USE_SSL`.

## Versionado recomendado

Activar versionado en:

- `educacore-documents`
- `educacore-archives`

No activar versionado en:

- `educacore-temp`, salvo que exista una razon puntual.
- `educacore-backups`, si la retencion ya la maneja Coolify.

Motivo: documentos y archivos archivados necesitan recuperacion ante borrado o
sobrescritura accidental. Temporales y backups ya tienen politicas de limpieza
propias.

## Lifecycle recomendado

Reglas sugeridas:

- `educacore-temp`: expirar objetos actuales despues de 7 dias.
- `educacore-documents`: conservar versiones no actuales 30 a 90 dias.
- `educacore-archives`: sin expiracion automatica.
- `educacore-backups`: usar la retencion configurada en el scheduled backup de PostgreSQL.

## Comandos mc de referencia

Configurar alias:

```bash
mc alias set educacore https://minio.example.com ACCESS_KEY SECRET_KEY
```

Crear buckets si faltan:

```bash
mc mb --ignore-existing educacore/educacore-documents
mc mb --ignore-existing educacore/educacore-temp
mc mb --ignore-existing educacore/educacore-archives
```

Activar versionado:

```bash
mc version enable educacore/educacore-documents
mc version enable educacore/educacore-archives
```

Agregar lifecycle para temporales:

```bash
mc ilm rule add --expire-days 7 educacore/educacore-temp
```

Agregar lifecycle para versiones antiguas de documentos:

```bash
mc ilm rule add --noncurrent-expire-days 60 educacore/educacore-documents
```

Revisar estado:

```bash
mc version info educacore/educacore-documents
mc version info educacore/educacore-archives
mc ilm rule ls educacore/educacore-temp
mc ilm rule ls educacore/educacore-documents
```

## Scripts del repositorio

Revisar buckets, versionado, lifecycle y escritura temporal:

```powershell
./scripts/minio-check.ps1
```

Preparar buckets, versionado y lifecycle en modo simulacion:

```powershell
./scripts/minio-bootstrap.ps1
```

Aplicar la preparacion:

```powershell
./scripts/minio-bootstrap.ps1 -Apply
```

Los scripts leen las variables `MINIO_*` del entorno y no imprimen secretos en
mensajes de error ni en modo dry-run.
## Backup externo real

MinIO en el mismo VPS protege contra separar archivos de PostgreSQL y contra
errores dentro de la aplicacion, pero no protege contra perdida completa del VPS.

Para respaldo externo usar uno de estos caminos:

- Replicacion bucket a bucket hacia otro MinIO/S3 compatible.
- Mirror programado hacia Backblaze B2, Wasabi, AWS S3 u otro proveedor.
- Snapshot del volumen del VPS mas backup S3 externo.

`mc mirror` sirve para copiar objetos actuales. Para conservar historico de
versiones, usar replicacion de buckets, no solo mirror.

## Prueba minima de recuperacion

1. Subir un PDF desde el sistema.
2. Confirmar que aparece en `educacore-documents/files/...`.
3. Descargarlo desde la aplicacion.
4. Borrarlo desde la aplicacion.
5. Confirmar que desaparece el objeto actual.
6. Si el bucket tiene versionado, confirmar que existe una version previa recuperable.
7. Restaurar el objeto en un bucket o prefijo de prueba.
8. Confirmar que el archivo restaurado abre correctamente.

## Criterio de cierre

Esta fase queda cerrada cuando:

- Backend y worker arrancan con `MinIO storage backend enabled`.
- Los archivos nuevos se guardan en `educacore-documents`.
- Las exportaciones temporales se guardan en `educacore-temp`.
- El borrado desde la aplicacion elimina el objeto en MinIO.
- Existe versionado en documentos y archivos.
- Existe una prueba de recuperacion documentada.
- Existe una estrategia definida para copia externa fuera del VPS.
