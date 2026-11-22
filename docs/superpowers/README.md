# Backlog Telekinesis — planes superpowers

Backlog de evolución del producto a 2026-07-06, tras la ola cinematográfica de julio
(`docs/mejoras-cinematograficas-2026-07.md`, ya implementada: cámara matrix+springs,
cursor Fitts/overshoot/trail, spotlight deslizante, síntesis de sonido dual, Studio con
reorder/scrub/undo). Cada plan es autónomo, ejecutable task-a-task con
`superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans`,
y produce software funcional por sí solo.

## Los cinco planes

| # | Plan | Qué entrega | Tamaño | Depende de |
|---|------|-------------|--------|------------|
| 1 | [Librería de animaciones/transiciones + docs](plans/2026-07-06-01-animation-transition-library.md) | 11 → 22 efectos (`pan`, `callout`, `caption`, `letterbox`, `confetti`, `hover`, `press-key`…), 3 easings, perfil de sonido `chime`, lane `annotation`, docs con test de cobertura | **L** (15 tasks) | — |
| 2 | [Secuencias ready-to-use](plans/2026-07-06-02-ready-to-use-sequences.md) | 10 secuencias parametrizadas (`login`, `form-fill`, `feature-tour`…), timesheets autorados (`{"use": …, "with": …}`), `expandTimesheet`, comando CLI, tool MCP, inserción desde Studio | **M** (9 tasks) | — (enriquecida por 1) |
| 3 | [Studio pro estilo CapCut + librería de componentes](plans/2026-07-06-03-studio-pro-editor.md) | Timeline propia (drag-reorder, trim 2 bordes, multi-select, clipboard, zoom), play-desde-playhead, panel de componentes autodescubiertos (clasificación + miniaturas + sugerencias), recetas persistentes, proyectos/autosave, export con presets | **L** (10 tasks) | — (enriquecida por 2) |
| 4 | [Componentes Login/Safe con datos mock](plans/2026-07-06-04-safe-login-mock-components.md) | `<TelekineticSafe>` (mock/redact/blur), `<TelekineticLogin>` (sesión demo), mocks deterministas por semilla, `Timesheet.auth` (storageState/cookies/localStorage), fixture vault, guía de flujos restringidos | **M** (8 tasks) | — |
| 5 | [Suite QA + galería GIF autograbada + README ampliado](plans/2026-07-06-05-qa-suite-gif-gallery-readme.md) | Workspace `e2e/` (@playwright/test): runtime real, huella-cero, invariantes de los 11 efectos, pipeline record→mix→gif; 12 GIFs grabados por Telekinesis sobre Telekinesis; README con GIF + timesheet por efecto; job CI bloqueante | **L** (10 tasks) | — (su test de cobertura *obliga* a extender la galería cuando 1 y 2 aterricen) |

## Orden recomendado

```
5 (QA primero: red de seguridad para todo lo demás)
└─► 1 (vocabulario de efectos)
    └─► 2 (secuencias, que ya pueden usar los efectos nuevos)
        └─► 3 (Studio pro: su panel de componentes sugiere secuencias)
4 (independiente — puede ir en paralelo a cualquiera)
```

El orden 1→2→3→4→5 (el del enunciado original) también funciona: ningún plan tiene
dependencia dura de otro; las sinergias están marcadas como pasos opcionales dentro de
cada plan ("si el Plan X aterrizó…"). Lo único no negociable es que **el plan 5 se
ejecute antes de publicitar el proyecto**, porque convierte el README en escaparate y
la CI en contrato.

## Invariantes compartidos (léelos antes de ejecutar cualquier plan)

1. **El contrato vive en `@telekinesis/schema` y solo crece.** Nunca renombrar/eliminar
   valores de `EFFECT_ACTIONS`, `EasingPattern`, `SoundProfile`, lanes ni campos.
   Los timesheets de `examples/` deben seguir parseando tras cada task.
2. **`timeline[]` secuencial es la única fuente de verdad.** Studio, layout y seek
   proyectan; jamás almacenan tiempos absolutos propios.
3. **Una pieza, dos vidas:** en modo usuario todo compila a passthrough con cero huella
   (hay un spec e2e que lo garantiza desde el plan 5). En modo demo, todo registra.
4. **`mode: "self" | "external"` intacto:** los visuales corren siempre en la página;
   el I/O real lo hace el usuario (self) o Playwright (external).
5. **Los overlays viven fuera de `<body>`** (`#telekinesis-layer`), porque la cámara
   transforma `<body>`. Frames animados = transform/opacity only.
6. **Los GIFs del repo los graba Telekinesis** vía script con presupuesto duro; nunca a
   mano.
7. Puerta de cada task: `pnpm typecheck && pnpm test` (+ `pnpm e2e` cuando exista)
   verdes + commit atómico.

## Estado

- [ ] Plan 1 — librería de animaciones/transiciones
- [ ] Plan 2 — secuencias ready-to-use
- [ ] Plan 3 — Studio pro + librería de componentes
- [ ] Plan 4 — Login/Safe + datos mock
- [x] Plan 5 — QA + galería + README *(2026-07-13; ver notas)*

### Notas de ejecución — Plan 5

- El hero de la galería es un **timesheet propio** (`examples/gallery/hero.timesheet.json`,
  tour condensado de la landing, ~11s): `landing-demo.timesheet.json` (28s, 20 pasos) medía
  2.1MB — 2.4× el presupuesto — incluso degradado a fps10/width480. El plan asumía que cabría.
- Ajustes de encoding medidos (documentados en `e2e/scripts/record-gallery.ts`): width por
  defecto 480 (560 reventaba presupuesto en los zooms), overrides por clip
  (`hero` fps10; `zoom-in`/`zoom-out` fps10+width440 tras medir varianza run-a-run de ±25-30%).
- **Cross-OS**: los GIFs grabados en CI (ubuntu) no igualan los bytes committeados (macOS)
  — clips estáticos inflan 3-5× por ruido de render, clips de movimiento clavan el tamaño.
  El presupuesto duro es el contrato (todo pasó en CI); el ±10% de la Task 9.3 no es alcanzable
  entre SOs.
- Mejoras de engine que el plan no preveía y la calidad de los GIFs exigió: carry sincronizado
  del drag externo (visual + drag real con pasos, curva compartida vía `curveForEasing` en
  schema), `mistakes` honrado en grabación externa (typo real + backspace), hook
  `afterTimeline` en `RecordOptions`.
- Deuda registrada: `easing: "spring"` en drag-and-drop no espeja la rama `flySpring` del
  cursor en el recorder (durmiente, documentado en `packages/schema/src/easing.ts`) — para el
  Plan 1, que toca easings.

Al completar un plan: marcar aquí, y si cambió algún invariante de esta página,
actualizarla en el mismo PR.
