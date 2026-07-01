# Architecture

Telekinesis separates **what the UI is** from **what the camera does**. Your app
is marked up once with frames; everything cinematic lives in a timesheet that an
AI or a human authors, and a recorder performs.

```
                    ┌──────────────────────────────────────────────┐
                    │                @telekinesis/schema            │
                    │   Effects · Timesheet · Sound catalog · JSON  │
                    │     (the contract every package agrees on)    │
                    └──────────────────────────────────────────────┘
                          ▲             ▲              ▲            ▲
            ┌─────────────┘             │              │            └─────────────┐
            │                           │              │                          │
 ┌────────────────────┐   ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │  @telekinesis/core │   │ @telekinesis/engine│  │ @telekinesis/cli │  │ @telekinesis/mcp │
 │  (in the browser)  │   │   (Playwright)     │  │  (orchestrator)  │  │   (LLM bridge)   │
 │                    │   │                    │  │                  │  │                  │
 │ <TelekineticFrame> │   │ drives the page,   │  │ record → engine  │  │ extract_ui_context│
 │ <TelekinesisStage> │◄──┤ runs visuals via   │  │ then ffmpeg mix  │  │ generate_timesheet│
 │ registry · cursor  │   │ window.__telekinesis│ │ (Option B audio) │  │                  │
 │ zoom · highlight   │   │ + real click/type  │  │                  │  │                  │
 │ player · runtime   │   │ → silent video +   │  │                  │  │                  │
 │                    │   │   audio-map.json   │  │                  │  │                  │
 └────────────────────┘   └────────────────────┘  └──────────────────┘  └──────────────────┘
```

## 1. Detection: one component, two lives

`<TelekineticFrame>` checks `isDemoMode()`:

- **User mode** (real visitors) → renders `<>{children}</>`. No wrapper, no
  listeners, no registration. Literally zero footprint.
- **Demo mode** (`navigator.webdriver === true`, or `?demo`/`?telekinesis`, or a
  forced flag) → renders a measurable wrapper with `data-telekinesis-id` and
  registers itself in a global [Zustand](https://github.com/pmndrs/zustand)
  store.

Detection returns `false` during SSR so server and first client render match
(no hydration mismatch); the component upgrades to demo mode in a layout effect.

## 2. The registry

Every mounted frame lives in a vanilla Zustand store keyed by `id`, holding the
real `HTMLElement`. The engine resolves `frameId → element → getBoundingClientRect()`
on demand, so zoom/highlight/cursor targeting is always correct **after** layout
and even after a zoom transform (rects reflect transforms).

## 3. Two ways to drive the same effects

The effect implementations in `core` take a `mode`:

| Mode | Visuals | Real interaction | Used by |
| --- | --- | --- | --- |
| `self` | yes | yes (dispatches clicks, types into inputs) | live in-browser preview |
| `external` | yes | **no** — Playwright performs it | recording |

This is why the playground can show the whole demo with one `play()` call, while
the recorder gets pixel-accurate visuals *and* a genuinely reacting app.

## 4. The overlay layer

The cursor, ripples and spotlight are mounted as a child of `<html>` (a sibling
of `<body>`). The zoom effect transforms `<body>`; anything inside body would be
zoomed with it (and `position: fixed` breaks under a transformed ancestor).
Living outside body keeps the cursor and spotlight rock-steady in viewport space.

## 5. Recording (Epic 4)

`@telekinesis/engine`:

1. launches Chromium with `recordVideo` at the timesheet resolution,
2. navigates and waits for `window.__telekinesis.ready`,
3. walks the timeline — visuals through `runEffect` (awaited so the animation is
   captured), real I/O through Playwright locators,
4. records `{ profile, asset, t }` for every sound-bearing action,
5. closes the context (flushing a **silent** `.webm`) and writes `audio-map.json`.

## 6. Audio — Option B (Epic 5)

Headless CI Linux has no sound card, so we never play audio during recording.
Instead the CLI takes the silent video + audio map and mixes each cue at its
exact millisecond offset with ffmpeg:

```
[1:a]adelay=2400:all=1[a1];
[2:a]adelay=3120:all=1[a2];
... amix=inputs=N:normalize=0[aout]
→ -map 0:v -map [aout] -c:v libx264 -c:a aac -shortest demo.mp4
```

No virtual audio servers, fully deterministic, reproducible in any pipeline.

## 7. The AI bridge (Epic 3)

`@telekinesis/mcp` exposes `extract_ui_context` (what frames exist) and
`generate_timesheet` (a schema-validated draft), plus the JSON Schema as a
resource. The model reasons over real frames; the schema guarantees it can't
hallucinate an unplayable sheet.
