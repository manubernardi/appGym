# Mi Gimnasio

App web instalable (PWA) para registrar entrenamientos y ver la evolución por grupo muscular.
Funciona sin internet en el gimnasio y sincroniza con Firebase cuando hay conexión. Todo gratis.

Cómo decide la app lo que sugiere y compara (sugerencia de peso, récords, cumplimiento, estancados, balance muscular…): [CRITERIOS.md](CRITERIOS.md).
Cambios de cada versión: [CHANGELOG.md](CHANGELOG.md).

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto en Firebase
1. Entrá a https://console.firebase.google.com con tu cuenta de Google y tocá **Crear un proyecto**.
   Nombre, por ejemplo, `mi-gimnasio`. Google Analytics: desactivalo (no hace falta).
2. **Authentication** → *Comenzar* → *Método de acceso* → habilitá **Google**.
3. **Firestore Database** → *Crear base de datos* → ubicación `southamerica-east1` (o la más cercana) →
   *Iniciar en modo de producción*.
4. En Firestore → pestaña **Reglas**, reemplazá todo por el contenido de [`firestore.rules`](firestore.rules) y tocá **Publicar**
   (o desde la PC: `npx firebase login` una vez y después `npm run deploy:rules`).
   Las reglas, además de que cada uno vea solo lo suyo, validan la forma y el tamaño de lo que se guarda.
   **Cada vez que cambies `firestore.rules`, volvé a publicarlas** (subir el código a GitHub no las actualiza).
5. Configuración del proyecto (⚙️) → *Tus apps* → ícono **web `</>`** → registrá la app (sin Hosting).
   Copiá los valores de `firebaseConfig` y pegalos en [`js/firebase-config.js`](js/firebase-config.js).

El plan gratuito (Spark) no pide tarjeta y sobra para uso personal.

### 1b. Activar la lectura del plan desde foto (opcional)
1. En la consola de Firebase → **AI Logic** (menú *Compilación / Build*) → **Comenzar**.
2. Elegí **Gemini Developer API** (la gratuita, no pide tarjeta) y confirmá. Esto habilita la API y crea la clave sola: no hay que pegar nada en la app.

Usa el modelo `gemini-3.8-flash` (y `gemini-3.5-flash-lite` si el primero no está). Si Google los retira, cambiá la lista `MODELS` en [`js/ai.js`](js/ai.js).

### 1c. App Check (recomendado si la usa más gente)
Hace que solo tu app pueda usar Firestore y Gemini con la configuración del proyecto (que es pública). Sin App Check,
cualquiera que copie [`js/firebase-config.js`](js/firebase-config.js) podría gastar tu cupo de Gemini.

1. Firebase → **App Check** → *Apps* → tu app web → **Fraud Defense (antes reCAPTCHA Enterprise)**.
   Si pide una clave del sitio: Google Cloud (mismo proyecto) → **Seguridad → Fraud Defense / reCAPTCHA** → *Crear clave* →
   plataforma **Web**, dominios `TU-USUARIO.github.io` y `localhost`, **sin** desafío de casilla. No hay clave secreta.
   (reCAPTCHA v3 "Classic" también funciona pero Firebase lo marca como obsoleto.)
2. Guardá en App Check con esa clave del sitio.
3. Pegá la misma clave en `appCheckSiteKey` en [`js/firebase-config.js`](js/firebase-config.js), subí la versión de `CACHE` y publicá.
4. Esperá un día o dos y mirá en Firebase → App Check → *APIs* que casi todos los pedidos aparezcan como **verificados**
   (si activás la exigencia antes, las versiones viejas de la app que todavía tengan los teléfonos dejan de funcionar).
5. Activá **Aplicar / Enforce** primero en **Firebase AI Logic** (Gemini) y después en **Cloud Firestore**.

Para probar en `localhost` con App Check exigido: la consola del navegador muestra un *token de depuración* la primera vez;
registralo en App Check → tu app → ⋮ → **Administrar tokens de depuración**.

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
`localhost` ya viene autorizado en Firebase. Ojo: así usás **tus datos reales**. Para probar sin tocarlos, usá el entorno de prueba.

## Entorno de prueba
Una copia de Firebase corriendo en tu PC, con usuarios ficticios y datos de ejemplo. Lo que hagas ahí **no toca tu app ni tus datos reales**:
usa un proyecto llamado `demo-appgym` (Firebase garantiza que los proyectos `demo-` nunca acceden a nada real).

**Una sola vez:** instalá Java 21 (por ejemplo `winget install EclipseAdoptium.Temurin.21.JDK`) y, desde esta carpeta, `npm install`.

**Cada vez:**

```sh
npm run dev
```

- Levanta los emuladores (login y base de datos), carga los usuarios de prueba y sirve la app en **http://localhost:5050**.
- En la app aparece la franja **ENTORNO DE PRUEBA** y, en vez de "Entrar con Google", elegís un usuario (contraseña de todos: `prueba123`):

  | Usuario | Para probar |
  |---|---|
  | `manu@prueba.com` | Plan de 4 semanas en la semana 3, 4 meses de historial, peso corporal, un ejercicio estancado y una semana sin entrenar |
  | `terminado@prueba.com` | Un plan que terminó hace unos días: el aviso en Entrenar y el reporte del plan |
  | `nuevo@prueba.com` | Sin datos, como alguien que recién instala la app |

- Atajo: `http://localhost:5050/?como=manu@prueba.com` entra directo con ese usuario.
- **En el celular**: la terminal muestra una dirección tipo `http://192.168.x.x:5050`. Abrila con el celular en la misma red Wi-Fi.
  La primera vez Windows puede preguntar si deja pasar a Node y a Java por el firewall: aceptá para redes privadas.
- **Ver o editar los datos**: http://localhost:4000 (consola de los emuladores).
- Las fechas son relativas a hoy: el plan siempre está en curso cuando lo probás.
- **Ctrl+C** corta todo. Los datos de prueba se borran y el próximo `npm run dev` los vuelve a cargar desde cero.
- Si dice *port taken* (quedó algo abierto de una vez anterior): `npm run dev:parar` y de nuevo `npm run dev`.
- No hay Gemini (el proyecto es falso): la foto del plan y el resumen con IA muestran un error.
- No registra el service worker: cada recarga trae el código recién guardado.
- Los usuarios están en [`js/dev.js`](js/dev.js) y sus datos se arman en [`scripts/seed-data.mjs`](scripts/seed-data.mjs).
  Para agregar un usuario de prueba, sumalo a `DEV_USERS` con un `profile` y armá ese perfil en `seedData`.

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

### Catálogo de ejercicios
Los ejercicios de base (70: pecho, espalda, …, cardio) están en el código ([`js/data.js`](js/data.js), `CATALOG`), no en la base de datos.
En Firestore cada usuario guarda solo lo suyo: los ejercicios que crea, los del catálogo que edita (mismo id) y los que oculta (`hidden: true`).
Así un usuario nuevo empieza sin documentos y un ejercicio agregado al catálogo le llega a todos al publicar.
Los ids del catálogo (`base-…`) no se cambian nunca: los entrenamientos y rutinas los guardan.

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

- [`tests/seed.test.mjs`](tests/seed.test.mjs): que los datos del entorno de prueba sigan mostrando lo que se quiere probar.

- [`tests/rules/rules.test.mjs`](tests/rules/rules.test.mjs): las reglas de Firestore en el emulador (lo que la app guarda tiene que pasar;
  datos de otro usuario, colecciones inventadas o documentos gigantes no). Necesita Java y las dependencias de desarrollo:
  `npm install` una vez y después `npm run test:rules`. No corre en el hook porque tarda (levanta el emulador).
  `npm run dev` también prueba las reglas de paso: los datos de prueba se cargan como cada usuario, con las reglas activas.

Una vez por clon, activá el hook que corre los tests antes de cada `git push` y frena el push si cambiaste archivos de la app
sin subir la versión de `CACHE`:

```sh
git config core.hooksPath .githooks
```
El teléfono toma la versión nueva la segunda vez que abrís la app.
