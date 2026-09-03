---
version: alpha
name: GAZLL
description: A calm, evidence-led systems lab notebook for bilingual senior backend interview preparation.
colors:
  cool-paper: "#EEF1F6"
  white-surface: "#FFFFFF"
  deep-navy-ink: "#14233A"
  slate-text: "#42536C"
  quiet-slate: "#626E7F"
  mist-line: "#DBE1EA"
  structural-line: "#C6CFDC"
  engineering-emerald: "#0B6E4F"
  engineering-emerald-deep: "#085239"
  emerald-wash: "#E4F1EB"
  review-clay: "#AE4536"
  clay-wash: "#F6E8E5"
  annotation-brass: "#846938"
  blueprint-indigo: "#3D4E8F"
  blueprint-wash: "#E7EAF6"
  systems-teal: "#1C7684"
  systems-wash: "#E3F1F3"
  terminal-navy: "#0F1D31"
  terminal-raised: "#16273F"
  terminal-text: "#E6ECF5"
  terminal-muted: "#8A9AB4"
  terminal-green: "#86D6AC"
  terminal-blue: "#8DBBEC"
  terminal-amber: "#E2B871"
  terminal-clay: "#E69185"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "60px"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-1.4px"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.4px"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.62
  label:
    fontFamily: "IBM Plex Mono, monospace"
    fontSize: "10.5px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.5px"
rounded:
  micro: "5px"
  compact: "7px"
  control: "9px"
  card: "10px"
  surface: "14px"
  overlay: "16px"
  full: "999px"
spacing:
  micro: "4px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  "2xl": "24px"
  "3xl": "28px"
components:
  button-primary:
    backgroundColor: "{colors.engineering-emerald}"
    textColor: "{colors.white-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  button-ghost:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.slate-text}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    padding: "6px 12px"
  filter-chip:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.slate-text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  question-card:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.deep-navy-ink}"
    rounded: "{rounded.card}"
    padding: "15px 18px"
  note-input:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.deep-navy-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  navigation-item:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.slate-text}"
    rounded: "{rounded.card}"
    padding: "9px 10px"
  search-result:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.deep-navy-ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  calendar-day:
    backgroundColor: "{colors.white-surface}"
    textColor: "{colors.deep-navy-ink}"
    rounded: "{rounded.compact}"
    padding: "8px"
---

# Design System: GAZLL

## Overview

**Creative North Star: "The Systems Lab Notebook"**

GAZLL should feel like **The Systems Lab Notebook**: a calm, rigorous workspace where a senior backend engineer collects evidence, rehearses explanations, and returns to difficult ideas. It is closer to a carefully annotated technical reference than a promotional learning product. The interface should reward depth without becoming heavy, and remain easy to scan during focused study.

The visual system is built around cool paper, crisp white work surfaces, deep navy text, and restrained engineering accents. Its voice is precise rather than sterile: compact metadata, visible structure, quiet feedback, and enough warmth to make repeated study inviting.

The calendar-schedule subtool uses the same materials—color, type, controls, focus treatment, and radii—but a denser operational topology. It may use month, year, agenda, rail, and item views without copying the main study page composition. This is **shared materials, different instrument**, not a separate brand.

**Key Characteristics:**

- Calm, technical, and evidence-led.
- Information-rich but deliberately scannable.
- Precise controls over cool paper and crisp work surfaces.
- One visual language across study and scheduling tools.

## Colors

The neutral foundation is Cool Paper (`#EEF1F6`) behind White Surface (`#FFFFFF`). Deep Navy Ink (`#14233A`) carries primary text; Slate Text (`#42536C`) supports secondary copy; Quiet Slate (`#626E7F`) is reserved for metadata that still meets contrast requirements. Mist Line (`#DBE1EA`) and Structural Line (`#C6CFDC`) organize the interface before shadows are considered.

Engineering Emerald is the primary interactive and progress color. Blueprint Indigo, Review Clay, Annotation Brass, and Systems Teal identify content families and meaningful states. Each accent should normally appear as dark text or a compact mark over its pale companion wash. Terminal colors are reserved for code and technical diagrams on the dark navy code surface.

**The Accent Means Meaning Rule:** accent colors communicate interaction, completion, status, or a stable content family. Do not use them as arbitrary decoration.

**The Soft Before Solid Rule:** prefer a pale wash for broad areas and reserve saturated fills for primary actions, small selected states, and high-salience markers such as today. Never place long body copy on a saturated accent.

Status must never rely on color alone. Pair color with a label, icon, border, position, or shape. Maintain WCAG AA contrast for text and controls.

## Typography

The system has three voices. Space Grotesk provides compact, confident hierarchy. IBM Plex Sans carries explanations and long reading. IBM Plex Mono labels metadata, filters, shortcuts, code, and small technical controls.

**The Three Voices Rule:** use Space Grotesk to orient, IBM Plex Sans to explain, and IBM Plex Mono to annotate. Do not use mono for paragraphs or Space Grotesk for dense answer text.

The display style scales responsively from `36px` to the `60px` token maximum with a tight `1.05` line height. Headlines use `30px`; component titles use `19px`; body copy starts at `16px` with a generous `1.62` line height. Labels are `10.5px`, usually uppercase, with `0.5px` tracking; do not apply uppercase to translated sentences or user-authored content.

**The 600 Is Bold Rule:** the downloaded families make weight 600 the dependable bold UI weight. Avoid synthesized weights. Use 700 only where the loaded Space Grotesk face and hierarchy genuinely require it.

## Layout

The primary shell is capped at `1400px`, with a `24px` desktop gutter and `14px` below `760px`. Reading columns should remain narrower than the shell; wide space belongs to navigation, comparisons, diagrams, and operational tools rather than longer line lengths.

**The One Shell Rule:** header, navigation, and main content share the same horizontal anchors even when their internal grids differ. Alignment should make the interface feel authored before decoration is added.

Use the spacing scale intentionally: `4–8px` inside tightly related controls, `12–18px` inside components, and `24–28px` between sections or distinct groups. Prefer a few stable gaps over one-off values.

**The Shed, Don’t Wrap Rule:** the persistent header remains one row. At `999px`, `760px`, `600px`, and `420px`, remove or relocate lower-priority controls before allowing the header to wrap. Preserve the current task, language, search, and navigation access according to context.

The calendar may use dedicated breakpoints near `1040px`, `900px`, `720px`, and `420px` because its information topology is denser. It should progressively move rails, compress labels, and change views instead of merely shrinking the desktop grid.

## Elevation & Depth

GAZLL is line-first and tonal-first. Most separation comes from paper versus surface, thin structural borders, inset states, and small changes in background tone.

**The Line-First Rule:** add a border or tonal step before adding a shadow. The default surface shadow is subtle (`0 1px 2px rgba(20,35,58,.05), 0 12px 30px -18px rgba(20,35,58,.28)`). Stronger ambient shadows belong only to overlays, modals, active expandable cards, and temporarily raised interactions.

The sticky header may use translucent paper and backdrop blur to preserve context while content moves beneath it. Dark code blocks use Terminal Navy and Terminal Raised as a local depth system; they should not make surrounding cards visually heavier.

Motion is short and functional: approximately `120–180ms` for color, border, opacity, and small transforms. Avoid decorative entrance sequences in study flows. Under `prefers-reduced-motion: reduce`, remove nonessential animation and smooth scrolling.

## Shapes

Corners are moderately rounded and precise, never bubbly. Use `5–7px` for tiny technical elements, `9px` for controls, `10px` for cards and navigation items, `14px` for major surfaces, and `16px` for overlays. Keep the radius consistent among siblings.

**The Purposeful Pill Rule:** `999px` is for tags, filters, statuses, and compact segmented actions only. Content cards, dialogs, text fields, and calendar cells retain visible corners.

Borders are normally `1px`; a `3px` edge may indicate an active topic, question state, or progress category. Icons use simple geometry, consistent stroke weight, and current color. Prefer inline SVG or the existing icon system over emoji.

## Components

Primary buttons use the emerald-to-deep-emerald treatment, white text, compact mono labeling, and a `9px` radius. There should usually be one primary action per local decision area. Ghost buttons remain white with a structural border and gain emerald emphasis on hover or focus.

Filter chips are compact pills. Their selected state combines an accent or wash with a clear border and semantic text; it is not communicated by color alone. Question cards use a white surface, a structural outline, and a state-colored left edge. Expansion may add the shared ambient shadow, but collapsed lists should stay visually quiet.

Inputs and note areas use body typography, a near-white resting surface, and a clear emerald focus ring. Search overlays use a `16px` radius, a strong border, and the strongest approved ambient shadow; result rows remain individually navigable and show keyboard focus.

Navigation items have generous hit targets, rounded rectangular geometry, and a persistent active cue such as a left rule plus wash. Calendar day cells use the same border, focus, and state language while allowing more compact density and multiple scheduling signals.

**The Control Is a Control Rule:** clickable behavior must use a real button, link, input, or appropriate interactive element. Preserve keyboard order, visible focus, at least `44px` touch targets where feasible, and explicit accessible names for icon-only actions.

The tokens above are normative, and `public/styles.css` is where they are actually
declared — the two must agree. Illustrative component recipes were generated into
`.impeccable/design.json`, which is gitignored tooling state rather than repo
content, so treat this file and `styles.css` as the pair that matters.

## Do's and Don'ts

- **Do** make evidence, progress, and next action legible at a glance.
- **Do** preserve EN/VI parity and allow labels and headings to expand without clipping.
- **Do** use whitespace, alignment, borders, and typographic contrast before adding decoration.
- **Do** keep calendar-schedule recognizably GAZLL while optimizing its denser workflow independently.
- **Do** verify focus, hover, active, disabled, empty, loading, error, and reduced-motion states.
- **Don’t** turn every card, heading, or icon into a different accent color.
- **Don’t** stack shadows on ordinary nested surfaces or make the notebook feel like a floating-card dashboard.
- **Don’t** hide essential actions behind hover-only affordances or use color as the sole state signal.
- **Don’t** introduce new font families, arbitrary radii, or one-off spacing when an existing token fits.
- **Don’t** force the calendar into the study page layout; share the design language, not the exact composition.
