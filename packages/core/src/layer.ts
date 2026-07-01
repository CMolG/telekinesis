/**
 * The Telekinesis overlay layer.
 *
 * Mounted as a child of `<html>` (a sibling of `<body>`) on purpose: when the
 * zoom effect applies a `transform` to `<body>`, any `position: fixed`
 * descendant of body becomes positioned relative to body and would be zoomed
 * too. Living outside body keeps the cursor, ripples and spotlight rock-steady
 * in viewport space.
 */
let layerEl: HTMLElement | null = null;

export function getLayer(): HTMLElement {
  if (layerEl && layerEl.isConnected) return layerEl;
  const el = document.createElement("div");
  el.id = "telekinesis-layer";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483600",
    overflow: "visible",
  });
  (document.documentElement || document.body).appendChild(el);
  layerEl = el;
  return el;
}

export function destroyLayer(): void {
  layerEl?.remove();
  layerEl = null;
}
