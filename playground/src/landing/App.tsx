import * as React from "react";
import { TelekineticFrame, TelekinesisStage, play } from "@telekinesis/core";
import { landingTimesheet } from "./demo";

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    id: "feature-cinematic",
    icon: "🎥",
    title: "Cinematic effects",
    description:
      "Ghost-cursor moves, spotlight highlights and eased zooms — the same camera language editors reach for, driven entirely by data.",
  },
  {
    id: "feature-ai",
    icon: "🤖",
    title: "AI-authored timesheets",
    description:
      "Describe the tour you want and let an MCP-connected agent author the timesheet — every zoom, click and keystroke included.",
  },
  {
    id: "feature-ci",
    icon: "⚙️",
    title: "CI-friendly recording",
    description:
      "Runs headless under Playwright and mixes narration with ffmpeg, so a polished MP4 ships on every merge — no manual screen capture.",
  },
];

export default function LandingApp(): React.ReactElement {
  const [email, setEmail] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const scrollToWaitlist = () => {
    document.getElementById("waitlist-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const runDemo = async () => {
    abortRef.current?.abort();
    setEmail("");
    setJoined(false);

    const controller = new AbortController();
    abortRef.current = controller;
    setPlaying(true);
    try {
      await play(landingTimesheet, { mode: "self", sound: false, signal: controller.signal });
    } catch {
      /* aborted */
    } finally {
      if (abortRef.current === controller) setPlaying(false);
    }
  };

  return (
    <div className="page">
      <TelekinesisStage />

      <header className="toolbar">
        <div className="brand">
          <span className="logo">◑</span> Telekinesis
        </div>
        <nav className="nav-links">
          <a href="#features-section">Features</a>
          <a href="#waitlist-section">Waitlist</a>
        </nav>
        <div className="nav-actions">
          <TelekineticFrame id="nav-cta" intent="nav-action">
            <button className="cta small" onClick={scrollToWaitlist}>
              Get started
            </button>
          </TelekineticFrame>
          <button className="play" onClick={runDemo} disabled={playing}>
            {playing ? "● Recording…" : "▶ Play demo"}
          </button>
        </div>
      </header>

      <main className="content">
        <TelekineticFrame id="hero" intent="hero-section" className="hero" as="section">
          <div className="hero-copy">
            <span className="eyebrow">Self-recording demo engine</span>
            <h1>Your product can film its own demo.</h1>
            <p className="lead">
              Wrap any region in a <code>&lt;TelekineticFrame&gt;</code>, mount{" "}
              <code>&lt;TelekinesisStage /&gt;</code>, and Telekinesis choreographs the
              zooms, spotlights, ghost-cursor moves and typing — captured straight to
              video by Playwright.
            </p>
            <div className="hero-actions">
              <TelekineticFrame id="hero-cta" intent="primary-action" allowZoom>
                <button className="cta" onClick={scrollToWaitlist}>
                  Start recording free
                </button>
              </TelekineticFrame>
              <a className="cta ghost" href="#features-section">
                See how it works
              </a>
            </div>
            <p className="hero-meta">Zero-cost for real users · MIT licensed · No new dependencies</p>
          </div>

          <TelekineticFrame id="hero-visual" intent="preview-card">
            <div className="visual-card">
              <div className="visual-card-bar">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="visual-card-body">
                <span className="play-icon">▶</span>
                <p>Cinematic demo preview</p>
                <div className="visual-card-progress">
                  <span />
                </div>
              </div>
            </div>
          </TelekineticFrame>
        </TelekineticFrame>

        <section id="features-section">
          <TelekineticFrame id="features" intent="feature-grid" className="features">
            {features.map((feature) => (
              <TelekineticFrame key={feature.id} id={feature.id} intent="feature-card" allowZoom>
                <div className="feature-card">
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </TelekineticFrame>
            ))}
          </TelekineticFrame>
        </section>

        <section id="waitlist-section">
          <TelekineticFrame id="waitlist" intent="waitlist-form" className="waitlist">
            <h2>Be first to record with Telekinesis</h2>
            <p className="lead">
              Join the waitlist for early access to the hosted recording cloud and the
              AI timesheet generator.
            </p>
            <div className="waitlist-form">
              <TelekineticFrame id="waitlist-email" intent="email-field">
                <input
                  type="email"
                  placeholder="you@company.com"
                  aria-label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </TelekineticFrame>
              <TelekineticFrame id="waitlist-submit" intent="submit">
                <button className="cta" onClick={() => setJoined(true)}>
                  Join the waitlist
                </button>
              </TelekineticFrame>
            </div>

            {joined && (
              <TelekineticFrame id="waitlist-success" intent="success">
                <div className="success">
                  🎬 You're on the list! We'll email {email || "you"} the moment the beta opens.
                </div>
              </TelekineticFrame>
            )}
          </TelekineticFrame>
        </section>
      </main>

      <footer className="foot">
        © {new Date().getFullYear()} Telekinesis — this page recorded its own demo with{" "}
        <code>&lt;TelekinesisStage /&gt;</code>.
      </footer>
    </div>
  );
}
