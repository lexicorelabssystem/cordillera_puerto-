# Manual de Usuario — Cordillera SaaS v3.0
## Plataforma de Monitoreo de Aprendizajes

---

## Tabla de Contenidos
1. [Acceso a la Plataforma](#1-acceso)
2. [Panel de Control (Dashboard)](#2-dashboard)
3. [Libro de Calificaciones](#3-libro)
4. [Evaluaciones](#4-evaluaciones)
5. [Ensayos SIMCE](#5-simce)
6. [Reportes](#6-reportes)
7. [Planes Remediales](#7-remediales)
8. [Banco de Preguntas](#8-preguntas)
9. [Gestión de Usuarios](#9-usuarios)
10. [Importación/Exportación](#10-datos)

---

## 1. Acceso a la Plataforma {#1-acceso}

### Inicio de Sesión
1. Abrir navegador e ir a la URL de la plataforma
2. Ingresar correo electrónico y contraseña
3. Si es primer inicio de sesión, cambiar la contraseña temporal

### Roles disponibles:
- **Administrador**: Gestión completa del sistema
- **Dirección**: Visión institucional, reportes globales
- **UTP**: Coordinación pedagógica, monitoreo
- **Docente**: Crear evaluaciones, ingresar notas, ver remediales
- **Estudiante**: Ver notas, rendir evaluaciones en línea
- **Apoderado**: Seguimiento académico del estudiante

### Recuperar Contraseña
1. Click en "¿Olvidaste tu contraseña?"
2. Ingresar correo registrado
3. Revisar bandeja de entrada para el link de recuperación
4. El link expira en 15 minutos

---

## 2. Panel de Control (Dashboard) {#2-dashboard}

### Para Administradores/Directivos
El dashboard muestra:
- **KPIs**: Total estudiantes, cursos, docentes, evaluaciones
- **Semáforo**: Cursos por nivel de rendimiento (verde/amarillo/rojo)
- **Alertas**: Cursos y estudiantes con bajo rendimiento
- **Listados**: Cursos, estudiantes, docentes activos

### Para Docentes
- Seleccionar curso y asignatura para ver estudiantes
- KPIs del curso: promedio, % aprobación, en riesgo
- Gráfico de barras de notas
- Dictado por voz para observaciones

### Para Estudiantes
- KPIs personales: promedio, nivel, estado
- Historial de notas por semestre
- Alertas académicas personales

---

## 3. Libro de Calificaciones {#3-libro}

### Acceder
Menú lateral → Evaluaciones → Libro de Calificaciones

### Funcionalidades:
1. **Seleccionar curso** y opcionalmente **asignatura**
2. **Ver matriz**: Estudiantes (filas) × Evaluaciones (columnas)
3. **Ingresar nota**: Click en celda vacía, escribir nota (1.0 - 7.0), Enter para guardar
4. **Editar nota**: Click en celda con nota, modificar, Enter
5. **Filtros**:
   - Buscar por nombre o RUT
   - Solo estudiantes en riesgo
   - Solo notas pendientes
   - Solo notas bajo 4.0
6. **Crear evaluación rápida**: Botón "Nueva Evaluación"

### Indicadores visuales:
- 🔴 Nota bajo 4.0 (texto rojo)
- 🟢 Nota 6.0 o superior (texto verde)
- 🟠 Pendiente (sin nota)
- ⚪ Sin datos

### Exportar:
- **PDF**: Descarga el libro completo con KPIs
- **Excel**: Descarga los datos en formato tabla

### Acciones desde el libro:
- Click en **nombre del estudiante** → Perfil completo con historial
- Click en **título de evaluación** → Detalle de la evaluación

---

## 4. Evaluaciones {#4-evaluaciones}

### Crear una Evaluación
1. Menú → Evaluaciones → Evaluaciones
2. Click en "+ Nueva evaluación"
3. Completar formulario:
   - **Título**: Nombre descriptivo
   - **Tipo**: Diagnóstica, Proceso, Cierre, Parcial, Final, SIMCE
   - **Curso**: Seleccionar curso objetivo
   - **Asignatura**: Lenguaje, Matemática, Ciencias o Historia
   - **Semestre**: 1° o 2°
   - **Puntaje máximo**: Total de puntos
   - **Ponderación**: % de la nota final (0-100)

### Estados de una Evaluación:
| Estado | Significado |
|--------|-------------|
| BORRADOR | En creación, no visible a estudiantes |
| PUBLICADA | Visible, fechas definidas |
| ACTIVA | Estudiantes pueden rendir |
| CERRADA | Ya no se aceptan intentos |
| EN CORRECCIÓN | Respuestas siendo calificadas |
| CALIFICADA | Todas las notas ingresadas |
| REPORTADA | Resultados publicados |
| ARCHIVADA | Fuera de circulación |

### Descargar PDF de Prueba
En la página de detalle de evaluación, botón "Descargar PDF":
- Incluye todas las preguntas
- Respuestas correctas marcadas con ✓ (solo versión docente)
- Formato A4 listo para imprimir

---

## 5. Ensayos SIMCE {#5-simce}

### Acceder
Menú → Evaluaciones → Ensayos SIMCE

### Banco disponible:
- **48 ensayos** tipo SIMCE:
  - 10 Matemática 4° básico
  - 10 Comprensión Lectora 4° básico
  - 10 Matemática 6° básico
  - 10 Comprensión Lectora 6° básico
  - 8 Ciencias Naturales 6° básico

### KPIs del banco:
- Total ensayos
- Matemática 4° / Lectura 4° / Matemática 6° / Lectura 6°

### Usar un ensayo:
1. Seleccionar ensayo de la tabla
2. Ver preguntas y respuestas
3. Publicar para que los estudiantes lo rindan
4. Revisar resultados en Libro de Calificaciones

---

## 6. Reportes {#6-reportes}

### Generar Reporte
Menú → Reportes

### Tipos disponibles:
1. **Reporte por Curso**: Consolidado de notas, promedios, riesgo
2. **Reporte por Estudiante**: Historial completo individual
3. **Reporte por OA**: Logro por Objetivo de Aprendizaje
4. **Estudiantes en Riesgo**: Listado bajo 4.0

### Descargar:
- **PDF**: Documento formateado con resumen y detalle
- **XLSX**: Hoja de cálculo para análisis
- **CSV**: Datos crudos para procesamiento

---

## 7. Planes Remediales {#7-remediales}

### Detección Automática
El sistema detecta automáticamente estudiantes con:
- Promedio bajo 4.0 en un OA
- Rendimiento bajo 60% en evaluaciones

### Crear Plan Remedial
1. Menú → Rutas Remediales
2. Seleccionar curso y asignatura
3. El sistema sugiere estudiantes que necesitan intervención
4. Seleccionar OA descendidos
5. Asignar recursos (guías, presentaciones, fichas)
6. Dar seguimiento al progreso

### Estados:
- **Pendiente**: Plan creado, estudiante notificado
- **En Progreso**: Estudiante trabajando en el plan
- **Completado**: Actividades terminadas
- **Evaluado**: Efectivo / No Efectivo

---

## 8. Banco de Preguntas {#8-preguntas}

### Crear Pregunta
Menú → Currículum → Banco de Preguntas

### Tipos de pregunta:
- **Selección Múltiple**: 4 opciones, 1 correcta
- **Verdadero/Falso**: 2 opciones
- **Respuesta Corta**: Texto breve
- **Ensayo**: Texto extenso
- **Términos Pareados**: Matching

### Vinculación curricular:
Cada pregunta se asocia a:
- Asignatura
- Eje temático
- Objetivo de Aprendizaje (OA)
- Habilidad

---

## 9. Gestión de Usuarios {#9-usuarios}

### Crear Usuario (Admin)
1. Menú → Usuarios
2. Click en "+ Nuevo usuario"
3. Completar: nombre, apellido, email, rol, institución
4. El sistema envía email de bienvenida con contraseña temporal

### Permisos
Cada rol tiene permisos predefinidos. El administrador puede:
- Asignar/quitar permisos específicos
- Activar/desactivar usuarios
- Cambiar roles

### Perfil
Cada usuario puede:
- Cambiar su contraseña
- Actualizar sus datos personales
- Ver su historial de actividad

---

## 10. Importación/Exportación de Datos {#10-datos}

### Importar
Menú → Importar

1. Seleccionar tipo de datos (estudiantes, notas, preguntas)
2. Cargar archivo Excel (.xlsx) o CSV
3. El sistema valida los datos y muestra preview
4. Confirmar importación
5. En caso de error, hacer rollback

### Plantilla
Descargar plantilla de carga desde el botón "Descargar plantilla"

### Exportar
Menú → Exportar

1. Seleccionar entidad (estudiantes, notas, preguntas, cursos)
2. Seleccionar formato (Excel, CSV, JSON)
3. Click en "Exportar"
4. El archivo se procesa en segundo plano
5. Descargar desde el historial

---

## Atajos y Tips

| Atajo | Descripción |
|-------|-------------|
| Click en nota | Editar nota en libro de clases |
| Click en estudiante | Ver perfil completo |
| Click en evaluación | Ver detalle de evaluación |
| Enter en celda | Guardar nota |
| Escape en celda | Cancelar edición |
| Dictado por voz | Usar micrófono para notas de voz |

---

## Soporte

- **Email**: soporte@cordillera.cl
- **WhatsApp**: +56 9 XXXX XXXX
- **Horario**: Lunes a Viernes, 8:30 - 17:30 hrs
- **Tiempo de respuesta**: < 4 horas hábiles

---

*Manual de Usuario — Cordillera SaaS v3.0*
*Versión 1.0 — Mayo 2026*
