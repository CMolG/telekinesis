import { createStore } from "zustand/vanilla";
import { rectToJSON, type RectJSON } from "./geometry";

export interface FrameRecord {
  id: string;
  intent?: string;
  allowZoom: boolean;
  element: HTMLElement;
}

/** Serializable view of a frame (safe to return across `page.evaluate`). */
export interface FrameInfo {
  id: string;
  intent?: string;
  allowZoom: boolean;
  rect: RectJSON;
}

interface RegistryState {
  frames: Map<string, FrameRecord>;
  register: (rec: FrameRecord) => void;
  unregister: (id: string) => void;
}

/**
 * Global registry of mounted `<TelekineticFrame>`s. A vanilla Zustand store so
 * it works outside React too (the engine / runtime read it directly).
 */
export const registryStore = createStore<RegistryState>((set) => ({
  frames: new Map(),
  register: (rec) =>
    set((s) => {
      const frames = new Map(s.frames);
      frames.set(rec.id, rec);
      return { frames };
    }),
  unregister: (id) =>
    set((s) => {
      if (!s.frames.has(id)) return s;
      const frames = new Map(s.frames);
      frames.delete(id);
      return { frames };
    }),
}));

export function getFrame(id: string): FrameRecord | undefined {
  return registryStore.getState().frames.get(id);
}

export function getFrameElement(id: string): HTMLElement | null {
  return getFrame(id)?.element ?? null;
}

export function getFrameRect(id: string): DOMRect | null {
  const el = getFrameElement(id);
  return el ? el.getBoundingClientRect() : null;
}

export function listFrames(): FrameInfo[] {
  return [...registryStore.getState().frames.values()].map((f) => ({
    id: f.id,
    intent: f.intent,
    allowZoom: f.allowZoom,
    rect: rectToJSON(f.element.getBoundingClientRect()),
  }));
}
