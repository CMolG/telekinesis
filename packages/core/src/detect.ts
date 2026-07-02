export interface DetectOptions {
  /** Extra query-param names that force demo mode (besides `demo`/`telekinesis`). */
  params?: string[];
  /** Hard override. */
  force?: boolean;
}

/**
 * Is the page being driven by Telekinesis (a recorder or a forced preview)?
 *
 * True when any of:
 *  - `navigator.webdriver === true` (Playwright / Puppeteer / Selenium)
 *  - a `?demo` / `?telekinesis` (or custom) query param is present
 *  - `window.__TELEKINESIS_FORCE__ === true`
 *
 * Returns `false` during SSR (no `window`), which keeps server and first client
 * render identical and avoids hydration mismatches. `<TelekineticFrame>` and
 * `<TelekinesisStage>` re-check after mount.
 */
export function isDemoMode(opts: DetectOptions = {}): boolean {
  if (opts.force) return true;
  if (typeof window === "undefined") return false;
  try {
    // Studio mode implies demo mode: frames must register and the runtime must
    // install so the editor can introspect and drive the page.
    if (isStudioMode()) return true;
    if (typeof navigator !== "undefined" && navigator.webdriver === true) {
      return true;
    }
    const sp = new URLSearchParams(window.location.search);
    const names = ["demo", "telekinesis", ...(opts.params ?? [])];
    if (names.some((n) => sp.has(n))) return true;
    if ((window as unknown as Record<string, unknown>).__TELEKINESIS_FORCE__ === true) {
      return true;
    }
  } catch {
    /* defensive: never throw from detection */
  }
  return false;
}

/**
 * Is the page being edited by the Telekinesis Studio? True when a
 * `?telekinesis-studio` query param is present or `window.__TELEKINESIS_STUDIO__`
 * is set. When true, `<TelekinesisStage>` also installs the `postMessage`
 * bridge the Studio talks to.
 */
export function isStudioMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).has("telekinesis-studio")) return true;
    if ((window as unknown as Record<string, unknown>).__TELEKINESIS_STUDIO__ === true) return true;
  } catch {
    /* defensive */
  }
  return false;
}

/** Force (or unforce) demo mode at runtime — handy for a "Play demo" button. */
export function setForcedDemoMode(on: boolean): void {
  if (typeof window === "undefined") return;
  (window as unknown as Record<string, unknown>).__TELEKINESIS_FORCE__ = on;
}
