import type { ExtractedFrame } from "@telekinesis/engine";
import type { TimesheetInput } from "@telekinesis/schema";

const FIELD = /(email|password|search|name|input|field|textbox)/i;
const ACTION = /(button|cta|submit|login|signup|sign-up|buy|action|checkout|continue|next|save)/i;
const CONTAINER = /(table|pricing|container|grid|list|panel|board|section|form)/i;

function matches(f: ExtractedFrame, re: RegExp): boolean {
  return re.test(f.id) || (f.intent ? re.test(f.intent) : false);
}

function area(f: ExtractedFrame): number {
  return f.rect.width * f.rect.height;
}

function sampleText(f: ExtractedFrame): string {
  const hay = `${f.id} ${f.intent ?? ""}`;
  if (/email/i.test(hay)) return "ada@telekinesis.dev";
  if (/password/i.test(hay)) return "l0vel@ce";
  if (/search/i.test(hay)) return "telekinesis";
  return "Hello, Telekinesis";
}

/**
 * Build a schema-valid *draft* timesheet from a set of frames. Deterministic and
 * heuristic — establish a scene by zooming a container, then walk fields and
 * actions top-to-bottom. The calling LLM is expected to refine pacing and copy.
 */
export function generateDraft(
  frames: ExtractedFrame[],
  goal?: string,
): TimesheetInput {
  const timeline: unknown[] = [{ action: "wait", duration: 500 }];

  const container =
    [...frames]
      .filter((f) => f.allowZoom && matches(f, CONTAINER))
      .sort((a, b) => area(b) - area(a))[0] ??
    [...frames].sort((a, b) => area(b) - area(a))[0];

  if (container) {
    timeline.push({
      action: "zoom-in",
      frameId: container.id,
      scale: 1.12,
      duration: 1100,
      easing: "ease-out",
    });
  }

  const ordered = [...frames].sort((a, b) => a.rect.top - b.rect.top);
  for (const f of ordered) {
    if (container && f.id === container.id) continue;

    if (matches(f, FIELD)) {
      timeline.push({ action: "cursor-move", destFrameId: f.id, duration: 650 });
      timeline.push({ action: "click", frameId: f.id });
      timeline.push({
        action: "type-down",
        frameId: f.id,
        text: sampleText(f),
        soundProfile: "mechanical-keyboard",
        delayAfter: 200,
      });
    } else if (matches(f, ACTION)) {
      timeline.push({ action: "highlight", frameId: f.id, duration: 1000 });
      timeline.push({ action: "cursor-move", destFrameId: f.id, duration: 650 });
      timeline.push({
        action: "click",
        frameId: f.id,
        soundProfile: "macbook-trackpad",
        delayAfter: 400,
      });
    }
  }

  if (container) timeline.push({ action: "zoom-out", duration: 800 });

  return {
    version: "1.0",
    meta: {
      title: goal ? `Demo: ${goal}` : "Generated demo",
      description: goal,
      generatedBy: "telekinesis-mcp",
    },
    resolution: { width: 1280, height: 720 },
    fps: 30,
    timeline,
  } as TimesheetInput;
}
