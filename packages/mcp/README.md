# @telekinesis/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that turns
Telekinesis into an AI-drivable tool. Point an MCP client (Claude Code, Claude
Desktop, etc.) at it and an LLM can read your UI and draft a timesheet.

## Tools

| Tool | What it does |
| --- | --- |
| `extract_ui_context({ url })` | Opens the page, waits for the runtime, returns every registered frame with its rect. |
| `generate_timesheet({ url? , frames?, goal? })` | Returns a **schema-validated** draft timesheet to refine. |

## Resources

- `telekinesis://schema/timesheet` — the full JSON Schema (so the model emits valid sheets)
- `telekinesis://effects` — the effect + sound-profile catalog

## Run

```bash
# dev
pnpm --filter @telekinesis/mcp dev
# built
telekinesis-mcp
```

Example client config:

```json
{
  "mcpServers": {
    "telekinesis": { "command": "telekinesis-mcp" }
  }
}
```

The model's loop: `extract_ui_context` → reason about the flow →
`generate_timesheet` (or hand-author against the schema resource) → you edit the
timeline → `telekinesis record`.

Requires Playwright browsers (`pnpm exec playwright install chromium`).
