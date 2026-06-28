# REPORTE DE OPTIMIZACIONES PARA ESCALABILIDAD DE PRUEBAS

## 1. Objetivo

Este reporte resume las optimizaciones recomendadas para que el sistema educativo pueda crecer de forma ordenada y soportar pruebas online con al menos 50 alumnos simultaneos, cada uno respondiendo aproximadamente 30 preguntas.

Escenario base:

- 50 alumnos simultaneos.
- 30 preguntas por prueba.
- 1.500 respuestas totales por evaluacion.
- Backend NestJS/Fastify.
- PostgreSQL con Prisma.
- Frontend React/Vite.
- Archivos actualmente en almacenamiento local `uploads`.
- Redis presente en `docker-compose`, util para futuras colas/cache.

La prioridad es proteger el flujo critico de prueba activa: login, carga de evaluacion, guardado de respuestas, envio final y calculo de nota.

## 2. Principio central

Durante una prueba activa, el sistema debe hacer solo trabajo liviano y predecible.

Debe ejecutarse durante la prueba:

- Login del alumno.
- Obtener perfil minimo.
- Obtener evaluacion asignada.
- Obtener preguntas ya procesadas.
- Crear o continuar intento.
- Guardar respuestas.
- Finalizar intento.
- Calcular puntaje simple.
- Guardar nota.

No debe ejecutarse durante la prueba:

- Procesamiento PDF.
- OCR.
- Importaciones masivas.
- Exportaciones Excel/PDF.
- Reportes institucionales.
- Recaclulos completos.
- Dashboards globales pesados.
- Backups o limpiezas.
- Correccion masiva.

## 3. Prioridades recomendadas

| Prioridad | Optimizacion | Impacto | Riesgo del cambio | Estado |
| --- | --- | --- | --- | --- |
| P0 | Validar permisos en exportaciones | Evita fuga de datos | Medio | Implementado |
| P1 | Optimizar `saveAnswers` | Reduce consultas durante prueba | Medio | Implementado |
| P1 | Hacer `submitAttempt` transaccional | Evita estados parciales | Medio | Implementado |
| P1 | Preprocesar PDF/SIMCE antes de prueba | Evita CPU/IO pesado con alumnos conectados | Alto | Implementado |
| P1 | Evitar recaclulos repetidos en `bulkGradeAnswers` | Reduce carga severa | Medio | Implementado |
| P1 | Mover reportes/exportaciones/recalculos a worker | Protege API principal | Medio/Alto | Implementado |
| P2 | Integrar MinIO para archivos | Evita llenar disco local | Medio | Implementado |
| P2 | Cachear vista estudiante de evaluacion activa en Redis | Reduce carga PostgreSQL | Medio | Implementado |
| P2 | Ajustar polling frontend | Reduce requests innecesarias | Bajo | Implementado |
| P2 | Agregar limites DTO | Protege contra payloads grandes | Bajo | Implementado |


## 3.1 Avance aplicado hasta ahora

Fecha de actualizacion: 2026-06-27.

Cambios ya implementados:

- `backend/src/modules/data-ops/exports/exports.service.ts`: se agrego validacion de alcance por usuario antes de exportar estudiantes, notas, evaluaciones y banco de preguntas.
- `backend/src/modules/assessments/attempts/attempts.service.ts`: `saveAnswers` ahora carga opciones en lote, usa mapas en memoria, valida que la alternativa pertenezca a la pregunta y guarda en transaccion.
- `backend/src/modules/assessments/attempts/attempts.service.ts`: `submitAttempt` ahora ejecuta correccion objetiva pendiente, creacion de omitidas, calculo de puntaje, cierre de intento y creacion/actualizacion de nota dentro de una transaccion.
- `backend/src/modules/simce/simce.service.ts`: el worker parsea el PDF una sola vez y guarda el documento preparado en Redis sin expiracion; `getStudentSimceEssay` solo lee ese resultado compartido y nunca parsea el PDF durante la apertura del alumno.
- `backend/src/modules/assessments/grading/grading.service.ts`: `bulkGradeAnswers` ahora valida respuestas en lote, actualiza las correcciones en una transaccion y ejecuta `recalculateAssessment` solo una vez por evaluacion afectada.
- Se agregaron limites DTO en respuestas, SIMCE, correccion masiva y exportaciones para cortar payloads grandes antes de llegar a los servicios.
- Se agregaron indices Prisma faltantes en `student_answers`, `grades`, `assessments` y modelos SIMCE; el schema fue validado con `prisma validate`.
- Se ajusto el polling frontend del alumno: dashboard y ensayos SIMCE sin refresco automatico periodico, intento activo con polling cada 60 segundos.
- `findById` de evaluaciones ahora usa una consulta separada para estudiantes que no carga `isCorrect` ni `explanation` desde la base de datos.
- Se implemento cache Redis/fallback en memoria para la vista estudiante de evaluaciones usando `CacheService`, con TTL de 60 segundos e invalidacion en mutaciones de evaluacion/preguntas.
- Se completo BullMQ con colas independientes para exportaciones, recalculos, procesamiento PDF SIMCE, reportes y limpieza automatica.
- API y worker se ejecutan como servicios Docker separados y comparten Redis, PostgreSQL, MinIO y el volumen `uploads` como fallback/local.
- Se agrego persistencia de estados mediante `ExportJob` y `BackgroundJob`, incluyendo la migracion de `background_jobs`.
- Los reportes institucionales, de curso, estudiante, OA y riesgo ahora se generan exclusivamente en el worker.
- El frontend usa exportaciones asincronas, muestra el historial real de jobs y refresca reportes pendientes hasta su finalizacion.
- El healthcheck de la API informa estado, workers y contadores de las seis colas BullMQ.
- La confirmacion de pauta SIMCE ya no oculta errores al encolar el procesamiento PDF.
- El resultado del parsing SIMCE se conserva en Redis sin TTL; si aun no esta disponible, el alumno recibe estado de preparacion pendiente en lugar de activar parsing en vivo.
- Se integro `StorageService` con driver `local|minio`; las cargas nuevas de `FileAsset` se guardan en MinIO cuando `STORAGE_DRIVER=minio`.
- `docker-compose.yml` ahora incluye servicio `minio`, bucket persistente `miniodata` y variables `MINIO_*` para API y worker.
- Exportaciones asincronas generadas por el worker se suben al bucket temporal de MinIO y se descargan desde el endpoint existente de archivos.
- Se agrego cola BullMQ `cleanup` con ejecucion horaria para borrar `FileAsset` expirados y exportaciones temporales antiguas.
- Los reportes nuevos guardan el JSON completo en `FileAsset`/MinIO y mantienen solo filtros livianos en la tabla `reports`.
- Se implemento archivado semestral reversible por institucion con cola BullMQ, snapshot en MinIO, checksum SHA-256, retencion y restauracion administrativa.
- El listado de reportes ya no transporta el resultado completo; el frontend carga el detalle solo al abrir o descargar PDF/CSV/JSON.

Validacion ejecutada:

- `npm --workspace backend run typecheck`: correcto.
- `npm --workspace frontend run typecheck`: correcto.
- `npm --workspace backend run build`: correcto.
- `npm --workspace frontend run build`: correcto, con advertencia Vite de chunks grandes.
- `npm --workspace backend test -- --runInBand src/modules/simce/simce.service.spec.ts`: correcto, 17 tests.
- `git diff --check`: correcto, solo advertencias CRLF/LF de Git.
- `docker compose config --quiet`: correcto. Infraestructura levantada y k6 50x30 aprobado con 0% de errores y HTTP p95 de 850 ms.

Observacion:

- La validacion de exportacion de banco de preguntas para perfiles institucionales queda limitada por el modelo actual, porque `Question` no tiene `institutionId`. Para docentes se restringe por asignaturas asignadas; para aislamiento institucional perfecto se recomienda agregar relacion institucional o ownership mas explicito al banco de preguntas.

## 4. Optimizacion del flujo de respuestas

### Problema

Con 50 alumnos y 30 preguntas hay 1.500 respuestas. Eso no es excesivo para PostgreSQL, pero puede volverse pesado si cada respuesta dispara una llamada independiente o si el backend consulta la pauta/opcion correcta una por una.

### Objetivo

Evitar:

- 1.500 requests individuales.
- Consultas repetidas por cada alternativa.
- Guardados sin transaccion.
- Recalculos innecesarios.

### Estrategia recomendada

El frontend debe acumular respuestas localmente y enviar lotes.

Flujo recomendado:

1. Alumno abre la prueba.
2. Backend entrega preguntas ya procesadas.
3. Alumno responde en memoria local del navegador.
4. Frontend guarda cambios cada 20-30 segundos o al cambiar de bloque/pagina.
5. Al finalizar, frontend envia las 30 respuestas finales.
6. Backend calcula puntaje y guarda nota en una operacion atomica.

Resultado esperado:

| Modelo | Requests aproximadas |
| --- | --- |
| Guardar cada clic | Hasta 1.500 requests |
| Guardar por bloques | 100 a 200 requests |
| Guardar manual + final | 50 a 100 requests |

## 5. Optimizar `saveAnswers`

Archivo auditado:

- `backend/src/modules/assessments/attempts/attempts.service.ts`

### Problema actual

`saveAnswers` procesa cada respuesta en un loop y puede consultar `questionOption.findUnique` por cada alternativa seleccionada.

Con 50 alumnos x 30 preguntas, eso puede convertirse en muchas consultas repetidas.

### Recomendacion

Reestructurar `saveAnswers` para:

- Cargar una vez las preguntas de la evaluacion.
- Cargar una vez las opciones necesarias.
- Crear mapas en memoria:
  - `questionId -> points`
  - `questionId -> type`
  - `optionId -> isCorrect`
- Procesar respuestas usando esos mapas.
- Guardar en una transaccion.

### Beneficio

Reduce consultas repetidas y hace que el costo sea mas estable aunque aumenten alumnos o preguntas.

### Estado aplicado

Implementado en `backend/src/modules/assessments/attempts/attempts.service.ts`.

Cambios concretos:

- Se reemplazo la busqueda lineal de preguntas por `Map`.
- Se reemplazo `questionOption.findUnique` por respuesta por una carga unica con `questionOption.findMany`.
- Se valida que `selectedOptionId` pertenezca a la pregunta enviada.
- Se guarda el lote de respuestas y `timeSpentSec` dentro de `prisma.$transaction`.

## 6. Hacer `submitAttempt` transaccional

Archivo auditado:

- `backend/src/modules/assessments/attempts/attempts.service.ts`

### Problema

El envio final crea respuestas omitidas, recalcula puntaje, actualiza intento y crea/actualiza nota. Si falla a mitad del proceso, puede quedar estado parcial.

### Recomendacion

Envolver en `prisma.$transaction`:

- Crear respuestas omitidas.
- Recalcular respuestas pendientes si aplica.
- Calcular puntaje.
- Actualizar intento.
- Crear/actualizar nota.

### Beneficio

Garantiza consistencia: el intento queda completo o no se aplica nada.

### Estado aplicado

Implementado en `backend/src/modules/assessments/attempts/attempts.service.ts`.

Cambios concretos:

- Se corrigieron respuestas objetivas pendientes dentro de una transaccion.
- Se crean respuestas omitidas con `createMany` y `skipDuplicates`.
- Se calcula puntaje usando las respuestas definitivas ya persistidas.
- Se actualiza el intento y se crea/actualiza `Grade` dentro de la misma transaccion.

## 7. Preprocesar PDF y SIMCE antes de la prueba

Archivo auditado:

- `backend/src/modules/simce/simce.service.ts`

### Problema critico

`getStudentSimceEssay` lee el PDF desde disco y lo parsea cuando el alumno abre el ensayo.

Con 50 alumnos abriendo el mismo ensayo, el backend puede leer y parsear el mismo PDF 50 veces.

### Flujo correcto

1. Profesor sube PDF.
2. Backend procesa PDF una sola vez.
3. Preguntas y alternativas se guardan en base de datos.
4. Profesor revisa/confirma.
5. Prueba queda lista.
6. Alumno recibe preguntas desde DB/cache, no desde PDF.

### Beneficio

Elimina CPU/IO pesado durante la prueba activa.

### Estado aplicado

Implementado en `backend/src/modules/simce/simce.service.ts`, `backend/src/modules/workers/processors/simce-pdf.processor.ts` y `backend/src/worker-app.module.ts`.

Cambios concretos:

- El worker `simce-pdf` lee el PDF desde `StorageService`, por lo que funciona con MinIO o almacenamiento local.
- `preParsePdfDocument` parsea el documento una sola vez y guarda el resultado preparado en Redis con clave `simce:pdf:{fileId}:parsed` sin TTL.
- `getStudentSimceEssay` lee el documento preparado desde Redis y no ejecuta parsing durante la apertura del alumno.
- Si el PDF aun no fue procesado, el alumno recibe una respuesta de preparacion pendiente en vez de cargar CPU/IO en la API principal.
- La confirmacion de pauta SIMCE encola el procesamiento y no oculta errores de cola.

Mejora futura opcional:

- El flujo ya evita parsing en vivo para alumnos. A futuro se puede persistir la estructura final de preguntas/instrucciones SIMCE en tablas propias para recuperar el documento preparado incluso tras perder Redis.

## 8. Corregir `bulkGradeAnswers`

Archivo auditado:

- `backend/src/modules/assessments/grading/grading.service.ts`

### Problema

`bulkGradeAnswers` llama a `gradeAnswer` por cada respuesta. Cada `gradeAnswer` llama a `recalculateAssessment`.

Ejemplo:

- 20 respuestas corregidas.
- 20 llamadas a recalculo completo.

### Recomendacion

Cambiar el flujo:

1. Validar todas las respuestas.
2. Actualizar todas las respuestas.
3. Ejecutar un solo `recalculateAssessment` al final.

### Beneficio

Reduce drásticamente la carga de correccion masiva.

### Estado aplicado

Implementado en `backend/src/modules/assessments/grading/grading.service.ts`.

Cambios concretos:

- `bulkGradeAnswers` ya no llama a `gradeAnswer` por cada item.
- Se cargan respuestas, evaluaciones y puntajes maximos en lote.
- Se valida el alcance de cada evaluacion afectada una sola vez.
- Se actualizan respuestas corregidas dentro de una transaccion.
- Se ejecuta `recalculateAssessment` una sola vez por evaluacion afectada, no una vez por respuesta.


## 9. Mover procesos pesados a worker

### Estado: implementado

La API principal conserva los flujos sensibles a latencia: autenticacion, carga de evaluacion, intentos, respuestas y envio final. Los procesos pesados implementados se ejecutan en un proceso NestJS separado mediante Redis + BullMQ.

Colas activas:

- `exports`: exportaciones Excel, CSV y JSON.
- `recalculations`: recalculo completo de evaluaciones.
- `simce-pdf`: preprocesamiento de PDF SIMCE.
- `reports`: reportes de estudiante, curso, OA, riesgo e institucionales.
- `cleanup`: limpieza horaria de archivos temporales y exportaciones antiguas.

Controles implementados:

- Concurrencia 1 por cola para proteger PostgreSQL durante pruebas activas.
- Tres intentos con backoff exponencial.
- Estados `PENDING`, `QUEUED`, `PROCESSING`, `COMPLETED` y `FAILED` persistidos.
- IDs separados para registro de base de datos y job BullMQ.
- Consulta de jobs limitada al usuario solicitante o SUPER_ADMIN.
- Deteccion de workers y contadores de cola en `GET /health`.
- Contenedores separados `backend`, `worker`, `redis` y `minio` en `docker-compose.yml`.
- Volumen `uploads` mantenido como fallback local y MinIO como almacenamiento principal cuando `STORAGE_DRIVER=minio`.
- Migracion `20260626000200_add_background_jobs` para despliegues nuevos y existentes.

Integracion frontend:

- Exportaciones usan `POST /exports/async`.
- Historial obtenido desde `GET /jobs`.
- Reportes se encolan desde `POST /reports/generate`.
- Las pantallas refrescan automaticamente mientras existen trabajos pendientes.

Con esto, reportes, exportaciones, recalculos completos y procesamiento PDF no bloquean el event loop de la API que atiende a los alumnos.

### Separacion de resultados grandes

- `ReportsProcessor` serializa el resultado a JSON y lo guarda en `educacore-documents/reports/{reportId}.json` mediante `StorageService`.
- Se crea un `FileAsset` durable y `Report.fileAssetId` enlaza el reporte con su contenido.
- `Report.filters` conserva solamente filtros de consulta, evitando crecimiento de filas JSON en PostgreSQL.
- `GET /reports/:id` hidrata `filters.summary` desde MinIO/local para mantener compatibilidad con el frontend y reportes antiguos.
- La pantalla de reportes solicita el contenido completo solo al presionar Ver, PDF, CSV o JSON.
- No fue necesaria una migracion nueva porque `Report.fileAssetId` ya existia en el schema.
## 10. Validar alcance en exportaciones

Archivo auditado:

- `backend/src/modules/data-ops/exports/exports.service.ts`

### Problema

Los metodos de exportacion reciben `userId`, pero no lo usan para validar permisos por curso, institucion o asignatura.

Riesgo:

- Un docente podria exportar datos mas amplios de lo permitido si envia filtros amplios.
- Puede exponer alumnos, notas o preguntas.

### Recomendacion

Antes de consultar:

- Para docentes: limitar a cursos/asignaturas asignados.
- Para ADMIN/UTP/DIRECTION: limitar por institucion.
- Para SUPER_ADMIN: permitir global.

Usar helpers existentes:

- `resolveUserScope`
- `assertCourseScope`
- `assertInstitutionScope`

## 11. Integrar MinIO para archivos

### Estado: implementado

Se agrego una capa `StorageService` para separar la aplicacion del disco local. El sistema puede operar con `STORAGE_DRIVER=local` o `STORAGE_DRIVER=minio` sin cambiar los controladores.

Cambios concretos:

- Nuevo modulo `backend/src/modules/storage` con `StorageService`.
- `FileAsset.storagePath` ahora puede guardar rutas locales o URI `minio://bucket/key`.
- Las cargas nuevas de archivos usan bucket documental `educacore-documents` cuando MinIO esta activo.
- Las descargas y vistas usan el mismo endpoint existente, pero el stream sale desde MinIO o local segun `storagePath`.
- El worker de exportaciones sube archivos generados al bucket temporal `educacore-temp` cuando MinIO esta activo.
- El worker SIMCE lee PDFs mediante `StorageService`, por lo que el preprocesamiento ya no depende de una ruta local compartida.
- `docker-compose.yml` incluye servicio `minio`, volumen persistente `miniodata` y variables `MINIO_*` para API y worker.
- API y worker esperan a MinIO saludable antes de arrancar cuando el compose usa el driver MinIO.

Buckets usados:

- `educacore-documents`: documentos, PDFs y archivos asociados a entidades.
- `educacore-temp`: exportaciones temporales generadas por worker.

### Limpieza automatica

Tambien se agrego cola BullMQ `cleanup`:

- Se programa automaticamente cada 1 hora al iniciar el worker.
- Borra `FileAsset` con `expiresAt <= now`.
- Borra archivos de exportacion con mas de 24 horas desde `completedAt`.
- Limpia el objeto en MinIO/local y deja `ExportJob.fileUrl = null` para evitar enlaces muertos.

Beneficio:

- Reduce crecimiento del disco local.
- Permite escalar API y worker sin depender de que ambos compartan el mismo filesystem.
- Evita que exportaciones temporales se acumulen indefinidamente.

## 12. Cache Redis para prueba activa

Datos cacheables por `assessmentId`:

- Preguntas.
- Alternativas.
- Puntajes.
- Configuracion de tiempo.
- Pauta objetiva.

Ejemplos de claves:

- `assessment:{id}:questions`
- `assessment:{id}:answer-key`
- `assessment:{id}:settings`

### Beneficio

Si 50 alumnos abren la misma prueba, PostgreSQL no tiene que reconstruir la misma evaluacion 50 veces.

### Avance complementario aplicado

Redis/cache distribuido esta implementado mediante `CacheService` con Redis y fallback en memoria. Ademas, se optimizo `backend/src/modules/assessments/assessments/assessments.service.ts`:

- Para estudiantes, `findById` usa una consulta Prisma separada.
- Esa consulta no carga `question.explanation`.
- Esa consulta no carga `option.isCorrect`.
- Se evita traer pauta/respuestas correctas desde PostgreSQL para luego borrarlas en memoria.

Beneficio inmediato:

- Menor payload desde base de datos.
- Menos trabajo de sanitizacion en backend.
- Menor riesgo de exponer pauta objetiva por accidente.

Estado implementado:

- Cache Redis real activo para evaluaciones: vista estudiante con TTL de 60 segundos e invalidacion en mutaciones.
## 13. Ajustar polling frontend

Archivos relacionados:

- `frontend/src/features/alumno/AlumnoDashboard.tsx`
- `frontend/src/pages/alumno/StudentAssessmentAttemptPage.tsx`

### Observacion

El dashboard alumno refrescaba datos cada 30 segundos. La pagina de intento consultaba estado del intento cada 15 segundos mientras estaba en progreso.

### Recomendacion

- Pausar polling del dashboard al entrar a prueba.
- Subir el polling del intento a 30-60 segundos si no es estrictamente necesario.
- Evitar consultar portal completo mientras el alumno responde.
- Usar debounce/throttle para guardado.

### Estado aplicado

Implementado en frontend.

Cambios concretos:

- `AlumnoDashboard`: `student-portal` queda con `staleTime` de 60 segundos, sin `refetchInterval` periodico y sin refetch automatico al enfocar ventana.
- `SimceEssaysSection`: lista de ensayos SIMCE queda con `staleTime` de 60 segundos, sin `refetchInterval` periodico y sin refetch automatico al enfocar ventana.
- `StudentAssessmentAttemptPage`: polling de intento en progreso sube de 15 segundos a 60 segundos.
- Se mantienen invalidaciones explicitas al enviar una evaluacion, por lo que el dashboard se actualiza cuando corresponde.

Validacion ejecutada:

- `npm --workspace frontend run typecheck`: correcto.
- `npm --workspace backend run build`: correcto.
- `npm --workspace frontend run build`: correcto, con advertencia Vite de chunks grandes.
- `npm --workspace backend test -- --runInBand src/modules/simce/simce.service.spec.ts`: correcto, 17 tests.
- `git diff --check`: correcto, solo advertencias CRLF/LF de Git.
- `docker compose config --quiet`: correcto. Infraestructura levantada y k6 50x30 aprobado con 0% de errores y HTTP p95 de 850 ms.
## 14. Limites DTO

Agregar limites a payloads:

- Respuestas por request.
- Largo de respuesta abierta.
- Cantidad de items en pauta SIMCE.
- Cantidad de estudiantes en batch.
- Formatos permitidos de exportacion.

Ejemplos:

- Max 50 respuestas por request en prueba normal.
- Max 120 preguntas por pauta SIMCE.
- Max 5.000 filas por exportacion sin worker.
- Max 50 estudiantes por batch manual.

### Estado aplicado

Implementado en DTOs de backend.

Cambios concretos:

- `SaveAnswersDto`: maximo 120 respuestas por request.
- `SingleAnswerDto`: respuesta abierta con maximo 8.000 caracteres.
- `SaveAnswerKeyDto`: maximo 120 items de pauta SIMCE.
- `SaveStudentResponsesDto` y `BatchStudentResponsesDto`: maximo 120 respuestas por estudiante.
- `BulkGradeDto` y `BulkDirectGradeDto`: maximo 50 items por batch.
- Feedback, comentarios y motivos de nota: maximo 2.000 caracteres.
- `ExportRequestDto`: `entityType` y `format` restringidos con `IsIn`.
## 15. Indices recomendados

Revisar y asegurar indices en:

### `assessment_attempts`

Estado actual:

- `assessmentId + studentId`: existente como `@@unique([assessmentId, studentId])`.
- `assessmentId + status`: existente.
- `studentId`: existente.
- `assessmentId`: cubierto por el prefijo izquierdo del unique `assessmentId + studentId` y por `assessmentId + status`.

### `student_answers`

Estado aplicado:

- `attemptId + questionId`: existente como `@@unique([attemptId, questionId])`.
- `attemptId`: agregado.
- `questionId`: agregado.
- `selectedOptionId`: agregado.

Motivo:

- Acelera carga de respuestas por intento, validaciones por pregunta y joins/consultas relacionadas con alternativas seleccionadas.

### `grades`

Estado aplicado:

- `assessmentId + studentId`: existente como `@@unique([assessmentId, studentId])`.
- `studentId`: existente.
- `assessmentId`: agregado.

Motivo:

- Acelera listados/recalculos de notas por evaluacion.

### `assessments`

Estado aplicado:

- `courseId + subjectId + assessmentType`: existente.
- `status`: existente.
- `isActive + startDate + endDate`: existente.
- `courseId`: agregado.
- `subjectId`: agregado.
- `courseId + status`: agregado.

Motivo:

- Acelera dashboard por curso, filtros por asignatura y consultas de evaluaciones activas/cerradas por curso.

### `simce_assessments`

Estado aplicado:

- `courseId + subjectId`: existente.
- `teacherId + status`: existente.
- `status`: existente.
- `academicYearId`: existente.
- `courseId + status`: agregado.
- `subjectId + status`: agregado.

### `simce_answer_keys`

Estado aplicado:

- `assessmentId + questionNumber`: existente como `@@unique([assessmentId, questionNumber])`.
- `assessmentId`: existente.
- `axisId`: agregado.
- `skillId`: agregado.
- `oaId`: agregado.

### `simce_student_responses`

Estado aplicado:

- `assessmentId + studentId + questionNumber`: existente como `@@unique([assessmentId, studentId, questionNumber])`.
- `assessmentId + studentId`: existente.
- `assessmentId`: existente.
- `assessmentId + questionNumber`: agregado.
- `studentId`: agregado.

Motivo:

- Acelera resultado por estudiante, analisis por pregunta y reportes agregados SIMCE.

Validacion ejecutada:

- `npm --workspace backend exec -- prisma validate --schema prisma/schema.prisma`: correcto.
## 16. Plan por etapas

### Hacer primero

1. [x] Validar permisos en exportaciones.
2. [x] Optimizar `saveAnswers`.
3. [x] Hacer `submitAttempt` transaccional.
4. [x] Evitar parsing PDF/SIMCE durante apertura de alumno mediante worker y Redis compartido.
5. [x] Corregir `bulkGradeAnswers` para recalcular una sola vez.

### Hacer esta semana

1. [x] Agregar limites DTO.
2. [x] Ajustar polling frontend.
3. [x] Revisar indices Prisma.
4. [x] Crear prueba k6 con 50 alumnos x 30 preguntas.
5. [x] Mover endpoints pesados implementados a BullMQ para que no corran en la API durante prueba activa.

### Hacer este mes

1. [x] Integrar MinIO.
2. [x] Mover exportaciones/reportes/recalculos y PDF SIMCE a worker.
3. [x] Crear limpieza de temporales.
4. [x] Crear cache Redis para evaluaciones activas.
5. [x] Separar reportes grandes de la tabla `reports`.

### Backlog futuro opcional

1. [x] Observabilidad avanzada: Prometheus, metricas HTTP/Node/PostgreSQL/BullMQ y dashboard Grafana aprovisionado.
2. [x] Dashboard Grafana de prueba activa: selector de evaluacion, conectados por actividad en 5 minutos, intentos, entregas, respuestas y avance.
3. [x] Alertas Prometheus por latencia p95, errores 5xx, PostgreSQL caido, acumulacion/falta de workers BullMQ, CPU sobre 80%, RAM critica y disco sobre 70%/90%.
4. [x] Auditoria automatica AST de endpoints/consultas sin paginacion, limites maximos y linea base validada en prerelease.
5. [x] Politica de archivado semestral reversible con worker, MinIO, retencion, checksum y restauracion.

## 17. Metricas objetivo

Durante prueba activa:

- API p95 menor a 1.5 segundos.
- Errores 500 igual a 0.
- CPU menor a 70-80%.
- RAM libre mayor a 1 GB.
- PostgreSQL sin locks largos.
- Docker sin reinicios.
- Disco bajo 70%.
- `saveAnswers` p95 menor a 1 segundo idealmente.
- `submitAttempt` p95 menor a 2 segundos idealmente.

## 18. Conclusion

El volumen de 50 alumnos x 30 preguntas, es decir 1.500 respuestas, no es excesivo para PostgreSQL si el sistema guarda por lotes, evita consultas repetidas y mantiene procesos pesados fuera del horario de prueba.

El mayor riesgo no es guardar 1.500 filas. El mayor riesgo es mezclar ese flujo con:

- parsing PDF en vivo,
- reportes agregados,
- exportaciones,
- recaclulos completos,
- correcciones masivas,
- almacenamiento local sin limpieza.

La estructura recomendada es:

- prueba activa rapida y liviana,
- procesos pesados diferidos,
- archivos en MinIO,
- respuestas por lotes,
- operaciones criticas transaccionales,
- cache para datos repetidos,
- permisos estrictos en exportaciones.

Con estas mejoras, el sistema queda preparado no solo para 50 alumnos, sino para crecer gradualmente con mas cursos, mas evaluaciones y mas historial academico.
