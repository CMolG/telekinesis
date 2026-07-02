import { useRef, useState } from "react";
import type { Timesheet } from "@telekinesis/schema";
import { clampMove } from "./timeline-ops";

/**
 * Drag-to-reorder surface for the timeline.
 *
 * Why not drag clips directly in the `@xzdarcy/react-timeline-editor` lanes
 * below: RTE's `onActionMoveEnd` model is built for *free positioning in
 * continuous time within one row* (with collision detection against
 * neighbors in that same row). Our clips don't have independent positions —
 * `timeline[]`'s array order is the only source of truth, and
 * `layoutTimesheet` derives every clip's time from it. Reordering here means
 * "splice this element to a different array index," a different operation
 * that also has to work *across* lanes (a `camera` clip moving before a
 * `timing` clip). Bending RTE's same-row continuous-time drag into an
 * array-splice would mean fighting its collision/snap engine for a result it
 * wasn't designed to produce. A dedicated flat strip — one chip per clip, in
 * array order, native HTML5 drag-and-drop — models the actual data structure
 * directly and keeps RTE doing what it's good at (lanes, playhead, resize).
 *
 * Keyboard equivalent: focus a chip (Tab, or click) and press Alt+↑/↓. Chips
 * are keyed by object identity (not index), so React keeps the same DOM node
 * — and its focus — across a reorder instead of remounting at the new index.
 */
export function ReorderStrip({
  sheet,
  selectedIndex,
  onSelect,
  onReorder,
}: {
  sheet: Timesheet;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const idsRef = useRef(new WeakMap<object, string>());
  const nextIdRef = useRef(0);

  const keyFor = (effect: object): string => {
    let id = idsRef.current.get(effect);
    if (!id) {
      id = `clip-${nextIdRef.current++}`;
      idsRef.current.set(effect, id);
    }
    return id;
  };

  return (
    <ul className="tk-reorder-strip" aria-label="Clip order (drag to reorder, or focus a clip and press Alt+Up/Down)">
      {sheet.timeline.map((effect, index) => {
        const selected = index === selectedIndex;
        return (
          <li key={keyFor(effect)} className="tk-chip-wrap">
            <button
              type="button"
              className="tk-chip"
              draggable
              aria-current={selected ? "true" : undefined}
              data-drop-target={overIndex === index && dragIndex !== null && dragIndex !== index}
              aria-label={`${index + 1} of ${sheet.timeline.length}: ${effect.action}${selected ? " (selected)" : ""}`}
              onClick={() => onSelect(index)}
              onFocus={() => onSelect(index)}
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                // Firefox refuses to start a drag without data on the transfer.
                e.dataTransfer.setData("text/plain", String(index));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overIndex !== index) setOverIndex(index);
              }}
              onDragLeave={() => setOverIndex((cur) => (cur === index ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex ?? Number(e.dataTransfer.getData("text/plain"));
                setDragIndex(null);
                setOverIndex(null);
                if (Number.isFinite(from) && from !== index) onReorder(from, index);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onKeyDown={(e) => {
                if (!e.altKey) return;
                if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  const to = clampMove(index, -1, sheet.timeline.length);
                  if (to !== index) onReorder(index, to);
                } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const to = clampMove(index, 1, sheet.timeline.length);
                  if (to !== index) onReorder(index, to);
                }
              }}
            >
              <span className="tk-chip-index" aria-hidden>
                {index + 1}
              </span>
              <span className="tk-chip-label">{effect.action}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
