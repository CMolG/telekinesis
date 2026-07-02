import type { Effect, TimesheetInput } from "@telekinesis/schema";
import type { RectJSON } from "./geometry";
import type { FrameInfo } from "./registry";
import { registryStore } from "./registry";
import { getRuntime } from "./runtime";
import type { SoundMark } from "./sound";

/**
 * The Studio bridge — a `postMessage` mirror of `window.__telekinesis`.
 *
 * The runtime (`installRuntime`) already exposes `listFrames/getRect/runEffect/
 * play/showCursor` inside the page, but a same-window API is useless to the
 * Studio, which embeds the target app in an *iframe* (often another origin).
 * This bridge relays those exact methods over `postMessage` so the Studio can
 * introspect and drive **any** Telekinetic app it loads — the primitive that
 * lets it build an editing UI from the app's own frames.
 */

const REQ = "tk-studio-req";
const RES = "tk-studio-res";
const EVT = "tk-studio-evt";

interface RequestMessage {
  __tk: typeof REQ;
  id: number;
  method: string;
  args: unknown[];
}

/** Options accepted by `play` across the bridge (functions can't be cloned). */
interface BridgePlayOptions {
  mode?: "self" | "external";
  sound?: boolean;
  soundBase?: string;
}

/**
 * Install the in-page responder. Called by `<TelekinesisStage>` when the page
 * is in Studio mode. Returns a disposer. Posts replies/events to the embedder
 * (`window.parent`).
 *
 * `targetOrigin` is `"*"` because the Studio is a local dev tool that may load
 * the target from any origin; the bridge only ever activates behind an explicit
 * Studio flag.
 */
export function installStudioBridge(target: Window = window): () => void {
  let playAbort: AbortController | null = null;

  const post = (msg: unknown): void => {
    const parent = target.parent;
    if (parent && parent !== target) parent.postMessage(msg, "*");
    const opener = target.opener as Window | null;
    if (opener) opener.postMessage(msg, "*");
  };

  const emit = (event: string, data: Record<string, unknown> = {}): void =>
    post({ __tk: EVT, event, ...data });

  const handlers: Record<string, (args: unknown[]) => unknown> = {
    ping: () => ({ version: getRuntime()?.version ?? null, ready: getRuntime()?.ready === true }),
    listFrames: () => getRuntime()?.listFrames() ?? [],
    getRect: (args) => getRuntime()?.getRect(String(args[0])) ?? null,
    showCursor: () => {
      getRuntime()?.showCursor();
    },
    runEffect: (args) => getRuntime()?.runEffect(args[0] as Effect),
    stop: () => {
      playAbort?.abort();
    },
    play: (args) => {
      playAbort?.abort();
      playAbort = new AbortController();
      const rt = getRuntime();
      if (!rt) return [];
      const sheet = args[0] as TimesheetInput;
      const opts = (args[1] ?? {}) as BridgePlayOptions;
      const total = Array.isArray(sheet?.timeline) ? sheet.timeline.length : 0;
      return rt.play(sheet, {
        mode: opts.mode,
        sound: opts.sound,
        soundBase: opts.soundBase,
        signal: playAbort.signal,
        onStep: (index) => emit("step", { index, total }),
      });
    },
  };

  const onMessage = async (e: MessageEvent): Promise<void> => {
    const data = e.data as RequestMessage | undefined;
    if (!data || data.__tk !== REQ || typeof data.id !== "number") return;
    const handler = handlers[data.method];
    if (!handler) {
      post({ __tk: RES, id: data.id, ok: false, error: `unknown method: ${data.method}` });
      return;
    }
    try {
      const result = await handler(data.args ?? []);
      post({ __tk: RES, id: data.id, ok: true, result });
    } catch (err) {
      post({ __tk: RES, id: data.id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  target.addEventListener("message", onMessage);
  // Re-emit whenever the set of mounted frames changes, so the Studio can keep
  // its X-ray overlay and frame palette in sync as the user navigates.
  const unsubscribe = registryStore.subscribe(() => emit("frames-changed"));
  // Announce readiness for a Studio that attached after the app booted.
  emit("ready");

  return () => {
    target.removeEventListener("message", onMessage);
    unsubscribe();
    playAbort?.abort();
  };
}

/* ------------------------------------------------------------------ *
 * Studio-side client
 * ------------------------------------------------------------------ */

export interface StudioPlayOptions extends BridgePlayOptions {
  onStep?: (index: number, total: number) => void;
}

export interface StudioClient {
  ping(): Promise<{ version: string | null; ready: boolean }>;
  /** Poll `ping` until the target runtime reports ready (or reject on timeout). */
  ready(timeoutMs?: number): Promise<void>;
  listFrames(): Promise<FrameInfo[]>;
  getRect(id: string): Promise<RectJSON | null>;
  showCursor(): Promise<void>;
  /** Run a single effect's visuals (scrub-to-step preview). */
  runEffect(effect: Effect): Promise<void>;
  /** Play a whole timesheet live in the target; resolves with the sound marks. */
  play(sheet: TimesheetInput, opts?: StudioPlayOptions): Promise<SoundMark[]>;
  stop(): Promise<void>;
  /** Subscribe to bridge events (`ready`, `frames-changed`, `step`). */
  on(event: string, cb: (data: Record<string, unknown>) => void): () => void;
  destroy(): void;
}

export interface StudioClientOptions {
  targetOrigin?: string;
  /** Per-call timeout in ms (0 disables). Default 15000. `play` never times out. */
  timeoutMs?: number;
}

/**
 * Create a promise-based proxy of a Telekinetic app running in `frame`. Used by
 * the Studio to talk to the {@link installStudioBridge} responder.
 */
export function createStudioClient(
  frame: HTMLIFrameElement | Window,
  options: StudioClientOptions = {},
): StudioClient {
  const targetWindow: Window | null = frame instanceof Window ? frame : frame.contentWindow;
  const targetOrigin = options.targetOrigin ?? "*";
  const defaultTimeout = options.timeoutMs ?? 15_000;

  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<(data: Record<string, unknown>) => void>>();
  let seq = 0;

  const onMessage = (e: MessageEvent): void => {
    const d = e.data as { __tk?: string; id?: number; ok?: boolean; result?: unknown; error?: string; event?: string };
    if (!d || typeof d.__tk !== "string") return;
    if (d.__tk === RES && typeof d.id === "number") {
      const p = pending.get(d.id);
      if (!p) return;
      pending.delete(d.id);
      if (d.ok) p.resolve(d.result);
      else p.reject(new Error(d.error ?? "studio bridge error"));
    } else if (d.__tk === EVT && typeof d.event === "string") {
      listeners.get(d.event)?.forEach((cb) => cb(d as Record<string, unknown>));
    }
  };
  window.addEventListener("message", onMessage);

  const call = <T>(method: string, args: unknown[] = [], timeoutMs = defaultTimeout): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (!targetWindow) {
        reject(new Error("studio client: target iframe has no contentWindow"));
        return;
      }
      const id = ++seq;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      targetWindow.postMessage({ __tk: REQ, id, method, args }, targetOrigin);
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (pending.delete(id)) reject(new Error(`studio call "${method}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });

  const on = (event: string, cb: (data: Record<string, unknown>) => void): (() => void) => {
    const set = listeners.get(event) ?? new Set();
    set.add(cb);
    listeners.set(event, set);
    return () => set.delete(cb);
  };

  return {
    ping: () => call("ping"),
    ready: (timeoutMs = 15_000) =>
      new Promise<void>((resolve, reject) => {
        const started = Date.now();
        const tick = async (): Promise<void> => {
          try {
            const { ready } = await call<{ ready: boolean }>("ping", [], 2000);
            if (ready) return resolve();
          } catch {
            /* not up yet */
          }
          if (Date.now() - started > timeoutMs) return reject(new Error("studio target never became ready"));
          setTimeout(tick, 250);
        };
        void tick();
      }),
    listFrames: () => call("listFrames"),
    getRect: (id) => call("getRect", [id]),
    showCursor: () => call("showCursor"),
    runEffect: (effect) => call("runEffect", [effect]),
    play: (sheet, opts = {}) => {
      const off = opts.onStep
        ? on("step", (d) => opts.onStep!(Number(d.index), Number(d.total)))
        : () => {};
      const { mode, sound, soundBase } = opts;
      return call<SoundMark[]>("play", [sheet, { mode, sound, soundBase }], 0).finally(off);
    },
    stop: () => call("stop"),
    on,
    destroy: () => {
      window.removeEventListener("message", onMessage);
      pending.clear();
      listeners.clear();
    },
  };
}
