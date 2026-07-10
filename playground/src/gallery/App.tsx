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
            <div className="gallery-drag-row">
              <TelekineticFrame id="gal-drag-src" intent="draggable-item">
                <div className="gallery-chip">Record demo</div>
              </TelekineticFrame>
              <span className="gallery-drag-arrow" aria-hidden="true">
                →
              </span>
              <TelekineticFrame id="gal-drag-dest" intent="drop-zone">
                <div className="gallery-dropzone">Drop here</div>
              </TelekineticFrame>
            </div>
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
