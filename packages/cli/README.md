# @telekinesis/cli

The `telekinesis` command — orchestrates the recorder and mixes audio.

```bash
# scaffold a timesheet
telekinesis init -u http://localhost:3000?demo

# watch it run in a real browser (no file written)
telekinesis preview telekinesis.timesheet.json

# record + mix → mp4
telekinesis record telekinesis.timesheet.json -o demo.mp4

# procedurally synthesize the sound pack (wavs, no ffmpeg needed for this step)
telekinesis sounds -o telekinesis-sounds
telekinesis record flow.json -s telekinesis-sounds -o demo.mp4
```

## `record`

1. validates the timesheet,
2. runs `@telekinesis/engine` → a **silent** video + `audio-map.json`,
3. mixes each sound at its exact timestamp with **ffmpeg** (`adelay`+`amix`),
4. cleans up the temp artifacts (keep them with `--keep-temp`).

| Flag | Meaning |
| --- | --- |
| `-u, --url` | URL to record (overrides `timesheet.url`) |
| `-o, --output` | output mp4 (default `telekinesis-demo.mp4`) |
| `-s, --sounds` | sound pack dir (defaults to the bundled pack) |
| `--headed` | show the browser |
| `--keep-temp` | keep the silent video + audio map |

Requires **ffmpeg** on your PATH and Playwright browsers
(`pnpm exec playwright install chromium`).
