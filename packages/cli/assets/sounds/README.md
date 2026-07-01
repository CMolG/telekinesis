# Bundled sound pack

The default sound pack used by `telekinesis record` when `--sounds` is not given.

These are **real recordings**, not synthesized tones — sourced from Kenney's
"Interface Sounds" pack, released under **CC0 1.0** (public domain; crediting
Kenney is appreciated but not required), so they are safe to redistribute with
this MIT package.

| File | Profile | Source clip |
| --- | --- | --- |
| `mouse-click.wav` | `mouse-click` | `click_001` |
| `macbook-trackpad.wav` | `macbook-trackpad` | `drop_001` |
| `mechanical-keyboard.wav` | `mechanical-keyboard` | `tick_001` |
| `pop.wav` | `pop` | `glass_002` |
| `whoosh.wav` | `whoosh` | `minimize_001` |

Each clip was downmixed to mono 44.1 kHz, had its leading silence trimmed and
its level balanced with ffmpeg (the keyboard tick is mixed ~6 dB quieter since
it fires once per keystroke).

**Provenance:** Kenney Interface Sounds — <https://kenney.nl/assets/interface-sounds>
· CC0 1.0 <https://creativecommons.org/publicdomain/zero/1.0/> · WAV mirror:
<https://github.com/Calinou/kenney-interface-sounds>

Swap in your own `.wav` files for a custom feel — the filenames must stay the
same. Missing files are skipped at mix time, so a partial pack is fine.

> `telekinesis sounds -o <dir>` still synthesizes a quick **placeholder** pack
> (pure ffmpeg tones) into `<dir>` — handy as a dependency-free fallback or a
> scratch base to record over. It does not touch this bundled pack.
