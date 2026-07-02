<div align="center">

# ◑ Telekinesis

**Cinematic, AI-orchestrated product demo videos — your real app records itself.**

Mark up your UI once. An LLM (or you) writes a *timesheet*. Playwright performs
it — ghost cursor, smooth zoom, spotlight, typing, sound — and renders an
always-up-to-date demo video.

_Open source · MIT · TypeScript · React/Next · Playwright · MCP_

</div>

---

## Why

Hand-made product demos rot the moment the UI changes. Telekinesis treats the
demo as **code**: a declarative timesheet performed against your live app. Change
the UI, re-run one command, get a fresh video — narrated like a human did it.

The trick (from [navigator.webdriver](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver)
to cinematography):

```
            Real visitor                         Playwright (or ?demo)
                 │                                        │
        <TelekineticFrame>                       <TelekineticFrame>
                 │                                        │
        ┌────────▼────────┐                      ┌────────▼─────────┐
        │  <>{children}</> │                      │  registered,     │
        │  zero footprint  │                      │  zoomable target │  ──▶ 🎬 video
        └─────────────────┘                      └──────────────────┘
```

Same component, two lives. For users it compiles away to nothing. Under the
recorder it becomes a controllable, measurable target.

## How it works

1. **Mark up** regions with `<TelekineticFrame id="...">` and mount
   `<TelekinesisStage>` once.
2. **Author a timesheet** — an ordered list of effects (`zoom-in`, `highlight`,
   `cursor-move`, `click`, `type-down`, …), by hand or via the MCP server.
3. **Record** — Playwright performs the visuals *and* the real clicks/typing,
   producing a silent video + a timestamped audio map.
4. **Mix** — the CLI lays each sound at its exact moment with ffmpeg (no audio
   hardware needed, CI-friendly).

## Quick start

```bash
pnpm add @telekinesis/core            # in your React/Next app
pnpm add -D @telekinesis/cli          # the recorder
pnpm exec playwright install chromium # one-time
```

Mark up your UI:

```tsx
import { TelekineticFrame, TelekinesisStage } from "@telekinesis/core";

export default function Pricing() {
  return (
    <>
      <TelekinesisStage />{/* mount once near the root */}

      <TelekineticFrame id="pricing" intent="pricing-table">
        <TelekineticFrame id="pro-tier" intent="primary-plan">
          <PlanCard name="Pro" />
        </TelekineticFrame>
        <TelekineticFrame id="buy" intent="primary-action">
          <button>Buy Pro</button>
        </TelekineticFrame>
      </TelekineticFrame>
    </>
  );
}
```

Write `flow.timesheet.json`:

```json
{
  "url": "http://localhost:3000?demo",
  "resolution": { "width": 1280, "height": 720 },
  "timeline": [
    { "action": "zoom-in", "frameId": "pricing", "scale": 1.12 },
    { "action": "highlight", "frameId": "pro-tier" },
    { "action": "cursor-move", "destFrameId": "buy" },
    { "action": "click", "frameId": "buy", "soundProfile": "macbook-trackpad" },
    { "action": "zoom-out" }
  ]
}
```

Preview, record, or edit it visually:

```bash
telekinesis preview flow.timesheet.json          # headed, no file
telekinesis record  flow.timesheet.json -o demo.mp4
telekinesis record  flow.timesheet.json --format both   # MP4 + GIF
telekinesis gif     flow.timesheet.json -o demo.gif     # a looping GIF
telekinesis studio  --target http://localhost:3000      # the visual editor (:57174)
```

## See it now (no install)

```bash
git clone <this repo> && cd telekinesis
pnpm install
pnpm exec playwright install chromium   # one-time, for recording

pnpm docs          # the documentation — a Telekinetic app — at :4311
pnpm docs:motion   # record every docs section into a GIF (dogfooding)
pnpm studio        # the CapCut-style timesheet editor at :57174
pnpm playground    # the component sandbox at :5173
```

The docs and playground force demo mode, so the full cinematic layer runs live
in your browser — exactly what the recorder would capture. The **Studio**
(a rarely-used local port, 57174) embeds any Telekinetic app, shows which
components are telekinetic, and lets you tune timing and effects like a video
editor, then render a GIF or MP4.

## Effects

`click` · `type-down` · `drag-and-drop` · `shake` · `zoom-in` · `zoom-out` ·
`scroll-up` · `scroll-down` · `cursor-move` · `highlight` · `wait`

All strongly typed (Zod) with easing and sound profiles. Full reference:
[`docs/effects.md`](docs/effects.md).

## AI: the MCP server

```json
{ "mcpServers": { "telekinesis": { "command": "telekinesis-mcp" } } }
```

- `extract_ui_context({ url })` — what frames are on screen
- `generate_timesheet({ url, goal })` — a **schema-validated** draft to refine

The model never hallucinates an unplayable sheet: the
[JSON Schema](packages/schema/README.md) is the guardrail. See
[`packages/mcp`](packages/mcp/README.md).

## Packages

| Package | Role |
| --- | --- |
| [`@telekinesis/schema`](packages/schema) | Zod effects + timesheet + sound catalog + JSON Schema + `layoutTimesheet` — the shared contract |
| [`@telekinesis/core`](packages/core) | `<TelekineticFrame>`, `<TelekinesisStage>`, registry, cursor, effects engine, `window.__telekinesis`, the Studio `postMessage` bridge |
| [`@telekinesis/engine`](packages/engine) | Playwright recorder → silent video + `audio-map.json` |
| [`@telekinesis/render`](packages/render) | ffmpeg: mix timed audio into an MP4, and export high-quality GIFs (palette or gifski) |
| [`@telekinesis/cli`](packages/cli) | `record` / `gif` / `preview` / `studio` / `init` / `sounds` |
| [`@telekinesis/mcp`](packages/mcp) | MCP server: `extract_ui_context`, `generate_timesheet` |
| [`apps/docs`](apps/docs) | the Nextra documentation — itself a Telekinetic app that records its own tutorials |
| [`apps/studio`](apps/studio) | the Studio: a CapCut-style visual timesheet editor |
| [`playground`](playground) | a Vite sandbox that previews the cinematics live |

## Develop

```bash
pnpm install         # everything (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 to skip browsers)
pnpm typecheck
pnpm test            # schema unit tests
pnpm build           # build all publishable packages
pnpm playground      # live demo
```

Architecture deep-dive: [`docs/architecture.md`](docs/architecture.md).

## Roadmap

Built inside-out (UI → AI). Status of the original backlog:

- [x] **Epic 1 — Core UI**: frame registry, `<TelekineticFrame>`, ghost cursor, zoom/highlight engine
- [x] **Epic 2 — Schemas**: Zod effects + timesheet, sound profiles, JSON Schema export
- [x] **Epic 3 — MCP**: `extract_ui_context`, `generate_timesheet`, schema resources
- [x] **Epic 4 — Recorder**: Playwright runner, sequential executor, audio-map extraction
- [x] **Epic 5 — CLI + audio**: `record`/`preview`/`init`/`sounds`, ffmpeg mixer (Option B), cleanup
- [x] **Epic 6 — DX**: playground app, CI, docs
- [x] **Epic 7 — Rendering**: `@telekinesis/render` — GIF export (ffmpeg palette, auto-gifski) alongside the MP4 mixer
- [x] **Epic 8 — Docs**: a Nextra site that is itself a Telekinetic app and records its own per-section tutorials
- [x] **Epic 9 — Studio**: a CapCut-style visual timesheet editor + the `window.__telekinesis` `postMessage` bridge
- [ ] Polish: real sound pack, `drag-and-drop` self-mode fidelity, framework-agnostic (`/vanilla`) entry, visual-regression tests, timeline drag-to-reorder in the Studio

## Contributing

Issues and PRs welcome. The contract lives in `@telekinesis/schema` — extend it
there first, and every other package follows.

## License

[MIT](LICENSE) © Telekinesis contributors
