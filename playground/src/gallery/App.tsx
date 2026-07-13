import * as React from "react";
import { rectCenter, TelekineticFrame, TelekinesisStage, type Point } from "@telekinesis/core";

/**
 * The effects gallery — a single compact 960×540 stage built to be filmed,
 * one micro-timesheet per effect (see `examples/gallery/*.timesheet.json`).
 * Every frame id here is load-bearing: it's the exact string those
 * timesheets target, so don't rename one without updating its sheet(s).
 *
 * Layout contract (see the plan/task notes): the four interactive sets —
 * the CTA card, the input, the draggable list and the success badge — all
 * sit inside the initial 960×540 viewport (no scrolling required to reach
 * them). `gal-article` is the one set allowed to run long: it starts near
 * the fold and extends hundreds of pixels further down, giving
 * `scroll-down`/`scroll-up` real headroom to travel through.
 */
export default function GalleryApp(): React.ReactElement {
  return (
    <div className="page">
      <TelekinesisStage />

      <header className="toolbar">
        <div className="brand">
          <span className="logo">◑</span> Telekinesis <span className="muted">gallery</span>
        </div>
        <p className="gallery-kicker">11 effects, one page, one camera.</p>
      </header>

      <main className="gallery-stage">
        <div className="gallery-row">
          <TelekineticFrame id="gal-card" intent="cta-card" allowZoom className="gallery-set">
            <div className="gallery-cta-card">
              <h3>Ship the recording</h3>
              <p className="tagline">One click, camera-ready.</p>
              <TelekineticFrame id="gal-cta" intent="primary-action">
                <button type="button" className="cta">
                  Launch demo
                </button>
              </TelekineticFrame>
            </div>
          </TelekineticFrame>

          <section className="gallery-set gallery-input-card">
            <span className="gallery-set-label">Quick note</span>
            <TelekineticFrame id="gal-input" intent="text-field">
              <input type="text" placeholder="Type here…" aria-label="Quick note" />
            </TelekineticFrame>
          </section>

          <section className="gallery-set gallery-drag-card">
            <span className="gallery-set-label">Backlog → Done</span>
            <DragDemo />
          </section>
        </div>

        <div className="gallery-badge-row">
          <TelekineticFrame id="gal-done" intent="success-badge">
            <div className="gallery-badge">✓ Synced</div>
          </TelekineticFrame>
        </div>
      </main>

      <TelekineticFrame
        id="gal-article"
        intent="long-read"
        as="article"
        className="gallery-article"
      >
        <h2>Why the camera never lies</h2>
        <p>
          Screenshots freeze a single instant and ask you to trust everything around it. A
          recording proves the whole journey — the cursor actually traveled there, the field
          was actually typed into, the click actually landed. That is the premise of this
          entire page: nothing below is hand-drawn or edited after the fact.
        </p>
        <p>
          Every clip in the gallery is filmed exactly the way it plays: a JSON timesheet
          describes a handful of steps — travel here, click that, wait a beat — and{" "}
          <code>@telekinesis/core</code> performs them for real, in a real DOM, inside a real
          headless browser.
        </p>
        <blockquote>
          "If it's not driven by data, it's not a Telekinesis clip." — the one rule this page
          can't break.
        </blockquote>
        <p>
          That is also why this gallery is deliberately small: five self-contained sets, a
          handful of pixels each, built to survive being shrunk down into a shareable GIF. High
          contrast over subtlety, a handful of colors over a whole palette.
        </p>
        <p>Eleven actions, three families:</p>
        <ul>
          <li>Interactions — click, type-down, drag-and-drop, shake</li>
          <li>Camera &amp; navigation — zoom-in, zoom-out, scroll-up, scroll-down, cursor-move</li>
          <li>Annotation &amp; pacing — highlight, wait</li>
        </ul>
        <p>
          Scroll back up, open this page with <code>?demo</code> in the URL, and run any
          timesheet from <code>examples/gallery/</code> straight from the console:{" "}
          <code>__telekinesis.play(sheet)</code> replays this page's timesheets live, right in
          your browser.
        </p>
        <p>
          You've now reached the bottom of the one set on this page tall enough to need
          scrolling — which is the whole point: <code>scroll-down</code> and{" "}
          <code>scroll-up</code> need real headroom to travel through, so this paragraph exists
          mostly to give them somewhere to go.
        </p>
      </TelekineticFrame>

      <footer className="foot gallery-foot">
        Every clip above is <code>examples/gallery/*.timesheet.json</code>, played for real —
        nothing here is a hand-edited GIF.
      </footer>
    </div>
  );
}

/**
 * The one pair on this page with real behavior instead of static chrome:
 * `gal-drag-src`'s chip is a plain pointer-driven drag — `pointerdown`
 * captures the pointer on the chip itself, then `pointermove`/`pointerup`
 * (plus `pointercancel`/`lostpointercapture`) — deliberately *not* HTML5
 * `draggable`, because Playwright's `Locator.dragTo()` drives a drag purely
 * by dispatching real mouse input, which Chromium synthesizes into real
 * Pointer Events the same way genuine hardware would (see
 * `packages/engine/src/record.ts`); a native HTML5 drag needs `dragstart`/
 * `dragover`/`drop`, which that never fires. Everything else in the gallery
 * is inert chrome the camera performs *around* — this is the one set that
 * has to actually respond when the recorder really drags it, so the
 * `drag-and-drop` gallery clip shows the card moving, not just the ghost
 * cursor.
 *
 * On a successful drop the chip is translated (not re-parented) so it sits
 * centered over the dropzone — simpler and more robust than moving the DOM
 * node between frames, and the dropzone gets a "filled" style to read as
 * occupied.
 */
function DragDemo(): React.ReactElement {
  const [offset, setOffset] = React.useState<Point | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [dropped, setDropped] = React.useState(false);
  const dropRef = React.useRef<HTMLDivElement | null>(null);
  // Removes the in-flight drag's chip listeners (pointermove/up/cancel/
  // lostpointercapture). Set for the duration of a drag, cleared once it
  // ends; both a normal end and the unmount effect below may call it, so
  // it's idempotent (removeEventListener on an already-removed listener is
  // a no-op) and clears itself.
  const removeDragListenersRef = React.useRef<(() => void) | null>(null);

  // Safety net for a drag interrupted by unmount (this component removed
  // from the tree — e.g. a route change — mid-drag, before pointerup/
  // pointercancel ever fires). Without this the chip's listeners would
  // outlive the component; no need to also touch React state here — an
  // unmounted component has nothing left to render.
  React.useEffect(() => {
    return () => removeDragListenersRef.current?.();
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    if (dropped) return; // settled — this demo only plays once
    // Reentrancy/input guards: `dragging` blocks a second pointer from
    // starting a concurrent drag session while one is already in flight
    // (which would attach a second, independent set of listeners onto the
    // same chip); `isPrimary`/`button` restrict this to a single primary
    // contact point via the primary (left) mouse button, same as any other
    // drag-initiating control.
    if (dragging || !e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    const chip = e.currentTarget;
    const pointerId = e.pointerId;
    const startPointer: Point = { x: e.clientX, y: e.clientY };
    const startOffset: Point = offset ?? { x: 0, y: 0 };
    chip.setPointerCapture(pointerId);
    setDragging(true);

    // Pointer capture retargets every later event for *this* pointerId to
    // `chip`, wherever the pointer physically is — so these listen on the
    // chip itself, not `window`: a real drag released outside the viewport
    // still delivers pointerup here instead of leaving the chip stuck.
    // Capture only retargets the captured pointer's own events though — it
    // doesn't stop some other, uncaptured pointer (a second finger, say)
    // from also dispatching pointermove/up/cancel at the chip mid-drag — so
    // every handler below re-checks `ev.pointerId` against the pointer that
    // actually started this drag before acting on it.
    const handleMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      setOffset({
        x: startOffset.x + (ev.clientX - startPointer.x),
        y: startOffset.y + (ev.clientY - startPointer.y),
      });
    };

    const removeDragListeners = () => {
      chip.removeEventListener("pointermove", handleMove);
      chip.removeEventListener("pointerup", handleUp);
      chip.removeEventListener("pointercancel", handleCancel);
      chip.removeEventListener("lostpointercapture", handleCancel);
      removeDragListenersRef.current = null;
    };

    const endDrag = (settle: boolean) => {
      removeDragListeners();
      setDragging(false);

      const chipRect = chip.getBoundingClientRect();
      const dropRect = dropRef.current?.getBoundingClientRect();
      if (settle && dropRect && centerInside(chipRect, dropRect)) {
        // Settle exactly centered over the dropzone, whatever offset got it
        // there — an additive correction on top of the live drag offset.
        const chipCenter = rectCenter(chipRect);
        const dropCenter = rectCenter(dropRect);
        setOffset((prev) => {
          const cur = prev ?? { x: 0, y: 0 };
          return {
            x: cur.x + (dropCenter.x - chipCenter.x),
            y: cur.y + (dropCenter.y - chipCenter.y),
          };
        });
        setDropped(true);
      } else {
        setOffset(null); // missed the dropzone, or the drag was cancelled
      }
    };

    const handleUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      endDrag(true);
    };
    // pointercancel (browser-initiated, e.g. a gesture takeover) and
    // lostpointercapture (capture released for any other reason without an
    // up/cancel) both mean the drag ended without a real drop: snap back,
    // same as missing the dropzone.
    const handleCancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      endDrag(false);
    };

    chip.addEventListener("pointermove", handleMove);
    chip.addEventListener("pointerup", handleUp);
    chip.addEventListener("pointercancel", handleCancel);
    chip.addEventListener("lostpointercapture", handleCancel);
    removeDragListenersRef.current = removeDragListeners;
  }

  return (
    <div className="gallery-drag-row">
      <TelekineticFrame id="gal-drag-src" intent="draggable-item">
        <div
          className={"gallery-chip" + (dragging ? " dragging" : "") + (dropped ? " dropped" : "")}
          style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
          onPointerDown={handlePointerDown}
        >
          Record demo
        </div>
      </TelekineticFrame>
      <span className="gallery-drag-arrow" aria-hidden="true">
        →
      </span>
      <TelekineticFrame id="gal-drag-dest" intent="drop-zone">
        <div ref={dropRef} className={"gallery-dropzone" + (dropped ? " filled" : "")}>
          {/* Stays mounted always — only visually hidden via CSS
              (.filled .gallery-dropzone-label) once dropped — so the
              dropzone's own content-based box never changes size on drop.
              Unmounting this text used to collapse the box (its shrink-to-fit
              width/height both hug content) right as the settle math below
              measures this same rect. See the .filled rule in styles.css. */}
          <span className="gallery-dropzone-label">Drop here</span>
        </div>
      </TelekineticFrame>
    </div>
  );
}

/** Is `inner`'s center point inside `outer`? The standard "did you drop it here" test. */
function centerInside(inner: DOMRect, outer: DOMRect): boolean {
  const c = rectCenter(inner);
  return c.x >= outer.left && c.x <= outer.right && c.y >= outer.top && c.y <= outer.bottom;
}
