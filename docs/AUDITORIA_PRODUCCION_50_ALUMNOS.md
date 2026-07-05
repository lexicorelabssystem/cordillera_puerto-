# Auditoria de produccion: 50 alumnos simultaneos

## Objetivo

Validar que Cordillera soporte una evaluacion online con 50 alumnos rindiendo en paralelo y profesores/UTP observando la plataforma sin congelamientos, errores 500, timeouts ni latencias que interrumpan el flujo del alumno.

## Alcance

La prueba cubre:

- Login de alumnos.
- Carga de evaluacion activa.
- Inicio de intento.
- Guardado de respuestas por rondas de autoguardado.
- Envio/finalizacion de la evaluacion.
- Profesores/UTP consultando evaluacion e intentos mientras los alumnos responden.

No cubre:

- Procesamiento de PDF durante la rendicion.
- Migracion historica de archivos locales.
- Compra/configuracion final de dominio.

## Precondiciones

- Backend desplegado en produccion o preview productivo.
- Frontend apuntando al backend correcto.
- Evaluacion con `status = ACTIVE`.
- Evaluacion con `deliveryMode = ONLINE` o `MIXED`.
- 50 alumnos reales/de prueba matriculados en el curso de la evaluacion.
- Profesores/UTP con permiso para ver la evaluacion.
- Si se va a repetir la prueba, usar una evaluacion nueva o `allowRetake = true`.
- No commitear CSV con claves reales.

## CSV de alumnos

Crear fuera del repo si contiene claves reales:

```csv
email,password
alumno01@colegio.cl,CLAVE_REAL
alumno02@colegio.cl,CLAVE_REAL
```

## CSV de profesores

Crear fuera del repo si contiene claves reales:

```csv
email,password
utp@cordillera.cl,CLAVE_REAL
profesor01@colegio.cl,CLAVE_REAL
```

## Comando recomendado

```powershell
$env:API_BASE="https://TU-BACKEND/api/v1"
$env:ASSESSMENT_ID="UUID_EVALUACION_ACTIVA"
$env:USERS_CSV="C:\ruta\segura\students.preview.csv"
$env:TEACHERS_CSV="C:\ruta\segura\teachers.preview.csv"
$env:VUS="50"
$env:TEACHER_VUS="3"
$env:TEACHER_POLL_SEC="10"
$env:AUTOSAVE_ROUNDS="3"
$env:AUTOSAVE_PAUSE_SEC="15"
$env:SUBMIT="true"

k6 run scripts/load/student-assessment-50.js
```

## Corrida gradual sugerida

### 1. Smoke test sin entrega

```powershell
$env:VUS="5"
$env:TEACHER_VUS="1"
$env:SUBMIT="false"
k6 run scripts/load/student-assessment-50.js
```

### 2. Carga media sin entrega

```powershell
$env:VUS="25"
$env:TEACHER_VUS="2"
$env:SUBMIT="false"
k6 run scripts/load/student-assessment-50.js
```

### 3. Carga objetivo con entrega

```powershell
$env:VUS="50"
$env:TEACHER_VUS="3"
$env:SUBMIT="true"
k6 run scripts/load/student-assessment-50.js
```

## Criterios de aceptacion

La prueba se considera aprobada si:

- `http_req_failed` queda bajo 1% idealmente, maximo 5%.
- `http_req_duration p(95)` queda bajo 2s.
- `login_duration p(95)` queda bajo 2s.
- `start_attempt_duration p(95)` queda bajo 2.5s.
- `save_answers_duration p(95)` queda bajo 2.5s.
- `submit_attempt_duration p(95)` queda bajo 5s.
- `teacher_poll_duration p(95)` queda bajo 2.5s cuando `TEACHER_VUS > 0`.
- No aparecen errores 500 en backend.
- No aparecen timeouts en backend o proxy.
- CPU/RAM no quedan saturadas de forma sostenida.
- PostgreSQL no muestra agotamiento de conexiones.

## Monitoreo durante la prueba

En el servidor:

```sh
docker ps
docker stats
```

Logs del backend:

```sh
docker logs -f NOMBRE_CONTENEDOR_API
```

PostgreSQL, dentro del contenedor correcto:

```sh
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Consultas utiles:

```sql
SELECT count(*) AS active_connections
FROM pg_stat_activity;
```

```sql
SELECT state, count(*)
FROM pg_stat_activity
GROUP BY state
ORDER BY count(*) DESC;
```

```sql
SELECT
  status,
  count(*)
FROM assessment_attempts
WHERE "assessmentId" = 'UUID_EVALUACION_ACTIVA'
GROUP BY status;
```

## Interpretacion

Si falla login:

- Revisar usuarios CSV.
- Revisar CORS/CSRF si se prueba desde browser, aunque k6 usa API directa.
- Revisar rate limits si existen.

Si falla carga de evaluacion:

- Verificar `ASSESSMENT_ID`.
- Verificar que alumnos esten matriculados en el curso.
- Verificar `status = ACTIVE`.

Si falla guardado de respuestas:

- Revisar latencia de PostgreSQL.
- Revisar errores de transacciones/upsert.
- Revisar CPU/RAM del contenedor API.

Si falla submit:

- Revisar preguntas omitidas, intentos ya completados o `allowRetake`.
- Usar evaluacion nueva para repetir.

## Checklist antes de comprar dominio

- Backend estable con healthcheck OK.
- Frontend productivo apunta a backend productivo.
- CORS incluye dominio final y dominios preview necesarios.
- Cookies/auth revisadas para dominio final.
- MinIO guarda documentos en `educacore-documents`.
- Eliminacion definitiva borra tambien en MinIO.
- Backups PostgreSQL y MinIO definidos.
- Prueba k6 de 50 alumnos aprobada.
- Logs sin secrets.
- No hay CSV con claves reales commiteados.