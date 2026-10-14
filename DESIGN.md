---
version: md3-1
name: GAZLL
description: A calm, evidence-led systems lab notebook for bilingual senior backend interview preparation, built on Material Design 3.
system: Material Design 3 (baseline, not Expressive)
seed: "#0B6E4F"
scheme: TonalSpot
colors:
  light:
    primary: "#1E6A4F"
    on-primary: "#FFFFFF"
    primary-container: "#A8F2CF"
    on-primary-container: "#005139"
    secondary-container: "#CFE9D9"
    on-secondary-container: "#354B40"
    surface: "#F5FBF5"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#EFF5EF"
    surface-container: "#EAEFEA"
    surface-container-high: "#E4EAE4"
    on-surface: "#171D1A"
    on-surface-variant: "#404944"
    outline: "#707973"
    outline-variant: "#BFC9C2"
    error: "#BA1A1A"
    error-container: "#FFDAD6"
  dark:
    primary: "#8CD5B3"
    on-primary: "#003826"
    primary-container: "#005139"
    on-primary-container: "#A8F2CF"
    secondary-container: "#354B40"
    on-secondary-container: "#CFE9D9"
    surface: "#0F1512"
    surface-container-lowest: "#0A0F0C"
    surface-container-low: "#171D1A"
    surface-container: "#1B211E"
    surface-container-high: "#252B28"
    on-surface: "#DEE4DE"
    on-surface-variant: "#BFC9C2"
    outline: "#8A938D"
    outline-variant: "#404944"
    error: "#FFB4AB"
    error-container: "#93000A"
  custom-groups: [indigo, teal, clay, brass, violet, slate, rose, steel]
  terminal: { background: "#0F1D31", raised: "#16273F", text: "#E6ECF5", muted: "#A8B7C9" }
typography:
  brand: "Roboto Flex (variable, self-hosted)"
  plain: "Roboto Flex (variable, self-hosted)"
  mono: "Roboto Mono (variable, self-hosted) — code only"
  scale: "MD3 type scale in rem: display L/M/S 57/45/36, headline 32/28/24, title 22/16/14, body 16/14/12, label 14/12/11"
  floor: "11px (label-small); nothing smaller"
shape: { extra-small: 4px, small: 8px, medium: 12px, large: 16px, extra-large: 28px, full: 9999px }
motion: { standard: "cubic-bezier(.2,0,0,1)", emphasized-decelerate: "cubic-bezier(.05,.7,.1,1)", short: 100–200ms, medium: 300–400ms }
state-layers: { hover: 8%, focus: 10%, pressed: 10%, dragged: 16% }
---

# Design System: GAZLL on Material Design 3

## Overview

**Creative North Star: "The Systems Lab Notebook"** — a calm, rigorous
workspace where a senior backend engineer collects evidence, rehearses
explanations and returns to difficult ideas. It reads like an annotated
technical reference, not a promotional learning product.

Since 2026-10-14 the notebook is expressed in **Material Design 3**: MD3
colour roles, type scale, shape scale, state layers, elevation and motion,
and MD3 component anatomy for buttons, chips, cards, the top app bar, the
navigation drawer, search, dialogs and segmented buttons. The baseline is
deliberate: MD3 *Expressive* (2025) favours large shapes and lively motion,
which fights a long-reading surface.

`public/styles.css` declares everything here; this file says why. Where the
two disagree, the CSS is what ships and this file is the bug.

## Colour

**One seed, two themes, generated.** `tools/md3-tokens.mjs` derives every
colour role from the seed `#0B6E4F` with the TonalSpot scheme of
`@material/material-color-utilities` and writes the block between the
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
  neon (teal `#6FF7F6`, brass `#FFE166`).
- **Selected = secondary container.** Pressed chips, the active drawer item,
  the current contents entry and segmented selections all use
  `secondary-container` / `on-secondary-container`. `primary` is for the one
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

Roboto Flex for everything a person reads or operates; Roboto Mono only for
code. Both are self-hosted (`tools/fonts.mjs` copies the wght-axis subsets for
latin, latin-ext and vietnamese from `@fontsource-variable`), which also took
Google Fonts out of the CSP.

- Sizes are the MD3 type scale in `rem`. Labels are `label-*` (medium weight,
  sentence case, ~0.5px tracking); the old uppercase mono eyebrows are gone.
- **Nothing below 11px** (`label-small`). Text at 8–10px was the least readable
  on the site and is not coming back.
- Long reading uses `--reading-size` / `--reading-leading` (16–17.5px, 1.76):
  Vietnamese stacks diacritics and needs the extra leading.

## Shape, elevation and motion

- **Shape:** buttons and search are `full`; chips and tags `small` (8px);
  cards `medium` (12px); hero panels and the drawer edge `large`; dialogs,
  the search view and the pager `extra-large` (28px).
- **Elevation is tone first.** Separate with `surface-container-*` and
  `outline-variant`; shadows (`--md-sys-elevation-level1…5`) only where MD3
  lifts something: an open card, a hovered filled button, the pager, dialogs.
- **State layers:** hover mixes the content colour over the container at 8%,
  focus and pressed at 10% (`color-mix()`), never `filter: brightness`.
- **Motion:** MD3 easing and duration tokens; route changes cross-fade through
  the View Transition API with the app bar held still; a scroll-driven
  progress bar runs under the header. All of it is off under
  `prefers-reduced-motion`.

## Components

The shared skin lives in one block at the end of `styles.css` ("MD3
components"). Layout stays with the surface that owns it.

- **Buttons:** filled (`.btn-primary`, `.pbtn.next`, `.cal-primary`) and
  outlined (`.btn-ghost`, `.pbtn`); 40px, `label-large`, full corner. One
  filled button per decision area.
- **Chips:** 32px, 8px corner, outline-variant border; selected chips swap to
  the (family) container and show a leading check, so selection is never colour
  alone. Non-interactive tags are outlined labels, not chips.
- **Cards:** outlined on `surface-container-lowest`; hover adds a state layer,
  not a shadow. The hero is a filled `surface-container-low` panel.
- **Top app bar:** `surface`, one row, sheds controls instead of wrapping (the
  rule in CLAUDE.md stands). The search trigger is an MD3 search bar.
- **Navigation drawer:** `surface-container-low`, full-corner active indicator
  in `secondary-container`, 56px items; display choices sit in its footer as
  segmented buttons.
- **Dialogs and search view:** `surface-container-high`, 28px corner, scrim at
  32%. Text fields are outlined with a 4px corner and a primary focus edge.

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
  the site would let them win every conflict and their `:root` tokens repaint
  the shared header.
- **No Material Web components.** `@material/web` is in maintenance mode and
  ships custom elements that fight SSR; MD3 is implemented in plain CSS.
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
