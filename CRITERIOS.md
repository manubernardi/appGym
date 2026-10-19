# Criterios de la app

Cómo decide la app cada cosa que sugiere, compara o marca: qué cuenta, con qué números y por qué.
Cada sección dice dónde está en el código, por si querés cambiar un número.
Los cambios de versión están en el [CHANGELOG](CHANGELOG.md).

## Índice

1. [Conceptos de base](#1-conceptos-de-base): 1RM estimado, mejor serie, récord, subió / bajó
2. [Entrenar](#2-entrenar): sugerencia de peso, escalones, RIR, récord en vivo, resumen al terminar, "Te toca"
3. [Progreso → Mes](#3-progreso--mes): constancia, fuerza por ejercicio, récords nuevos
4. [Progreso → Análisis](#4-progreso--análisis): plan, cumplimiento, estancados, balance, fuerza relativa, resumen con IA
5. [Progreso → Semana, Ejercicios, Récords y Peso](#5-progreso--semana-ejercicios-récords-y-peso)
6. [Otros](#6-otros)
7. [Resumen de números](#7-resumen-de-números)

---

## 1. Conceptos de base

### 1RM estimado (fuerza estimada)
Cuánto podrías levantar a una sola repetición, calculado con la **fórmula de Epley**:

> 1RM = peso × (1 + reps ÷ 30)

- Con 1 rep, el 1RM es el peso.
- Ejemplos: 60 kg × 10 → 80 kg · 62,5 × 8 → 79,2 kg · 40 × 11 → 54,7 kg.
- Es una estimación: con más de 12 a 15 reps pierde precisión.
- Código: `e1rm` en [`js/stats.js`](js/stats.js).

### Mejor serie de un entrenamiento
De todas las series de un ejercicio en un entrenamiento, la que tiene **más peso**. A igual peso, la de **más reps**.
En los ejercicios sin peso, la de más reps. Es la que se usa para comparar una vez contra otra.
- Código: `topSet` y `beats` en [`js/stats.js`](js/stats.js).

### Récord
Una serie es **récord** si supera a la mejor serie de todas las veces anteriores, con la regla de arriba:
**más peso, o el mismo peso con más reps**. En los ejercicios sin peso, más reps.

- **La primera vez que hacés un ejercicio no es récord**: no hay nada que superar.
- El cardio no tiene récords.
- Ejemplos: con el récord en 60 × 8, son récord 62,5 × 3 (más peso) y 60 × 9 (mismo peso, más reps). 57,5 × 15 **no** lo es, aunque el 1RM estimado sea más alto.
- Por qué así: es la definición más simple de explicar y de verificar mirando el gimnasio ("nunca había levantado tanto").
- Código: `beats` en [`js/stats.js`](js/stats.js), `recordBefore` e `isRecord` en [`js/coach.js`](js/coach.js).

### Subió / bajó / igual
Para decir si un ejercicio **mejoró** entre dos veces, se compara la fuerza estimada de la mejor serie de cada una, con un **margen de ±1,5%**:

| Cambio del 1RM estimado | Resultado |
|---|---|
| más de +1,5% | ▲ subió (verde) |
| entre −1,5% y +1,5% | = igual (gris) |
| menos de −1,5% | ▼ bajó (rojo) |

- En los ejercicios sin peso se comparan las reps, con el mismo margen.
- Ejemplos:
  - 42,5 × 7 → 40 × 11: **subió** (+4%). Bajaste el peso pero ganaste fuerza.
  - 60 × 10 → 62,5 × 8: **igual** (−1%). Es la progresión normal: subís el peso y perdés un par de reps.
  - 60 × 10 → 60 × 11: **subió** (+2,5%). Una rep más con el mismo peso es mejora.
  - 60 × 10 → 62,5 × 7: **bajó** (−3,6%).
- Por qué el margen: sin él, cada vez que subís el peso como corresponde el ejercicio aparecería en rojo.
- **Dónde aplica**: *Mes → Fuerza por ejercicio*, *Análisis → Reporte del plan* y el resumen al terminar ("Contra la última vez").
  **No** cambia los récords, que siguen la regla de arriba.
- Las etiquetas con el detalle ("+2,5 kg · −2 reps") muestran el cambio real de peso y reps; el **color** de la etiqueta sigue esta clasificación.
- Código: `strengthScore` y `compareStrength` en [`js/stats.js`](js/stats.js) (el `0.015` es el margen).

---

## 2. Entrenar

### Sugerencia de peso ("Hoy")
Aparece en cada ejercicio de **fuerza** (no en zona media ni en cardio) cuando ya lo hiciste alguna vez y no estás editando un entrenamiento viejo.
Sigue la **doble progresión**: primero completás las reps del objetivo con un peso, y después subís el peso.

**Qué series cuentan.** Se mira la última vez que hiciste el ejercicio:
- El **peso de trabajo** es el más alto que usaste.
- Las series más livianas **antes** de la primera con ese peso son de **aproximación** y no cuentan (45 × 10 · **50 × 9 · 50 × 9**).
- Las más livianas **después** sí cuentan: bajaste porque no llegabas (**60 × 10 · 60 × 10** · 55 × 10).

**Objetivo cumplido**: todas las series que cuentan se hicieron con el peso de trabajo y llegaron al **tope** de reps del objetivo
(en "3x8-10" el tope es 10; en "3x10", 10). Si hoy el plan pide más series que la última vez (de 3x10 a 4x8), alcanza con las que hiciste.

**Decisión**, en este orden:

| Situación de la última vez | Sugerencia | Reps sugeridas |
|---|---|---|
| Objetivo cumplido, pero alguna serie con **RIR 0** | = mantené el peso ("afirmalo antes de subir") | el tope |
| Objetivo cumplido, ejercicio **sin peso** | ▲ sumá peso extra o más reps | el tope |
| Objetivo cumplido y **RIR promedio 3 o más** | ▲ subí **dos** escalones | el mínimo del rango |
| Objetivo cumplido | ▲ subí **un** escalón | el mínimo del rango |
| **Más de la mitad** de las series quedaron **2 o más reps por debajo del mínimo** | ▼ bajá un escalón | el mínimo |
| Llegaste a las reps en todas, pero bajaste el peso en alguna | = mantené y hacelas todas con ese peso | el tope |
| Cualquier otro caso | = mantené y buscá llegar al tope | el tope |
| **Sin objetivo** escrito | = mantené | una rep más que la mejor de la última vez |

- Con un rango ("3x8-10"), al subir de peso se vuelve al mínimo (8) y se va subiendo de reps hasta el tope (10).
- Si la última vez no tenía RIR cargado, se sube un escalón (como si no supiera cuánto te sobraba).
- El botón **Usar** completa el peso sugerido en las series vacías; las reps las escribís vos. Los campos vacíos muestran lo sugerido como pista.
- Código: `suggestion` en [`js/coach.js`](js/coach.js).

### Escalones de peso
Cuánto se sube o se baja en cada paso:

| Tipo | Escalón |
|---|---|
| Barra (peso total) | 2,5 kg |
| Máquina / polea | 2,5 kg |
| Mancuerna (peso de una) | 1 kg hasta 10 kg; 2 kg desde 10 kg |
| Sin peso con lastre | 2,5 kg |

- Si en tu gimnasio las mancuernas van de a 2,5 kg o las máquinas de a 5 kg, se cambia en `weightStep` en [`js/coach.js`](js/coach.js).

### RIR (reps en reserva)
Cuántas reps más podías hacer al terminar la serie: **0** = ninguna (llegaste al límite), **4+** = te sobraban 4 o más.
- Es **opcional** y solo aparece en los ejercicios de fuerza.
- Solo se usa para la sugerencia de la próxima vez: RIR 0 frena la subida y un promedio de 3 o más la duplica (ver la tabla de arriba).
- Se guarda en cada serie como `rir` (0 a 4).

### Récord en vivo
- Debajo de "Última vez" aparece el récord a superar ("🏆 Récord: 60 × 10"): la mejor serie de **todos los otros entrenamientos**.
- Mientras escribís, la serie que lo supera se marca en verde con 🏆.
- Al terminar de escribirla (cuando salís del campo) aparece el aviso "¡Récord en …!" con una vibración, **una vez por ejercicio** en cada entrenamiento.
  El aviso espera a que termines de escribir para no festejar un número a medio escribir.
- Código: `markRecord` y el evento `change` en [`js/views/train.js`](js/views/train.js).

### Resumen al terminar
- **Duración**: se compara con la vez anterior que terminaste **la misma rutina**. Si la diferencia es menor a **2 minutos**, dice "igual que la vez anterior".
- **Series**: las de fuerza y zona media que tienen reps. El cardio se muestra aparte, en minutos.
- **Kg levantados**: peso × reps de cada serie. En las mancuernas cuentan las dos (× 2); sin peso suma 0, salvo el lastre.
- **Récords nuevos**: la mejor serie de hoy de cada ejercicio que supera al récord anterior.
- **Contra la última vez**: la mejor serie de hoy contra la de la última vez que hiciste cada ejercicio, clasificada con [subió / bajó / igual](#subió--bajó--igual).
- **Próximo**: la primera rutina del plan que todavía no hiciste esta semana, contando la que acabás de terminar. Si no falta ninguna, "¡Semana completa!".
- Código: `sessionSummary` en [`js/coach.js`](js/coach.js) y `renderSummary` en [`js/views/train.js`](js/views/train.js).

### "Te toca"
- La primera rutina del plan, en el orden del plan, que **no hiciste esta semana** (de lunes a domingo).
- "Esta semana: 2 de 3" cuenta las rutinas activas con al menos un entrenamiento esta semana.
- Código: `renderHome` en [`js/views/train.js`](js/views/train.js).

### Aviso de plan terminado
- Aparece en Entrenar durante **21 días** después del último día del plan y lleva a *Análisis*. Desaparece antes si cargás un plan nuevo.

---

## 3. Progreso → Mes

### Constancia (mapa de días)
- Un cuadrito por día, con una columna por semana (lunes arriba).
- **17 semanas** en pantallas angostas (celular) y **26** desde 480 px de ancho.
- El tono depende de las **series del día** (todas, cardio incluido):

| Series en el día | Tono |
|---|---|
| sin entrenar | gris |
| 1 a 9 | claro |
| 10 a 17 | medio |
| 18 a 24 | fuerte |
| 25 o más | lleno |

- **Semanas seguidas entrenando**: semanas (lunes a domingo) con al menos un entrenamiento, hasta la actual.
  La semana en curso sin entrenar todavía **no corta** la racha.
- Código: `HEAT_LEVELS` y `heatmap` en [`js/views/progress.js`](js/views/progress.js); `weekStreak` en [`js/stats.js`](js/stats.js).

### Fuerza por ejercicio
- Para cada ejercicio hecho **dos o más veces** en el mes, compara la mejor serie de la **primera** vez con la de la **última**, clasificada con [subió / bajó / igual](#subió--bajó--igual).
  Los que hiciste una sola vez no se comparan (la nota dice cuántos).
- **Plegado**: muestra las **3 que más subieron** y las **3 que más bajaron**, ordenadas por cambio porcentual del 1RM estimado, y un botón *Ver los N ejercicios*.
  Si plegar escondería uno solo o ninguno, se muestran todos.
- Código: `monthSummary` en [`js/stats.js`](js/stats.js); `strengthList` y `STR_TOP` en [`js/views/progress.js`](js/views/progress.js).

### Récords nuevos del mes
- Récords que superaron a uno anterior dentro del mes, del más nuevo al más viejo. Se ven **3** y el resto con *Ver los N récords* (si son 4, se ven todos).

---

## 4. Progreso → Análisis

### El plan
- **Plan** = las rutinas activas que tienen tabla de progresión semanal.
- **Empieza** el lunes de la semana del **primer entrenamiento terminado** de alguna de esas rutinas.
- **Dura** tantas semanas como la tabla más larga; **termina** el domingo de la última semana.
- **Días del plan hechos**: semanas hechas de cada rutina, sumadas. Cuenta las semanas **recuperadas**, igual que la pestaña Plan
  ("10 de 12" = 3 rutinas × 4 semanas, faltaron 2).
- **Sin entrenar**: semanas que ya pasaron sin hacer esa rutina (y sin recuperar).
- **Récords nuevos**: récords que superaron a uno anterior entre el inicio del plan y hoy (o el fin, si ya terminó).
- **Fuerza en el plan**: igual que en el Mes, pero con la primera y la última vez **dentro del plan**.
- Código: `planInfo`, `strengthChange` y `recordsBetween` en [`js/analysis.js`](js/analysis.js).

### Cumplimiento del objetivo
Qué parte de lo que pedía el plan llegaste a hacer.

- Se miran los entrenamientos **del plan**. Sin plan empezado, los de las **últimas 4 semanas**.
- Solo los ejercicios con objetivo escrito ("3x10", "4x8-12"). Sin cardio.
- **Una serie cumple** si llega al **mínimo** de reps del objetivo (en "3x8-10", 8 o más).
- **Las series que no hiciste cuentan como no cumplidas**: con objetivo 3x10 y solo 2 series hechas, como mucho cumplís 2 de 3.
- **Serie fácil**: pasó el **tope** por **2 o más** reps (en "3x10", 12 o más).

| Cumplimiento | Mensaje |
|---|---|
| 85% o más **y** 30% o más de series fáciles | El plan te queda corto: subí el peso |
| 80% o más | Vas cumpliendo el plan |
| 60% a 80% | Cumplís la mayoría: mirá los que te cuestan |
| menos de 60% | El plan te queda grande: bajá un poco el peso |

- **Te cuestan**: ejercicios con menos del **60%** de series cumplidas (los 3 peores).
- **Te quedan fáciles**: la mitad o más de sus series fueron fáciles **y** cumplen el 80% o más (los 3 más fáciles).
- Por qué 80% y no 100%: es normal que la última serie quede una rep corta por cansancio.
- Código: `targetCompliance` en [`js/analysis.js`](js/analysis.js); los umbrales, en `complianceCard` en [`js/views/progress.js`](js/views/progress.js).

### Estancados
- Un ejercicio está **estancado** si lleva **3 entrenamientos seguidos o más sin récord** (ver [Récord](#récord)).
- Solo cuenta si lo hiciste al menos **4 veces** y la última fue en los **últimos 45 días** (los que dejaste de hacer no aparecen).
- **No cuenta los de Abdominales**: la zona media se hace siempre igual a propósito.
- Sugerencia:
  - **3 o 4** sin récord → **descarga**: bajá un 10% el peso una semana y volvé a subir.
  - **5 o más** → **cambiá algo**: la variante (barra por mancuernas, por ejemplo) o el rango de reps.
- Código: `stalledExercises` en [`js/analysis.js`](js/analysis.js).

### Balance muscular
- **Series por semana** de cada grupo muscular, en promedio de las **últimas 4 semanas**.
  Si empezaste a entrenar hace menos, se promedia sobre lo que llevás (mínimo una semana).
  En el resumen con IA de un plan terminado, se usan las semanas del plan.
- Cada serie suma **1 al grupo principal** del ejercicio y **½ a cada grupo secundario**. Sin cardio.
- **Franja de referencia: 10 a 20 series por semana** por músculo, lo habitual para ganar masa muscular.
  Menos de 10 → *poco*; 10 a 20 → *bien*; más de 20 → *mucho*.
- **Empuje** = Pecho + Hombros + Tríceps. **Tirón** = Espalda + Bíceps. **Piernas** = Cuádriceps + Isquiotibiales + Glúteos + Gemelos.
  - Empuje más de **1,5 veces** el tirón → "sumá espalda o bíceps".
  - Empuje menos de **2/3** del tirón → "sumá pecho, hombros o tríceps".
  - Piernas menos del **40%** del tren superior (empuje + tirón) → aviso.
- Código: `muscleBalance` en [`js/analysis.js`](js/analysis.js); `BAL_MIN`, `BAL_MAX` y los cocientes en `balanceCard` en [`js/views/progress.js`](js/views/progress.js).

### Fuerza relativa
- **1RM estimado ÷ peso corporal**, con tu **mejor serie de los últimos 4 meses** (120 días) y tu **último peso cargado**.
- Solo ejercicios con **barra**: con mancuernas y máquinas el número no se compara con nada.
- Para cuatro básicos hay **niveles**, con referencias aproximadas. Cada número es desde dónde empieza ese nivel (× tu peso):

| Ejercicio | Principiante | Novato | Intermedio | Avanzado | Élite |
|---|---|---|---|---|---|
| Sentadilla (hombres) | 0,75 | 1,25 | 1,5 | 2,25 | 2,75 |
| Sentadilla (mujeres) | 0,5 | 0,75 | 1,25 | 1,5 | 2 |
| Press banca (hombres) | 0,5 | 0,75 | 1 | 1,5 | 2 |
| Press banca (mujeres) | 0,25 | 0,5 | 0,75 | 1 | 1,5 |
| Peso muerto (hombres) | 1 | 1,5 | 2 | 2,5 | 3 |
| Peso muerto (mujeres) | 0,5 | 1 | 1,25 | 1,75 | 2,5 |
| Press militar (hombres) | 0,35 | 0,55 | 0,8 | 1,1 | 1,4 |
| Press militar (mujeres) | 0,2 | 0,35 | 0,5 | 0,75 | 1 |

- Ejemplo: con 80 kg de peso y un 1RM de banca de 80 kg (1×) estás en **intermedio**, y te faltan 40 kg para avanzado (1,5 × 80 = 120).
- Se reconocen por el ejercicio del catálogo (*Sentadilla con barra*, *Press banca plano*, *Peso muerto*, *Press militar con barra*)
  o por un nombre propio igual, sin importar mayúsculas ni tildes ("press banca", "press de banca", "sentadilla"…).
- Las referencias de hombres o de mujeres se eligen en la tarjeta y la app lo recuerda en ese teléfono.
- Son orientativas: sirven para ubicarte, no como meta.
- Código: `LIFTS` y `relativeStrength` en [`js/analysis.js`](js/analysis.js).

### Resumen y consejos con IA
- Solo se pide cuando tocás el botón, y necesita internet. Usa Gemini por Firebase AI Logic (plan gratuito), con los modelos de `MODELS` en [`js/ai.js`](js/ai.js).
- **Qué se le manda**: solo números del plan. Fechas, semanas, días hechos, récords, cumplimiento, cada ejercicio con su primera y última serie del plan (con el 1RM estimado),
  los estancados y las series por músculo. **No** se mandan tu nombre, tu mail ni tu peso corporal.
- **Qué se le pide**: un párrafo corto sobre cómo te fue y exactamente 3 consejos para el próximo plan, en rioplatense, en 120 palabras como máximo,
  basándose solo en esos datos.
- **No se guarda**: dura mientras la app está abierta. Si cargás otro entrenamiento del plan, se descarta para no quedar desactualizado.
- No conoce lesiones, cansancio ni tus objetivos: tomalo como una segunda opinión.
- Código: `reportPrompt` y `askSummary` en [`js/views/progress.js`](js/views/progress.js).

---

## 5. Progreso → Semana, Ejercicios, Récords y Peso

### Volumen por semana (Semana)
- Barras de las **últimas 12 semanas** que terminan en la actual. Si elegiste una semana de hace más de 12, terminan en esa.
- Se sacan las semanas vacías de antes de tu primer entrenamiento, dejando al menos **4** barras.
- **Series**: series de fuerza y zona media con reps (sin cardio).
- **Kg levantados**: peso × reps de cada serie; las mancuernas cuentan las dos (× 2). Desde **10.000 kg** se muestra en toneladas.

### Gráficos de Ejercicios y Peso
- **Períodos**: 1M, 3M, 6M y 1A son meses de calendario hacia atrás desde hoy; *Todo*, todo el historial.
  Solo aparecen los que recortan algo: con 2 meses de datos no se ofrece 1A.
- **Número grande en Ejercicios**: el 1RM estimado de la última vez (las reps máximas, sin peso) y cuánto cambió desde el primer registro del período.
- **Rombo** en la línea: entrenamientos con récord.
- **Peso corporal**: la línea principal es la **media de 7 días** de cada fecha (los registros de esa fecha y los 6 días anteriores).
  Saca el ruido diario (agua, comida, sal). El cambio de peso se muestra en gris: subir o bajar no es bueno ni malo de por sí.

### Récords
- El récord de cada ejercicio es su mejor serie (ver [Récord](#récord)).
- **Nuevos en los últimos 30 días**: récords que superaron a uno anterior en los últimos 30 días.
- **Mini gráfico**: la tendencia de las **últimas 12 veces**, con el 1RM estimado (reps, si es sin peso).

---

## 6. Otros

- **Entrenamiento olvidado abierto**: si quedó en curso más de **6 horas**, se cierra solo. Si tiene series se guarda como terminado; si está vacío, se borra.
  Código: `STALE_HOURS` en [`js/views/train.js`](js/views/train.js).
- **Semanas del plan**: son de calendario (lunes a domingo). La semana 1 es la del primer entrenamiento del plan y cada lunes pasa a la siguiente,
  aunque no hayas hecho todos los días. Una semana que terminó sin hacer una rutina se puede recuperar la próxima vez.
  Detalle en [`js/progression.js`](js/progression.js) y en la v10 del [CHANGELOG](CHANGELOG.md).

---

## 7. Resumen de números

| Qué | Valor | Dónde |
|---|---|---|
| Fórmula del 1RM | peso × (1 + reps ÷ 30) | `e1rm` · stats.js |
| Margen subió / bajó | ±1,5% del 1RM estimado | `compareStrength` · stats.js |
| Escalón barra / máquina | 2,5 kg | `weightStep` · coach.js |
| Escalón mancuerna | 1 kg hasta 10 kg, después 2 kg | `weightStep` · coach.js |
| Subir dos escalones | RIR promedio 3 o más | `suggestion` · coach.js |
| No subir | alguna serie con RIR 0 | `suggestion` · coach.js |
| Bajar un escalón | más de la mitad de las series 2+ reps bajo el mínimo | `suggestion` · coach.js |
| Duración "igual" | menos de 2 min de diferencia | `durationCompare` · train.js |
| Aviso de plan terminado | 21 días | `renderHome` · train.js |
| Entrenamiento olvidado | 6 horas | `STALE_HOURS` · train.js |
| Tonos de constancia | 1 / 10 / 18 / 25 series | `HEAT_LEVELS` · progress.js |
| Semanas en constancia | 17 (celular) / 26 (desde 480 px) | `heatmap` · progress.js |
| Listas plegadas | 3 que más subieron + 3 que más bajaron; 3 récords | `STR_TOP` · progress.js |
| Volumen semanal | 12 semanas (mínimo 4 barras) | `VOL_WEEKS` · progress.js |
| Cumplimiento: serie cumplida | llega al mínimo de reps | `targetCompliance` · analysis.js |
| Cumplimiento: serie fácil | tope + 2 reps o más | `targetCompliance` · analysis.js |
| Cumplimiento: mensajes | 85% + 30% fáciles / 80% / 60% | `complianceCard` · progress.js |
| Estancado | 3+ entrenamientos sin récord (de al menos 4, el último en 45 días) | `stalledExercises` · analysis.js |
| Descarga o cambio | 3–4 → descarga 10%; 5+ → cambiar | `stalledCard` · progress.js |
| Balance: período | 4 semanas | `muscleBalance` · analysis.js |
| Balance: secundarios | ½ serie | `muscleBalance` · analysis.js |
| Balance: franja | 10 a 20 series por semana | `BAL_MIN`, `BAL_MAX` · progress.js |
| Empuje / tirón desbalanceado | más de 1,5 o menos de 0,67 | `balanceCard` · progress.js |
| Piernas bajas | menos del 40% del tren superior | `balanceCard` · progress.js |
| Fuerza relativa: período | 120 días | `relativeStrength` · analysis.js |
| Media del peso corporal | 7 días | `movingAverage` · stats.js |
| Mini gráfico de récords | últimas 12 veces | `trend` · progress.js |
| Resumen con IA | 1 párrafo + 3 consejos, máx. 120 palabras | `reportPrompt` · progress.js |
