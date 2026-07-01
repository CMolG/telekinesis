import { chromium } from "playwright";

export interface ExtractedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExtractedFrame {
  id: string;
  intent?: string;
  allowZoom: boolean;
  rect: ExtractedRect;
}

export interface ExtractOptions {
  headless?: boolean;
  /** Timeout (ms) waiting for the in-page runtime. */
  timeout?: number;
  viewport?: { width: number; height: number };
}

/**
 * Open a page, wait for the Telekinesis runtime, and return every registered
 * `<TelekineticFrame>` with its viewport rect. Used by the MCP server so an LLM
 * can see what's on screen before drafting a timesheet.
 */
export async function extractFrames(
  url: string,
  opts: ExtractOptions = {},
): Promise<ExtractedFrame[]> {
  const browser = await chromium.launch({ headless: opts.headless ?? true });
  try {
    const context = await browser.newContext({
      viewport: opts.viewport ?? { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        (window as unknown as { __telekinesis?: { ready?: boolean } }).__telekinesis
          ?.ready === true,
      undefined,
      { timeout: opts.timeout ?? 15_000 },
    );
    await page.waitForTimeout(300);
    const frames = (await page.evaluate(() =>
      (
        window as unknown as { __telekinesis: { listFrames(): ExtractedFrame[] } }
      ).__telekinesis.listFrames(),
    )) as ExtractedFrame[];
    return frames;
  } finally {
    await browser.close();
  }
}
