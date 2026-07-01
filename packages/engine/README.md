# @telekinesis/engine

The recording engine. Given a timesheet and a URL, it drives the page with
Playwright and returns a **silent** video plus a timestamped audio map.

```ts
import { record } from "@telekinesis/engine";

const result = await record(timesheet, {
  url: "http://localhost:3000?demo",
  outDir: "./.telekinesis-tmp",
  headless: true,
});

result.videoPath;     // path to the silent .webm
result.audioMapPath;  // audio-map.json — { marks: [{ profile, asset, t }] }
result.durationMs;
```

## How it splits the work

- **Visuals** (`cursor-move`, `zoom-in/out`, `highlight`, `shake`, `scroll`,
  the ripple on a click) are performed by the in-page runtime via
  `window.__telekinesis.runEffect(...)` and recorded as they animate.
- **Real interactions** (`click`, `type-down`, `drag-and-drop`) are performed by
  Playwright against `[data-telekinesis-id="…"]`, so your app actually responds.
- **Sound** is never played here. Each sound-bearing action records
  `{ profile, asset, t }`; the CLI mixes the audio with ffmpeg (Option B).

Requires the page to mount `<TelekinesisStage>` (which installs the runtime).
`navigator.webdriver` is `true` under Playwright, so demo mode turns on
automatically.

> Needs browsers: `pnpm exec playwright install chromium`.
