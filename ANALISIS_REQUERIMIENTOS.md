# Analisis Tecnico-Funcional - Plataforma de Monitoreo de Aprendizajes

## 1) Objetivo del servicio (interpretacion operativa)
La plataforma debe permitir monitoreo sistematico y en tiempo real del aprendizaje escolar, con foco en toma de decisiones pedagogicas, deteccion temprana de brechas y generacion de rutas remediales.

## 2) Requisitos funcionales obligatorios extraidos
1. Plataforma web con acceso por link y credenciales.
2. Aplicacion en linea de evaluaciones (multi-dispositivo: PC, celular, tablet).
3. Cobertura curricular:
   - 1° a 8°: Lenguaje y Matematica.
   - 6°: Ciencias.
   - 8°: Historia y Geografia.
4. Monitoreo de progreso por evaluaciones diagnosticas, de proceso y cierre.
5. Generacion de reportes digitales con historial de resultados.
6. Ruta de aprendizaje sugerida para periodo remedial (por estudiante/curso/OA).
7. Material digital imprimible con pauta/respuestas.
8. Descarga de pruebas en PDF.
9. Correccion rapida mediante:
   - App movil, o
   - Traspaso de respuestas a plataforma.
10. Banco SIMCE minimo:
   - 10 ensayos matematica 4to basico.
   - 10 ensayos comprension lectora 4to basico.
   - 10 ensayos matematica 6to basico.
   - 10 ensayos comprension lectora 6to basico.
   - 8 ensayos ciencias 6to basico.

## 3) Lo que ya cubre el MVP actual
1. Roles basicos (`administrador`, `direccion`, `docente`, `estudiante`).
2. Carga manual y carga CSV.
3. KPI + semaforo + tendencia + alertas por bajo logro.
4. Reporte por estudiante y por curso.
5. Historial (persistencia local en navegador).
6. Validacion parcial de cobertura curricular (Lenguaje/Matematica, 6° Ciencias, 8° Historia).

## 4) Brechas criticas entre requerimiento y MVP
1. No hay autenticacion real (actualmente login simple sin password/seguridad).
2. No existe motor de evaluaciones en linea con preguntas y rendicion por estudiante.
3. No hay modulo de impresion/descarga PDF de instrumentos y claves de correccion.
4. No existe banco estructurado de ensayos SIMCE exigidos (10/10/10/10/8).
5. No hay app movil o lector para correccion rapida (OMR, QR u otro flujo).
6. No hay ruta remedial automatica basada en reglas pedagogicas por OA/habilidad.
7. Falta Historia y Geografia explicitamente separada para 8° (hoy esta solo Historia).
8. Falta trazabilidad institucional robusta (auditoria, respaldo central, multiusuario real).

## 5) Riesgos de cumplimiento (si se postula a licitacion)
1. Riesgo alto de inadmisibilidad tecnica si no se demuestra modulo de evaluacion en linea y banco SIMCE completo.
2. Riesgo alto si no se evidencia descarga PDF y material imprimible con respuestas.
3. Riesgo medio-alto por seguridad de datos de estudiantes (Ley 19.628 y buenas practicas).
4. Riesgo medio por capacidad de uso masivo concurrente en periodos de aplicacion.
5. Riesgo medio por soporte en dispositivos moviles y conectividad escolar variable.

## 6) Recomendacion de arquitectura objetivo
1. Frontend web responsive (docente/directivo/estudiante) + panel evaluaciones.
2. Backend API con autenticacion JWT + roles/permisos.
3. Base de datos relacional (PostgreSQL) con modelo:
   - establecimientos, cursos, estudiantes, asignaturas,
   - OA/habilidades,
   - instrumentos, preguntas, claves,
   - aplicaciones, respuestas, puntajes,
   - reportes e historial.
4. Servicio de reporteria PDF.
5. Modulo de banco SIMCE y versionado de instrumentos.
6. Modulo de rutas remediales basado en reglas (ejemplo: <60% OA critico => plan reforzamiento quincenal).

## 7) Fases sugeridas para llegar a cumplimiento
### Fase 1 (2-4 semanas) - Base productiva
1. Login real, usuarios y permisos.
2. Catalogo de cursos/asignaturas/OA.
3. Carga de instrumentos y rendicion en linea basica.
4. Reportes historicos por estudiante/curso/asignatura/OA.

### Fase 2 (3-5 semanas) - Cumplimiento licitacion
1. Descarga PDF de pruebas y claves.
2. Banco SIMCE completo requerido (10/10/10/10/8).
3. Correccion rapida (carga de respuestas por plantilla masiva o app movil liviana).
4. Ruta remedial automatica y recomendaciones por bajo logro.

### Fase 3 (2-3 semanas) - Calidad y operacion
1. Pruebas de carga y seguridad.
2. Capacitacion usuarios del establecimiento.
3. Manuales, soporte y mesa de ayuda.
4. Evidencias para oferta tecnica (capturas, fichas funcionales, demo).

## 8) Criterios de aceptacion minimos propuestos
1. Un docente puede crear/aplicar una evaluacion online y obtener resultados por OA en <5 minutos tras cierre.
2. Un directivo puede descargar reporte PDF por curso/asignatura y ver historico comparativo.
3. Un administrador puede cargar banco de ensayos y asignarlos por nivel/asignatura.
4. El sistema sugiere acciones remediales cuando puntaje <60% en OA priorizado.
5. Plataforma usable en desktop y celular sin perdida de funciones criticas.

## 9) Observaciones sobre matricula y niveles
El texto compartido muestra una seccion de niveles/matricula con formato parcial ("1 4 90", "2 4 115", etc.) y parece incompleta/ambigua. Para propuesta formal conviene normalizar tabla final con columnas:
- Nivel
- Numero de cursos
- Matricula estimada
- Asignaturas
- Numero de evaluaciones esperadas por periodo

## 10) Proximo entregable recomendado
Documento de "Oferta Tecnica" con:
1. Alcance funcional punto a punto vs requerimiento.
2. Plan de implementacion con hitos y fechas.
3. Metodologia de soporte/capacitacion.
4. SLA y tiempos de respuesta.
5. Matriz de cumplimiento (Cumple / Parcial / No aplica / Evidencia).
