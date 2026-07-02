import { useMemo } from "react";
import { Timeline as RTE } from "@xzdarcy/react-timeline-editor";
import type { TimelineAction, TimelineRow, TimelineEffect } from "@xzdarcy/timeline-engine";
import {
  EFFECT_LANES,
  LANE_OF,
  layoutTimesheet,
  type EffectAction,
  type EffectLane,
  type Timesheet,
} from "@telekinesis/schema";
import "@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css";

const LANE_COLOR: Record<EffectLane, string> = {
  timing: "#64748b",
  camera: "#7c5cff",
  navigation: "#0ea5e9",
  cursor: "#f59e0b",
  interaction: "#22c55e",
};

/**
 * Adapts `@xzdarcy/react-timeline-editor` to Telekinesis's *sequential*
 * timesheet: `layoutTimesheet` projects the sequence onto absolute time, one
 * lane (row) per effect category. The array order stays authoritative — editing
 * happens in the inspector and re-derives this view.
 */
export function Timeline({
  sheet,
  selectedIndex,
  onSelect,
}: {
  sheet: Timesheet;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const { editorData, effects } = useMemo(() => {
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
          flexible: false,
        })),
    }));
    const uniq = [...new Set(layout.items.map((i) => i.effect.action))];
    const fx: Record<string, TimelineEffect> = Object.fromEntries(
      uniq.map((a) => [a, { id: a, name: a }]),
    );
    return { editorData: rows, effects: fx };
  }, [sheet]);

  return (
    <div className="tk-timeline">
      <div className="tk-lane-labels">
        {EFFECT_LANES.map((l) => (
          <div key={l} className="tk-lane-label" style={{ color: LANE_COLOR[l] }}>{l}</div>
        ))}
      </div>
      <RTE
        editorData={editorData}
        effects={effects}
        autoScroll
        scale={1}
        scaleWidth={140}
        startLeft={16}
        rowHeight={34}
        onClickAction={(_e: unknown, param: { action: TimelineAction }) => onSelect(Number(param.action.id))}
        getActionRender={(action: TimelineAction) => {
          const lane = LANE_OF[action.effectId as EffectAction];
          const selected = String(action.id) === String(selectedIndex);
          return (
            <div className="tk-clip" data-selected={selected} style={{ background: LANE_COLOR[lane] }}>
              {action.effectId}
            </div>
          );
        }}
      />
    </div>
  );
}
