# Bundled sound pack

The default sound pack used by `telekinesis record` when `--sounds` is not given.

These are **procedurally synthesized**, not recorded samples: layered PCM WAV
written sample-by-sample in `@telekinesis/render/src/synth/` (band-pass-filtered
noise transients + resonant, pitch-dropping oscillator bodies + soft `tanh`
saturation — see `docs/mejoras-cinematograficas-2026-07.md` §1 for the design
brief). That keeps the pack **CI-friendly** (no audio hardware, no ffmpeg
needed to generate it), free of third-party licensing, and fully reproducible
from code.

| File | Profile |
| --- | --- |
| `mouse-click.wav` | `mouse-click` |
| `macbook-trackpad.wav` | `macbook-trackpad` |
| `mechanical-keyboard.wav` | `mechanical-keyboard` |
| `pop.wav` | `pop` |
| `whoosh.wav` | `whoosh` |

Each file is deterministic — regenerating produces byte-identical output,
since every synth voice is driven by a seed derived from its profile id. The
live in-browser preview (`@telekinesis/core`'s `SoundEngine`) synthesizes the
same layered model with Web Audio nodes, so the preview matches the render.

**Regenerate** after tuning `packages/render/src/synth/` or
`packages/schema/src/sound.ts`'s `SOUND_PROFILES[...].synth`:

```bash
cd packages/cli && pnpm exec tsx src/cli.ts sounds -o assets/sounds
```

Swap in your own `.wav` files for a custom feel — the filenames must stay the
same. Missing files are skipped at mix time, so a partial pack is fine.
