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

Preview, then record:

```bash
telekinesis preview flow.timesheet.json     # headed, no file
telekinesis record  flow.timesheet.json -o demo.mp4
```

## See it now (no install)

```bash
git clone <this repo> && cd telekinesis
pnpm install
pnpm playground        # open http://localhost:5173 and press “▶ Play demo”
```

The playground forces demo mode, so the full cinematic layer runs live in your
browser — exactly what the recorder would capture.

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
| [`@telekinesis/schema`](packages/schema) | Zod effects + timesheet + sound catalog + JSON Schema — the shared contract |
| [`@telekinesis/core`](packages/core) | `<TelekineticFrame>`, `<TelekinesisStage>`, registry, cursor, effects engine, `window.__telekinesis` |
| [`@telekinesis/engine`](packages/engine) | Playwright recorder → silent video + `audio-map.json` |
| [`@telekinesis/cli`](packages/cli) | `record` / `preview` / `init` / `sounds` + the ffmpeg mixer |
| [`@telekinesis/mcp`](packages/mcp) | MCP server: `extract_ui_context`, `generate_timesheet` |
| [`playground`](playground) | a Vite demo app that previews the cinematics live |

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
- [ ] Polish: real sound pack, `drag-and-drop` self-mode fidelity, framework-agnostic (`/vanilla`) entry, visual-regression tests, hosted docs site

## Contributing

Issues and PRs welcome. The contract lives in `@telekinesis/schema` — extend it
there first, and every other package follows.

## License

[MIT](LICENSE) © Telekinesis contributors
