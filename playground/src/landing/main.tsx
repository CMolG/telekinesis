import { setForcedDemoMode } from "@telekinesis/core";
import * as React from "react";
import { createRoot } from "react-dom/client";
import LandingApp from "./App";
import "./landing.css";

// The landing page always runs in demo mode so the cinematic layer is live and
// the "Play demo" button works without a `?demo` query param.
setForcedDemoMode(true);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>,
);
