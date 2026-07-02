import { useEffect, useMemo, useRef } from "react";
import { Timeline as RTE, type TimelineState } from "@xzdarcy/react-timeline-editor";
import type { TimelineAction, TimelineRow, TimelineEffect } from "@xzdarcy/timeline-engine";
import {
  EFFECT_ACTIONS,
  EFFECT_LANES,
  LANE_OF,
  SOUND_PROFILES,
  layoutTimesheet,
  type EffectAction,
  type EffectLane,
  type SoundProfile,
  type Timesheet,
} from "@telekinesis/schema";
import { formatClock, resizeDurationMs } from "./timeline-ops";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

const LANE_COLOR: Record<EffectLane, string> = {
  timing: "#64748b",
  camera: "#7c5cff",
  navigation: "#0ea5e9",
  cursor: "#f59e0b",
  interaction: "#22c55e",
};
const SOUND_LANE_COLOR = "#14b8a6";
const LANE_LABELS: { id: string; color: string }[] = [
  ...EFFECT_LANES.map((l) => ({ id: l, color: LANE_COLOR[l] })),
  { id: "sound", color: SOUND_LANE_COLOR },
];

/** Every action with a real `duration` field (i.e. not `click`/`type-down`, whose active time is synthetic/derived) can have its trailing edge dragged. Mirrors `Inspector.tsx`'s `hasDuration`. */
const RESIZABLE_ACTIONS = new Set<EffectAction>(EFFECT_ACTIONS.filter((a) => a !== "click" && a !== "type-down"));
/** Every action except `wait` can carry a `soundProfile` (schema-enforced). */
const SOUND_CAPABLE = new Set<EffectAction>(EFFECT_ACTIONS.filter((a) => a !== "wait"));

// Must match the `scaleWidth`/`scale` props passed to <RTE> below (px per 1
// "scale" unit, which is 1 second at scale=1) — used to turn "a few px" of
// snap tolerance into a millisecond threshold.
const SCALE_WIDTH_PX = 140;
const SNAP_PX = 8;
const SNAP_THRESHOLD_MS = (SNAP_PX / SCALE_WIDTH_PX) * 1000;

const soundActionId = (index: number): string => `sound-${index}`;
const soundIndexFromActionId = (id: string): number => Number(id.slice("sound-".length));

/**
 * Adapts `@xzdarcy/react-timeline-editor` to Telekinesis's *sequential*
 * timesheet: `layoutTimesheet` projects the sequence onto absolute time, one
 * lane (row) per effect category, plus a derived `sound` lane for any clip
 * carrying a `soundProfile`. The array order stays authoritative — reordering
 * happens in `ReorderStrip` (a separate, dedicated surface — see its module
 * doc for why); this component owns visualizing lanes, the playhead
 * (scrubbing via the Studio bridge's `seek`), and trailing-edge duration
 * resize with snapping.
 */
export function Timeline({
  sheet,
  selectedIndex,
  onSelect,
  playheadMs,
  totalMs,
  onScrub,
  onScrubStart,
  onResize,
  onToggleMute,
}: {
  sheet: Timesheet;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  /** Current playhead position (ms), owned by the parent so the range input and RTE's cursor stay in sync. */
  playheadMs: number;
  totalMs: number;
  /** Fires continuously while scrubbing (range input drag, RTE cursor drag, or a ruler click). */
  onScrub: (ms: number) => void;
  /** Fires once when a scrub gesture begins — the parent uses this to stop any in-flight `play()`. */
  onScrubStart: () => void;
  onResize: (index: number, durationMs: number) => void;
  onToggleMute: (index: number) => void;
}) {
  const rteRef = useRef<TimelineState>(null);

  const { editorData, effects, layout } = useMemo(() => {
    const layout = layoutTimesheet(sheet);
    const rows: TimelineRow[] = EFFECT_LANES.map((lane) => ({
      id: lane,
      actions: layout.items
        .filter((it) => it.lane === lane)
        .map((it) => ({
          id: String(it.index),
          start: it.start / 1000,
          end: it.end / 1000,
          effectId: it.effect.action,
          movable: false,
          flexible: RESIZABLE_ACTIONS.has(it.effect.action),
        })),
    }));
    const soundRow: TimelineRow = {
      id: "sound",
      actions: layout.items
        .filter((it) => SOUND_CAPABLE.has(it.effect.action))
        .map((it) => ({
          id: soundActionId(it.index),
          start: it.start / 1000,
          end: it.end / 1000,
          effectId: "sound",
          movable: false,
          flexible: false,
        })),
    };
    const uniq = [...new Set(layout.items.map((i) => i.effect.action))];
    const fx: Record<string, TimelineEffect> = Object.fromEntries(uniq.map((a) => [a, { id: a, name: a }]));
    fx.sound = { id: "sound", name: "sound" };
    return { editorData: [...rows, soundRow], effects: fx, layout };
  }, [sheet]);

  // Keep RTE's internal cursor in sync with the app-owned playhead (range
  // input drags, clip-select jumps, etc). `setTime` is imperative and does
  // not itself fire `onCursorDrag`, so this can't loop.
  useEffect(() => {
    rteRef.current?.setTime(playheadMs / 1000);
  }, [playheadMs]);

  return (
    <div className="tk-timeline">
      <div className="tk-playhead-bar">
        <label className="tk-playhead-label" htmlFor="tk-playhead-range">
          Playhead
        </label>
        <input
          id="tk-playhead-range"
          type="range"
          className="tk-playhead-range"
          min={0}
          max={Math.max(totalMs, 1)}
          step={10}
          value={Math.min(playheadMs, Math.max(totalMs, 1))}
          onPointerDown={onScrubStart}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-valuetext={`${formatClock(playheadMs)} of ${formatClock(totalMs)}`}
        />
        <span className="tk-time-readout" aria-hidden>
          {formatClock(playheadMs)} / {formatClock(totalMs)}
        </span>
      </div>

      <div className="tk-lanes-row">
        <div className="tk-lane-labels">
          {LANE_LABELS.map((l) => (
            <div key={l.id} className="tk-lane-label" style={{ color: l.color }}>
              {l.id}
            </div>
          ))}
        </div>
        <RTE
          ref={rteRef}
          editorData={editorData}
          effects={effects}
          autoScroll
          scale={1}
          scaleWidth={SCALE_WIDTH_PX}
          startLeft={16}
          rowHeight={34}
          onClickAction={(_e, { action }) => {
            if (action.effectId === "sound") {
              const index = soundIndexFromActionId(String(action.id));
              onSelect(index);
              onToggleMute(index);
              return;
            }
            onSelect(Number(action.id));
          }}
          onCursorDragStart={() => onScrubStart()}
          onCursorDrag={(time) => onScrub(time * 1000)}
          onClickTimeArea={(time) => {
            onScrubStart();
            onScrub(time * 1000);
            return true;
          }}
          onActionResizeStart={() => onScrubStart()}
          onActionResizing={({ dir }) => (dir === "left" ? false : undefined)}
          onActionResizeEnd={({ action, start, end, dir }) => {
            if (dir !== "right" || action.effectId === "sound") return;
            const index = Number(action.id);
            const item = layout.items[index];
            if (!item) return;
            const neighborEdges = layout.items
              .filter((_, i) => i !== index)
              .flatMap((it) => [it.start, it.end]);
            const proposedEndMs = end * 1000;
            const newDuration = resizeDurationMs(start * 1000, proposedEndMs, neighborEdges, {
              thresholdMs: SNAP_THRESHOLD_MS,
              minDurationMs: 50,
            });
            onResize(index, Math.round(newDuration));
          }}
          getActionRender={(action: TimelineAction) => {
            if (action.effectId === "sound") {
              const index = soundIndexFromActionId(String(action.id));
              const effect = sheet.timeline[index] as unknown as Record<string, unknown> | undefined;
              const profile = effect?.soundProfile as SoundProfile | undefined;
              const label = profile ? SOUND_PROFILES[profile].label : "Silent";
              return (
                <button
                  type="button"
                  className="tk-sound-clip"
                  data-muted={!profile}
                  aria-pressed={profile != null}
                  aria-label={`Sound for clip ${index + 1}: ${profile ? label : "muted"}. Activate to ${profile ? "mute" : "add sound"}.`}
                  title={profile ? `${label} — click to mute` : "No sound — click to add"}
                  onClick={() => {
                    onSelect(index);
                    onToggleMute(index);
                  }}
                >
                  <span aria-hidden>{profile ? "♪" : "∅"}</span>
                  <span className="tk-sound-label">{label}</span>
                </button>
              );
            }
            const index = Number(action.id);
            const lane = LANE_OF[action.effectId as EffectAction];
            const selected = index === selectedIndex;
            return (
              <button
                type="button"
                className="tk-clip"
                style={{ background: LANE_COLOR[lane] }}
                aria-current={selected ? "true" : undefined}
                aria-label={`${action.effectId} clip in the ${lane} lane${selected ? ", selected" : ""}`}
                onClick={() => onSelect(index)}
              >
                {action.effectId}
              </button>
            );
          }}
        />
      </div>
    </div>
  );
}
