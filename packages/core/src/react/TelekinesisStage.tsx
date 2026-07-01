import * as React from "react";
import type { TimesheetInput } from "@telekinesis/schema";
import { isDemoMode } from "../detect";
import { play } from "../player";
import { installRuntime, type TelekinesisRuntime } from "../runtime";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

export interface TelekinesisStageProps {
  /** Auto-play `timesheet` (or `window.__TELEKINESIS_TIMESHEET__`) on mount. */
  autoplay?: boolean;
  timesheet?: TimesheetInput;
  sound?: boolean;
  soundBase?: string;
  /** Delay (ms) before autoplay, to let frames register. Default 500. */
  startDelay?: number;
  onReady?: (runtime: TelekinesisRuntime) => void;
  onComplete?: () => void;
}

/**
 * Mount once near the root of your app. In demo mode it installs the
 * `window.__telekinesis` runtime (so the recorder can drive the page) and,
 * when `autoplay` is set, performs the timesheet live in the browser. Renders
 * nothing and does nothing for real users.
 */
export function TelekinesisStage(props: TelekinesisStageProps): null {
  const [demo, setDemo] = React.useState(false);

  useIsomorphicLayoutEffect(() => {
    setDemo(isDemoMode());
  }, []);

  React.useEffect(() => {
    if (!demo) return;
    const runtime = installRuntime({ soundBase: props.soundBase });
    props.onReady?.(runtime);

    const injected = (window as unknown as Record<string, TimesheetInput>)
      .__TELEKINESIS_TIMESHEET__;
    const sheet = props.timesheet ?? injected;
    if (!props.autoplay || !sheet) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      play(sheet, {
        mode: "self",
        sound: props.sound,
        soundBase: props.soundBase,
        signal: controller.signal,
      })
        .then(() => props.onComplete?.())
        .catch(() => {
          /* aborted on unmount */
        });
    }, props.startDelay ?? 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
