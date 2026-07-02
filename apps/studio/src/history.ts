/**
 * A generic linear undo/redo stack. The Studio's `sheet` state is already
 * updated immutably (`setSheet((s) => ({ ...s, timeline })`), so snapshotting
 * it here is just holding onto references — cheap, and safe from accidental
 * mutation.
 *
 * Kept framework-agnostic (no React) so it's trivial to unit-test and so the
 * "when do we snapshot" policy lives in one place: callers push on committed
 * edits (add/update/delete/reorder/resize) and must NOT push on pure
 * selection changes — see `App.tsx`'s `commitSheet` vs `setSelected`.
 */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** Cap on stored snapshots (past + future combined stays well under this). */
export const MAX_HISTORY = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * Record `history.present` as undoable and make `next` the new present.
 * Branching: any pending redo (`future`) is discarded, matching standard
 * editor undo/redo semantics (you can't redo past a new edit).
 */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present].slice(-MAX_HISTORY);
  return { past, present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1] as T;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next as T,
    future: rest,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
