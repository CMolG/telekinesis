# @telekinesis/core

The browser runtime for [Telekinesis](../../README.md).

It does two jobs:

1. **Mark up your UI** with `<TelekineticFrame>` — zero-cost for real users,
   a measurable, registered target for the camera in demo mode.
2. **Perform the timesheet** — a ghost cursor, smooth zoom, spotlight,
   ripples and typing, exposed to the Playwright recorder via
   `window.__telekinesis`.

## Quick start (React / Next.js)

```tsx
import { TelekineticFrame, TelekinesisStage } from "@telekinesis/core";

export default function Pricing() {
  return (
    <>
      {/* mount once near the root */}
      <TelekinesisStage autoplay />

      <TelekineticFrame id="pro-tier" intent="primary-plan">
        <PlanCard name="Pro" />
      </TelekineticFrame>

      <TelekineticFrame id="buy" intent="primary-action">
        <button>Buy now</button>
      </TelekineticFrame>
    </>
  );
}
```

For real visitors `<TelekineticFrame>` renders `<>{children}</>` — no wrapper,
no listeners. Under Playwright (or with `?demo`) it renders a registered,
zoomable container.

## Two ways to drive it

| Mode | Who acts | Used by |
| --- | --- | --- |
| `self` | the engine also dispatches real clicks/typing | live in-browser preview |
| `external` | visuals only; **Playwright** does the real I/O | recording |

```ts
import { play } from "@telekinesis/core";
const marks = await play(timesheet, { mode: "self" }); // returns sound marks
```

## `window.__telekinesis`

Installed by `<TelekinesisStage>` in demo mode:

- `play(timesheet, opts)` — perform a whole sheet
- `runEffect(effect)` — one effect's visuals (recorder drives I/O)
- `listFrames()` / `getRect(id)` — registered frames + viewport rects
- `ready`, `version`

See [`docs/architecture.md`](../../docs/architecture.md).
