/**
 * Pure planning for simulated human typing with occasional mistakes.
 *
 * Shared by `@telekinesis/core`'s self-mode `typeInto` (`effects.ts`, DOM
 * writes in a live browser preview) and `@telekinesis/engine`'s
 * external-mode `type-down` (`record.ts`, real Playwright keystrokes during
 * a recording), so a live-preview typo and a recorded typo are decided by
 * the exact same function instead of two hand-written implementations that
 * could quietly drift apart. Deliberately dependency-free (no DOM, no
 * timers, no I/O) so it works identically in the browser and in Node: this
 * only decides *what* happens, never *how* — each caller turns the plan into
 * its own writes/keystrokes and its own pacing.
 */

/** One character of a typing pass, with an optional preceding mistake. */
export interface TypingStep {
  /** The character actually meant to land at this position. */
  char: string;
  /**
   * Present when this step should be preceded by a wrong keystroke: type
   * `typo`, pause, backspace it, pause, then type `char`. Mirrors a human
   * noticing and fixing a typo mid-word.
   */
  typo?: string;
}

/** Per-character chance of a preceding typo, once the target isn't empty. */
export const TYPO_RATE = 0.06;

export interface PlanTypingOptions {
  /**
   * Does the target already hold content before this pass starts? A typo is
   * never planned for the very first character typed into a truly empty
   * field (there's nothing to have "just mistyped" yet) — but it *can* be
   * planned on the first character of this pass when the target was already
   * non-empty. Defaults to `false` (fresh target) — true for every current
   * call site, which always types into an empty field.
   */
  startNonEmpty?: boolean;
  /** Source of randomness. Defaults to `Math.random`; inject for deterministic tests. */
  rng?: () => number;
}

/**
 * Plan a typing pass over `text`. When `mistakes` is false the plan is just
 * `text` split into steps with no typos — exact, and no `rng` calls at all.
 *
 * Iterates Unicode code points (`[...text]`), not UTF-16 code units, so
 * surrogate pairs (e.g. emoji) count as one character/one step.
 */
export function planTyping(
  text: string,
  mistakes: boolean,
  opts: PlanTypingOptions = {},
): TypingStep[] {
  const rng = opts.rng ?? Math.random;
  let hasContent = opts.startNonEmpty ?? false;
  const steps: TypingStep[] = [];
  for (const char of [...text]) {
    if (mistakes && hasContent && rng() < TYPO_RATE) {
      steps.push({ char, typo: randomTypoLetter(rng) });
    } else {
      steps.push({ char });
    }
    hasContent = true;
  }
  return steps;
}

/** A random lowercase letter — stands in for "the wrong key" in a typo. */
export function randomTypoLetter(rng: () => number = Math.random): string {
  return String.fromCharCode(97 + Math.floor(rng() * 26));
}
