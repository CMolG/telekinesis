import { describe, expect, it } from "vitest";
import {
  clampMove,
  clampSelection,
  formatClock,
  remapSelectionAfterMove,
  reorderTimeline,
  resizeDurationMs,
  snapToEdges,
  suggestedSoundProfile,
} from "../src/timeline-ops";

describe("reorderTimeline", () => {
  it("moves an item forward", () => {
    expect(reorderTimeline(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves an item backward", () => {
    expect(reorderTimeline(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when from === to", () => {
    const items = ["a", "b", "c"];
    expect(reorderTimeline(items, 1, 1)).toEqual(items);
  });

  it("clamps out-of-range indices instead of throwing", () => {
    expect(reorderTimeline(["a", "b", "c"], -5, 99)).toEqual(["b", "c", "a"]);
  });

  it("returns an empty array unchanged", () => {
    expect(reorderTimeline([], 0, 1)).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = ["a", "b", "c"];
    reorderTimeline(items, 0, 2);
    expect(items).toEqual(["a", "b", "c"]);
  });
});

describe("remapSelectionAfterMove", () => {
  it("follows the moved clip itself", () => {
    expect(remapSelectionAfterMove(0, 0, 2)).toBe(2);
  });

  it("shifts left when a clip moved forward past the selection", () => {
    // [sel=1, x, y] -> moving index 0 to index 2 pushes 1 and 2 left by one.
    expect(remapSelectionAfterMove(1, 0, 2)).toBe(0);
  });

  it("shifts right when a clip moved backward past the selection", () => {
    expect(remapSelectionAfterMove(1, 3, 0)).toBe(2);
  });

  it("leaves an unaffected selection untouched", () => {
    expect(remapSelectionAfterMove(4, 0, 1)).toBe(4);
  });

  it("passes null through", () => {
    expect(remapSelectionAfterMove(null, 0, 1)).toBeNull();
  });

  it("is a no-op when from === to", () => {
    expect(remapSelectionAfterMove(2, 3, 3)).toBe(2);
  });
});

describe("clampMove", () => {
  it("moves within bounds", () => {
    expect(clampMove(1, 1, 5)).toBe(2);
    expect(clampMove(1, -1, 5)).toBe(0);
  });

  it("clamps at the start boundary", () => {
    expect(clampMove(0, -1, 5)).toBe(0);
  });

  it("clamps at the end boundary", () => {
    expect(clampMove(4, 1, 5)).toBe(4);
  });

  it("handles an empty timeline", () => {
    expect(clampMove(0, 1, 0)).toBe(0);
  });
});

describe("clampSelection", () => {
  it("passes null through", () => {
    expect(clampSelection(null, 5)).toBeNull();
  });

  it("clamps to the new last index when the timeline shrank", () => {
    expect(clampSelection(4, 2)).toBe(1);
  });

  it("leaves an in-range selection untouched", () => {
    expect(clampSelection(1, 5)).toBe(1);
  });

  it("nulls out when the timeline is empty", () => {
    expect(clampSelection(0, 0)).toBeNull();
  });
});

describe("snapToEdges", () => {
  it("snaps to the nearest edge within threshold", () => {
    expect(snapToEdges(1005, [1000, 2000], 50)).toBe(1000);
  });

  it("picks the closer of two candidates", () => {
    expect(snapToEdges(1490, [1000, 1500], 600)).toBe(1500);
  });

  it("leaves the value unchanged outside the threshold", () => {
    expect(snapToEdges(1200, [1000, 2000], 50)).toBe(1200);
  });
});

describe("resizeDurationMs", () => {
  it("snaps the new end to a neighbor and derives duration from the clip start", () => {
    // clip starts at 500, dragged to end ~1005, neighbor edge at 1000 is within threshold.
    expect(resizeDurationMs(500, 1005, [1000], { thresholdMs: 50 })).toBe(500);
  });

  it("never collapses below the minimum duration", () => {
    expect(resizeDurationMs(500, 510, [], { minDurationMs: 50 })).toBe(50);
  });

  it("uses the raw proposed end when nothing is nearby", () => {
    expect(resizeDurationMs(0, 2000, [9000], { thresholdMs: 60 })).toBe(2000);
  });
});

describe("formatClock", () => {
  it("formats zero", () => {
    expect(formatClock(0)).toBe("0:00.0");
  });

  it("formats sub-minute durations with tenths", () => {
    expect(formatClock(1234)).toBe("0:01.2");
  });

  it("formats minutes", () => {
    expect(formatClock(65_123)).toBe("1:05.1");
  });

  it("clamps negative input to zero", () => {
    expect(formatClock(-500)).toBe("0:00.0");
  });
});

describe("suggestedSoundProfile", () => {
  it("gives click a mouse-click default", () => {
    expect(suggestedSoundProfile("click")).toBe("mouse-click");
  });

  it("gives type-down a keyboard default", () => {
    expect(suggestedSoundProfile("type-down")).toBe("mechanical-keyboard");
  });

  it("falls back to pop for wait (which has no soundProfile field at all)", () => {
    expect(suggestedSoundProfile("wait")).toBe("pop");
  });
});
