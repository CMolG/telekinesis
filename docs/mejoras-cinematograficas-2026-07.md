# Plan de mejoras cinematográficas — Telekinesis (Julio 2026)

**Fecha:** 2026-07-02 · **Alcance:** animaciones y fluidez, editor de vídeo web (Studio), efectos de sonido · **Método:** auditoría anclada al código; cada mejora nombra el fichero que la implementa.

> **Diagnóstico en una frase:** la arquitectura (schema-first Zod, core/engine/render/cli separados, `mode: self|external`, el truco de `<TelekineticFrame>` que compila a nada) es excelente y no se toca. Todo lo que se siente "amateur" vive en tres sitios concretos y acotados: los sonidos son **ondas sinusoidales puras** de ffmpeg, el motor de animación tiene **5 curvas de easing y un zoom que escala `<body>`**, y el Studio tiene una **timeline de solo lectura**. Son exactamente los tres frentes que el plan ataca.

---

## 1. Sonido — hoy suena a electrodoméstico, y se sabe por qué

### Causa raíz (verificada en código)

`packages/render/src/sounds.ts` genera los 5 assets con recetas `ffmpeg lavfi` de **osciladores puros**:

| Perfil | Receta actual | Por qué suena mal |
|---|---|---|
| `mouse-click` | `sine=frequency=1100:duration=0.05` | Un beep senoidal de 1100 Hz. No hay transitorio percusivo ni cuerpo — es un pitido |
| `macbook-trackpad` | `sine=frequency=320:duration=0.06` | Otro beep, más grave. Un trackpad real es un *thock* de banda ancha con resonancia |
| `mechanical-keyboard` | `anoisesrc=color=pink` | Ruido rosa plano; sin el "click-clack" de dos fases (down-stroke + bottom-out) |
| `pop` | `sine=frequency=600:duration=0.09` | Beep |
| `whoosh` | `anoisesrc=color=brown` + bandpass | Lo menos malo, pero sin movimiento de pitch/paneo |

El propio comentario lo admite: *"Placeholder, replaceable"*. Ninguno tiene **envolvente ADSR**, contenido armónico ni capas.

### Solución: síntesis procedural de calidad (no samples)

Se elige síntesis procedural sobre samples grabados por tres razones alineadas con la filosofía del proyecto: (a) **CI-friendly, sin hardware de audio** — principio explícito del README; (b) **cero problemas de licencia** de assets de terceros; (c) **determinista y versionable** — el WAV se regenera desde código.

El camino técnico es escribir **PCM WAV muestra a muestra en Node** (no `ffmpeg lavfi`), lo que da control total sobre la envolvente por muestra. Cada sonido se compone de capas:

- **Transitorio** (el "tick"): ráfaga de ruido filtrado (band-pass) de 2-8 ms con decaimiento exponencial casi instantáneo — es el 80 % de la sensación de "click físico".
- **Cuerpo resonante**: 1-3 osciladores (senoidal/triangular) en frecuencias inarmónicas con envolvente exponencial rápida y un ligero *pitch drop* (los golpes físicos bajan de tono al decaer).
- **Saturación suave** (`tanh`) para calidez, y un *fade-out* anti-click al final del buffer.
- Micro-aleatoriedad determinista por-hit opcional (semilla) para que el tecleo no suene idéntico carácter a carácter ("machine-gun effect").

Objetivo por perfil: `macbook-trackpad` = transitorio corto + cuerpo 150-200 Hz con decay 40 ms; `mechanical-keyboard` = dos fases (press ~2 kHz tick + bottom-out ~180 Hz thock); `mouse-click` = transitorio brillante + cuerpo 400 Hz corto; `pop` = seno con pitch-up rápido + click; `whoosh` = ruido filtrado con barrido de band-pass y envolvente de campana.

**Entregables:** nuevo `packages/render/src/synth/` (generador PCM WAV + un modelo por perfil), reescritura de `synthSounds()` para usarlo (adiós recetas `sine`), y un **banco Web Audio equivalente** en `packages/core/src/sound.ts` para que la *preview* en navegador suene igual que el render (hoy la preview reproduce el mismo WAV plano). El catálogo `packages/schema/src/sound.ts` gana metadatos de mezcla (ganancia por perfil, si admite variación). Regenerar los 5 `.wav` en `packages/cli/assets/sounds/`.

---

## 2. Animación y fluidez — de "correcto" a "cinematográfico"

### Hallazgos (verificados en `packages/core/`)

1. **Solo 5 easings** (`easing.ts`): linear, ease-in/out/in-out y un "spring" que es un cubic-bezier de rebote, **no un muelle físico**. Falta el vocabulario que da sensación premium: expo, quint, circ, y un spring real parametrizable (tensión/fricción/masa).
2. **El zoom escala `document.body`** (`overlay.ts`): frágil con `position: fixed`, puede emborronar texto durante la interpolación, y `transform-origin` en coordenadas de página se descuadra con scroll. Un movimiento de cámara serio necesita una **capa de cámara** dedicada que combine `scale + translate` en una sola matriz animada por rAF (habilita paneo suave y efecto "Ken Burns", no solo zoom estático).
3. **El cursor** (`cursor.ts`) viaja por un Bézier cuadrático de un punto de control — humano pero básico. Le falta: **perfil de velocidad asimétrico** (acelera rápido, desacelera al aproximarse — ley de Fitts), **micro-overshoot + settle** al llegar, y un **trail/motion-blur** sutil. El `pressPulse` colapsa a `scale(0.76)` de golpe, sin *squash & stretch*.
4. **Sin continuidad entre efectos**: cada efecto arranca y para en `v=0`. Un montaje cinematográfico encadena movimientos con continuidad de velocidad y *holds* con micro-movimiento, no cortes secos.
5. **El highlight** (`overlay.ts`) aparece con un fade de opacidad pero **no anima el tamaño/posición** del foco desde el estado previo (si ya había un spotlight, debería deslizarse al nuevo target, no parpadear). Sin *breathing*/pulse en el foco activo.

### Mejoras

- **`packages/core/src/easing.ts` + `packages/schema/src/easing.ts`**: ampliar el enum de easing (añadir `ease-in-out-expo`, `ease-out-quint`, `ease-out-circ`, `ease-out-back`) **de forma aditiva** (no renombrar los existentes — otros paquetes y el Studio los referencian por string). Reemplazar el `spring` bezier por un **integrador de muelle real** en `timing.ts` (semi-implícito, parametrizable por `stiffness/damping/mass`), con un `settleThreshold` que corta cuando la energía es despreciable.
- **`packages/core/src/cursor.ts`**: perfil de velocidad tipo Fitts (curva de aproximación con desaceleración larga), micro-overshoot configurable con settle elástico, y un trail opcional (varios "fantasmas" con opacidad decreciente o un `filter: blur` direccional durante tramos rápidos). `pressPulse` con *squash & stretch* (anticipación + rebote) en vez del colapso lineal.
- **`packages/core/src/overlay.ts`**: introducir una **capa de cámara** (`camera.ts` nuevo) que envuelva el contenido y anime `matrix(scale, tx, ty)` por rAF, soportando zoom + paneo combinados y un ligero *drift* de reposo (Ken Burns) para que los *holds* respiren. `highlight` que **interpola rect** del foco anterior al nuevo (movimiento del spotlight) y un pulso de respiración en el borde. `ripple` con doble anillo desfasado.
- **Regla dura para T2:** solo **añadir** valores a los enums; nunca renombrar ni quitar los actuales (T3-Studio y las timesheets de `examples/` los usan por nombre). Mantener `mode: self|external` intacto.

---

## 3. Editor de vídeo web (Studio) — de visor a editor real

### Hallazgos (verificados en `apps/studio/`)

- La timeline (`Timeline.tsx`) usa `@xzdarcy/react-timeline-editor` con `movable:false, flexible:false`: es **solo lectura**. Toda edición ocurre en el Inspector. El propio roadmap lista *"timeline drag-to-reorder"* como pendiente.
- **Sin playhead ni scrubbing**: `play` es todo-o-nada (`App.tsx`); no se puede arrastrar un cabezal y ver el frame exacto.
- **Sin representación del sonido** en la timeline (los cues de audio son invisibles).
- **Sin undo/redo**, sin snapping, sin ajuste de duración arrastrando bordes, sin copiar/pegar clips.
- El X-ray refresca por **polling cada 700 ms** en vez de escuchar el bridge de eventos que ya existe.

### Mejoras (por impacto)

1. **Drag-to-reorder** en la timeline: arrastrar un clip reordena el `timeline[]` (la fuente de verdad sigue siendo el array secuencial; se reproyecta con `layoutTimesheet`). Es la pieza nº1 pendiente del roadmap.
2. **Playhead + scrubbing**: un cabezal arrastrable que hace *seek* determinista — reproducir la timesheet hasta `t` en el iframe vía el bridge (`runEffect` acumulado o un nuevo `seek(t)` en `studio-bridge.ts`), para revisar sin renderizar.
3. **Cues de sonido en la timeline**: una lane de audio que muestre cada `soundProfile` en su offset (reusar `layoutTimesheet`), con opción de mutear/cambiar perfil inline. Prepara el terreno para waveforms.
4. **Undo/redo** (Cmd+Z / Cmd+Shift+Z): historial de estados del `sheet` (el patrón inmutable actual de `setSheet` lo hace barato).
5. **Ajuste de duración por arrastre** de los bordes del clip (habilitar `flexible` para lanes temporales) y **snapping** a los bordes de clips vecinos.
6. **X-ray por eventos**: sustituir el `setInterval(700)` por la señal `frames-changed` del bridge (ya emitida) + un rAF para el seguimiento de scroll.

**Regla para T3:** el array `timeline[]` sigue siendo la única fuente de verdad; la vista se re-deriva. No romper el contrato del Inspector ni el `postMessage` bridge (`packages/core/src/studio-bridge.ts`) del que también depende el playground.

---

## 4. Orquestación

Tres workstreams con dominios de fichero casi disjuntos → paralelizables:

| Workstream | Ficheros propios | Toca `schema/` | Toca `core/` |
|---|---|---|---|
| **T1 Sonido** | `render/src/synth/*`, `render/src/sounds.ts`, `core/src/sound.ts`, `cli/assets/sounds/*` | `schema/src/sound.ts` | `core/src/sound.ts` |
| **T2 Animación** | `core/src/{easing,cursor,overlay,timing}.ts`, `core/src/camera.ts` (nuevo) | `schema/src/easing.ts` | `core/src/{easing,cursor,overlay,timing,camera}` |
| **T3 Studio** | `apps/studio/src/*`, `core/src/studio-bridge.ts` | — | `core/src/studio-bridge.ts` |

Sin colisiones de fichero: T1 y T2 tocan `schema/` en ficheros distintos (`sound.ts` vs `easing.ts`) y `core/` en ficheros distintos (`sound.ts` vs el resto). T3 y T2 comparten `core/` solo si T3 toca `studio-bridge.ts` (para `seek`) — T2 no lo toca. **Contrato de coordinación:** los enums de easing solo crecen (T2), así que las cadenas que T3 lee siguen siendo válidas.

**Quality gate por workstream (orquestador):** `pnpm typecheck` + `pnpm test` + `pnpm build` + revisión de diff + validación sensorial (T1: reproducir los WAV generados; T2/T3: `pnpm playground`/`pnpm studio` y observar). Cada subagente Sonnet lleva un Role/Mod del market de Heliox como en las olas anteriores.

**Definición de hecho global:** typecheck y tests verdes, build limpio, y — la prueba real — una grabación de heliox-ide con el sistema mejorado que produzca un GIF/MP4 con sonido creíble y movimiento fluido, apta para el README y la landing (helioxide.com).
