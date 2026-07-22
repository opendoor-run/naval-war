---
name: Pacific Theater Command
colors:
  surface: '#f4fde4'
  surface-dim: '#d5ddc6'
  surface-bright: '#f4fde4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef7de'
  surface-container: '#e9f1d9'
  surface-container-high: '#e3ebd3'
  surface-container-highest: '#dde6ce'
  on-surface: '#171e0f'
  on-surface-variant: '#43474c'
  inverse-surface: '#2b3323'
  inverse-on-surface: '#ecf4dc'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4e6073'
  primary: '#152738'
  on-primary: '#ffffff'
  primary-container: '#2b3d4f'
  on-primary-container: '#95a8bd'
  inverse-primary: '#b5c8df'
  secondary: '#665d4c'
  on-secondary: '#ffffff'
  secondary-container: '#eee1cb'
  on-secondary-container: '#6c6352'
  tertiary: '#530300'
  on-tertiary: '#ffffff'
  tertiary-container: '#771307'
  on-tertiary-container: '#ff806b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4fb'
  primary-fixed-dim: '#b5c8df'
  on-primary-fixed: '#091d2e'
  on-primary-fixed-variant: '#36485b'
  secondary-fixed: '#eee1cb'
  secondary-fixed-dim: '#d1c5b0'
  on-secondary-fixed: '#211b0e'
  on-secondary-fixed-variant: '#4e4636'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a7'
  on-tertiary-fixed: '#400200'
  on-tertiary-fixed-variant: '#881f12'
  background: '#f4fde4'
  on-background: '#171e0f'
  surface-variant: '#dde6ce'
typography:
  display-stencil:
    fontFamily: Bebas Neue
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.1em
  headline-stamped:
    fontFamily: Bebas Neue
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-typewriter:
    fontFamily: Courier Prime
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-monospaced:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  caption-ink:
    fontFamily: Courier Prime
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.2'
spacing:
  rivet-gap: 0.5rem
  gutter: 1.5rem
  margin-safe: 2rem
  component-gap: 1rem
---

## Brand & Style
The design system is rooted in **Tactile Realism** and **Skeuomorphism**, specifically channeling the atmosphere of a 1940s naval headquarters during daylight operations. The visual narrative centers on high-stakes command, reliability under pressure, and analog utility. Every interface element is treated as a physical object—a piece of stamped metal, a sun-bleached chart, or a mechanical toggle.

The aesthetic avoids digital-native concepts like blurs, glows, or translucency. Instead, it leans into the "Heavy Industrial" look of World War II: matte surfaces, mechanical depth, and the grit of a field headquarters. The target experience is one of immersion, where the user feels they are interacting with a physical "Tactical Plotting Table" in a brightly lit command room.

## Colors
The palette is derived from maritime charts and military hardware, optimized for a light-mode environment.
- **Deep Navy (#2B3D4F):** Used for structural contrast, primary ink for reports, and heavy equipment framing.
- **Aged Parchment (#D9CDB8):** The primary surface color, used for logistical readouts, document backgrounds, and the central map area.
- **Olive Drab (#4A5240):** Used for structural elements and secondary military-grade equipment surfaces.
- **Tactical Red (#A43424):** A critical highlight color for warnings, enemy positions, and high-priority strike orders.
- **Amber Glow (#FFB347):** Limited to mechanical dial backlighting and indicator lamps.

Surface treatments should include a noise grain (3-5% opacity) to simulate paper pulp or painted metal.

## Typography
Typography is functional and mechanical, designed to look like printed or stamped ink.
- **Headlines:** Use `Bebas Neue` to simulate stencil-cut lettering or heavy ink stamps. Letter spacing is increased to mimic manual alignment.
- **Data & Reports:** `Courier Prime` provides the "typewriter" feel essential for intelligence reports and radio logs.
- **Tactical Readouts:** `JetBrains Mono` is used for coordinates, bearing data, and numeric telemetry to ensure absolute legibility and a technical, monospaced aesthetic.
- **Visual Effects:** Apply a subtle `0.5px` blur or slight color jitter to text to simulate ink bleed on fibrous paper or uneven pressure from a stamp.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy, resembling a physical plotting map pinned to a table.
- **The Map Base:** The primary interface is a large, central "Pacific Theater" canvas.
- **The Dashboards:** Peripheral information is housed in "Steel Panes" or "Clipboards" that snap to the edges of the screen.
- **Grid:** Use a 12-column grid for logistics panels, but allow for free-form placement of tactical icons (ships, planes) on the map layer.
- **Safety:** Content is contained within a 2rem "Safe Area" to prevent information from feeling crowded by the heavy industrial frames of the UI.

## Elevation & Depth
Depth is achieved through **Physical Layering** rather than digital shadows, utilizing the light-mode contrast to show stacking.
- **Tier 1 (Base):** The maritime chart, slightly yellowed and grainy (Aged Parchment).
- **Tier 2 (Documents):** Paper reports and clipboards "laid on top" of the map. These use crisp, dark outlines and a subtle offset to suggest thickness.
- **Tier 3 (Controls):** Knobs, switches, and metal plates. These use inner shadows and directional highlights to feel like 3D objects protruding from the bulkhead.
- **Tier 4 (Markers):** Tactical markers (vessel icons) are treated as physical wooden or metal blocks with distinct drop shadows to separate them from the board.

## Shapes
The design system utilizes **Sharp** geometry.
- All containers, paper edges, and metal panels have 0px corner radii.
- Occasional "stamped metal" buttons may use a 2px radius to simulate the rounding of heavy machinery, but the default state is rigid and angular.
- Circular elements are reserved strictly for mechanical dials, gauges, and compass roses.

## Components
- **Tactile Switches:** Replace standard toggles with vertical metal flip-switches. Use high-contrast "Up/Down" positions with a physical click sound metaphor.
- **The Clipboard:** Container for lists and data. Features a metallic top clip and an Aged Parchment background with horizontal "ink" rules.
- **Dials & Gauges:** Use for selecting ranges or viewing status (e.g., fuel, range). Dials should have physical tick marks and a rotating needle.
- **Stamped Buttons:** Action triggers should look like embossed metal plates. The "Hover" state is a slight darkening, and "Active" is a deeper inset.
- **Ink Stamps:** Used for status labels (e.g., "CONFIDENTIAL," "SUNK," "MISSION COMPLETE"). These should have irregular edges and variable opacity.
- **Input Fields:** Styled as "Underlined Blanks" on a typewriter document, where text appears in `Courier Prime` directly above the line.

---

## Implementation notes (as built)

The live implementation (`app/src/index.css`, prefixed `.ptc-*`) follows the
prose palette above (Deep Navy / Aged Parchment / Olive Drab / Tactical Red /
Amber Glow) rather than the frontmatter's `colors` block, which reads as a
mismatched generic Material export (pale yellow-green surfaces) inconsistent
with everything else in this spec. See [[naval_war_visual_design]] project
memory for the reasoning if this needs revisiting.

Two deliberate departures from a literal reading of this spec, both by
explicit user decision:
- **No dark mode.** A physical, daylit plotting table has no natural night
  variant, so the app commits to this single theme rather than adding a
  `prefers-color-scheme: dark` branch.
- **Card art is never filtered.** The scanned 1983 card images are the
  emotional core of this project (the game's been out of print for decades)
  - no grayscale/sepia/contrast treatment is applied to them, even though a
    literal "printed recognition-card" reading of this system might suggest
    it. Mood is carried by the chrome around the art, not the art itself.

Not yet implemented: Tactile Switches and Dials & Gauges (no current UI
element needs a toggle or a range selector).
