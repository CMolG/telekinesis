import * as React from "react";
import { TelekineticFrame, TelekinesisStage } from "@telekinesis/core";

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
 * `gal-drag-src`'s chip is a plain pointer-driven drag — mousedown, then
 * window-level mousemove/mouseup while dragging — deliberately *not* HTML5
 * `draggable`, because Playwright's `Locator.dragTo()` drives a drag purely
 * by dispatching real mousedown/mousemove/mouseup (see
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
  const chipRef = React.useRef<HTMLDivElement | null>(null);
  const dropRef = React.useRef<HTMLDivElement | null>(null);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (dropped) return; // settled — this demo only plays once
    e.preventDefault();
    const startPointer: Point = { x: e.clientX, y: e.clientY };
    const startOffset: Point = offset ?? { x: 0, y: 0 };
    setDragging(true);

    const handleMove = (ev: MouseEvent) => {
      setOffset({
        x: startOffset.x + (ev.clientX - startPointer.x),
        y: startOffset.y + (ev.clientY - startPointer.y),
      });
    };

    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      setDragging(false);

      const chipRect = chipRef.current?.getBoundingClientRect();
      const dropRect = dropRef.current?.getBoundingClientRect();
      if (chipRect && dropRect && centerInside(chipRect, dropRect)) {
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
        setOffset(null); // missed the dropzone — snap back home
      }
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  return (
    <div className="gallery-drag-row">
      <TelekineticFrame id="gal-drag-src" intent="draggable-item">
        <div
          ref={chipRef}
          className={
            "gallery-chip" +
            (dragging ? " is-dragging" : "") +
            (dropped ? " is-dropped" : "")
          }
          style={offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
          onMouseDown={handleMouseDown}
        >
          Record demo
        </div>
      </TelekineticFrame>
      <span className="gallery-drag-arrow" aria-hidden="true">
        →
      </span>
      <TelekineticFrame id="gal-drag-dest" intent="drop-zone">
        <div ref={dropRef} className={"gallery-dropzone" + (dropped ? " is-filled" : "")}>
          {dropped ? "" : "Drop here"}
        </div>
      </TelekineticFrame>
    </div>
  );
}

interface Point {
  x: number;
  y: number;
}

function rectCenter(r: DOMRect): Point {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Is `inner`'s center point inside `outer`? The standard "did you drop it here" test. */
function centerInside(inner: DOMRect, outer: DOMRect): boolean {
  const c = rectCenter(inner);
  return c.x >= outer.left && c.x <= outer.right && c.y >= outer.top && c.y <= outer.bottom;
}
