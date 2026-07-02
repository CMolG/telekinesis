import { describe, expect, it } from "vitest";
import { MAX_HISTORY, canRedo, canUndo, createHistory, pushHistory, redo, undo } from "../src/history";

describe("createHistory", () => {
  it("starts with empty past/future", () => {
    const h = createHistory("a");
    expect(h).toEqual({ past: [], present: "a", future: [] });
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });
});

describe("pushHistory", () => {
  it("records the previous present and clears future", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b");
    expect(h.present).toBe("b");
    expect(h.past).toEqual(["a"]);
    expect(h.future).toEqual([]);
  });

  it("discards redo history on a new edit (branching undo)", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    h = undo(h); // present "b", future ["c"]
    expect(canRedo(h)).toBe(true);
    h = pushHistory(h, "d"); // new edit from "b" — "c" is no longer reachable
    expect(h.present).toBe("d");
    expect(h.future).toEqual([]);
    expect(canRedo(h)).toBe(false);
  });

  it("caps stored history at MAX_HISTORY", () => {
    let h = createHistory(0);
    for (let i = 1; i <= MAX_HISTORY + 10; i++) h = pushHistory(h, i);
    expect(h.past.length).toBeLessThanOrEqual(MAX_HISTORY);
    expect(h.present).toBe(MAX_HISTORY + 10);
  });
});

describe("undo/redo", () => {
  it("round-trips a single edit", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b");
    h = undo(h);
    expect(h.present).toBe("a");
    h = redo(h);
    expect(h.present).toBe("b");
  });

  it("undo at the start of history is a no-op", () => {
    const h = createHistory("a");
    expect(undo(h)).toEqual(h);
  });

  it("redo with nothing to redo is a no-op", () => {
    const h = createHistory("a");
    expect(redo(h)).toEqual(h);
  });

  it("walks back multiple steps in order", () => {
    let h = createHistory("a");
    h = pushHistory(h, "b");
    h = pushHistory(h, "c");
    h = undo(h);
    h = undo(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);
  });
});
