# Reporte: Migracion de PDFs de Assessment Templates a MinIO

Fecha: 2026-07-01  
Modulo: `assessment-templates`  
Estado: cerrado y validado en produccion

## Objetivo

Migrar el almacenamiento del PDF original subido en `POST /api/v1/assessment-templates/upload` desde el filesystem local (`/app/uploads/files`) hacia MinIO, usando el bucket de documentos productivo:

```text
educacore-documents
```

El objetivo operativo era que el PDF quedara como objeto durable en MinIO, que PostgreSQL guardara metadata suficiente para ubicarlo, y que la aplicacion pudiera leerlo/descargarlo nuevamente desde la app.

## Problema inicial

El endpoint de carga de plantillas funcionaba correctamente para:

- recibir PDF/DOCX
- parsear contenido
- extraer preguntas
- crear la plantilla

Pero el archivo fisico final quedaba guardado en:

```text
/app/uploads/files
```

En produccion esa ruta estaba montada en:

```text
/data/coolify/cordillera/uploads/files
```

Esto dejaba los PDFs dependientes del disco del contenedor/host, mientras que la infraestructura ya tenia MinIO configurado para documentos.

## Variables de entorno relevantes

Se uso la configuracion existente:

```env
STORAGE_DRIVER=minio
MINIO_ENDPOINT=...
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_DOCUMENTS_BUCKET=educacore-documents
MINIO_TEMP_BUCKET=educacore-temp
MINIO_ARCHIVES_BUCKET=educacore-archives
```

No se documentan access keys ni secrets en este reporte.

## Cambios implementados

### 1. StorageService

Archivo:

```text
backend/src/modules/storage/storage.service.ts
```

Se reutilizo el `StorageService` existente, que ya soporta drivers:

```text
local
minio
```

Se agrego el getter:

```ts
get driver() { return this.config.storage.driver; }
```

Esto permite registrar metadata segura (`local` o `minio`) sin exponer credenciales.

### 2. Metadata explicita en FileAsset

Archivo:

```text
backend/prisma/schema.prisma
```

Se agregaron campos en `FileAsset`:

```prisma
storageProvider String @default("local")
bucket          String?
objectKey       String?
```

Tambien se agregaron indices:

```prisma
@@index([storageProvider])
@@index([bucket, objectKey])
```

Migracion creada:

```text
backend/prisma/migrations/20260630000100_add_file_asset_storage_metadata/migration.sql
```

La migracion:

- agrega columnas nuevas
- marca registros antiguos como `local` o `minio` segun `storagePath`
- deriva `bucket` y `objectKey` desde `minio://bucket/key` cuando corresponde
- crea indices para consultas posteriores

### 3. FilesService con objectKey explicito

Archivo:

```text
backend/src/modules/data-ops/files/files.service.ts
```

Se mantuvo compatibilidad con `uploadFile(...)`.

Se agrego:

```ts
uploadFileAtKey(...)
```

Este metodo permite indicar explicitamente:

```text
bucket
objectKey
storageName
```

Tambien persiste:

```text
storageProvider
bucket
objectKey
storagePath
originalName
mimeType
size
```

Se agregaron logs seguros:

```text
Stored file asset driver=minio bucket=educacore-documents objectKey=... size=...
```

No se registran access keys ni secrets.

### 4. Upload de assessment templates hacia MinIO

Archivo:

```text
backend/src/modules/assessments/templates/assessment-templates.service.ts
```

Antes:

- el archivo se guardaba antes de crear la plantilla
- quedaba con una ruta generica `files/{uuid}.pdf`
- luego se actualizaba `entityId`

Ahora:

1. Se parsea el PDF/DOCX desde `Buffer`.
2. Se crea la plantilla para obtener `templateId`.
3. Se genera un `objectKey` estable:

```text
assessment-templates/{templateId}/original.pdf
```

o `.docx` si corresponde.

4. Se sube el archivo original al bucket configurado:

```text
educacore-documents
```

5. Se crea `FileAsset` con metadata MinIO.
6. Se enlaza `assessmentTemplate.sourceFileId`.

Ejemplo real validado:

```text
bucket=educacore-documents
objectKey=assessment-templates/e3912f25-c1d6-4786-b97b-7bf16b6d30a9/original.pdf
```

### 5. Endpoint interno de descarga por templateId

Archivos:

```text
backend/src/modules/assessments/templates/assessment-templates.controller.ts
backend/src/modules/assessments/templates/assessment-templates.service.ts
backend/src/modules/data-ops/files/files.service.ts
```

Se agrego endpoint:

```text
GET /api/v1/assessment-templates/:id/source/download
```

Este endpoint:

- valida permisos sobre la plantilla
- lee `sourceFileId`
- busca el `FileAsset`
- usa `StorageService` para leer desde MinIO o local
- devuelve el archivo original como descarga

Esto evita depender del nombre interno del archivo y permite descargar desde la app usando el `templateId`.

### 6. Boton interno en frontend

Archivos:

```text
frontend/src/lib/api.ts
frontend/src/pages/admin/AssessmentTemplatesPage.tsx
```

Se agrego:

```ts
api.downloadAssessmentTemplateSource(id)
```

Tambien se ajusto `requestBlob(...)` para:

- enviar `Authorization: Bearer ...`
- usar `credentials: "include"`
- refrescar sesion si recibe `401`

En la pantalla Banco de Pruebas se agrego boton:

```text
Descargar fuente
```

Disponible:

- en la tabla de plantillas
- en el detalle de la plantilla seleccionada

## Validaciones realizadas

### Build backend

Comando:

```bash
npm --workspace backend run build
```

Resultado:

```text
OK
```

Incluyo `prisma generate` y validacion TypeScript.

### Typecheck frontend

Comando:

```bash
npm --workspace frontend run typecheck
```

Resultado:

```text
OK
```

### Arranque backend con MinIO

Evidencia de log:

```text
[StorageService] MinIO storage backend enabled
[NestApplication] Nest application successfully started
```

### Upload real de PDF

Evidencia de log:

```text
[FilesService] Stored file asset driver=minio bucket=educacore-documents objectKey=assessment-templates/e3912f25-c1d6-4786-b97b-7bf16b6d30a9/original.pdf size=1980377
[AssessmentTemplatesService] Assessment template source stored driver=minio bucket=educacore-documents objectKey=assessment-templates/e3912f25-c1d6-4786-b97b-7bf16b6d30a9/original.pdf size=1980377
[HTTP] POST /api/v1/assessment-templates/upload?... -> 201
```

### Verificacion visual en MinIO

Se confirmo en MinIO:

```text
educacore-documents/
  assessment-templates/
```

Con objeto asociado al template subido.

### Descarga/lectura desde MinIO

Evidencia de log:

```text
[HTTP] GET /api/v1/assessment-templates/e3912f25-c1d6-4786-b97b-7bf16b6d30a9/source/download -> 200
```

Esto confirma el ciclo completo:

```text
subida PDF -> MinIO -> metadata PostgreSQL -> lectura desde backend -> descarga en app
```

## Resultado alcanzado

El modulo `assessment-templates` ahora:

- guarda el PDF original en MinIO cuando `STORAGE_DRIVER=minio`
- usa bucket `educacore-documents`
- genera `objectKey` estable por plantilla
- persiste metadata en PostgreSQL
- mantiene compatibilidad con `STORAGE_DRIVER=local`
- permite descargar el PDF fuente desde la app
- evita exponer credenciales en logs
- registra logs seguros con driver, bucket, objectKey y size

## Estado de compatibilidad local

Con:

```env
STORAGE_DRIVER=local
```

`StorageService.put(...)` sigue guardando en filesystem local bajo `uploads/...`.

Esto mantiene desarrollo local funcional sin MinIO.

## Consideraciones operativas

### Plantillas antiguas

Algunas plantillas antiguas pueden no tener `sourceFileId` o no tener archivo fuente migrado. En esos casos, la descarga puede devolver `404`.

Ejemplo observado:

```text
GET /api/v1/assessment-templates/025aa810-0b8c-4fe9-93d7-147ee905b26d/source/download -> 404
```

Esto no representa fallo del flujo nuevo; indica que esa plantilla no tiene archivo fuente asociado o no fue creada bajo el nuevo flujo.

### CORS/CSRF en Vercel previews

Durante las pruebas aparecieron previews Vercel con dominios dinamicos. Para evitar bloqueos, `CORS_ORIGINS` debe incluir el origen exacto que usa el frontend.

Ejemplo:

```text
https://cordillera-puerto-frontend-<hash>.vercel.app
```

Para produccion estable se recomienda usar un dominio fijo y mantenerlo en `CORS_ORIGINS`.

### No limpiar uploads todavia

Aunque el flujo nuevo ya no deja PDFs finales de assessment templates en `/app/uploads/files`, no se recomienda borrar esa carpeta todavia.

Antes de limpiar se debe:

1. Inventariar archivos locales.
2. Cruzarlos con `file_assets.storagePath`.
3. Identificar archivos historicos usados por otros modulos.
4. Migrar o conservar segun corresponda.

## Consultas utiles

Ver ultimos archivos de assessment templates:

```sql
SELECT
  id,
  "entityId",
  "storageProvider",
  bucket,
  "objectKey",
  "storagePath",
  "originalName",
  "mimeType",
  size,
  "createdAt"
FROM file_assets
WHERE "entityType" = 'assessment-template'
ORDER BY "createdAt" DESC
LIMIT 10;
```

Ver plantilla y archivo fuente:

```sql
SELECT
  at.id AS template_id,
  at.title,
  at."sourceFileId",
  fa."storageProvider",
  fa.bucket,
  fa."objectKey",
  fa."storagePath",
  fa."originalName",
  fa.size
FROM assessment_templates at
LEFT JOIN file_assets fa ON fa.id = at."sourceFileId"
ORDER BY at."createdAt" DESC
LIMIT 10;
```

## Archivos modificados

Backend:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20260630000100_add_file_asset_storage_metadata/migration.sql
backend/src/modules/storage/storage.service.ts
backend/src/modules/data-ops/files/files.service.ts
backend/src/modules/assessments/templates/assessment-templates.service.ts
backend/src/modules/assessments/templates/assessment-templates.controller.ts
```

Frontend:

```text
frontend/src/lib/api.ts
frontend/src/pages/admin/AssessmentTemplatesPage.tsx
```

## Proximo paso recomendado

El siguiente paso sano es inventariar `/app/uploads/files` y revisar que otros modulos todavia dependen de almacenamiento local.

Orden recomendado:

1. Inventario de archivos locales.
2. Cruce con `file_assets`.
3. Identificar modulos pendientes.
4. Migrar los que deban vivir en MinIO.
5. Solo despues, planificar limpieza controlada de archivos locales antiguos.

