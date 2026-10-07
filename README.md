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
- **Plan**: cargás las rutinas del mes (Día A, Día B…) con cada ejercicio y su objetivo (`3x10`).
  Cuando cambia el plan, *Empezar plan nuevo* archiva las rutinas viejas (los registros se mantienen).
- **Entrenar**: elegís la rutina y anotás kg y reps de cada serie. Arriba de cada ejercicio ves lo que hiciste la última vez,
  y los campos vacíos muestran esos valores en gris como referencia. Se guarda solo mientras escribís.
- **Progreso**:
  - *Grupos*: series y volumen por grupo muscular, por semana o mes, separando cuando el grupo fue **principal** o **secundario**.
  - *Ejercicios*: gráfico de peso máximo y fuerza estimada (1RM) de cada ejercicio, más su historial.
  - *Récords*: mejor marca de cada ejercicio.
  - *Peso corporal*.
- **Más**: historial completo (se puede editar o borrar cualquier entrenamiento), tus ejercicios (nombre, tipo de peso,
  grupos musculares) y copia de seguridad en un archivo.

### Cómo se calcula el volumen
`kg × reps` de cada serie. Para ejercicios de **mancuerna** se anota el peso de una y el volumen se multiplica × 2.
**Barra**: peso total. **Máquina/polea**: el número de la máquina. Los ejercicios **sin peso** cuentan series pero no volumen.

## Actualizar la app
Después de cambiar archivos, subí el número de `CACHE` en [`sw.js`](sw.js) (`gimnasio-v2`, …).
El teléfono toma la versión nueva la segunda vez que abrís la app.
