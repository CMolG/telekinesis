import { setForcedDemoMode } from "@telekinesis/core";
import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// The playground always runs in demo mode so the cinematic layer is live and
// the "Play demo" button works without a `?demo` query param.
setForcedDemoMode(true);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
