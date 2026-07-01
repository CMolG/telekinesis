import * as React from "react";
import { TelekineticFrame, TelekinesisStage, play } from "@telekinesis/core";
import { demoTimesheet } from "./demo";

interface Plan {
  id: string;
  name: string;
  price: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    tagline: "For tinkering",
    features: ["1 project", "720p exports", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    tagline: "For shipping teams",
    features: ["Unlimited projects", "4K exports", "AI timesheets", "Priority support"],
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$99",
    tagline: "For studios",
    features: ["SSO & SAML", "Custom asset packs", "On-prem recorder"],
  },
];

export default function App(): React.ReactElement {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loggedIn, setLoggedIn] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const runDemo = async () => {
    abortRef.current?.abort();
    setEmail("");
    setPassword("");
    setLoggedIn(false);
    setSelected(null);

    const controller = new AbortController();
    abortRef.current = controller;
    setPlaying(true);
    try {
      await play(demoTimesheet, { mode: "self", sound: false, signal: controller.signal });
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
          <span className="logo">◑</span> Telekinesis <span className="muted">playground</span>
        </div>
        <button className="play" onClick={runDemo} disabled={playing}>
          {playing ? "● Recording…" : "▶ Play demo"}
        </button>
      </header>

      <main className="content">
        <section className="hero">
          <h1>Your app records its own demo.</h1>
          <p className="lead">
            Click <strong>Play demo</strong> and watch the ghost cursor zoom, spotlight,
            type and click — exactly what Playwright will capture as a video.
          </p>
        </section>

        <TelekineticFrame id="pricing" intent="pricing-table" className="pricing">
          {plans.map((plan) => {
            const card = (
              <div className={`card${plan.featured ? " featured" : ""}${selected === plan.id ? " selected" : ""}`}>
                {plan.featured && <div className="ribbon">Most popular</div>}
                <h3>{plan.name}</h3>
                <p className="tagline">{plan.tagline}</p>
                <div className="price">
                  {plan.price}
                  <span>/mo</span>
                </div>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {plan.featured ? (
                  <TelekineticFrame id="tier-pro-cta" intent="primary-action">
                    <button className="cta" onClick={() => setSelected(plan.id)}>
                      {selected === plan.id ? "Selected ✓" : "Choose Pro"}
                    </button>
                  </TelekineticFrame>
                ) : (
                  <button className="cta ghost" onClick={() => setSelected(plan.id)}>
                    Choose {plan.name}
                  </button>
                )}
              </div>
            );

            return plan.featured ? (
              <TelekineticFrame key={plan.id} id="tier-pro" intent="primary-plan" allowZoom>
                {card}
              </TelekineticFrame>
            ) : (
              <React.Fragment key={plan.id}>{card}</React.Fragment>
            );
          })}
        </TelekineticFrame>

        <section className="login">
          <h2>Create your account</h2>
          <label className="field">
            <span>Email</span>
            <TelekineticFrame id="email" intent="email-field">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </TelekineticFrame>
          </label>

          <label className="field">
            <span>Password</span>
            <TelekineticFrame id="password" intent="password-field">
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </TelekineticFrame>
          </label>

          <TelekineticFrame id="login" intent="submit">
            <button className="cta block" onClick={() => setLoggedIn(true)}>
              Start recording
            </button>
          </TelekineticFrame>

          {loggedIn && (
            <TelekineticFrame id="welcome" intent="success">
              <div className="welcome">
                🎬 Welcome aboard, {email || "friend"}! Your studio is ready.
              </div>
            </TelekineticFrame>
          )}
        </section>
      </main>

      <footer className="foot">
        Tip: open with <code>?demo</code> or under Playwright and{" "}
        <code>&lt;TelekinesisStage autoplay /&gt;</code> records itself.
      </footer>
    </div>
  );
}
