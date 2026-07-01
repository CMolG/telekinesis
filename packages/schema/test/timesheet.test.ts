import { describe, expect, it } from "vitest";
import {
  EFFECT_ACTIONS,
  SOUND_PROFILES,
  parseTimesheet,
  safeParseTimesheet,
  timesheetJsonSchema,
} from "../src/index";

describe("timesheet parsing", () => {
  it("parses a minimal valid timesheet and applies defaults", () => {
    const sheet = parseTimesheet({
      timeline: [{ action: "wait" }],
    });
    expect(sheet.version).toBe("1.0");
    expect(sheet.resolution).toEqual({ width: 1920, height: 1080 });
    expect(sheet.fps).toBe(30);
    // wait.duration default
    expect(sheet.timeline[0]).toMatchObject({ action: "wait", duration: 1000 });
  });

  it("applies per-effect defaults (click ripple, typing speed)", () => {
    const sheet = parseTimesheet({
      timeline: [
        { action: "click", frameId: "buy" },
        { action: "type-down", frameId: "email", text: "a@b.com" },
      ],
    });
    expect(sheet.timeline[0]).toMatchObject({ showRipple: true });
    expect(sheet.timeline[1]).toMatchObject({ typingSpeed: 55, mistakes: false });
  });

  it("rejects an unknown action", () => {
    const res = safeParseTimesheet({ timeline: [{ action: "teleport" }] });
    expect(res.success).toBe(false);
  });

  it("requires a destination for drag-and-drop", () => {
    const res = safeParseTimesheet({
      timeline: [{ action: "drag-and-drop", frameId: "card" }],
    });
    expect(res.success).toBe(false);
  });

  it("accepts drag-and-drop with a destFrameId", () => {
    const res = safeParseTimesheet({
      timeline: [{ action: "drag-and-drop", frameId: "card", destFrameId: "column-2" }],
    });
    expect(res.success).toBe(true);
  });

  it("requires a destination for cursor-move", () => {
    const res = safeParseTimesheet({
      timeline: [{ action: "cursor-move" }],
    });
    expect(res.success).toBe(false);
  });

  it("requires a non-empty timeline", () => {
    const res = safeParseTimesheet({ timeline: [] });
    expect(res.success).toBe(false);
  });
});

describe("catalogs", () => {
  it("exposes all 11 effect actions", () => {
    expect(EFFECT_ACTIONS).toHaveLength(11);
  });

  it("every sound profile has an asset and cadence", () => {
    for (const meta of Object.values(SOUND_PROFILES)) {
      expect(meta.asset).toMatch(/\.(wav|mp3)$/);
      expect(["once", "per-keystroke"]).toContain(meta.cadence);
    }
  });
});

describe("json schema export", () => {
  it("produces an object schema for the timesheet", () => {
    expect(timesheetJsonSchema).toBeTypeOf("object");
    expect(JSON.stringify(timesheetJsonSchema)).toContain("timeline");
  });
});
