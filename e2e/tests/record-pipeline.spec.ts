import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { record, type RecordResult } from "@telekinesis/engine";
import { mixAudio, toGif } from "@telekinesis/render";
import type { TimesheetInput } from "@telekinesis/schema";
import { ffprobeJson, hasFfmpeg } from "../helpers";

// The real, committed sound pack (`packages/cli/src/ffmpeg.ts`'s
// `defaultSoundsDir` resolves the same directory for the CLI) — not a
// fixture copy, so a renamed/missing asset breaks this spec the same way
// it'd break a real mix.
const soundsDir = fileURLToPath(new URL("../../packages/cli/assets/sounds", import.meta.url));

const RESOLUTION = { width: 960, height: 540 };

// Short on purpose: this sheet is encoded for real (browser + ffmpeg mix +
// ffmpeg gif) up to three times below, and each test still has to land
// inside the suite's 90s/test timeout. Mirrors the shape of the playground's
// own built-in ?demo sequence (playground/src/demo.ts), so every frameId
// referenced here is known-good.
const SHEET: TimesheetInput = {
  url: "http://localhost:4173/?demo",
  resolution: RESOLUTION,
  timeline: [
    { action: "wait", duration: 300 },
    { action: "zoom-in", frameId: "pricing", scale: 1.15, duration: 700 },
    { action: "cursor-move", destFrameId: "tier-pro-cta", duration: 500 },
    { action: "click", frameId: "tier-pro-cta", soundProfile: "macbook-trackpad" },
    { action: "zoom-out", duration: 500 },
  ],
};

test.describe("record → mix → gif pipeline", () => {
  // One recording, three stages: record's webm is the input of *both*
  // mixAudio and toGif — mirroring every production call site (the CLI's
  // record.ts/gif.ts commands, the Studio sidecar's export route and
  // apps/docs/scripts/record-sections.ts all feed toGif `result.videoPath`,
  // the recorder's webm, directly; GIFs carry no audio, so the mix stage is
  // a sibling consumer, not a prerequisite). Serial mode keeps that shared
  // artifact flowing through one temp dir *and* means a "record" failure
  // skips the downstream stages automatically, instead of them crashing on
  // an undefined `recordResult`.
  test.describe.configure({ mode: "serial" });

  let outDir: string;
  // Definite-assignment (`!`): written by "record", read by the two tests
  // after it. Safe because serial mode guarantees "record" finishes (or the
  // whole group stops on its failure) before the downstream tests start.
  let recordResult!: RecordResult;

  test.beforeAll(async () => {
    outDir = await mkdtemp(path.join(tmpdir(), "tk-record-pipeline-"));
  });

  test.afterAll(async () => {
    // Best-effort: a failed cleanup shouldn't fail the run.
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  });

  test("record produces a webm and a coherent audio map", async () => {
    test.skip(!(await hasFfmpeg()), "ffmpeg not on PATH");

    recordResult = await record(SHEET, { outDir, headless: true });

    // A 960x540 webm of ~3s of real UI motion measured ~570-640KB across
    // repeated recordings of this sheet — the 20KB floor sits ~30x below
    // that, so it only trips on a catastrophic recorder failure (empty or
    // near-empty capture), never on ordinary encode variance.
    expect((await stat(recordResult.videoPath)).size).toBeGreaterThan(20_000);

    // Only the "click" step sets a soundProfile — wait/zoom-in/cursor-move/
    // zoom-out are silent — so exactly one mark is expected.
    expect(recordResult.audioMap.marks).toHaveLength(1);
    expect(recordResult.audioMap.marks[0].profile).toBe("macbook-trackpad");

    // The click's mark is stamped after its own visual resolves — cursor
    // snap (180ms) + press pulse (260ms) + ripple (770ms, showRipple
    // defaults true; see core/effects.ts's click case and overlay.ts's
    // RIPPLE_RINGS) — plus the real Playwright click, all *after* the prior
    // timeline: wait(300) + zoom-in(700) + cursor-move(500, plus its
    // overshoot settle of up to 420ms — SETTLE_MAX_DURATION_MS in
    // core/cursor.ts, always triggered here since the travel far exceeds
    // MIN_OVERSHOOT_TRAVEL_PX). Measured ~3200ms in practice; >1000ms is a
    // generous floor, not a tight measurement.
    expect(recordResult.audioMap.marks[0].t).toBeGreaterThan(1000);

    // Full timeline adds the trailing zoom-out(500ms) on top of the above —
    // measured ~3700ms in practice. >2300ms sits ~1.4s below that: enough
    // to catch a truncated/short-circuited run without ever flaking on
    // scheduler jitter.
    expect(recordResult.audioMap.durationMs).toBeGreaterThan(2300);

    const probe = await ffprobeJson(recordResult.videoPath);
    const videoStream = probe.streams.find((s) => s.codec_type === "video");
    // The requested resolution is respected verbatim — no implicit
    // downscaling by Playwright's video recorder.
    expect(videoStream?.width).toBe(RESOLUTION.width);
    expect(videoStream?.height).toBe(RESOLUTION.height);
  });

  test("mixAudio adds the audio track and preserves the video's duration", async () => {
    test.skip(!(await hasFfmpeg()), "ffmpeg not on PATH");

    const mixedPath = path.join(outDir, "mixed.mp4");
    const { mixed } = await mixAudio({
      videoPath: recordResult.videoPath,
      audioMap: recordResult.audioMap,
      soundsDir,
      output: mixedPath,
    });
    // macbook-trackpad.wav is a real, committed asset (see soundsDir above),
    // so the one mark from "record" above is never silently skipped as
    // missing.
    expect(mixed).toBe(1);

    const [webmProbe, mp4Probe] = await Promise.all([
      ffprobeJson(recordResult.videoPath),
      ffprobeJson(mixedPath),
    ]);

    const audioStream = mp4Probe.streams.find((s) => s.codec_type === "audio");
    expect(audioStream?.codec_name).toBe("aac");

    const webmDuration = Number(webmProbe.format.duration);
    const mp4Duration = Number(mp4Probe.format.duration);
    // mixer.ts deliberately omits `-shortest` (see its comment there) so the
    // (longer) silent video — not the mixed audio, which ends at the last
    // cue — defines the output's duration. The mp4 should therefore be at
    // least as long as the source webm; -0.2s absorbs container/keyframe
    // rounding from the vp8/vp9 -> h264 re-encode, not a real truncation.
    expect(mp4Duration).toBeGreaterThanOrEqual(webmDuration - 0.2);
  });

  test("toGif produces an animated gif within budget", async () => {
    test.skip(!(await hasFfmpeg()), "ffmpeg not on PATH");

    const gifPath = path.join(outDir, "clip.gif");
    // Fed the recorder's webm, exactly like production (see the describe
    // comment above) — asserting on any other input (e.g. mixAudio's
    // re-encoded mp4) would let a VP8/webm-specific decode regression slip
    // past this spec while breaking every real toGif caller.
    //
    // fps/width/maxColors trimmed well below toGif's defaults (15/640/256):
    // this clip's zoom+ripple motion changes almost every pixel every frame,
    // which defeats GIF's LZW/palette compression, and no gifsicle pass runs
    // afterwards to shrink the result (pinned off below). Measured against
    // fresh recordings of this exact SHEET fed as webm: the defaults blew
    // past 4MB, and fps10/width480/maxColors48 still hit 1,488,780 bytes —
    // a useless 1% under budget. This setting (fps10/width440/maxColors32)
    // measured 1,085,055 / 1,073,083 / 869,922 bytes over three independent
    // recordings — worst case ~1.09MB, ~28% under the 1.5MB budget — so
    // run-to-run encode variance can't flake the assert.
    const result = await toGif(recordResult.videoPath, {
      output: gifPath,
      fps: 10,
      width: 440,
      maxColors: 32,
      // Pin both optional accelerators off (production precedent: the CLI's
      // gif command exposes exactly these knobs) so this test exercises
      // toGif's always-available ffmpeg fallback path deterministically.
      // Left on "auto", the backend/optimized asserts below — and the byte
      // budget above — would reflect whatever happens to be on the runner's
      // PATH: a contributor with gifski installed would fail them for
      // purely environmental reasons.
      gifski: "never",
      optimize: "never",
    });

    // The pinned options above force the ffmpeg palette path with no
    // gifsicle pass — assert toGif honored them.
    expect(result.backend).toBe("ffmpeg");
    expect(result.optimized).toBe(false);

    const bytes = await readFile(gifPath);
    // GIF89a is the format signature ffmpeg's gif muxer always writes.
    expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    // Budget from the plan: a short UI clip must stay shareable-sized.
    expect(bytes.length).toBeLessThan(1_500_000);

    // `-count_packets` is required for ffprobe to populate nb_read_packets;
    // the base ffprobeJson call omits it since most callers don't need a
    // frame count, so it's passed as an extra arg here.
    const probe = await ffprobeJson(gifPath, ["-count_packets"]);
    const videoStream = probe.streams.find((s) => s.codec_type === "video");
    // >5 frames proves this is a real animation, not a static/near-static
    // capture — the several-second clip at the 10fps configured above
    // produces dozens.
    expect(Number(videoStream?.nb_read_packets)).toBeGreaterThan(5);
  });
});
