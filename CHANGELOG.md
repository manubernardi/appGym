# Registro de cambios

Cambios de la app en orden cronológico (la última versión está al final). Cada versión corresponde al número de `CACHE` en [`sw.js`](sw.js).

## v1 — Primera versión (2026-10-07)

App web instalable (PWA) en GitHub Pages, con Firebase (login con Google + Firestore) para sincronizar en la nube. Funciona sin internet.

- **Entrenar**: registro serie por serie (kg y reps), con lo que hiciste la última vez como referencia. Se guarda solo mientras escribís.
- **Plan**: rutinas del mes (Día A, Día B…) con objetivo por ejercicio; archivar, restaurar y copiar rutinas.
- **Progreso**: gráficos por ejercicio (peso máximo y 1RM estimado), récords y peso corporal.
- **Más**: historial editable, gestión de ejercicios (nombre, tipo de peso, grupos) y copia de seguridad.
- Ejercicios iniciales agrupados en 10 grupos musculares: Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos y Abdominales.
- Tipos de peso: **barra** (peso total), **mancuerna** (peso de una), **máquina/polea** (número de la máquina) y **sin peso** (solo reps).

## v2 — Estadísticas rehechas (2026-10-07)

El volumen en kg y la separación principal/secundario resultaban confusos, así que la pestaña *Progreso* se reorganizó para mostrar menos números y conclusiones más claras.

- **Mes**: cantidad de entrenamientos y frecuencia, récords nuevos y qué ejercicios **mejoraron / se mantuvieron / bajaron**
  (compara la mejor serie de la primera vez del mes con la de la última), más las series promedio por semana de cada grupo.
- **Semana**: series de cada grupo muscular comparadas con un objetivo de **10 a 20** (bajo / bien / alto). Tocando un grupo se ven los ejercicios que sumaron.
- Cuenta de series: cada serie suma **1 al grupo principal** y **½ a cada grupo secundario**.
- Se sacó el cálculo de volumen en kg de las estadísticas por grupo.
- Archivos: [`js/stats.js`](js/stats.js), [`js/views/progress.js`](js/views/progress.js), [`css/styles.css`](css/styles.css), [`README.md`](README.md), [`sw.js`](sw.js).

## v3 — Plan desde foto (2026-10-08)

### Qué hay de nuevo
- **📷 Cargar plan desde foto** en la pestaña *Plan*. Sacás una foto de la hoja del plan, o elegís una de la galería, y Gemini arma las rutinas solo.
  - Le pasa a Gemini tu lista de ejercicios para que **asocie los que están escritos distinto** a uno que ya tenés
    (ej. "press banco barra" → "Press banca plano") y tenga en cuenta el implemento (barra, mancuerna, máquina, polea).
  - Si un ejercicio no existe, propone **crearlo** con nombre, tipo de peso, grupo principal y grupos secundarios.
  - **Si no dice el implemento**, se asume barra cuando el ejercicio existe con barra y con otro ("Press plano" → "Press banca plano").
  - **"Alternado"** implica mancuernas y se asocia al mismo ejercicio con mancuernas ("Press militar alternado" → "Press de hombros con mancuernas").
  - **"Unilateral" / "a una mano" / "a un brazo"** se guarda como un ejercicio aparte ("Tríceps polea unilateral" → nuevo "Extensión de tríceps en polea unilateral"),
    porque el peso de un brazo no se compara con el de dos. Si ya existe una versión de un lado ("Remo unilateral" → "Remo con mancuerna"), usa esa.
  - El objetivo se guarda **tal cual está escrito** ("3X10").
- **Pantalla de revisión** antes de guardar:
  - Podés cambiar el nombre de cada rutina, cambiar un ejercicio por otro (tocándolo), corregir el objetivo o quitar ejercicios.
  - Para cada ejercicio muestra lo que decía la hoja ("En la hoja: …").
  - Los ejercicios que se van a crear aparecen marcados como **nuevo**, con su tipo de peso y sus grupos.
- Al guardar:
  - El plan actual **se archiva automáticamente** (los registros de entrenamientos no se tocan).
  - Los ejercicios nuevos se crean una sola vez, aunque aparezcan en varias rutinas o ya exista uno con el mismo nombre.
  - Las rutinas quedan en el mismo orden que en la hoja (Día A, Día B…).
- Leer la foto necesita internet. Sin conexión, la app avisa y no intenta leerla.
- **Progresión semanal** (formato de [`Formato plan.csv`](Formato%20plan.csv)):
  - La tabla *Progresión semanal* se lee con las **columnas como progresiones** (1, 2, 3…) y las **filas como semanas** (1 a 4).
    La cantidad de semanas, de progresiones y los valores pueden cambiar de un plan a otro.
  - El `(n)` al lado de cada ejercicio es su número de progresión. **Si no tiene número, se usa la progresión 1.**
  - La semana se cuenta **por rutina**: veces que hiciste ese día + 1. Si un día lo hiciste más veces que otro, cada uno va en su semana.
    Pasada la última semana de la tabla, queda en la última hasta que cargues un plan nuevo.
  - **Entrenar**: cada rutina muestra "Semana N de M"; al empezar, los objetivos y la cantidad de series salen de esa semana,
    y la sesión guarda la semana (se ve en el título).
  - **Plan**: muestra la tabla de progresión, la semana de cada día y, por ejercicio, su progresión y el objetivo de esta semana (ej. "P2 · 3x10").
    En el editor de rutina se elige la progresión de cada ejercicio en vez de escribir el objetivo. Las rutinas nuevas o copiadas usan la misma tabla.
  - **Revisión de la foto**: la tabla se puede corregir celda por celda, y cada ejercicio tiene un selector de progresión.
  - Los planes sin tabla siguen funcionando como antes, con el objetivo fijo escrito al lado de cada ejercicio.

### Puesta en marcha necesaria
En la consola de Firebase: **AI Logic → Comenzar → Gemini Developer API** (gratis, sin tarjeta). No hay que pegar ninguna clave en la app.
Está explicado en el paso 1b del [README](README.md).

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/plan-import.js`](js/plan-import.js) | **Nuevo.** Las instrucciones para Gemini explican el formato (días en columnas, `(n)` = progresión, tabla con columnas = progresiones y filas = semanas). Achica la foto (máx. 1600 px, JPEG), se la manda a Gemini por Firebase AI Logic con un esquema JSON fijo y valida la respuesta: si Gemini devuelve un id de ejercicio que no existe, lo trata como ejercicio nuevo. Modelos: `gemini-3.8-flash`, y `gemini-3.5-flash-lite` si el primero no existe o está saturado (lista `MODELS`). |
| [`js/progression.js`](js/progression.js) | **Nuevo.** Cálculo de la semana de cada rutina (`currentWeek`) y del objetivo de cada ejercicio para esa semana (`itemTarget`). La tabla se guarda en cada rutina como `progression: [{ targets: [...] }]` (un elemento por semana), porque Firestore no admite listas dentro de listas; cada ejercicio guarda `prog`. |
| [`js/views/train.js`](js/views/train.js) | Al empezar una rutina usa el objetivo de la semana que toca, guarda `week` en la sesión y muestra la semana en la pantalla de inicio y en el título. |
| [`js/views/plan.js`](js/views/plan.js) | Botón de foto, pantalla de carga, pantalla de revisión y guardado (`importFromPhoto`, `openImportReview`, `saveImported`). El módulo de IA se carga recién al usarlo, así el resto de la app no lo descarga. Tabla de progresión (de lectura y editable) y selector de progresión por ejercicio. |
| [`js/db.js`](js/db.js) | Firebase pasa de la versión **10.12.2** a la **12.19.0** (el módulo de IA necesita la 12) y se exporta `app`. |
| [`js/views/exercises.js`](js/views/exercises.js) | Ahora se exporta `normalize()` (comparar nombres sin mayúsculas ni acentos), para que lo use plan.js. |
| [`css/styles.css`](css/styles.css) | Estilos nuevos: `.tag-new` (etiqueta "nuevo"), `.link-btn`, `.block` y `.prog-table`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v3` y se agregan `js/plan-import.js` y `js/progression.js` a la lista de archivos offline. |
| [`README.md`](README.md) | Paso 1b (activar AI Logic) y descripción de la carga por foto. |

### Para tener en cuenta
- Google dice que `gemini-3.8-flash` va a estar disponible por poco tiempo. Si la lectura empieza a fallar con un error de modelo, actualizá `MODELS` en [`js/plan-import.js`](js/plan-import.js) con un modelo vigente ([lista de modelos de Firebase AI Logic](https://firebase.google.com/docs/ai-logic/models)).
- Después de pasar a Firebase 12, conviene revisar que el login y la carga de datos sigan funcionando.
