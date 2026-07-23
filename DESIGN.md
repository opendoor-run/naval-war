---
name: Dazzle Command
colors:
  deck: '#6e7671'
  parchment: '#ded6c0'
  parchment-hi: '#f3eedf'
  parchment-lo: '#b6aa8c'
  navy: '#2a3f63'
  navy-deep: '#12192a'
  olive: '#2f6e6e'
  red: '#c1352a'
  amber: '#e2a33b'
  ink: '#17140f'
  ink-soft: '#5b5646'
typography:
  display-stencil:
    fontFamily: Allerta Stencil
    fontSize: 48px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  headline-bold:
    fontFamily: Public Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.08em
  body:
    fontFamily: Public Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-monospaced:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
spacing:
  gutter: 1.5rem
  margin-safe: 2rem
  component-gap: 1rem
---

## Brand & Style
**Dazzle Command** channels a WWII silkscreen recruitment poster crossed with
dazzle camouflage — the geometric stripe patterns painted on Allied hulls to
break up a U-boat's range-finding silhouette. The visual narrative is flat,
graphic, and print-based rather than photoreal: color blocks, hard rules, and
a repeating diagonal stripe motif standing in for "this is live / this is
critical" wherever the UI needs to say that.

This replaces the earlier "Pacific Theater Command" system (tactile realism,
aged parchment, embossed metal) with something deliberately flatter and more
graphic — a different, equally period-authentic register on the same Pacific
Theater subject matter, not a refinement of the old one. See
[[naval_war_visual_design]] project memory if the history matters.

## Colors
Named for their real-world reference rather than their CSS role, since the
same six values get reused across very different components:
- **Haze Gray (`--deck`, #6E7671):** USN "Measure 22" hull-paint gray — the
  app's outermost background, standing in for the old aged-parchment table.
- **Bone White (`--parchment-hi`, #F3EEDF) / Bone Khaki (`--parchment`,
  #DED6C0) / Deep Khaki (`--parchment-lo`, #B6AA8C):** poster paper, in
  descending brightness — panel surfaces, chip backgrounds, pressed states.
- **Ink Navy (`--navy`, #2A3F63) and its deep variant (`--navy-deep`,
  #12192A):** structural color — borders, buttons, headline text.
- **Sea Teal (`--olive`, #2F6E6E):** secondary accent (currently just the
  presence dot).
- **Signal Red (`--red`, #C1352A):** danger / critical — ink stamps,
  "you" in chat, the destructive button.
- **Flag Gold (`--amber`, #E2A33B):** the active/live accent — turn
  indicators, active chips, primary-button shadow.
- **Poster Ink (`--ink`, #17140F) / muted (`--ink-soft`, #5B5646):** body
  text.

No grain, no paper stains. The one background texture is a faint dazzle
stripe field worked into the Haze Gray desk at low opacity — texture that
reads as pattern only if you look for it.

## Typography
- **Allerta Stencil** is the display face, and it's spent in exactly one
  place per screen: the page title (`.ptc-display`) and the ink-stamp labels
  (`.ptc-stamp`, e.g. "SUNK", "MINEFIELD"). It has open counters that look
  like chromatic aberration under an offset text-shadow, so it's rendered as
  flat solid color, never shadowed.
- **Public Sans** carries everything else, including panel headlines
  (`.ptc-headline`) — bold, uppercase, letter-spaced, but in a legible
  humanist grotesk rather than the stencil face, so small labels don't fight
  the display type's open counters at small sizes.
- **IBM Plex Mono** is reserved for numeric/tactical readouts: gun sizes,
  hit points, dice rolls, chip labels.

## Layout & Spacing
Unchanged in structure from the previous system (12-column logistics
panels, a 2rem safe area, panels that snap to the screen edges) — the pivot
is in surface treatment, not layout.

## Shapes
Still sharp: 0px corner radii everywhere except the occasional 2px on a
button. Circles are reserved for the dazzle-bar swatch and rivet-adjacent
marks only.

## Components
- **Poster panel (`.ptc-panel`):** Bone White surface, a 2px Ink Navy rule,
  and a flat 4px offset shadow in the same Ink Navy — a print-misregistration
  effect instead of a soft drop shadow.
- **Dazzle bar (`.ptc-clipboard`, `.ptc-dazzle-bar`):** the signature
  element. A repeating diagonal navy/gold stripe, used as a panel's top edge
  band and, animated, as the active-turn indicator (`TurnTracker`'s current
  chip, `ScorePanel`'s turn swatch) — the same stripe language as the desk
  texture, tying "this is dazzle camouflage" to "this is the live thing"
  functionally, not just decoratively.
- **Registration-mark rivets (`.ptc-rivets`):** small corner tick marks,
  standing in for the old physical rivet dots — a printer's crop-mark
  reference rather than a fastener.
- **Ink stamp (`.ptc-stamp`):** rotated, dashed, stencil-set — unchanged in
  concept from the old system, just re-set in Allerta Stencil.
- **Flat poster button (`.ptc-btn`):** solid color, hard border, a flat
  offset shadow that tucks flush on press (no inset/gradient embossing).
- **Chips and inputs:** flat poster chip (gold when active) and an
  underlined blank, both re-set in Public Sans / IBM Plex Mono.

## Implementation notes (as built)
Same two non-negotiables carried over from the previous system, unchanged:
- **No dark mode.** Single theme, as before.
- **Card art is never filtered.** The scanned 1983 card images stay
  untouched — the mood is carried entirely by the chrome, never the art.

All of the above lives in `app/src/index.css` under the existing `.ptc-*`
class names and `--parchment`/`--navy`/etc. CSS variables — deliberately kept
the same names as the old system even though their assigned colors changed,
so this reskin only touched `index.css`, the font files, and two small
JS/TSX call sites that add the dazzle-bar turn indicator
(`TurnTracker.tsx`, `ScorePanel.tsx`); no other component needed to change.
