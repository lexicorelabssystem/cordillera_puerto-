# Prueba de carga: 50 alumnos en evaluación

Esta prueba usa k6 para simular alumnos rindiendo una evaluación online en preview.

## Requisitos

- Instalar k6: https://k6.io/docs/get-started/installation/
- Tener un preview backend disponible.
- Tener 50 usuarios estudiante reales o de prueba, matriculados en el curso de la evaluación.
- La evaluación debe estar `ACTIVE` y con `deliveryMode` `ONLINE` o `MIXED`.
- Para repetir la prueba varias veces, la evaluación debe permitir reintento (`allowRetake`) o debes usar una evaluación nueva/restaurar intentos.

## CSV de alumnos

Crea un archivo fuera del repo o copia `students.example.csv`:

```csv
email,password
alumno01@colegio.cl,Password123!
alumno02@colegio.cl,Password123!
```

## Ejecución recomendada contra preview

```powershell
$env:API_BASE="https://TU-BACKEND-PREVIEW/api/v1"
$env:ASSESSMENT_ID="UUID_DE_LA_EVALUACION"
$env:USERS_CSV="scripts/load/students.preview.csv"
$env:VUS="50"
$env:RAMP_UP="1m"
$env:HOLD="6m"
$env:RAMP_DOWN="30s"
$env:AUTOSAVE_ROUNDS="3"
$env:AUTOSAVE_PAUSE_SEC="15"
$env:SUBMIT="true"
k6 run scripts/load/student-assessment-50.js
```

## Interpretación rápida

- `http_req_failed` debe quedar bajo 5%.
- `http_req_duration p(95)` debería quedar bajo 2s.
- `submit_attempt_duration p(95)` bajo 5s es aceptable al inicio.
- Si aparecen muchos `slow_requests_over_5s`, revisar logs del backend y base de datos.

## Variantes útiles

Sin enviar la prueba al final:

```powershell
$env:SUBMIT="false"
k6 run scripts/load/student-assessment-50.js
```

Autosave más agresivo:

```powershell
$env:AUTOSAVE_ROUNDS="6"
$env:AUTOSAVE_PAUSE_SEC="5"
k6 run scripts/load/student-assessment-50.js
```