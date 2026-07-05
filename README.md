<div align="center">

<img src="public/telekinesis_header.png" alt="Telekinesis — your product films its own demo" width="100%" />

**Your product films its own demo.**

Mark up your real UI once. An LLM (or you) writes a *timesheet*. Telekinesis
performs it live in the browser — ghost cursor, smooth zoom, spotlight,
real clicks and typing, sound — and hands you a video that's never out of date.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)
![Playwright](https://img.shields.io/badge/powered%20by-Playwright-45ba4b.svg)

</div>

---

## The problem

Product demos are hand-made, and hand-made things rot. Someone records a
walkthrough, ships it to the landing page or the docs, and six weeks later the
button has moved, the copy changed, and the video is quietly lying to
everyone who watches it.

Telekinesis treats the demo as **code**, not a recording you maintain by
hand. Describe the tour as data, run one command, and get a fresh,
pixel-accurate video straight from your live app — no screen-recording
software, no editing timeline, no re-shoots.

The trick (borrowed from [navigator.webdriver](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/webdriver)
and pointed at cinematography instead of bot detection):

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

Same component, two lives. Ship it and it compiles away to nothing for real
users. Point the recorder at it and it becomes a controllable, measurable
stage.

## What you get

- **Real interactions, not screen capture.** Playwright drives your actual
  app — real clicks, real typing, real drag-and-drop — so the video can never
  drift from what the product actually does.
- **Cinematic motion for free.** Smooth zoom, spotlight, a ghost cursor,
  shake, highlight — a small vocabulary of effects that read as intentional,
  human-directed camera work.
- **Sound that matches the action.** ffmpeg mixes clicks and keystrokes at
  their exact timestamps. No microphone, no audio hardware, works in CI.
- **AI-authored, schema-guarded.** Hand an LLM your UI's frame map through
  the MCP server and it drafts a timesheet — validated against a JSON Schema,
  so it can't hand you something unplayable.
- **A visual editor when you want one.** The Studio is a CapCut-style
  timeline for tuning a timesheet by eye instead of by hand.

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
git clone https://github.com/CMolG/telekinesis.git && cd telekinesis
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

<div align="center">
<img src="public/telekinesis_divider.png" alt="" width="60%" />
</div>

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

## Contributing

Telekinesis is built in the open and built for the community using it — issues,
ideas, and PRs are genuinely welcome, not just tolerated. The contract lives in
`@telekinesis/schema`: extend it there first, and every other package follows.

Good first stops:

- Found a bug or a rough edge? [Open an issue](https://github.com/CMolG/telekinesis/issues).
- Building something with it? Show us — a demo video from your own app is the
  best kind of bug report.
- Want to add an effect, a sound profile, or a framework target? Start a
  discussion before the PR so the schema stays coherent.

If Telekinesis saves you from recording another demo by hand, a star helps
other people find it.

## License

[MIT](LICENSE) © Telekinesis contributors
