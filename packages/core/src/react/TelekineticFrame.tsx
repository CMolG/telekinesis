import * as React from "react";
import { isDemoMode } from "../detect";
import { registryStore } from "../registry";
import { useIsomorphicLayoutEffect } from "./useIsomorphicLayoutEffect";

export interface TelekineticFrameProps {
  /** Stable id used by the timesheet to target this node. */
  id: string;
  /** Optional hint for AI timesheet generation, e.g. `"primary-action"`. */
  intent?: string;
  /** Whether the camera may zoom onto this frame. */
  allowZoom?: boolean;
  /** Element/component to render in demo mode (default `"div"`). */
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Marks a region of the UI as cinematically controllable.
 *
 * - **User mode** (real visitors): renders a transparent fragment — zero DOM,
 *   zero cost, zero behavior change.
 * - **Demo mode** (Playwright / `?demo`): renders a measurable wrapper carrying
 *   `data-telekinesis-id` and registers itself so the engine can find, zoom,
 *   highlight and click it.
 */
export function TelekineticFrame({
  id,
  intent,
  allowZoom = true,
  as,
  className,
  style,
  children,
}: TelekineticFrameProps): React.ReactElement {
  const [demo, setDemo] = React.useState(false);
  const ref = React.useRef<HTMLElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (isDemoMode()) setDemo(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!demo) return;
    const el = ref.current;
    if (!el) return;
    registryStore.getState().register({ id, intent, allowZoom, element: el });
    return () => registryStore.getState().unregister(id);
  }, [demo, id, intent, allowZoom]);

  // User mode: completely transparent passthrough.
  if (!demo) return <>{children}</>;

  const Tag = (as ?? "div") as React.ElementType;
  return (
    <Tag
      // ref typing across arbitrary element/component types is intentionally loose
      ref={ref as unknown as React.Ref<HTMLElement>}
      data-telekinesis-id={id}
      data-telekinesis-intent={intent}
      data-telekinesis-frame=""
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
}
