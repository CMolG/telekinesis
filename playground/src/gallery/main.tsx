import { setForcedDemoMode } from "@telekinesis/core";
import * as React from "react";
import { createRoot } from "react-dom/client";
import GalleryApp from "./App";
import "../styles.css";

// The gallery always runs in demo mode: it exists purely to be filmed (by
// the micro-timesheets in examples/gallery/), so the cinematic layer must be
// live for every visitor, exactly like the main playground and the landing
// demo.
setForcedDemoMode(true);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <React.StrictMode>
    <GalleryApp />
  </React.StrictMode>,
);
