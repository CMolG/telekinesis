import type { Effect, EffectAction, SoundProfile } from "@telekinesis/schema";
import { EFFECT_ACTIONS, SOUND_PROFILES, SOUND_PROFILE_IDS } from "@telekinesis/schema";

/**
 * A pragmatic, schema-aware inspector for the selected effect. It edits the
 * common fields plus the ones that matter per action; every change is validated
 * by re-parsing the whole timesheet upstream.
 */
export function Inspector({
  effect,
  frameIds,
  onChange,
  onDelete,
}: {
  effect: Effect | null;
  frameIds: string[];
  onChange: (next: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  if (!effect) {
    return <div className="tk-inspector tk-empty">Select a clip to edit it.</div>;
  }
  const e = effect as Record<string, unknown>;
  const set = (patch: Record<string, unknown>) => onChange({ ...e, ...patch });

  const num = (key: string, label: string, step = 50) => (
    <label className="tk-field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={(e[key] as number) ?? ""}
        onChange={(ev) => set({ [key]: ev.target.value === "" ? undefined : Number(ev.target.value) })}
      />
    </label>
  );

  const frameSelect = (key: string, label: string) => (
    <label className="tk-field">
      <span>{label}</span>
      <select value={(e[key] as string) ?? ""} onChange={(ev) => set({ [key]: ev.target.value || undefined })}>
        <option value="">—</option>
        {frameIds.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
    </label>
  );

  const action = effect.action;
  const hasFrame = "frameId" in e;
  const hasDest = action === "cursor-move" || action === "drag-and-drop";
  const hasDuration = action !== "click" && action !== "type-down";
  /** Every action except `wait` can carry a `soundProfile` (schema-enforced). */
  const hasSound = action !== "wait";

  return (
    <div className="tk-inspector">
      <label className="tk-field">
        <span>Action</span>
        <select value={action} onChange={(ev) => onChange({ action: ev.target.value as EffectAction })}>
          {EFFECT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>

      {hasFrame && frameSelect("frameId", "Target frame")}
      {hasDest && frameSelect("destFrameId", "Destination frame")}

      {action === "type-down" && (
        <>
          <label className="tk-field">
            <span>Text</span>
            <input value={(e.text as string) ?? ""} onChange={(ev) => set({ text: ev.target.value })} />
          </label>
          {num("typingSpeed", "Typing speed (ms/char)", 5)}
        </>
      )}

      {action === "zoom-in" && num("scale", "Scale", 0.05)}

      {hasDuration && num("duration", "Duration (ms)")}
      {num("delayBefore", "Delay before (ms)")}
      {num("delayAfter", "Delay after (ms)")}

      {hasSound && (
        <label className="tk-field">
          <span>Sound</span>
          <select
            value={(e.soundProfile as string) ?? ""}
            onChange={(ev) => set({ soundProfile: (ev.target.value || undefined) as SoundProfile | undefined })}
          >
            <option value="">— (silent)</option>
            {SOUND_PROFILE_IDS.map((id) => (
              <option key={id} value={id}>
                {SOUND_PROFILES[id].label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="tk-field">
        <span>Note</span>
        <input value={(e.note as string) ?? ""} onChange={(ev) => set({ note: ev.target.value || undefined })} />
      </label>

      <button className="tk-danger" onClick={onDelete} type="button">Delete clip</button>
    </div>
  );
}
