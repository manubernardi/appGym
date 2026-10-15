# Mi Gimnasio

App web instalable (PWA) para registrar entrenamientos y ver la evolución por grupo muscular.
Funciona sin internet en el gimnasio y sincroniza con Firebase cuando hay conexión. Todo gratis.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Firebase
1. Entrá a https://console.firebase.google.com con tu cuenta de Google y tocá **Crear un proyecto**.
   Nombre, por ejemplo, `mi-gimnasio`. Google Analytics: desactivalo (no hace falta).
2. **Authentication** → *Comenzar* → *Método de acceso* → habilitá **Google**.
3. **Firestore Database** → *Crear base de datos* → ubicación `southamerica-east1` (o la más cercana) →
   *Iniciar en modo de producción*.
4. En Firestore → pestaña **Reglas**, reemplazá todo por el contenido de [`firestore.rules`](firestore.rules) y tocá **Publicar**.
5. Configuración del proyecto (⚙️) → *Tus apps* → ícono **web `</>`** → registrá la app (sin Hosting).
   Copiá los valores de `firebaseConfig` y pegalos en [`js/firebase-config.js`](js/firebase-config.js).

El plan gratuito (Spark) no pide tarjeta y sobra para uso personal.

### 1b. Activar la lectura del plan desde foto (opcional)
1. En la consola de Firebase → **AI Logic** (menú *Compilación / Build*) → **Comenzar**.
2. Elegí **Gemini Developer API** (la gratuita, no pide tarjeta) y confirmá. Esto habilita la API y crea la clave sola: no hay que pegar nada en la app.

Usa el modelo `gemini-3.8-flash` (y `gemini-3.5-flash-lite` si el primero no está). Si Google los retira, cambiá la lista `MODELS` en [`js/plan-import.js`](js/plan-import.js).

### 2. Publicar en GitHub Pages
1. Creá un repositorio en GitHub (por ejemplo `gimnasio`). Puede ser público: los datos no están en el código, sino en Firebase protegidos por tu login.
2. Subí todos los archivos de esta carpeta.
3. En el repo: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`** → Save.
   En un minuto queda en `https://TU-USUARIO.github.io/gimnasio/`.
4. En Firebase → **Authentication → Configuración → Dominios autorizados** → agregá `TU-USUARIO.github.io`.

### 3. Instalar en el teléfono
Abrí la dirección en **Chrome** en tu Android → menú ⋮ → **Agregar a la pantalla principal / Instalar app**.
Entrá con Google una vez (con internet). Después funciona también sin conexión.

## Probar en la PC
Desde esta carpeta: `npx serve .` (o cualquier servidor estático) y abrí `http://localhost:3000`.
`localhost` ya viene autorizado en Firebase.

## Cómo se usa
- **Plan**: cargás las rutinas del mes (Día 1, Día 2…, siempre ordenadas por número) con cada ejercicio y su objetivo (`3x10`).
  Con **📷 Desde foto** le sacás una foto a la hoja: Gemini arma las rutinas, asocia cada ejercicio
  con uno tuyo aunque esté escrito distinto ("press banco barra" → "Press banca plano") y propone crear los que no tenés.
  Revisás, corregís lo que haga falta y elegís cómo cargar cada día: como rutina nueva, *actualizando* una que ya tenés (mantiene la semana en la que vas) o no cargarlo. Las rutinas actuales que no se actualizan se archivan o se dejan, según elijas.
- **Progresión semanal**: si la hoja trae la tabla *Progresión semanal* (columnas = progresión 1, 2, 3…; filas = semanas),
  cada ejercicio guarda su número de progresión (el `(n)` al lado del nombre; sin número = 1).
  Los de **zona media** tienen sus propias series x reps ("Puente frontal 3*10") y quedan como **Fijo**: no siguen la tabla.
  Las semanas son **de calendario** (lunes a domingo): la semana 1 es la del primer entrenamiento del plan y cada lunes pasa a la siguiente,
  aunque no hayas hecho todos los días. Si una semana terminó sin hacer un día, esa semana queda **sin entrenar** (en rojo en la barra del plan).
  Si ya hiciste el día en la semana actual y lo volvés a hacer, **recupera** la semana sin entrenar más vieja (con sus objetivos); si no hay ninguna, repite la actual.
  Al empezar el entrenamiento, los objetivos y la cantidad de series salen de esa semana. Pasada la última semana de la tabla, se repite la última.
  Cuando cambia el plan, *Empezar plan nuevo* archiva las rutinas viejas (los registros se mantienen).
- **Fuerza, zona media y cardio**: los ejercicios se separan en estas tres categorías, cada una con su color
  (azul, naranja y violeta) en el plan y al entrenar. Cardio es un grupo más en *Mis ejercicios* (cinta, bici, elíptico…):
  se anota en minutos y, si querés, km, y no cuenta en los récords ni en la fuerza por ejercicio.
  Zona media = grupo Abdominales u objetivo *Fijo* en el plan.
- **Entrenar**: elegís la rutina y anotás kg y reps de cada serie. Cada ejercicio de fuerza es una página que pasás deslizando o con *Anterior / Siguiente*
  (los de zona media seguidos van juntos en una página, y lo mismo el cardio); la barra de arriba muestra en verde los completos y al final está el resumen para terminar. Arriba de cada ejercicio ves lo que hiciste la última vez,
  y los campos vacíos muestran esos valores en gris como referencia. Se guarda solo mientras escribís.
  Abajo corre un **cronómetro** desde que empezaste; al terminar se guarda la duración, que se ve en el historial
  (y se puede corregir al editar un entrenamiento).
  Si dejás un entrenamiento abierto sin terminarlo, a las 6 horas se cierra solo (se guarda si tiene series, se borra si está vacío).
- **Progreso**:
  - *Mes*: entrenamientos y frecuencia, tiempo entrenado, minutos de cardio, récords nuevos, cuántos días del plan hiciste cada semana
    y la **fuerza por ejercicio** (serie más pesada de la primera vs la última vez del mes: "▲ +7,5 kg", o en reps si el peso no cambió).
  - *Semana*: qué días del plan hiciste y cuáles faltan (o quedaron sin entrenar), y qué músculos trabajaste
    (solo el grupo principal de cada ejercicio). De los que no trabajaste dice hace cuánto fue la última vez.
  - *Ejercicios*: gráfico de peso máximo y fuerza estimada (1RM) de cada ejercicio, más su historial.
  - *Récords*: la serie más pesada de cada ejercicio (sin peso: más reps), hace cuánto fue y el récord anterior. Filtro por grupo,
    arriba los récords nuevos de los últimos 30 días y, tocando un ejercicio, su gráfico.
  - *Peso* corporal.
- **Más**: historial completo (se puede editar o borrar cualquier entrenamiento), tus ejercicios (nombre, tipo de peso,
  grupos musculares) y copia de seguridad en un archivo.

### Cómo se anota el peso
En ejercicios de mancuerna se anota el peso de una; con barra, el peso total; en máquina o polea, el número de la máquina.

## Actualizar la app
Anotá los cambios en [`CHANGELOG.md`](CHANGELOG.md). Después de cambiar archivos, subí el número de `CACHE` en [`sw.js`](sw.js) (`gimnasio-v2`, …).

### Tests
Hace falta Node 22 o más nuevo (no hay dependencias que instalar). Correlos con:

```sh
npm test
```

- [`tests/progression.test.mjs`](tests/progression.test.mjs): semanas del plan (calendario, sin entrenar, recuperar).
- [`tests/stats.test.mjs`](tests/stats.test.mjs): días del plan, músculos trabajados, fuerza del mes y récords.
- [`tests/app.test.mjs`](tests/app.test.mjs): carga todos los módulos y dibuja cada pantalla con datos de ejemplo (Firebase y el DOM son de mentira,
  ver [`tests/support/`](tests/support/)). Atrapa errores de sintaxis o de imports que dejarían la app trabada en "cargando",
  y revisa que [`sw.js`](sw.js) tenga en `APP_FILES` todos los archivos de `js/`.

Una vez por clon, activá el hook que corre los tests antes de cada `git push` y frena el push si cambiaste archivos de la app
sin subir la versión de `CACHE`:

```sh
git config core.hooksPath .githooks
```
El teléfono toma la versión nueva la segunda vez que abrís la app.
