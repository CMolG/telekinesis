import { describe, expect, it } from "vitest";
import { planTyping, randomTypoLetter, TYPO_RATE } from "../src/index";

describe("planTyping", () => {
  it("returns one step per character with no typos when mistakes is false", () => {
    // rng always "hits" the typo threshold if it were ever consulted —
    // proves mistakes:false short-circuits before any rng() call matters.
    const steps = planTyping("abc", false, { rng: () => 0 });
    expect(steps).toEqual([{ char: "a" }, { char: "b" }, { char: "c" }]);
  });

  it("never plans a typo on the very first character of an empty target", () => {
    const steps = planTyping("abc", true, { rng: () => 0 });
    expect(steps[0]).toEqual({ char: "a" });
    expect(steps[1].typo).toBeDefined();
    expect(steps[2].typo).toBeDefined();
  });

  it("can plan a typo on the first character when startNonEmpty is true", () => {
    const steps = planTyping("a", true, { rng: () => 0, startNonEmpty: true });
    expect(steps[0].typo).toBeDefined();
  });

  it("never plans a typo when rng always misses the threshold", () => {
    const steps = planTyping("abcdef", true, { startNonEmpty: true, rng: () => 0.99 });
    expect(steps.every((s) => s.typo === undefined)).toBe(true);
  });

  it("treats TYPO_RATE as an exclusive upper bound (just under hits, at/over misses)", () => {
    const justUnder = planTyping("xy", true, {
      startNonEmpty: true,
      rng: () => TYPO_RATE - 0.0001,
    });
    expect(justUnder[0].typo).toBeDefined();

    const atThreshold = planTyping("xy", true, { startNonEmpty: true, rng: () => TYPO_RATE });
    expect(atThreshold[0].typo).toBeUndefined();
  });

  it("produces exactly one step per character regardless of mistakes/typos", () => {
    const text = "hello world";
    expect(planTyping(text, true, { rng: () => 0 }).length).toBe([...text].length);
    expect(planTyping(text, false).length).toBe([...text].length);
  });

  it("treats a typo'd step's char as the original character, never the typo", () => {
    const steps = planTyping("ab", true, { startNonEmpty: true, rng: () => 0 });
    expect(steps.map((s) => s.char)).toEqual(["a", "b"]);
  });

  it("iterates Unicode code points, so a surrogate-pair emoji is one step", () => {
    const text = "a😀b";
    const steps = planTyping(text, false);
    expect(steps.map((s) => s.char)).toEqual(["a", "😀", "b"]);
  });
});

describe("randomTypoLetter", () => {
  it("is always a single lowercase a-z letter", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomTypoLetter()).toMatch(/^[a-z]$/);
    }
  });

  it("maps rng()'s [0,1) range to the full a-z span", () => {
    expect(randomTypoLetter(() => 0)).toBe("a");
    expect(randomTypoLetter(() => 0.999999)).toBe("z");
  });
});
