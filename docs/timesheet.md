# The timesheet

A timesheet is the "score" the recorder performs: recording settings plus an
ordered `timeline` of [effects](./effects.md).

```jsonc
{
  "version": "1.0",
  "meta": {                       // optional
    "title": "Pricing tour",
    "description": "Pick the Pro plan and sign up",
    "author": "you",
    "generatedBy": "telekinesis-mcp"
  },
  "url": "http://localhost:3000?demo",   // optional; CLI --url overrides
  "resolution": { "width": 1920, "height": 1080 },  // default 1080p
  "fps": 30,
  "timeline": [
    { "action": "zoom-in", "frameId": "pricing", "scale": 1.12 },
    { "action": "highlight", "frameId": "pro-tier" },
    { "action": "cursor-move", "destFrameId": "buy" },
    { "action": "click", "frameId": "buy", "soundProfile": "macbook-trackpad" }
  ]
}
```

## Rules

- `timeline` must have at least one effect.
- `frameId` / `destFrameId` must match a `<TelekineticFrame id=...>` that is
  mounted when the effect runs.
- `drag-and-drop` and `cursor-move` require a destination: `destFrameId`
  (preferred) **or** both `destX` and `destY`. This is enforced by the schema.
- Unknown `action`s and unknown fields are rejected.

## Validate

```ts
import { parseTimesheet, safeParseTimesheet } from "@telekinesis/schema";

parseTimesheet(json);               // throws ZodError on problems
const r = safeParseTimesheet(json); // { success, data | error }
```

The CLI validates before recording and prints friendly, path-pointed errors.

## Authoring options

1. **By hand** — copy [`examples/pricing-demo.timesheet.json`](../examples/pricing-demo.timesheet.json).
2. **Scaffold** — `telekinesis init` writes a starter you edit.
3. **AI** — the [MCP server](../packages/mcp/README.md)'s `generate_timesheet`
   returns a validated draft from your live frames; refine the timing and text.

## JSON Schema

`@telekinesis/schema` exports `timesheetJsonSchema` (refs inlined) for editors
and LLMs. The MCP server serves it at `telekinesis://schema/timesheet`.
