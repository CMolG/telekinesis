import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { extractFrames, type ExtractedFrame } from "@telekinesis/engine";
import {
  EFFECT_ACTIONS,
  SOUND_PROFILES,
  safeParseTimesheet,
  timesheetJsonSchema,
} from "@telekinesis/schema";
import { z } from "zod";
import { generateDraft } from "./draft";

const server = new McpServer({ name: "telekinesis", version: "0.1.0" });

const rectShape = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});

const frameShape = z.object({
  id: z.string(),
  intent: z.string().optional(),
  allowZoom: z.boolean().default(true),
  rect: rectShape,
});

server.tool(
  "extract_ui_context",
  "List every registered <TelekineticFrame> on a running page (id, intent, viewport rect). The page must mount <TelekinesisStage>; append ?demo to force demo mode.",
  {
    url: z
      .string()
      .url()
      .describe("URL of the running app, e.g. http://localhost:3000?demo"),
    timeoutMs: z.number().int().positive().optional(),
  },
  async ({ url, timeoutMs }) => {
    const frames = await extractFrames(url, { timeout: timeoutMs });
    return {
      content: [
        { type: "text", text: JSON.stringify({ count: frames.length, frames }, null, 2) },
      ],
    };
  },
);

server.tool(
  "generate_timesheet",
  "Draft a schema-valid timesheet. Provide a live `url` (frames are auto-extracted) or pass `frames` directly. Returns a validated draft to refine — consult the telekinesis://schema/timesheet resource for the full grammar.",
  {
    goal: z
      .string()
      .optional()
      .describe("What the demo should show, e.g. 'sign up and pick the Pro plan'"),
    url: z.string().url().optional(),
    frames: z.array(frameShape).optional(),
  },
  async ({ goal, url, frames }) => {
    let list: ExtractedFrame[] | undefined = frames;
    if (!list) {
      if (!url) throw new Error("Provide either `url` or `frames`.");
      list = await extractFrames(url);
    }

    const draft = generateDraft(list, goal);
    const parsed = safeParseTimesheet(draft);
    const payload = parsed.success
      ? { valid: true, timesheet: parsed.data }
      : { valid: false, timesheet: draft, issues: parsed.error.issues };

    return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
  },
);

server.resource(
  "timesheet-schema",
  "telekinesis://schema/timesheet",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(timesheetJsonSchema, null, 2),
      },
    ],
  }),
);

server.resource("effect-catalog", "telekinesis://effects", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(
        { actions: EFFECT_ACTIONS, sounds: Object.keys(SOUND_PROFILES) },
        null,
        2,
      ),
    },
  ],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
