import { describe, expect, it } from "vitest";
import {
  EFFECT_ACTIONS,
  LANE_OF,
  estimateEffectDuration,
  itemsStartedBy,
  layoutTimesheet,
  parseTimesheet,
} from "../src/index";

describe("estimateEffectDuration", () => {
  it("uses the effect's duration for timed effects", () => {
    const sheet = parseTimesheet({ timeline: [{ action: "zoom-in", frameId: "x" }] });
    // zoom-in default duration is 1200
    expect(estimateEffectDuration(sheet.timeline[0])).toBe(1200);
  });

  it("scales type-down by text length × typing speed", () => {
    const sheet = parseTimesheet({
      timeline: [{ action: "type-down", frameId: "email", text: "abcd", typingSpeed: 50 }],
    });
    expect(estimateEffectDuration(sheet.timeline[0])).toBe(200);
  });

  it("gives click a fixed synthetic beat", () => {
    const sheet = parseTimesheet({ timeline: [{ action: "click", frameId: "buy" }] });
    expect(estimateEffectDuration(sheet.timeline[0])).toBe(500);
  });

  it("has a lane for every action", () => {
    for (const action of EFFECT_ACTIONS) {
      expect(LANE_OF[action]).toBeTruthy();
    }
  });
});

describe("layoutTimesheet", () => {
  it("places effects sequentially with delays as gaps", () => {
    const sheet = parseTimesheet({
      timeline: [
        { action: "wait", duration: 500 },
        { action: "highlight", frameId: "hero", duration: 1000, delayBefore: 200, delayAfter: 300 },
        { action: "zoom-out", duration: 800 },
      ],
    });
    const { items, totalMs } = layoutTimesheet(sheet);

    // wait: 0 → 500
    expect(items[0]).toMatchObject({ start: 0, duration: 500, end: 500, lane: "timing" });
    // highlight: 500 + 200 delayBefore = 700 → 1700, then +300 delayAfter
    expect(items[1]).toMatchObject({ start: 700, duration: 1000, end: 1700, lane: "camera" });
    // zoom-out: cursor is 1700 + 300 = 2000
    expect(items[2]).toMatchObject({ start: 2000, duration: 800, end: 2800 });
    expect(totalMs).toBe(2800);
  });

  it("preserves the original array order via index", () => {
    const sheet = parseTimesheet({
      timeline: [{ action: "wait" }, { action: "zoom-out" }],
    });
    const { items } = layoutTimesheet(sheet);
    expect(items.map((i) => i.index)).toEqual([0, 1]);
  });
});

describe("itemsStartedBy", () => {
  const sheet = parseTimesheet({
    timeline: [
      { action: "wait", duration: 500 }, // 0 → 500
      { action: "zoom-in", frameId: "hero", duration: 700 }, // 500 → 1200
      { action: "zoom-out", duration: 400 }, // 1200 → 1600
    ],
  });
  const layout = layoutTimesheet(sheet);

  it("excludes everything before playback starts", () => {
    expect(itemsStartedBy(layout, -1)).toEqual([]);
  });

  it("is a prefix: only clips whose start has been reached", () => {
    // t=500 is exactly the zoom-in's start — it has begun, wait has ended.
    expect(itemsStartedBy(layout, 500).map((i) => i.index)).toEqual([0, 1]);
  });

  it("includes a clip that is mid-flight at t", () => {
    expect(itemsStartedBy(layout, 900).map((i) => i.index)).toEqual([0, 1]);
  });

  it("includes everything once t reaches the last clip's start", () => {
    expect(itemsStartedBy(layout, 1200).map((i) => i.index)).toEqual([0, 1, 2]);
  });

  it("stays a prefix (stable order) past the end of playback", () => {
    expect(itemsStartedBy(layout, 999_999).map((i) => i.index)).toEqual([0, 1, 2]);
  });
});
