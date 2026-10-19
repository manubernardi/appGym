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
- **Cómo cargar cada día** (selector *Cargar como* en la revisión):
  - **Nueva rutina**, **Actualizar <rutina actual>** o **No cargar**.
  - *Actualizar* reemplaza los ejercicios de esa rutina por los de la foto, pero mantiene la misma rutina: **no se pierde la semana en la que vas**
    (ej. cargaste Día 1 y Día 2 a mano: los actualizás desde la foto y el Día 3 entra como nuevo).
  - Por defecto todos van como *Nueva rutina*, así un plan de otro mes no continúa las semanas del anterior.
  - Las rutinas actuales que no se actualizan se pueden **archivar** (plan nuevo) o **dejar** en el plan. Si todos los días van como nuevos, la opción marcada es archivar;
    si alguno actualiza o no se carga, la marcada es dejar (salvo que la elijas a mano).
- **La tabla de progresión es una sola para todo el plan**: se guarda en todas las rutinas cargadas o actualizadas, y las rutinas que se dejan y ya seguían una progresión toman la tabla nueva.
- Al guardar:
  - Las rutinas archivadas conservan sus registros de entrenamientos.
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
| [`css/styles.css`](css/styles.css) | Estilos nuevos: `.tag-new` (etiqueta "nuevo"), `.link-btn`, `.block`, `.prog-table`, `.dest`, `.radio-row` y `.excluded`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v3` y se agregan `js/plan-import.js` y `js/progression.js` a la lista de archivos offline. |
| [`README.md`](README.md) | Paso 1b (activar AI Logic) y descripción de la carga por foto. |

### Para tener en cuenta
- Google dice que `gemini-3.8-flash` va a estar disponible por poco tiempo. Si la lectura empieza a fallar con un error de modelo, actualizá `MODELS` en [`js/plan-import.js`](js/plan-import.js) con un modelo vigente ([lista de modelos de Firebase AI Logic](https://firebase.google.com/docs/ai-logic/models)).
- Después de pasar a Firebase 12, conviene revisar que el login y la carga de datos sigan funcionando.

## v4 — Zona media, ejercicios nuevos y orden de los días (2026-10-09)

### Qué cambió
- **Zona media con sus propias reps**: los ejercicios del *Circuito zona media* (ej. "Puente frontal c/ cambio de apoyo 3*10",
  "Puente frontal en fitball 3*12\"") ya no siguen la tabla de progresión semanal: cada uno guarda las series x reps escritas al lado.
  - En el plan y en la revisión de la foto, el selector de progresión tiene la opción **Fijo (sus propias reps)**, que muestra el campo de objetivo.
  - Las instrucciones para Gemini explican los dos bloques de cada día (zona media y fuerza), que la columna *Pausas* no es una progresión
    y que *Movilidad articular* / *Preventivos hombros* no son ejercicios de un día. Los días se llaman como en la hoja ("Día 1", "Día 2"…).
- **Ejercicios nuevos sin grupo muscular**: en la revisión de la foto cada ejercicio nuevo tiene **Editar nombre y grupos**
  (nombre, tipo de peso, grupo principal y secundarios). Si falta el grupo se marca en rojo y, al tocar *Guardar*, se abre el formulario para completarlo.
  Si le ponés el nombre de un ejercicio que ya tenés, se usa ese. A Gemini se le pide que siempre complete el grupo (zona media → Abdominales).
- **"En curso" al abrir la app**: tocar una rutina crea el entrenamiento al instante, y si no se terminaba ni se descartaba quedaba abierto para siempre.
  Ahora un entrenamiento abierto hace más de **6 horas** se cierra solo: si tiene series se guarda como terminado (con un aviso), si está vacío se borra.
- **Semana de cada día**: cuenta solo los entrenamientos **terminados** (antes uno abierto o abandonado también avanzaba la semana).
- **Orden de los días**: las rutinas se ordenan por nombre con los números en orden (Día 1, Día 2… Día 10), sin importar cuál se cargó primero.
  Las rutinas nuevas se sugieren como "Día N".

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/progression.js`](js/progression.js) | `FIXED` (= `prog: 0`) e `itemProg()`: un ejercicio con `prog: 0` usa siempre su `target`. `currentWeek` cuenta solo sesiones `finished`. |
| [`js/plan-import.js`](js/plan-import.js) | Prompt con el formato real (zona media / fuerza, pausas, encabezado). `target` se pide siempre que el ejercicio tenga reps propias; sin `(n)` y con reps propias queda `FIXED`. |
| [`js/views/plan.js`](js/views/plan.js) | Opción *Fijo* en los selectores de progresión, botón *Editar nombre y grupos* y apertura automática del formulario si falta el grupo. |
| [`js/views/exercises.js`](js/views/exercises.js) | `openExerciseForm(…, { draft: true })`: devuelve los datos sin guardar (o el ejercicio existente con ese nombre). |
| [`js/views/train.js`](js/views/train.js) | `closeStale()`: cierra entrenamientos abiertos hace más de `STALE_HOURS`. |
| [`js/db.js`](js/db.js) | Orden natural de rutinas por nombre (`localeCompare` con `numeric`). |
| [`css/styles.css`](css/styles.css) | `.missing` y `.btn-inline`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v4`. |

### Para tener en cuenta
- Las rutinas que ya cargaste con la foto anterior tienen la zona media con progresión 1: entrá a *Editar* en cada día y pasalos a **Fijo** con sus reps,
  o volvé a cargar la foto eligiendo *Actualizar Día N* (mantiene la semana en la que vas).

## v5 — Entrenar por páginas (2026-10-09)

### Qué cambió
- **Un ejercicio por página**: el entrenamiento ya no es una lista larga. Cada ejercicio ocupa su propia página
  y se pasa **deslizando** de costado o con los botones **← Anterior / Siguiente →** (fijos abajo, arriba de la barra de pestañas).
- **Zona media junta**: los ejercicios seguidos de zona media (los que tienen objetivo *Fijo* en el plan, o del grupo Abdominales
  si se agregaron a mano) van todos en una misma página, *Circuito zona media*.
- **Barra de progreso arriba**: un segmento por página; se pone verde cuando todas sus series tienen reps, y tocándolo vas a esa página.
- **Página final de resumen**: lista de ejercicios con las series hechas (tocás uno para volver), *+ Agregar ejercicio*,
  *Terminar entrenamiento* y *Descartar*. Lo mismo al editar un entrenamiento del historial (*Guardar* / *Borrar*).
- La app recuerda en qué página estabas si cambiás de pestaña y volvés. Al agregar, mover o cambiar un ejercicio, se muestra su página.

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/views/train.js`](js/views/train.js) | `renderEditor` arma las páginas (`buildPages`, `isCore`) en un carrusel con *scroll-snap*. Cada ejercicio de una rutina guarda `circuit` (zona media) al empezar. |
| [`css/styles.css`](css/styles.css) | `.steps`, `.step`, `.pager`, `.pager-page`, `.page-kicker`, `.pager-nav`, `.pager-count`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v5`. |


## v6 — Zona media siempre junta (2026-10-09)

- Los ejercicios de zona media salían en páginas separadas en las rutinas cargadas antes de v4: tenían progresión 1 en vez de *Fijo*,
  y esa marca le ganaba al grupo muscular. Ahora un ejercicio es de zona media si en el plan es *Fijo* **o** si su grupo principal es Abdominales,
  así que se juntan también en el entrenamiento que ya tengas abierto.
- Archivos: [`js/views/train.js`](js/views/train.js) (`isCore`), [`sw.js`](sw.js) (caché `gimnasio-v6`).

## v7 — Pestaña Plan rediseñada (2026-10-14)

- **Arriba**: título con un resumen (cantidad de rutinas y semanas de la progresión) y los botones **📷 Desde foto** y **+ Nueva rutina** lado a lado.
- **Tarjeta de cada rutina**: nombre con la cantidad de ejercicios, una **barra de semanas** (verde las hechas, azul la que toca)
  y la lista de ejercicios numerada, con la progresión (**P1**, **P2**… o **Fijo**) y el objetivo de esta semana en una pastilla a la derecha.
- **Progresión semanal**: pasó abajo de las rutinas y se despliega al tocarla, para que no ocupe toda la pantalla.
- *Empezar plan nuevo* quedó como botón discreto al final.
- Archivos: [`js/views/plan.js`](js/views/plan.js) (`routineCard`, `weekBar`, `progressionCard`), [`css/styles.css`](css/styles.css), [`README.md`](README.md), [`sw.js`](sw.js) (caché `gimnasio-v7`).

## v8 — Zona media bien diferenciada (2026-10-14)

La zona media ahora tiene su propio color (naranja) en toda la app, así se distingue de un vistazo de los ejercicios principales.

- **Plan**: los ejercicios de zona media seguidos van en un **bloque aparte** (donde estén en la rutina, en general al final), con el título *Zona media · circuito de N*.
  Los ejercicios principales se numeran solos (1, 2, 3…) y los de zona media llevan un punto naranja. Debajo del nombre de la rutina dice, por ejemplo,
  *5 ejercicios + 3 de zona media*. En *Editar* y en la revisión del plan desde foto, esas filas aparecen marcadas con la etiqueta **Zona media**.
- **Entrenar**:
  - En el inicio, cada rutina muestra cuántos ejercicios son de zona media.
  - La página del circuito empieza con un cartel **Zona media** y sus ejercicios tienen el borde naranja.
  - En la barra de progreso de arriba, el segmento de la zona media es naranja (verde cuando está completo).
  - En el resumen final, esos ejercicios llevan la etiqueta **Zona media**.
- Es zona media lo mismo que antes: objetivo *Fijo* en el plan o grupo principal Abdominales.

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/progression.js`](js/progression.js) | `isCoreItem`, `coreRuns` (agrupa la zona media seguida, lo usan el plan y el entrenamiento) e `itemsLabel`. |
| [`js/views/plan.js`](js/views/plan.js) | `routineItems` arma la lista con el bloque de zona media; filas marcadas en el editor y en la revisión. |
| [`js/views/train.js`](js/views/train.js) | `buildPages` usa `coreRuns`; cartel, borde y etiqueta de zona media. |
| [`css/styles.css`](css/styles.css) | Colores `--core` / `--core-soft` (claro y oscuro), `.core-block`, `.core-tag`, `.core-banner`, `.step.core`, `.entry.core`. Se sacaron `.page-kicker` y `.prog-tag.fixed`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v8`. |

## v9 — Fuerza, zona media y cardio; cronómetro (2026-10-14)

### Fuerza, zona media y cardio
- Los ejercicios se separan en **tres categorías**, cada una con su color: **Fuerza** (azul), **Zona media** (naranja) y **Cardio** (violeta).
- **Cardio** es un grupo nuevo en *Mis ejercicios*. Se agregan solos *Cinta*, *Bicicleta fija*, *Elíptico*, *Remo ergómetro*, *Escaladora* y *Soga*
  (salvo los que ya tengas con ese nombre). Al crear un ejercicio de cardio no se pide tipo de peso ni grupos secundarios.
  - Se anota en **minutos** y, si querés, **km** (en vez de kg y reps).
  - No cuenta en las series por grupo muscular, en los récords ni en los gráficos de fuerza.
  - Al leer el plan desde una foto, el cardio se reconoce y se guarda con sus minutos ("20'" → "20 min").
- **Plan**: cada rutina muestra sus ejercicios en bloques por categoría, en el orden de la rutina, numerados dentro de cada bloque
  (ej. *Cardio · 1 ejercicio*, *Fuerza · 6 ejercicios*, *Zona media · circuito de 3 ejercicios*).
  Debajo del nombre dice, por ejemplo, *6 de fuerza · 3 de zona media · 1 de cardio*.
  En *Editar* y en la revisión de la foto, la zona media y el cardio llevan su etiqueta.
- **Entrenar**: fuerza va de a un ejercicio por página (con el título *Fuerza*). La zona media y el cardio seguidos van juntos en una página
  con su cartel. Cada tarjeta, el segmento de la barra de arriba y la fila del resumen llevan el color de su categoría.

### Cronómetro y duración
- Al empezar un entrenamiento arranca un **cronómetro**, que se ve siempre abajo, entre *Anterior* y *Siguiente*.
- Al tocar *Terminar entrenamiento* se guarda la **duración** ("¡Entrenamiento guardado! Duró 52 min").
- La duración aparece en *Últimos entrenamientos*, en el *Historial* y arriba al abrir un entrenamiento guardado.
  Ahí también se puede **corregir** (campo *Duración (minutos)* en el resumen), por ejemplo si te olvidaste de terminarlo.
- *Progreso → Mes* suma **tiempo entrenado** y **minutos de cardio**.
- Los entrenamientos de antes no tienen duración, y tampoco los que se cierran solos a las 6 horas: no se sabe cuánto duraron de verdad.

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/data.js`](js/data.js) | `CARDIO`, `EXERCISE_GROUPS` (grupos + Cardio), tipo `cardio`, `exerciseCategory`, `CATEGORIES` y ejercicios iniciales de cardio. `GROUPS` sigue siendo solo los grupos musculares. |
| [`js/db.js`](js/db.js) | Suma una vez los ejercicios de cardio a quien ya tenía la lista inicial (marca `cardioSeeded`). |
| [`js/progression.js`](js/progression.js) | `itemCategory` y `categoryRuns` reemplazan a `isCoreItem` y `coreRuns`; `itemsLabel` cuenta por categoría. |
| [`js/views/plan.js`](js/views/plan.js) | Bloques por categoría (`routineItems`) y etiquetas (`catTag`). |
| [`js/views/train.js`](js/views/train.js) | `entryCategory`, páginas por categoría, series de cardio (minutos en `r`, km en `w`), cronómetro (`startClock`), `startedAt` y `duration` (segundos) en la sesión. |
| [`js/stats.js`](js/stats.js) | Cardio fuera de récords, mejoras y gráficos; `cardioMin` y `trainedSec` en el resumen del mes; `fmtSets` muestra minutos y km. |
| [`js/ui.js`](js/ui.js) | `fmtClock` y `fmtDuration`. |
| [`js/views/exercises.js`](js/views/exercises.js), [`js/plan-import.js`](js/plan-import.js) | Cardio como grupo. |
| [`js/views/more.js`](js/views/more.js), [`js/views/progress.js`](js/views/progress.js) | Duración en el historial; tiempo entrenado y cardio en el mes. |
| [`css/styles.css`](css/styles.css) | Colores `--fuerza`, `--core`, `--cardio` (y `-soft`); clases `.cat-*` en lugar de `.core-*`; `.clock`; `[hidden]` siempre oculta. |
| [`sw.js`](sw.js) | Caché `gimnasio-v9`. |

## v10 — Semanas de calendario (2026-10-15)

Antes la semana de cada día avanzaba solo cuando lo terminabas, así que si faltabas un día ese día quedaba atrasado respecto de los otros.

- Las semanas del plan ahora son **de lunes a domingo**. La **semana 1** es la del primer entrenamiento del plan y cada lunes pasa a la siguiente progresión, hayas hecho todos los días o no.
- Si una semana termina sin que hayas hecho un día, esa semana queda **sin entrenar** para ese día: en *Plan* se ve en rojo en la barra de semanas (*Semana 3 de 6 · sin entrenar: 2*).
- **Recuperar**: si ya hiciste el día en la semana actual y lo volvés a hacer, usa los objetivos de la semana sin entrenar más vieja y la marca como hecha.
  En *Entrenar* el botón dice *Recupera semana 2* y en *Plan* *la próxima vez recupera la 2*. Si no hay nada pendiente, repite la semana actual.
- Pasada la última semana de la tabla, se sigue usando la última.
- No hace falta migrar nada: las semanas hechas se calculan con las fechas de los entrenamientos terminados, también los de antes.

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/progression.js`](js/progression.js) | `weekStatus` (semana actual, la que toca, hechas y sin entrenar) a partir de `planStart` y `weekToDo`; `currentWeek` la usa. |
| [`js/views/plan.js`](js/views/plan.js) | `weekBar` muestra hechas, sin entrenar, actual y qué semana se recupera. |
| [`js/views/train.js`](js/views/train.js) | `weekLabel` avisa cuando el entrenamiento recupera una semana. |
| [`css/styles.css`](css/styles.css) | `.week-steps span.missed`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v10`. |

## v11 — Estadísticas sin series por grupo (2026-10-15)

Las series por grupo (con el ½ de los secundarios y el objetivo de 10 a 20) no decían nada útil y tenían demasiados números. Se reemplazan por:

- **Semana → Días del plan**: cada día de tu plan con ✓ y la fecha en que lo hiciste, *pendiente* si la semana está en curso o *✗ sin entrenar* si ya terminó.
  Abajo aparecen los entrenamientos libres o de rutinas que no son del plan.
- **Semana → Músculos trabajados**: los grupos que entrenaste esa semana y cuántos días. Los que no, ordenados por hace cuánto no los entrenás
  (*última: hace 9 días*). Cuenta solo el **grupo principal** de cada ejercicio.
- **Mes → Días del plan por semana**: cada semana del mes con cuántos días del plan hiciste (*2 de 3*) y cuántas semanas quedaron completas.
- **Mes → Fuerza por ejercicio** (en lugar de mejoraron / se mantuvieron / bajaron en %): la serie más pesada de la primera y la última vez del mes,
  y cuánto cambió en **kg** (*▲ +7,5 kg*), o en reps si el peso fue el mismo.
- Los días del plan de una semana son las rutinas activas que ya existían esa semana, más cualquier rutina que hayas hecho esa semana.

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/stats.js`](js/stats.js) | `weekPlan`, `planWeeks` y `musclesWorked` reemplazan a `groupSets` (se van `TARGET_MIN`/`TARGET_MAX`). `monthSummary` compara con `topSet` (más peso) en lugar del 1RM en %, y ya no devuelve `groups`. |
| [`js/views/progress.js`](js/views/progress.js) | Pestañas *Mes* y *Semana* rehechas; fuera `balanceHtml`. |
| [`css/styles.css`](css/styles.css) | `.week-row`; fuera `.bal-*` y `--band`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v11`. |

## v12 — Arreglo: la app se quedaba cargando (2026-10-15)

- En la v10 la barra de semanas del *Plan* quedó con un error de sintaxis en [`js/views/plan.js`](js/views/plan.js) (`weekBar` sin cerrar) y la app no terminaba de cargar.
- Caché `gimnasio-v12` en [`sw.js`](sw.js) para que el teléfono baje el arreglo.

## v13 — La actualización no llegaba al teléfono (2026-10-15)

- El service worker guardaba los archivos sin saltear la caché del navegador (GitHub Pages la deja 10 minutos), así que podía quedarse con el `plan.js` roto aunque ya estuviera arreglado.
  Ahora al instalar pide todo a la red (`cache: 'reload'`) y al actualizar en segundo plano revalida (`no-cache`).
- Caché `gimnasio-v13` en [`sw.js`](sw.js).

## v14 — Récords rediseñados (2026-10-15)

- **Filtro por grupo** arriba (*Todos*, *Pecho*, *Espalda*…) en lugar de una lista larga con todos los grupos.
- **Nuevos en los últimos 30 días**: los récords que superaron a uno anterior, con la fecha y cuánto mejoraron (*▲ +2,5 kg*, *▲ +1 rep*).
- Cada ejercicio muestra la marca grande (*45* kg × 9), hace cuánto fue y el récord anterior (*antes 42,5 × 10*).
- Tocando un ejercicio se abre su gráfico en *Ejercicios*.
- Se sacó el 1RM estimado de los récords (sigue en el gráfico de cada ejercicio).

### Cambios técnicos
| Archivo | Cambio |
|---|---|
| [`js/stats.js`](js/stats.js) | `records()` devuelve `{ ex, best, date, prev, prevDate }` usando `topSet`/`beats` (antes `maxW`, `bestE1rm`, `maxReps`). |
| [`js/views/progress.js`](js/views/progress.js) | `renderRecords` con chips de grupo (`ui.recGroup`), `recordRow` y `recordValue`; `diffBadge` dice *rep* en singular. |
| [`css/styles.css`](css/styles.css) | `.rec-*`; fuera `.record-val`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v14`. |

## v15 — Mejora en kg y reps a la vez (2026-10-15)

- Cuando cambian el peso y las reps, el cartel muestra las dos cosas: *▲ +2,5 kg y +2 reps*. Si subió el peso pero bajaron las reps: *▲ +2,5 kg · −2 reps*.
  Antes mostraba solo los kg. Aplica en *Récords* y en *Mes → Fuerza por ejercicio*.
- Sube o baja según el peso; a igual peso, según las reps.
- Archivos: [`js/views/progress.js`](js/views/progress.js) (`diffBadge`), [`sw.js`](sw.js) (caché `gimnasio-v15`).

## Tests automáticos (2026-10-15)

No cambia la app (no sube la versión de la caché).

- `npm test` corre 26 tests con el test runner de Node, sin dependencias: semanas del plan, estadísticas, récords y una prueba de humo que carga todos los módulos y dibuja cada pantalla.
  Comprobado: el error de `plan.js` de la v10 y un error en la recuperación de semanas hacen fallar los tests.
- Hook [`.githooks/pre-push`](.githooks/pre-push): corre los tests antes de cada push y frena si cambiaron archivos de la app sin cambiar `CACHE` en `sw.js`. Se activa con `git config core.hooksPath .githooks`.
- Archivos nuevos: [`package.json`](package.json) (solo para `npm test`), [`tests/`](tests/), [`.githooks/pre-push`](.githooks/pre-push).

## v16 — App Check y validaciones en las reglas (2026-10-15)

Preparación para que la use más gente.

- **Reglas de Firestore con validaciones** ([`firestore.rules`](firestore.rules)): además de que cada usuario vea solo lo suyo, ahora
  - solo se puede escribir en `exercises`, `routines`, `sessions` y `bodyweight` (nada de colecciones inventadas ni subcolecciones);
  - cada tipo de documento tiene sus campos obligatorios con el tipo correcto (fecha `YYYY-MM-DD`, tipo de ejercicio válido, peso corporal entre 20 y 400 kg, etc.);
  - hay límites de tamaño: textos cortos, hasta 60 ejercicios por rutina o entrenamiento, 30 semanas por tabla y pocos campos por documento.
  - **Hay que publicarlas** en Firebase (consola o `npm run deploy:rules`): subir el código no las cambia.
- **Tests de las reglas** en el emulador de Firestore ([`tests/rules/rules.test.mjs`](tests/rules/rules.test.mjs), `npm run test:rules`), con documentos iguales a los que guarda la app, también los de versiones anteriores.
- **App Check** listo en el código ([`js/db.js`](js/db.js)): se activa al poner la clave de reCAPTCHA v3 en `appCheckSiteKey` ([`js/firebase-config.js`](js/firebase-config.js)). Mientras esté vacía no cambia nada. Pasos en el README.
- [`firebase.json`](firebase.json) y [`.firebaserc`](.firebaserc) para el emulador y para publicar las reglas; dependencias de desarrollo (`firebase-tools`, `@firebase/rules-unit-testing`) solo para los tests.
- [`.gitattributes`](.gitattributes): el hook `pre-push` siempre con fin de línea LF.
- Caché `gimnasio-v16` en [`sw.js`](sw.js).

## v17 — App Check activado (2026-10-15)

- App Check con **Fraud Defense (antes reCAPTCHA Enterprise)**: Firebase marca reCAPTCHA v3 "Classic" como obsoleto, así que se usa `ReCaptchaEnterpriseProvider` ([`js/db.js`](js/db.js)).
- Clave del sitio en `appCheckSiteKey` ([`js/firebase-config.js`](js/firebase-config.js)); el proyecto de Google Cloud es el mismo de Firebase. Todavía **sin exigir** (Enforce): primero hay que ver en Firebase → App Check que los pedidos lleguen verificados.
- Caché `gimnasio-v17` en [`sw.js`](sw.js).

## v18 — Catálogo de ejercicios en el código (2026-10-16)

Antes, a cada usuario nuevo se le copiaban los 70 ejercicios iniciales como documentos propios: 70 escrituras al entrar por primera vez
y 70 lecturas más cada vez que se abría la app. Ahora:

- Los 70 ejercicios de base son un **catálogo en el código** (`CATALOG` en [`js/data.js`](js/data.js)) con ids fijos (`base-press-banca-plano`, …).
- En Firestore cada usuario guarda solo lo suyo: ejercicios que crea, ejercicios del catálogo que **edita** (se guarda su versión con el mismo id)
  y los que **borra** (se guarda `hidden: true`, porque el del catálogo no se puede borrar).
- La app une las dos cosas (`mergeExercises`). Un usuario nuevo ya no escribe nada al entrar.
- **Usuarios de antes**: sus copias de la lista inicial siguen siendo suyas (sus entrenamientos apuntan a ellas). Si tienen un ejercicio con el mismo
  nombre que uno del catálogo, se muestra solo el suyo, así no aparecen repetidos. Si alguna vez borraron uno de la lista inicial, vuelve a aparecer el del catálogo
  (se puede borrar de nuevo).
- Ya no hacen falta `seedIfNeeded` ni la marca `cardioSeeded`: el cardio está en el catálogo.
- [`firestore.rules`](firestore.rules): acepta la marca de oculto y ids de hasta 60 letras (los del catálogo). **Hay que volver a publicar las reglas.**
- Tests: [`tests/catalog.test.mjs`](tests/catalog.test.mjs) (unión del catálogo, usuarios nuevos y de antes, ids fijos) y en las reglas.
- Caché `gimnasio-v18` en [`sw.js`](sw.js).

## v19 — Gráficas de Progreso (2026-10-16)

- **Ejercicios y Peso**:
  - El eje de fechas es **proporcional al tiempo**: dos entrenamientos separados por 3 semanas quedan más lejos que dos separados por 2 días.
  - **Número grande** arriba del gráfico con cuánto cambió en el período: 1RM estimado de la última vez (o reps, sin peso) y, en Peso, la media de 7 días.
  - Selector **1M · 3M · 6M · 1A · Todo** (solo los rangos que recortan algo).
  - Récords marcados con un rombo en la línea del peso máximo y "🏆 récord" en el historial.
  - Tooltip con los colores de la app y degradé debajo de la línea cuando hay una sola serie.
- **Peso corporal**: la línea principal es la **media de 7 días**; los registros diarios quedan como puntos.
- **Mes → Constancia**: mapa de días entrenados (un cuadrito por día, más oscuro con más series) y racha de semanas seguidas.
  Tocando un día se ve qué rutina hiciste y cuántas series.
- **Semana → Volumen por semana**: barras de las últimas 12 semanas en series o en kg levantados. Tocando una barra se va a esa semana.
- **Récords**: mini gráfico con la tendencia de las últimas 12 veces de cada ejercicio.
- Los colores de Chart.js se configuran una vez por tema y los gráficos se redibujan al pasar de claro a oscuro. Animación corta solo al entrar a una pestaña.

| Archivo | Cambio |
|---|---|
| [`js/stats.js`](js/stats.js) | `exerciseHistory` marca `pr`; nuevas `trainingDays`, `weekStreak`, `weeklyVolume` y `movingAverage`. |
| [`js/views/progress.js`](js/views/progress.js) | `timeChart` (eje lineal de fechas), `withRange`, `heroHtml`, `sparkline`, `heatmap` y `volumeChart`; `makeChart` aplica los valores de Chart.js una vez por tema. |
| [`css/styles.css`](css/styles.css) | `.hero`, `.spark`, `.heat-*`, `.chart-box.short`. |
| [`tests/stats.test.mjs`](tests/stats.test.mjs) | Tests de los cálculos nuevos. |
| [`sw.js`](sw.js) | Caché `gimnasio-v19`. |

## v20 — Inicio de Entrenar y listas más cortas (2026-10-16)

- **Entrenar**:
  - Arriba, cómo vas en la semana (un punto por rutina y "Esta semana: 2 de 3").
  - Tarjeta **"Te toca"** con la primera rutina del plan que falta esta semana y un botón grande *Empezar*.
  - El resto de las rutinas en lista, con "✓ jue 15 oct" o "pendiente". *Entrenamiento libre* pasa a ser un botón secundario.
- **Mes → Fuerza por ejercicio**:
  - Resumen en etiquetas ("▲ 5 mejoraron · ▼ 2 bajaron") y filas antes → ahora con lo que cambió resaltado en su color.
  - Plegado: las 3 que más subieron y las 3 que más bajaron, con **"Ver los N ejercicios"** para el resto.
- **Mes → Récords nuevos**: los 3 más recientes y "Ver los N récords".

| Archivo | Cambio |
|---|---|
| [`js/views/train.js`](js/views/train.js) | `renderHome` nuevo; `lastDoneText`. |
| [`js/views/progress.js`](js/views/progress.js) | `strengthSummary`, `strengthList`, `foldList`, `setHtml`. |
| [`css/styles.css`](css/styles.css) | `.next-card`, `.week-dots`, `.free-btn`, `.str-*`, `.delta-pill`, `.more-btn`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v20`. |

## v21 — Ayuda al entrenar (2026-10-16)

- **Sugerencia "Hoy"** en cada ejercicio de fuerza: peso y reps para hoy (▲ subí / = mantené / ▼ bajá) con el motivo,
  según la última vez, el objetivo de la semana y el RIR. El botón **Usar** completa ese peso en las series vacías.
  Los campos vacíos muestran lo sugerido.
- **Récord a superar** debajo de "Última vez". La serie que lo supera se marca con 🏆 y, al terminar de escribirla, avisa una vez por ejercicio (con vibración).
- **RIR** (reps en reserva) opcional por serie en los ejercicios de fuerza: – / 0 / 1 / 2 / 3 / 4+. Ajusta la sugerencia de la próxima vez.
- **Resumen al terminar** en lugar de volver directo al inicio: duración contra la vez anterior de la rutina, series, kg levantados,
  récords nuevos, cada ejercicio contra la última vez y qué rutina toca después.
- Los criterios de la sugerencia están en [`CRITERIOS.md`](CRITERIOS.md).

| Archivo | Cambio |
|---|---|
| [`js/coach.js`](js/coach.js) | **Nuevo.** `parseTarget`, `weightStep`, `suggestion`, `recordBefore`, `isRecord`, `sessionSummary`. |
| [`js/set-format.js`](js/set-format.js) | **Nuevo.** `fmtSet`, `diffParts`, `diffBadge`, `setHtml` (salen de `progress.js` para usarlos también en el resumen). |
| [`js/views/train.js`](js/views/train.js) | `entryCard` con sugerencia, récord y RIR; `markRecord`; `renderSummary`. `cleanup` conserva el RIR (`sets[].rir`). |
| [`js/stats.js`](js/stats.js) | Se exportan `beats` y `topSet`. |
| [`tests/coach.test.mjs`](tests/coach.test.mjs) | **Nuevo.** |
| [`sw.js`](sw.js) | Caché `gimnasio-v21`; cachea `coach.js` y `set-format.js`. |

Las reglas de Firestore no cambian: no validan el contenido de cada serie.

## v22 — Arreglo: series de aproximación en la sugerencia (2026-10-16)

- Con *45×10 · 50×9 · 50×9* y objetivo 3x8 sugería mantener 50 kg: la primera serie, más liviana, contaba como si hubieras bajado el peso.
  Ahora las series más livianas **antes** de la primera con el peso más alto son de aproximación y no cuentan; las más livianas **después** sí
  (bajaste porque no llegabas), y el motivo lo dice: "Con 60 kg hiciste 2 de 3 series".
- Archivos: [`js/coach.js`](js/coach.js), [`tests/coach.test.mjs`](tests/coach.test.mjs), [`sw.js`](sw.js) (caché `gimnasio-v22`).

## v24 — Pestaña Análisis (2026-10-16)

La v23 no se publicó (la caché se subió dos veces antes de este push).

- **Progreso → Análisis** (pestaña nueva, al lado de *Mes*):
  - **📋 Reporte del plan**: fechas, días del plan hechos, récords nuevos, semanas sin entrenar y cómo cambió cada ejercicio de la primera a la última vez del plan.
    Botón **"✨ Resumen y consejos con IA"**: Gemini escribe un párrafo sobre cómo te fue y 3 consejos para el próximo plan. Solo se genera al tocarlo y no se guarda.
  - **🎯 Cumplimiento del objetivo**: % de series que llegaron a las reps del plan, qué ejercicios cuestan y cuáles quedan fáciles.
  - **⏸️ Estancados**: ejercicios con 3 o más entrenamientos seguidos sin récord, con sugerencia de descarga o de cambio.
  - **⚖️ Balance muscular**: series por semana de cada grupo contra la franja de 10 a 20; empuje, tirón y piernas.
  - **💪 Fuerza relativa**: 1RM estimado ÷ peso corporal, con nivel en sentadilla, banca, peso muerto y press militar (referencias de hombres o de mujeres).
- **Entrenar**: durante 3 semanas después de terminar el plan, aviso "🏁 Terminaste el plan" con enlace al reporte (`#progreso/analisis`).
- **Subió / bajó por fuerza estimada (1RM)** con un margen de ±1,5% en *Mes → Fuerza por ejercicio*, en el reporte del plan y en el resumen al terminar:
  menos peso con muchas más reps (42,5×7 → 40×11) cuenta como mejora y 60×10 → 62,5×8, como igual. Los récords no cambian.
- Todos los umbrales están explicados en [`CRITERIOS.md`](CRITERIOS.md).

| Archivo | Cambio |
|---|---|
| [`js/analysis.js`](js/analysis.js) | **Nuevo.** `planInfo`, `strengthChange`, `recordsBetween`, `targetCompliance`, `stalledExercises`, `muscleBalance`, `relativeStrength`. |
| [`js/ai.js`](js/ai.js) | **Nuevo.** Gemini compartido (`generate`, lista `MODELS`); lo usan la foto del plan y el reporte. |
| [`js/plan-import.js`](js/plan-import.js) | Usa `generate` de `ai.js`. |
| [`js/stats.js`](js/stats.js) | `strengthScore` y `compareStrength`; `monthSummary` clasifica por 1RM estimado y devuelve `dir`. |
| [`js/progression.js`](js/progression.js) | Se exporta `planStart`. |
| [`js/views/progress.js`](js/views/progress.js) | `renderAnalysis` y sus tarjetas; `render(container, arg)` abre la pestaña de `#progreso/<pestaña>`. |
| [`js/views/train.js`](js/views/train.js) | Aviso de plan terminado; el resumen colorea por fuerza estimada. |
| [`tests/analysis.test.mjs`](tests/analysis.test.mjs) | **Nuevo.** También tests de `compareStrength`. |
| [`sw.js`](sw.js) | Caché `gimnasio-v24`; cachea `ai.js` y `analysis.js`. |
| [`README.md`](README.md) | La lista de modelos de Gemini ahora está en `js/ai.js`. |
