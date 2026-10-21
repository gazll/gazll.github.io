---
version: m3-expressive-1
name: GAZLL
description: A calm, evidence-led systems lab notebook for bilingual senior backend interview preparation, built on Material 3 Expressive.
system: Material 3 Expressive (May 2025) with the I/O 2026 spacing system
seed: "#0B6E4F"
scheme: TonalSpot, colour spec 2025 (custom groups on 2021)
colors:
  light:
    primary: "#2D6A51"
    on-primary: "#E6FFF0"
    primary-container: "#B1F0D1"
    on-primary-container: "#1D5C44"
    secondary-container: "#CFE9D9"
    on-secondary-container: "#40574B"
    tertiary-container: "#BBF5FD"
    on-tertiary-container: "#235F66"
    surface: "#F7FAF5"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#EFF5EF"
    surface-container: "#E8F0E9"
    surface-container-high: "#E2EAE3"
    on-surface: "#2B352F"
    on-surface-variant: "#57615B"
    outline: "#737D77"
    outline-variant: "#AAB4AD"
  dark:
    primary: "#A2D1B9"
    on-primary: "#1B4836"
    primary-container: "#2F5B48"
    on-primary-container: "#BEEED5"
    secondary-container: "#2A4035"
    on-secondary-container: "#ACC5B7"
    surface: "#0B0F0D"
    surface-container-lowest: "#000000"
    surface-container-low: "#0F1511"
    surface-container: "#141B17"
    surface-container-high: "#1A211D"
    on-surface: "#DEE8E0"
    on-surface-variant: "#A3AEA6"
    outline: "#6E7871"
    outline-variant: "#404A44"
  custom-groups: [indigo, teal, clay, brass, violet, slate, rose, steel]
  terminal: { background: "#0F1D31", raised: "#16273F", text: "#E6ECF5", muted: "#A8B7C9" }
typography:
  brand: "JetBrains Mono (variable, self-hosted)"
  plain: "JetBrains Mono (variable, self-hosted)"
  mono: "JetBrains Mono (variable, self-hosted)"
  scale: "M3 type scale in rem: display L/M/S 57/45/36, headline 32/28/24, title 22/16/14, body 16/14/12, label 14/12/11"
  emphasized: "500 for display/headline/body/title-large, 700 for labels and title-medium/small"
  floor: "11px (label-small); nothing smaller"
shape: { extra-small: 4px, small: 8px, medium: 12px, large: 16px, large-increased: 20px, extra-large: 28px, extra-large-increased: 32px, extra-extra-large: 48px, full: 9999px }
spacing: "8px scale, space100 = 8px: 0 2 4 6 8 10 12 14 16 20 24 32 36 40 48 56 64 72"
motion: "expressive spring scheme, as Material's web curves: fast/default/slow spatial 350/500/650ms, effects 150/200/300ms"
state-layers: { hover: 8%, focus: 10%, pressed: 10%, dragged: 16% }
---

# Design System: GAZLL on Material 3 Expressive

## Overview

**Creative North Star: "The Systems Lab Notebook"** — a calm, rigorous
workspace where a senior backend engineer collects evidence, rehearses
explanations and returns to difficult ideas. It reads like an annotated
technical reference, not a promotional learning product.

Since 2026-10-14 the notebook is expressed in **Material 3 Expressive** — the
current Material on m3.material.io: the May 2025 Expressive update (shape
morphing, the motion physics system, new and replaced components) plus the
I/O 2026 spacing system. A first pass shipped baseline M3 on the argument
that Expressive's large shapes and lively motion fight a long-reading surface;
the owner chose full Expressive instead (2026-10-14). The reading column
itself keeps its measure and calm — Expressive lives in the controls.

**Material Web has no Expressive build** (it is in maintenance mode), so
there is nothing to install: every component here is plain CSS written
against the Jetpack Compose token files (`androidx.compose.material3.tokens`),
which are generated from Material's own token source, and against the specs
on m3.material.io. When the two disagree, the Compose tokens win — they are
what Google ships.

`public/styles.css` declares everything here; this file says why. Where the
two disagree, the CSS is what ships and this file is the bug.

## Colour

**One seed, two themes, generated.** `tools/md3-tokens.mjs` derives every
colour role from the seed `#0B6E4F` with the TonalSpot scheme of
`@material/material-color-utilities`, on the **2025 colour spec** that
Expressive ships (on-container roles at tone 30, deeper dark surfaces), and
writes the block between the
`md3:generated` markers at the top of `styles.css`. Never edit that block by
hand; change the seed or the custom list and re-run the tool.
`tests/a11y.contrast.test.mjs` fails when the block is stale.

- **Roles, not colours.** Rules use `--md-sys-color-*` roles: `surface` is
  the page, `surface-container-lowest…highest` are tonal steps for cards and
  sheets, `on-surface` / `on-surface-variant` carry text, `outline-variant`
  draws dividers and card outlines, `outline` draws control outlines.
- **Content families are MD3 custom colour groups** — indigo, teal, clay,
  brass, violet, slate (neutral scheme), rose, steel — each with colour,
  on-colour, container and on-container in both themes. Topic types and
  calendar categories set `--g`, `--g-soft` (container) and `--g-on`. They are
  derived with TonalSpot, not MCU's `customColor()`, whose containers came out
  neon (teal `#6FF7F6`, brass `#FFE166`). They stay on the **2021** spec:
  a family accent prints as text on its own container (a pressed chip), and
  the 2025 accent is too light for that (3.86:1).
- **Selected follows the component, as Material assigns it.** Pressed chips,
  the active rail item, the current contents entry and the active search row
  use `secondary-container`; the selected menu item uses
  `tertiary-container` (the Expressive menu role); a selected option in a
  connected button group is `primary`. `primary` is otherwise for the one
  filled action in a decision area and for links.
- **The terminal stays dark in both themes.** Code is read on its own surface
  (`--code-bg`, `--surface-code`); those values are fixed on purpose.
- **Accent means meaning.** A family colour marks a family; it never decorates.
  Status is never colour alone — pair it with a label, an icon or a position.
- **Contrast floor.** Every text role clears WCAG AA 4.5:1 on the surface it is
  printed on, in light **and** dark; the test resolves aliases and
  `color-mix()` to check it.

## Themes and reader choices

Dark mode follows `prefers-color-scheme` unless the reader picked a theme in
the drawer (Auto / Light / Dark), which sets `data-theme` on `<html>`. Text
size (A / A+ / A++) sets `data-text`, which scales the root font size — this
works because every font size is `rem`. Both are per-device conveniences in
`localStorage` (`gazll:theme`, `gazll:text-size`, owned by
`app/utils/display-prefs.js`) and are applied by an inline head script before
first paint, so a dark reader never sees a light flash. Mermaid reads the roles
at render time, so diagrams follow the theme too.

## Typography

JetBrains Mono for everything — prose, chrome and code — chosen by the owner
over Roboto Flex: M3 lets the brand typeface change as long as the type scale
holds, and a study site about code reads well in one monospace voice. It is
self-hosted (`tools/fonts.mjs` copies the wght-axis subsets for latin,
latin-ext and vietnamese from `@fontsource-variable`), which also keeps
Google Fonts out of the CSP. Roboto Flex/Mono stay in `public/fonts`, unused
unless a typeface token names them, so going back is one line.

The Tools (`/fshare-tool`, `/course-registration`) use the same scale: every
`font-size` there is a `--md-sys-typescale-*-size` token, never a number.

- Sizes are the M3 type scale in `rem`. **Emphasized** type is the same size
  heavier (`--md-sys-typescale-emphasized-*-weight`): selected labels — the
  current rail item, the selected menu item, the selected option — use it. Labels are `label-*` (medium weight,
  sentence case, ~0.5px tracking); the old uppercase mono eyebrows are gone.
- **Nothing below 11px** (`label-small`). Text at 8–10px was the least readable
  on the site and is not coming back.
- Long reading uses `--reading-size` / `--reading-leading` (16–17.5px, 1.76):
  Vietnamese stacks diacritics and needs the extra leading.

## Shape, spacing, elevation and motion

- **Shape:** the Expressive scale adds `large-increased` (20),
  `extra-large-increased` (32) and `extra-extra-large` (48). Buttons, search
  and the toolbar are `full`; chips and tags `small` (8px); cards `medium`
  (12px), `large` once opened; menus, lists and the rail edge `large`; the
  hero, dialogs and the search view `extra-large` (28px).
- **Shape morphs.** Shape is state in Expressive. A pressed button or icon
  button squares to `small`, a pressed chip to `extra-small`; a selected
  option in a connected group goes fully round; a hovered menu or list row
  widens from `extra-small` to `medium`, a selected one to `medium`/
  `large`; an opened card grows to `large`. Corners move on the spatial
  spring, so they bounce slightly into place.
- **Spacing:** the I/O 2026 system, an 8px scale with `space100` = 8px and the
  nested units Material defines (`--md-sys-spacing-space0…900`). New padding
  and gaps read these tokens; Material Web does not have them either (they are
  Compose-only), so the names follow the spec's `md.sys.measurement.space*`.
- **Elevation is tone first.** Separate with `surface-container-*` and
  `outline-variant`; shadows (`--md-sys-elevation-level1…5`) only where MD3
  lifts something: an open card, a hovered filled button, the pager, dialogs.
- **State layers:** hover mixes the content colour over the container at 8%,
  focus and pressed at 10% (`color-mix()`), never `filter: brightness`.
- **Motion is the physics system, expressive scheme.** Springs, not easing
  curves: spatial springs (position, size, corners) overshoot and settle,
  effects springs (colour, opacity) never overshoot; fast for small controls,
  default for panels (the rail, the search view, an opening card), slow for
  full screen. CSS has no springs, so the tokens are Material's own web
  conversion — a `cubic-bezier` plus a duration per spring
  (`--md-sys-motion-spring-*`). The legacy easing/duration tokens remain for
  route changes only, which is also what Material keeps them for: the page
  cross-fades through the View Transition API with the app bar held still. A
  scroll-driven bar runs under the header. All of it is off under
  `prefers-reduced-motion`.

## Components

The shared skin lives in one block at the end of `styles.css` ("M3
Expressive components"). Layout stays with the surface that owns it. Where
Expressive retired a component, the site uses its replacement:

| Retired in Expressive | Used here instead |
|---|---|
| navigation drawer | modal expanded navigation rail (`.navpanel`) |
| segmented button | connected button group (`.md-segmented`) |
| bottom app bar | floating toolbar (`.pager`) |
| indeterminate circular progress | loading indicator (`.loading-block`) |

- **Buttons:** round, small (40px) by default and extra-small (32px) as
  `.btn-ghost.sm`, 16px side padding; filled (`.btn-primary`, `.pbtn.next`,
  `.cal-primary`) and outlined (`.btn-ghost`, `.pbtn`). One filled button per
  decision area. Icon buttons in the app bar are standard: no outline, a
  state layer, the same press morph.
- **Connected button group:** options 2px apart, outer corners full, inner
  corners small; selected = `primary`, round, emphasized label.
- **Chips:** 32px, 8px corner, outline-variant border; selected chips swap to
  the (family) container and show a leading check, so selection is never colour
  alone. Non-interactive tags are outlined labels, not chips.
- **Cards:** outlined on `surface-container-lowest`; hover adds a state layer,
  not a shadow; opening one grows its corners. The hero is a filled
  `surface-container-low` panel at `extra-large`.
- **App bar:** `surface`, no divider; once the page scrolls under it the bar
  takes `surface-container` (a scroll-driven animation, no script). One row,
  sheds controls instead of wrapping (the rule in CLAUDE.md stands). The
  search trigger is the contained search bar.
- **Navigation rail (expanded, modal):** `surface-container`, `large` end
  corners, level 2, 56px items with a full-corner `secondary-container`
  indicator. It slides on the default spatial spring and carries 24px of
  itself past the left edge, so the overshoot never opens a gap. Display
  choices sit in its footer as connected button groups.
- **Menu (topic picker):** the Expressive vertical menu — `surface-container-low`,
  `large` corner, level 2, rows 2px apart without dividers.
- **Segmented list (search results):** each group is one `large`-cornered
  block of `extra-small` rows 2px apart.
- **Floating toolbar (pager):** 64px, full corner, `surface-container`,
  level 3, 16px off the bottom edge. It tucks below the edge while the reader
  scrolls down and returns on any scroll up or near the end of the topic.
- **Progress:** determinate bars and the header ring separate the active part
  from a `secondary-container` track with a gap; a bar ends in a 4px stop
  indicator. The loading indicator morphs a primary shape through Material's
  seven loading shapes while it turns.
- **Dialogs and search view:** `surface-container-high`, 28px corner (square
  when the search view is full screen on a phone), scrim at 32%. Text fields
  are outlined with a 4px corner and a primary focus edge.

**The Control Is a Control Rule** still holds: real buttons and links, visible
focus (a 3px `secondary` ring), 44px targets where feasible, and an accessible
name that **contains the visible label** (axe `label-content-name-mismatch`).
A control whose label a phone hides keeps an `aria-label`; a code block that can
scroll sideways is focusable (`tabindex="0"`, added by `renderMarkdown`); a
shared link marks its card with `:target`, never a script-set class.

## Architecture decisions

- **Three token layers.** MD3 reference/system tokens (`--md-sys-*`,
  `--md-custom-*`), then the site's app tokens (`--paper`, `--ink`, `--line`,
  `--emerald`, the `--text-*` / `--surface-*` reading roles), which are aliases
  onto system roles and carry this site's semantics. New rules may use either;
  the app tokens are a deliberate layer, not debt.
- **No `@layer`.** The standalone tools' stylesheets are unlayered; layering
  the site would let them win every conflict.
- **The Tools follow the same roles.** `/fshare-tool` and
  `/course-registration` declare their own token names on
  `.static-tool-surface` only, each aliased onto a system or custom role, so
  they switch with the site's Theme. The Fshare tool's interactive accent is
  primary and its folders keep amber as `--md-custom-brass`; course
  registration's warnings use brass, its success teal.
- **No Material Web components.** `@material/web` is in maintenance mode, has
  no Expressive build, and ships custom elements that fight SSR; Expressive is
  implemented in plain CSS.
- **No container queries yet.** Media queries already fit every card at the
  widths screenshotted; add one when a component needs it, not before.

## Reviewing a change

`tools/screenshots.mjs` shoots twelve routes at 390/1024/1440 in light and
dark with an axe summary — locally (see CLAUDE.md for the NAS recipe) and on
every pull request. Look at the images: a green build has shipped a blank page
before.

## Do's and Don'ts

- **Do** use roles, never raw colours, outside the generated block and the
  terminal.
- **Do** keep EN/VI parity and let labels grow without clipping.
- **Do** verify hover, focus, pressed, disabled, empty, loading, error, dark
  and reduced-motion states.
- **Don't** add text below 11px, uppercase labels, or a new font family.
- **Don't** add shadows to ordinary nested surfaces or use an accent as
  decoration.
- **Don't** hide essential actions behind hover or signal state by colour
  alone.
