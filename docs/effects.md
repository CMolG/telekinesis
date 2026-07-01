# Effects reference

Every timeline entry is one effect, discriminated by `action`. All effects share
these optional fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `frameId` | string | target frame (required by most, see below) |
| `delayBefore` | ms | dramatic pause before the effect |
| `delayAfter` | ms | pause after the effect resolves |
| `note` | string | comment for the editor; ignored at runtime |

`easing` is one of `linear · ease-in · ease-out · ease-in-out · spring`.
`soundProfile` is one of `mechanical-keyboard · macbook-trackpad · mouse-click ·
whoosh · pop`.

## Interactions

### `click`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | **required** |
| `showRipple` | boolean | `true` |
| `soundProfile` | enum | — |

Moves the cursor onto the frame, ripples, and (self mode) clicks the inner
control.

### `type-down`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | **required** |
| `text` | string | **required** |
| `typingSpeed` | ms/char | `55` |
| `mistakes` | boolean | `false` |
| `soundProfile` | enum | — |

Types character-by-character; `mistakes` occasionally fat-fingers and corrects.

### `drag-and-drop`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | **required** (source) |
| `destFrameId` | string | preferred destination |
| `destX` / `destY` | number | absolute fallback |
| `duration` | ms | `800` |
| `easing` | enum | `ease-in-out` |

Prefer `destFrameId`: it's resolution-independent. The engine computes the drop
point at runtime, so a responsive layout never drops into the void.

### `shake`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | **required** |
| `intensity` | `low·medium·high` | `medium` |
| `duration` | ms | `500` |

A decaying horizontal wobble — great as anticipation before a submit.

## Camera & navigation

### `zoom-in`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | optional anchor |
| `scale` | number | `1.4` |
| `duration` | ms | `1200` |
| `easing` | enum | `ease-out` |
| `transformOrigin` | enum | `center` (used when no `frameId`) |

With a `frameId` the camera centers on that frame; otherwise it anchors at the
`transformOrigin` corner/center of the viewport.

### `zoom-out`
| Field | Type | Default |
| --- | --- | --- |
| `duration` | ms | `900` |
| `easing` | enum | `ease-in-out` |

Returns to scale 1.

### `scroll-up` / `scroll-down`
| Field | Type | Default |
| --- | --- | --- |
| `distance` | number \| `"viewport"` | `"viewport"` |
| `duration` | ms | `700` |
| `easing` | enum | `ease-in-out` |

### `cursor-move`
| Field | Type | Default |
| --- | --- | --- |
| `destFrameId` | string | preferred destination |
| `destX` / `destY` | number | absolute fallback |
| `duration` | ms | `700` |
| `curve` | `linear·arc·bezier` | `bezier` |
| `easing` | enum | `ease-in-out` |

`bezier`/`arc` curve the path so it reads as a hand, not a robot.

### `highlight`
| Field | Type | Default |
| --- | --- | --- |
| `frameId` | string | **required** |
| `duration` | ms | `1500` |
| `dimOpacity` | 0–1 | `0.6` |
| `padding` | px | `8` |

Spotlight: dims everything except a rounded cutout around the frame.

### `wait`
| Field | Type | Default |
| --- | --- | --- |
| `duration` | ms | `1000` |

A pure pause — "let the viewer read this".
