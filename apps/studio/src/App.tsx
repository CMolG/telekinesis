import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createStudioClient, type FrameInfo, type StudioClient } from "@telekinesis/core";
import { layoutTimesheet, safeParseTimesheet, type Effect, type SoundProfile, type TimesheetInput } from "@telekinesis/schema";
import { Inspector } from "./Inspector";
import { ReorderStrip } from "./ReorderStrip";
import { Timeline } from "./Timeline";
import { canRedo, canUndo, createHistory, pushHistory, redo, undo, type History } from "./history";
import { clampSelection, remapSelectionAfterMove, reorderTimeline, suggestedSoundProfile } from "./timeline-ops";

declare const __TK_TARGET__: string;

const withStudioParam = (url: string): string => {
  const u = new URL(url, window.location.href);
  u.searchParams.set("telekinesis-studio", "1");
  return u.toString();
};

const DEFAULT_SHEET: TimesheetInput = {
  version: "1.0",
  meta: { title: "Untitled demo", generatedBy: "telekinesis-studio" },
  resolution: { width: 1280, height: 720 },
  fps: 30,
  timeline: [{ action: "wait", duration: 800 }],
};

export function App() {
  const [target, setTarget] = useState<string>(() => {
    try {
      return __TK_TARGET__;
    } catch {
      return "http://localhost:4311";
    }
  });
  const [urlInput, setUrlInput] = useState(target);
  // `sheet` is a history-tracked snapshot stack (undo/redo — feature 4). Only
  // committed structural edits (add/update/delete/reorder/resize) push a
  // snapshot; `selected` below is deliberately kept OUTSIDE this stack so
  // pure selection changes never grow the undo history.
  const [history, setHistory] = useState<History<TimesheetInput>>(() => createHistory(DEFAULT_SHEET));
  const sheet = history.present;
  const [frames, setFrames] = useState<FrameInfo[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [xray, setXray] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Load a Telekinetic app to begin.");
  const [busy, setBusy] = useState(false);
  const [playheadMs, setPlayheadMs] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<StudioClient | null>(null);
  const scrubRaf = useRef(0);

  const parsed = useMemo(() => safeParseTimesheet(sheet), [sheet]);
  const frameIds = useMemo(() => frames.map((f) => f.id), [frames]);
  const layout = useMemo(
    () => (parsed.success ? layoutTimesheet(parsed.data) : { items: [], totalMs: 0 }),
    [parsed],
  );

  const refreshFrames = useCallback(async () => {
    const c = clientRef.current;
    if (!c) return;
    try {
      setFrames(await c.listFrames());
    } catch {
      /* target navigating */
    }
  }, []);

  // (Re)connect the bridge whenever the iframe loads a new page.
  const onIframeLoad = useCallback(async () => {
    clientRef.current?.destroy();
    const win = iframeRef.current;
    if (!win) return;
    const client = createStudioClient(win);
    clientRef.current = client;
    setConnected(false);
    setStatus("Connecting to the app…");
    try {
      await client.ready(8000);
      setConnected(true);
      setStatus("Connected.");
      // Event-driven X-ray (feature 6): the bridge re-emits `frames-changed`
      // on registry mutation *and* on scroll/resize (rAF-throttled inside
      // the target — see studio-bridge.ts), so this single listener replaces
      // the old `setInterval(refreshFrames, 700)` poll entirely.
      client.on("frames-changed", () => void refreshFrames());
      await refreshFrames();
    } catch {
      setStatus("No Telekinesis runtime found. Is <TelekinesisStage> mounted?");
    }
  }, [refreshFrames]);

  useEffect(() => () => clientRef.current?.destroy(), []);

  /* --------------------------- history (undo/redo) --------------------------- */

  const commitSheet = useCallback((updater: (s: TimesheetInput) => TimesheetInput) => {
    setHistory((h) => pushHistory(h, updater(h.present)));
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo(history)) return;
    const next = undo(history);
    setHistory(next);
    setSelected((sel) => clampSelection(sel, (next.present.timeline as unknown[]).length));
  }, [history]);

  const handleRedo = useCallback(() => {
    if (!canRedo(history)) return;
    const next = redo(history);
    setHistory(next);
    setSelected((sel) => clampSelection(sel, (next.present.timeline as unknown[]).length));
  }, [history]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  /* --------------------------- editing --------------------------- */

  const addEffect = (effect: Record<string, unknown>) => {
    const nextIndex = (sheet.timeline as unknown[]).length;
    commitSheet((s) => ({ ...s, timeline: [...(s.timeline as unknown[]), effect] }) as TimesheetInput);
    setSelected(nextIndex);
  };

  const updateEffect = (index: number, next: Record<string, unknown>) => {
    commitSheet((s) => {
      const timeline = [...(s.timeline as unknown[])];
      timeline[index] = next;
      return { ...s, timeline } as TimesheetInput;
    });
  };

  const deleteEffect = (index: number) => {
    commitSheet((s) => {
      const timeline = (s.timeline as unknown[]).filter((_, i) => i !== index);
      if (timeline.length === 0) timeline.push({ action: "wait", duration: 500 });
      return { ...s, timeline } as TimesheetInput;
    });
    setSelected(null);
  };

  const reorderClip = (from: number, to: number) => {
    commitSheet((s) => ({ ...s, timeline: reorderTimeline(s.timeline as unknown[], from, to) }) as TimesheetInput);
    setSelected((sel) => remapSelectionAfterMove(sel, from, to));
  };

  const resizeClip = (index: number, durationMs: number) => {
    const effect = parsed.success ? (parsed.data.timeline[index] as unknown as Record<string, unknown>) : null;
    if (!effect) return;
    updateEffect(index, { ...effect, duration: durationMs });
  };

  const toggleMute = (index: number) => {
    const effect = parsed.success ? (parsed.data.timeline[index] as unknown as Record<string, unknown>) : null;
    if (!effect || effect.action === "wait") return;
    const current = effect.soundProfile as SoundProfile | undefined;
    const next = current ? undefined : suggestedSoundProfile(effect.action as Effect["action"]);
    updateEffect(index, { ...effect, soundProfile: next });
  };

  const selectAndPreview = (index: number) => {
    setSelected(index);
    if (parsed.success) clientRef.current?.runEffect(parsed.data.timeline[index]).catch(() => {});
  };

  /* --------------------------- playhead / scrubbing --------------------------- */

  const seekPlayhead = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, Math.max(layout.totalMs, 0)));
      setPlayheadMs(clamped);
      if (!parsed.success) return;
      // rAF-throttle the actual bridge round-trip: the range input / RTE
      // cursor can fire many times per drag frame, but only the latest
      // matters — the target only ever needs to reflect where the playhead
      // *ends up* on this frame.
      if (scrubRaf.current) cancelAnimationFrame(scrubRaf.current);
      scrubRaf.current = requestAnimationFrame(() => {
        clientRef.current?.seek(parsed.data, clamped).catch(() => {});
      });
    },
    [layout.totalMs, parsed],
  );

  /* --------------------------- transport --------------------------- */

  const play = async () => {
    if (!parsed.success || !clientRef.current) return;
    setBusy(true);
    setStatus("Playing…");
    try {
      await clientRef.current.play(sheet, {
        mode: "self",
        onStep: (i, total) => setStatus(`Playing ${i + 1}/${total}`),
      });
      setStatus("Done.");
    } catch {
      setStatus("Playback stopped.");
    } finally {
      setBusy(false);
    }
  };
  const stop = () => clientRef.current?.stop();

  /* --------------------------- export --------------------------- */

  const render = async (format: "gif" | "mp4") => {
    if (!parsed.success) return;
    setBusy(true);
    setStatus(`Rendering ${format.toUpperCase()}… (recording in a headless browser)`);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timesheet: parsed.data, url: target, format }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `telekinesis-demo.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus(`Rendered ${format.toUpperCase()}.`);
    } catch (err) {
      setStatus(`Render failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!parsed.success) return;
    const path = window.prompt("Save timesheet to path:", "demo.timesheet.json");
    if (!path) return;
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, timesheet: parsed.data }),
    });
    const body = await res.json();
    setStatus(res.ok ? `Saved ${body.path}` : `Save failed: ${body.error}`);
  };

  const navigate = () => {
    setTarget(urlInput);
    setFrames([]);
    setConnected(false);
  };

  const selectedEffect: Effect | null =
    parsed.success && selected != null ? parsed.data.timeline[selected] ?? null : null;

  return (
    <div className="tk-app">
      <header className="tk-topbar">
        <span className="tk-brand"><span aria-hidden>◑</span> Studio</span>
        <div className="tk-url">
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} spellCheck={false} />
          <button onClick={navigate} type="button">Load</button>
        </div>
        <label className="tk-toggle">
          <input type="checkbox" checked={xray} onChange={(e) => setXray(e.target.checked)} /> X-ray
        </label>
        <div className="tk-history">
          <button onClick={handleUndo} disabled={!canUndo(history)} type="button" aria-label="Undo last edit (Cmd/Ctrl+Z)">
            ↶ Undo
          </button>
          <button onClick={handleRedo} disabled={!canRedo(history)} type="button" aria-label="Redo last edit (Cmd/Ctrl+Shift+Z)">
            ↷ Redo
          </button>
        </div>
        <div className="tk-transport">
          <button onClick={play} disabled={busy || !connected} type="button">▶ Play</button>
          <button onClick={stop} type="button">■ Stop</button>
          <button onClick={() => render("gif")} disabled={busy} type="button">Render GIF</button>
          <button onClick={() => render("mp4")} disabled={busy} type="button">Render MP4</button>
          <button onClick={save} type="button">Save</button>
        </div>
      </header>

      <div className="tk-body">
        <aside className="tk-palette">
          <h3>Telekinetic frames <span>{frames.length}</span></h3>
          {frames.length === 0 && <p className="tk-hint">{connected ? "No frames on this page." : status}</p>}
          <ul>
            {frames.map((f) => (
              <li key={f.id}>
                <div className="tk-frame-id">{f.id}{f.intent && <em> · {f.intent}</em>}</div>
                <div className="tk-quick">
                  <button onClick={() => addEffect({ action: "zoom-in", frameId: f.id })} type="button">Zoom</button>
                  <button onClick={() => addEffect({ action: "highlight", frameId: f.id })} type="button">Spotlight</button>
                  <button onClick={() => addEffect({ action: "cursor-move", destFrameId: f.id })} type="button">Point</button>
                  <button onClick={() => addEffect({ action: "click", frameId: f.id })} type="button">Click</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="tk-add-generic">
            <button onClick={() => addEffect({ action: "wait", duration: 800 })} type="button">+ Wait</button>
            <button onClick={() => addEffect({ action: "zoom-out" })} type="button">+ Zoom out</button>
            <button onClick={() => addEffect({ action: "scroll-down" })} type="button">+ Scroll</button>
          </div>
        </aside>

        <main className="tk-stage">
          <iframe
            ref={iframeRef}
            title="target"
            src={withStudioParam(target)}
            onLoad={onIframeLoad}
          />
          {xray && (
            <div className="tk-xray">
              {frames.map((f) => (
                <div
                  key={f.id}
                  className="tk-badge"
                  style={{ left: f.rect.x, top: f.rect.y, width: f.rect.width, height: f.rect.height }}
                  onClick={() => addEffect({ action: "highlight", frameId: f.id })}
                >
                  <span>{f.id}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        <aside className="tk-right">
          <Inspector
            effect={selectedEffect}
            frameIds={frameIds}
            onChange={(next) => selected != null && updateEffect(selected, next)}
            onDelete={() => selected != null && deleteEffect(selected)}
          />
          {!parsed.success && (
            <div className="tk-errors">
              {parsed.error.issues.map((i, k) => (
                <div key={k}>• {i.path.join(".") || "(root)"}: {i.message}</div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <footer className="tk-statusbar">
        <span>{status}</span>
        <span className="tk-count">{(sheet.timeline as unknown[]).length} clips</span>
      </footer>

      <div className="tk-timeline-dock">
        {parsed.success && (
          <>
            <ReorderStrip sheet={parsed.data} selectedIndex={selected} onSelect={selectAndPreview} onReorder={reorderClip} />
            <Timeline
              sheet={parsed.data}
              selectedIndex={selected}
              onSelect={selectAndPreview}
              playheadMs={playheadMs}
              totalMs={layout.totalMs}
              onScrub={seekPlayhead}
              onScrubStart={stop}
              onResize={resizeClip}
              onToggleMute={toggleMute}
            />
          </>
        )}
      </div>
    </div>
  );
}
