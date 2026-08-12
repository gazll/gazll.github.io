# CLAUDE.md

## Project

Study site for backend engineering interview prep. No framework, no build
step, no package.json — vanilla ES modules served straight to the browser.
`public/` is published to GitHub Pages by GitHub Actions.

**Two language layers, and they are not the same thing.**

1. **The shell stays English; reader surfaces follow EN/VI.** Navigation,
   account controls and shared utility chrome remain English. Study Track,
   System Design, Case Studies and the structured Project SRS follow the
   header's EN/VI switch. A Project's imported source documents remain in the
   language they were written in, while its manifest can carry localized SRS
   prose and requirements. (`lib/api.js` matches Vietnamese *and* English in
   its `authExpired` regex — `apps-script/Code.gs` answers in Vietnamese.)

   **One deliberate exception: `public/course-registration/`.** That sibling
   tool is entirely Vietnamese, and stays that way. It mirrors a Vietnamese
   source system (`phongdaotao.ntt.edu.vn`), so its labels reuse NTT's own
   wording — `Lịch học`, `Cơ sở`, `Dãy nhà`, `Phòng`, `Nhóm`, `GV`, `Sĩ số`,
   `Trạng thái` — taken from the `lang="dkhp-*"` attributes in NTT's markup.
   Translating those to English would make the tool read differently from the
   page it mirrors. This exception does not extend to the study site.

2. **The study material has an `EN`/`VI` switch in the header**, right of the
   progress ring. It was in the nav panel first and nobody could find it.
   English is the default language and each topic's base file; the complete
   Vietnamese original always exists alongside it as a `.vi.json` companion
   — see "The VI/EN language split".

Code comments are English, and they answer **why**, not what: the code already
says what it does. Keep them short.

## Layout

```
public/
  index.html         shell; loads the version-aware boot.js module
  boot.js            fetches version.json no-store, then loads matching CSS + app graph
  version.json       local "dev" release; deploy overwrites it with commit SHA + timestamp
  app.js             entry: hash router, topic track view (24 of the 27 topics; 10–11 and 27 render in System Design)
  config.js          GITIGNORED. Generated at deploy time from repo variables
  config.example.js  template to copy for local dev
  lib/
    constants.js     TOPIC_TYPES, DIFFICULTIES — the closed-set identifiers, label source
    markdown.js      renderMarkdown + renderUser (escaping variant)
    anchors.js       hash-router-safe heading permalinks and scroll restoration
    cross-ref.js     resolves a written (item-id) to the route that owns it
    ui.js            chevSVG, BADGE, debounce, localDay
    i18n.js          shared language storage + paired base/.vi JSON loader
    content.js       topic data model; owns the global content language and change events
    case-studies.js  numbered bilingual case-study data model + article-body cache
    system-design.js blueprint data model; resolves source_items to live topic items
    project.js       CalebZone SRS manifest and cached source-document/sample loader
    search.js        one index over all three surfaces: folding, ranking, snippets
    search-history.js recent searches: session while signed out, account once signed in
    mermaid.js       lazy loader for the vendored renderer; diagrams degrade to source
    question-links.js  #/track/<id> and #/system-design/<slug>/<id> route helpers
    clipboard.js     copyText with an execCommand fallback for local HTTP previews
    dsa-anim.js      DSA step-frame model + pure SVG frame renderer (no DOM)
    api.js           transport to Apps Script
    auth.js          Google Identity Services + header avatar/state machine
    store.js         offline-first progress, notes, study log
    interviews.js    interview journal data layer
  views/
    search.js        header search overlay (Ctrl/⌘+K) + the #/search/<query> panel
    interviews.js    interview journal CRUD (<dialog>)
    stats.js         streak + heatmap + per-topic progress
    admin.js         all-user overview (admin role only)
    system-design.js blueprint library + design/production-case reader, TOC, Mermaid tools
    case-studies.js  long-form case-study library + article reader/lightbox
    project.js       Project SRS reader with architecture, requirements, source docs and code samples
    release-notes.js bilingual changelog of the material; chrome stays English
    dsa-player.js    play/pause/step control for the DSA animations
  vendor/mermaid-11.16.1/  pinned upstream build; version lives in the directory name
  data/
    manifest.json       ordered list of every topic (n, topic_type, file, optional surface) — 27 rows
    meta.json            label/title/intro/tags/key/topic_type per topic, VI + EN in one file
    topics/NN-slug.json     complete English base, one file per topic (424 items total across 27 files)
    topics/NN-slug.vi.json  complete Vietnamese companion, same shape and item IDs
    release-notes.json   dated changelog of the material, VI + EN in one file
    dsa-animations.json  step frames for topic 19's 15 patterns; shared frames, per-language captions
    case-studies/manifest.json  ordered case-study rows (n, file, slug, immutable source fields)
    case-studies/meta.json      library/category/article metadata, VI + EN in one file
    case-studies/NN-slug.json     English guide + numbered English body path
    case-studies/NN-slug.vi.json  Vietnamese guide + numbered Vietnamese body path
    case-studies/articles/NN-slug[.vi].html trusted local long-form article pairs
    system-design/catalog.json  blueprints + production-case lenses, VI + EN in one file
    projects/calebzone/manifest.json  Project SRS metadata, module map, requirements, docs and sample manifest
    projects/calebzone/docs/        source-document snapshots imported from the CalebZone working tree
    projects/calebzone/samples/     sanitized Java/XML/YAML implementation samples
    interviews.json     seed entries, merged under everyone's own Sheet rows
  assets/case-studies/  local article figures; never hotlinked from a publisher
  assets/system-design/ local blueprint reference figures; catalog metadata owns EN/VI alt/caption
apps-script/Code.gs  the entire backend (Google Sheet as database)
tests/               every tests/*.test.mjs; discovered from disk, never enumerated
tools/               check.mjs (the one entrypoint) · validate-content.mjs · audit-content.mjs
                     add-content.mjs · stamp-assets.mjs
docs/content-playbook.md  how to add/update study content end to end
secret/              GITIGNORED. Personal setup notes and credentials
```

## Things that break easily

- **`.qhead` is a `<button>` — nothing inside it can be one too.** A nested
  `<button>` makes the browser silently close `.qhead` early, no console
  error, reparenting badge/chevron/answer as trailing siblings. The controls
  that need to be real buttons therefore live **outside** it: `.qtop` is a
  flex row holding `.qhead` and a sibling `.qmeta`, and `.qmeta` is where
  `.qcopy` and `.qlangbtn` sit. That is the only reason they can be genuine
  `<button>`s with native keyboard behaviour. Moving either back inside
  `.qhead` reintroduces the bug — and because both stop propagation, the
  symptom is not a click that toggles, it is a card whose answer has silently
  become a sibling of the card.

- **`lib/markdown.js` — the `SENT` sentinel.** It is
  `String.fromCharCode(0xE000)` on purpose. U+E000 is invisible in an editor,
  and if it degrades to an empty string the regex wraps **every number** in
  `<code>`. Do not "tidy" that line into a literal.

- **`item_id` is one flat key space, and it is a slug, not a number.**
  Format: `{topic-key}.{section-slug}.q{n}` — e.g.
  `01-java-core-jvm.memory-execution-model.q1`. `topic-key` is the topic's
  filename stem (matches `manifest.json`'s `file` and `meta.json`'s `key`);
  `section-slug` is generated once from the section's English title and
  reused for its `.vi.json` counterpart, so an item's id never changes with
  language. `progress`/`notes`/`study_log` in the Sheet key on this string
  verbatim (`item_id` is untyped there — see `Code.gs`'s `keyOf`), so an id
  is a **stored key**: renaming a topic's file, or re-slugifying a section
  title, orphans every row already in the Sheet for that topic.

- **The progress ring counts what the Study Track browses, not what `data/`
  holds.** `Content.topicItemIds` / `Content.totalTopicItems` are derived from
  `Content.topics`, which `_apply()` builds *after* dropping everything routed
  to another surface — so the denominator is 365 of the 424 items on disk, and
  `validate-content.mjs` prints both numbers so the split stays visible. Two
  things remove an item: a `manifest.json` row with `surface: "system-design"`
  (the whole topic, 10, 11 and 27), or a row listing individual ids in
  `system_design_items` (the OTA/whiteboard overlap in topic 16). Either way
  the item keeps its id and its `data/topics/` file — **the ids are stored
  Sheet keys**, so a reader's existing `progress` rows for those 59 items stay
  in the Sheet, simply uncounted. Never "clean up" by deleting the source
  items. Moving items between surfaces silently changes every reader's ring,
  so it belongs in `data/release-notes.json`.

- **Every topic needs a `topic_type`.** One of `core` · `data` · `design` ·
  `platform` · `algorithm` · `microservice`, defined once in
  `lib/constants.js` (`TOPIC_TYPES`) and read from there everywhere —
  `app.js`'s filter bar/stepper chip, `views/stats.js`, and
  `validate-content.mjs`'s validation set all import it rather than
  re-typing the list. The colours are the `[data-topic-type="…"]`
  custom-property blocks in `styles.css`. A topic with an unknown
  `topic_type` renders with no accent colour and drops out of the filter
  bar. Every item needs a `difficulty` the same way (`core` · `advanced` · `extra`,
  `DIFFICULTIES` in `lib/constants.js`) — it drives the ESSENTIAL/ADVANCED/EXTRA
  badge. `lib/constants.js`'s `label` is UI chrome (always English, per the
  "interface is always English" rule above); its `vi` field is reference
  only and nothing renders it.

- **Raw HTML blocks in a topic's `data/topics/NN-slug.json` end at the first
  blank line.** `renderMarkdown` collects lines starting with `<` until a
  blank one, so a blank line inside a `<pre>` or `<table>` truncates it and
  dumps the rest as literal text. Use a comment-only line as a separator
  instead.

- **Markdown headings are permalinks.** `renderMarkdown` gives each Markdown
  heading a local id and renders its text as an anchor. When a caller knows
  its route, pass `headingRoute` (and `headingPrefix` when multiple documents
  share a page) so the address becomes `#/view/item#heading`; the hash router
  restores the view and scroll position on reload. Do not add a clipboard
  action for this — clicking the heading updates the address bar and the
  reader can copy it with the browser's normal controls.

- **`renderMarkdown` never escapes, so `<` must be written `&lt;` everywhere
  in `data/topics/*.json`** — including inside inline code spans. `` `jcmd <pid>` ``
  emits a real `<pid>` element that the browser swallows, and the reader sees
  `jcmd  Thread.print`. Only `<` followed by a space survives as text. (The
  interview journal is the opposite: `renderUser` escapes first, so write a
  plain `<` there and never an entity.)

- **The interview journal merges two sources; `own` separates them.** Sheet
  rows carry `own: true`, `interviews.json` entries `own: false` and an id of
  `seed-N` (Sheet ids are UUIDs, so they cannot collide). Only own rows may be
  edited or deleted — a seed row has no Sheet row behind it, so `Sửa`/`Xoá`
  would fail. `importSeed()` copies one across, stripping every id so the
  backend creates new rows rather than editing. Seed entries whose name
  matches an own row are dropped, which is what makes import look in-place.

- **SVG `<marker>` ids must be unique across the whole file.** Every open
  card shares one DOM, so `url(#ar6)` resolves to whichever diagram rendered
  first — two diagrams reusing an id silently borrow each other's arrowheads.
  Name them after the item (`ar6_165`) rather than sequentially.

- **Release notes are one entry per release, grouped by day at render time.**
  `data/release-notes.json` stays append-friendly — a new release is a new row,
  newest first — and `groupByDate` in `views/release-notes.js` collects rows
  sharing a `date` under one heading, so the date is printed once however many
  releases it holds. Do not merge same-day releases by hand: several releases
  in one day is the normal case and each keeps its own title, with a
  `2 releases · 3 changes` roll-up on the heading. Grouping keys on the date
  string through a `Map`, so out-of-order rows are merged rather than
  duplicated, but the **group order follows first appearance** — keep the file
  newest-first or a day will surface in the wrong place. Tests pin the grouping
  and that same-date rows stay adjacent.

- **A DSA animation is mounted, never rendered inline.** `renderMarkdown`
  returns a string, so topic 19's pattern items carry only
  `<figure class='dgm dsa-anim' data-dsa='two-pointers'></figure>` and
  `views/dsa-player.js` fills it. `<figure>` and not `<div>`: `div` is not in
  `validate-content.mjs`'s `KNOWN` tag list, so a `<div>` placeholder fails
  validation. Every path that replaces card markup must call `stopDsaPlayers`
  first and `mountDsaPlayers` after — `renderDay`, "Expand all", collapsing a
  card, and the per-card language switch all do. Skip the stop and the
  `setInterval` keeps stepping a detached node. The per-card switch flips one
  card without touching `Content.lang`, which is why `mountDsaPlayers` takes an
  explicit language.

- **Animation frames are snapshots, and captions are per language.** A frame
  carries the whole visual state, so scrubbing to any step is O(1) and cannot
  drift the way replayed deltas do. `frames` are shared between EN and VI and
  only `en.notes[i]` / `vi.notes[i]` differ — a translation therefore cannot
  fall out of step with the drawing. Captions are printed into an HTML
  `<figcaption>`, never into the SVG: `<text>` does not wrap, and the notes run
  past 200 characters.

- **Syntax-highlight classes are scoped to `pre code`.** `.k .s .c .n .r .f`
  are one letter long and collide with UI classes — `.f` is also the interview
  modal's form-field class (`display:flex;flex-direction:column`), which put
  every highlighted function name on its own line until both sides were
  scoped. Keep new palette rules under `pre code`.

- **`Store.flush()` must stay serialized.** Two parallel pushes each slice the
  queue by their own `batch.length` and drop the other's ops. `_inflight` +
  `_pending` keep exactly one in flight, and `flush()` resolves only after the
  data really went out — the `visibilitychange` handler relies on that.

- **`api.js` must send `Content-Type: text/plain`.** Apps Script cannot answer
  a preflight OPTIONS. `application/json`, or an `Authorization` header, makes
  the request CORS non-simple and it fails. Hence idToken travels in the body.

- **Search folds text without changing its length.** `fold()` in
  `lib/search.js` lowercases and strips Vietnamese diacritics **per
  character**, because every offset — the snippet window, every `<mark>` — is
  found in the folded copy and applied to the original. `normalize('NFD')`
  over a whole string expands `ế` into three code units, and the highlight
  then lands mid-word. It does not throw; it just slices words in half. The
  same rule is why `plainText()` decodes entities *after* stripping tags:
  `&lt;pid&gt;` is text the author wrote, and decoding first would let the tag
  stripper eat it.

- **The search index is a copy, so a language switch must drop it.**
  `SearchIndex.entries` holds flattened strings taken out of `Content.topics`,
  the blueprint catalog and the case-study guides — none of which are re-read
  after the build. `views/search.js` registers its `Content.onChange` in
  `mountSearchOverlay()`, which `app.js` calls **before** its own listener, so
  the index is invalidated before any view repaints from it. The archived
  case-study articles (~200KB per language) load in a second pass,
  `SearchIndex.enrich()`, and whatever is on screen repaints when it lands:
  blocking the first result on eleven HTML files reads as a broken search.

- **The overlay's keys are handled on `document`, not on the dialog.**
  Removing a recent search repaints the list under the button that was
  clicked, which drops focus to `<body>` — a listener on the dialog goes deaf
  at exactly that moment and `Esc` stops closing. The click handlers therefore
  also return focus to the input. Result rows carry `data-index` in **DOM**
  order (groups render in `SURFACES` order, ranking only orders rows within a
  group), which is what makes arrow keys move the way the list looks.

- **Search history follows the account, and is carried over exactly once.**
  Signed out it is `sessionStorage` — a borrowed browser must not keep someone
  else's reading trail; signed in it is `localStorage` under the account
  bucket plus the Sheet. `attachAuth()` merges the session list into the
  account on sign-in and then **deletes the session key**, so a second account
  signed in from the same tab does not inherit it. `search.delete` matches the
  exact stored string, which is why `pull()` re-queues any row whose spelling
  the merge changed. Every remote call is best-effort: an Apps Script
  deployment without the `search.*` actions answers "Action không hợp lệ." and
  the reader must not notice.

- **Adding a menu is one entry in `VIEWS`.** `sec` picks the nav-panel section
  (`technical` · `experience` · `tool` · `about`). An entry with `href` is an external
  destination: it renders as a new-tab link and `currentViewId()` refuses to
  route to it, so a hash matching its id falls back to the track. That is how
  sibling apps under `public/` (e.g. `fshare-tool/`) join the menu.

- **Project is an implementation snapshot, not another Study Track.** The
  `Project` menu currently opens `#/project` and renders the CalebZone SRS from
  `data/projects/calebzone/manifest.json`. The manifest points at copied source
  documents and code/config samples so the page works after GitHub Pages deploy;
  it cannot read the sibling `/home/.../calebzone` directory at runtime. Update
  the snapshot deliberately, redact secrets before adding a sample, and keep
  `locales.vi` aligned with the structured module/requirement/decision arrays
  when the SRS is shown in Vietnamese. Source-document headings are scoped by
  document id so their permalinks stay unique on the one Project page.

- **Case studies are numbered and bilingual, but are not Study Track topics.**
  They do not have item ids, difficulty, reviewed state or notes, and never
  change the progress denominator. Their manifest follows the Topic convention:
  an immutable numbered row points at `NN-slug.json`, with a complete
  `NN-slug.vi.json` companion; localized metadata stays in the collection's own
  `meta.json`. `lib/i18n.js` provides the paired loader used by both data models,
  while `Content.lang` remains the one global EN/VI state. Full article bodies
  are paired as `articles/NN-slug.html` and `articles/NN-slug.vi.html`; their
  heading ids, code blocks and figure order must stay aligned. Figures live in
  the matching `assets/case-studies/NN-slug/` directory because the CSP permits
  local images, not publisher hotlinks. The visible URL deliberately keeps the
  unnumbered slug (for example `#/case-studies/arcturus-inventory-processing-system`),
  so reorganizing source files never breaks bookmarks. Do not store author names
  or retain contributor sections/images: article attribution is publication date
  plus the original Tiki Engineering URL only. Desktop TOC is the collapsible
  left column; its persisted state must not affect the mobile `<details>` TOC.
  Each manifest row also owns a local `cover_image` from that article and an
  explicit `cover_fit` (`cover` or `contain`); card art must reflect its content.

- **System Design is a presentation surface over existing content, not a copy
  of it.** `data/system-design/catalog.json` holds the blueprint prose, but a
  design's `source_items` are **ids, not text** — `lib/system-design.js` looks
  each one up through `Content.itemPair()` at render time, so the migrated
  deep-dive notes stay the single copy that lives in `data/topics/`. Editing a
  topic file therefore updates the blueprint too. Two invariants the validator
  now enforces: every `source_items` id must exist, and it must **also** be
  off the track (via `surface` or `system_design_items`) — otherwise the reader
  meets the same question twice, which is exactly the failure this layout was
  meant to prevent. An id may be claimed by only one design. Production cases
  are the `systems-architecture` rows handed over by Case Studies; each needs a
  `case_overviews` entry, and the pairing is checked in both directions.
  A design whose notes came from somewhere other than topics 10–11/16 states
  where in its own `migrated_note` (one per language, beside `tags`).
  `views/system-design.js` falls back to the COPY sentence, which names those
  original topics and is wrong for anything else — so the sentence lives in the
  catalog with the rest of the prose. Never branch on a slug in the view.

- **A blueprint reference figure is optional, local and bilingual.** Put the
  file under `assets/system-design/` and add one root `reference_image` object
  to that catalog row: repository-relative `src`, intrinsic integer `width` /
  `height`, then `en` and `vi` blocks with non-empty `alt` and `caption`.
  `lib/system-design.js` localizes that nested record and the view renders it
  below the editable Mermaid diagram as a full-resolution link. Do not put the
  source image inside one language block, hotlink it, or branch on a blueprint
  slug; the validator checks the path, file, dimensions and both translations.

- **IMPORTANT — the blueprint reading format is reviewed and settled. Do not
  re-flatten it.** These four decisions were made together against a real
  blueprint (`scaling-1m-to-10m-requests`) and each one replaced something that
  had already been tried and read badly. Changing one in isolation reintroduces
  the problem it fixed.

  1. **Decision rows stack; they are not a table.** `data_model` and `stack`
     names run 7–42 characters while their details run 120–570. The old
     `<table class="sd-comparison">` gave the name a fixed `width:31%`, so a
     seven-character name held half the row while the detail was squeezed into
     the rest. `comparisonTable()` now emits `.sd-decision-row`: name on its own
     line with a number chip, detail beneath it, indented under a left rule and
     free to use the full width. **`.sd-comparison-wrap` is kept as the outer
     class on purpose** — `tests/system-design.test.mjs` pins it.
  2. **A `:` or `—` in a catalog row is a structural break, not punctuation.**
     `splitDecision()` splits there, and both halves render on their own line.
     Never render the raw string — the label runs straight into the body text,
     which is the "dính chữ" this replaced. The same split drives the trade-off
     cards (`<strong>` + `<p>`), so they match.
  3. **Three tones, and they must stay rare.** `emphasize()` in
     `views/system-design.js` is the only thing that colours body text:
     `.sd-crit` clay = the cost or what breaks, `.sd-note` emerald = the rule
     that settles a choice, `.sd-num` ink-bold = quantities. The patterns are
     **narrow multi-word phrases, deliberately not keyword lists** — an earlier
     pass matched bare verbs (`use`/`choose`/`dùng`/`chỉ`) and lit a dozen spans
     per paragraph, which reads as noise and buries the two lines that matter.
     The test fails above 1 span/row (currently ~0.36). Two traps it guards, both
     of which corrupt text silently rather than failing the build: `QUANTITY`
     runs last and must not eat the digits of a sentinel an earlier pattern
     wrote (hence the private-use digits U+E010–E019, never ASCII), and it must
     not read the `39` of `&#39;` as a number (hence the `(?<!&#)` guard).
     Ranges match whole, so `1-10 triệu` is one span.
  4. **The article head is padded to the body column, and the TOC collapses in
     place.** `.sd-article-head` carries `padding-left: var(--sd-rail) + 28px`
     so the title starts level with the article body instead of hanging off the
     left edge past the TOC rail. The desktop TOC collapses to a 44px icon rail
     rather than unmounting — the grid column keeps its place, so collapsing
     never reflows the body mid-read, and `--sd-rail` drives the head padding
     and the grid together. State persists in `gazl.sd.toc`. Per the Case
     Studies rule, this **must not touch the mobile `<details>` TOC**: below the
     breakpoint the rail is gone and the head padding resets.

- **Mermaid is vendored, pinned by directory name, and loaded lazily.** The CSP
  is `script-src 'self'`, so a CDN was never an option — `public/vendor/
  mermaid-11.16.1/` is upstream's own build, committed unmodified. Never edit
  those files and never lint them: `tools/check.mjs` skips any path containing
  `vendor/`, which is also why the console-logging ban does not trip on them
  (`lib/mermaid.js` pins `logLevel: 'fatal'` instead). Upgrading means a **new
  directory**, not a modified one — that name is the cache key, which is why
  `stamp-assets.mjs` correctly leaves `.mjs` imports unstamped. The renderer is
  behind a dynamic `import()` so the ~800K only loads once a design article
  opens, and `securityLevel: 'strict'` + `htmlLabels: false` keeps diagram text
  from becoming markup. A render failure is not fatal by design: the `<pre>`
  already holds the escaped source, so the diagram degrades to readable,
  copyable Mermaid rather than a blank frame.

- **Every Pages deploy is one immutable asset version.** `tools/stamp-assets.mjs`
  writes the first 12 characters of `github.sha` plus `deployed_at` to
  `public/version.json`, versions local JS/CSS references in HTML, and versions
  every relative ESM import. Stamping only `app.js` is insufficient because its
  dependencies would still be cacheable under old URLs. `boot.js` always fetches
  `version.json` with `no-store`, swaps in that release's stylesheet, then imports
  the matching app entry. Keep the bootstrap small, stable and free of app logic.

- **The nav panel is `inert` while closed.** Without it the off-screen links
  stay in the tab order — the drawer is moved by `transform`, not `display`.
  `close()` blurs first, because focus inside a subtree that then becomes
  inert is not moved out on its own.

- **One shell width: `--shell` (+ `--gutter`).** `.top-inner` and `main` both
  read it, which is the only reason they line up. The topic dropdown is
  positioned against `.top-inner`, *not* `header.top` — the header is
  full-bleed, so anchoring there parks the panel on the window edge while the
  rest of the page stays centred.

- **The header is one row, and the topic picker is its title.** There is no
  brand block and no second `.topicbar` line: `#topicPick` sits between the
  nav toggle and `.headright`, carrying `track-only` so it disappears on every
  other view. Nothing in the header names the current *view* — `showView()`
  writes that into `document.title`, and the nav panel marks it with
  `aria-current`.

- **The header stays one row at every width, so it sheds instead of wrapping.**
  The picker is the only flexible item in `.top-inner`; everything else is a
  fixed-size control, so each thing dropped goes straight into the topic label.
  In order: `.progress-meta` + `.tb-steps` at 760, the header switch's EN/VI
  labels + `.tp-sub` at 600, `.progress-wrap` + `.syncstate` at 420. Below
  ~375px the label ellipsises, which is fine — the hero right underneath names
  the topic in full. Do not answer a cramped header with `flex-wrap`: that is
  the two-row layout this replaced.

- **`header.top` is a stacking context** (`position:sticky` + `z-index:50`),
  so anything inside it is trapped below 50 no matter its own `z-index`. That
  is why `.topic-scrim` is `z-index:40`: at 60 it covered the very dropdown it
  was supposed to sit behind.

- **Collapsing the header keeps the topic picker.** Only `.tp-sub` and the
  step buttons shrink. Collapsing is for reading, and jumping topics is what
  you do while reading.

- **A silent sign-in attempt must always end.** `Auth.connecting` is only true
  while an attempt is genuinely in flight; `SILENT_MS` and the
  `prompt()` notification each end it, and the resting state afterwards is
  `stale` — a still badge plus a real sign-in button. Do not reintroduce
  "has a hint and no token ⇒ connecting": FedCM suppressing the prompt is
  routine, and that spelling left the header spinner running forever with no
  way in. `Auth.state` is the single value the UI switches on.
  `tests/auth.state.test.mjs` pins all of it.

## The VI/EN language split

English is the **default and base** language. Every base topic file is
complete English, and every `.vi.json` companion is complete Vietnamese.
`Content.load()` fetches both eagerly (`manifest.json`, `meta.json`, every
topic's base file, and every topic's `.vi.json` companion), so the header
switch selects the already-loaded language and never needs a refetch.
If a `.vi.json` companion cannot be loaded, VI mode gracefully displays that
topic's English base instead of failing.

- **Topic files** — the base and companion use the same section order, item
  order, and four-key item schema. Their stable item IDs must match exactly;
  only the Vietnamese/English text differs.
  ```json
  { "sections": [{ "title": "…", "items": [
    { "id": "01-java-core-jvm.memory-execution-model.q1", "difficulty": "core", "q": "…", "a": "…" }
  ] }] }
  ```
- **Metadata** — `meta.json` has complete `topics["N"].en` and `.vi` blocks
  for each manifest topic. Each contains `label`, `title`, `intro`, and
  non-empty `tags`; the key name must match the language of its value.
  ```json
  { "topics": { "1": { "topic_type": "core", "key": "01-java-core-jvm",
                        "vi": { "label": "…", "title": "…", "intro": "…", "tags": ["…"] },
                        "en": { "label": "…", "title": "…", "intro": "…", "tags": ["…"] } } } }
  ```
  `key` is the topic's filename stem (without `.json`) — the id-reference
  the file names are built from, kept here so lookups do not need to parse
  paths, and the prefix every item ID in that topic starts with.
- **`_apply()` must keep cloning the source.** Overlaying in place would
  overwrite one language's strings with the other's, and switching back
  would then show the wrong text.
- **Content is validated, not trusted.** `validate-content.mjs` checks the
  manifest/meta contract, topic types and difficulties, item schemas and IDs,
  matching bilingual section/item sequences, markup safety, duplicate IDs,
  SVG marker uniqueness, and cross-references. It also covers
  `system-design/catalog.json` — bilingual completeness of every design,
  category and case lens, plus the `source_items` rules above — because those
  ids point *out* of the file and a typo there fails silently. With `--stats`,
  it reports structural/content statistics: topic and difficulty counts,
  answer lengths, cross-references, thin items, and code/table/SVG usage.

## Content standards

- **Write against the current release, and go to the primary source.** This is
  interview material for people who will be asked what they would do *now*, so
  a claim is worth what its source is worth: the spec, the RFC, the project's
  own reference docs, the vendor's own limits page — not a blog rewrite of
  them. The research-source allowlist in `tests/system-design.test.mjs` is a
  whitelist of origins, **not a limit on research**: when the best source for
  something lives on a host that is not in it yet, add the origin rather than
  settle for a weaker source. Every version-bound claim gets an entry in
  `data/content-reviews.json` with `reviewed_at` and `target_versions`, which
  is what separates a checked claim from an inherited one — see
  `docs/content-playbook.md` §1.4 and §2.5 for the claim types and the
  provenance rule for benchmark numbers.

- **One owner per mechanism, pointers everywhere else.** Duplicated *mechanism*
  — the same parameter table, the same trap list, the same example — is the
  thing to avoid: fix one copy and the other is now wrong. Duplicated *context*
  is not: "the three breaker states and their Resilience4j parameters" and
  "per-route or shared breaker at the gateway" are two interview questions, not
  one written twice. So a topic that merely *uses* a concept states the
  decision in its own context in a few lines and cross-refs the owner with
  `(item-id)`. Those render as links — `renderMarkdown` takes an optional
  `resolveRef`, and `lib/cross-ref.js` routes an id to `#/track/…` or to the
  blueprint holding it — which is what makes a pointer an acceptable substitute
  for a second copy. A reference is never re-explained prose. And an item is never
  deleted to remove a duplicate — `item_id` is a stored Sheet key. The only
  removal available is rewriting the item into pointer form while keeping its
  id, which costs the depth a reader already studied and still leaves the card
  in the progress ring; reserve it for a genuine verbatim duplicate.

- **The four traffic tiers are the site's shared yardstick.** A component is
  sized by its **peak rate**, so that is the number a capacity line leads with
  — with the daily volume in parentheses, because requests/day is the number a
  reader actually knows about their own system: `250 rps peak (1M req/day)`.
  Write both, in that order, every time:

  | Tier | Requests/day | Avg rps | Peak rps (planning) |
  |---|---|---|---|
  | T1 | 10k | 0.12 | ~2.5 |
  | T2 | 100k | 1.2 | ~25 |
  | T3 | 1M | 11.6 | ~250 |
  | T4 | 100M | 1,157 | ~25,000 |
  | *(waypoint)* | 10M | 116 | ~2,500 |

  `peak ≈ 20 × average`, rounded up. That factor is not arbitrary: it
  reproduces the numbers already written into
  `11-system-design-cases.the-big-prompts.q13/q15/q16` (1M/day ↔ 250 rps peak,
  10M/day ↔ 2,500 rps peak, 100M/day ↔ ~25,000 rps peak). Keep the anchors — a
  second peak factor elsewhere makes two topics contradict each other. It is a
  heuristic, so state the assumption where it matters: consumer and campaign
  traffic concentrates 10–20×, steady internal/B2B traffic 3–5×.

  T1→T3 each step is 10×, and T3→T4 is 100× on purpose: that last jump is where
  a system stops growing and changes shape (shards or cells, regional
  isolation, blast-radius design). 10M/day is the documented waypoint inside it
  — the tier that most readers are actually approaching — so name it when the
  answer changes there, but do not turn it into a fifth column. Everything
  between 10M and 100M is the same regime, and the honest way to describe T4 is
  as **N copies of a T3 system plus routing**: ~25,000 rps peak is roughly ten
  cells each carrying a T3-to-waypoint load. Per-cell numbers are the ones a
  reader can reason about; the tier-wide number only sizes the fleet.

  A technology, a config line or a pattern is then judged **per tier**, in
  these four words: `not needed` (the operational cost exceeds the benefit
  here) · `worth it` (cheap insurance, not yet required) · `mandatory` (its
  absence is an incident waiting) · `needs its own scaling story` (one config
  line will not do it; it needs its own component and an owner). Using the same
  four verdicts everywhere is what makes the tiers a yardstick instead of
  decoration — so they are these words, not synonyms of them. "Worth having"
  for `worth it` is the drift that already had to be corrected once.

  The Vietnamese companions use one fixed set too, established by topic 27:
  `không cần` · `nên có` · `bắt buộc` · `cần scale riêng`. Same rule — a
  translation that reaches for a different phrase each time is no longer a
  yardstick.

## Security model

There is no RLS. `Code.gs` is the only thing enforcing access:

1. Every action passes `requireUser()` before touching a Sheet.
2. `verifyIdToken()` checks `aud === CLIENT_ID`. Without it, a Google ID token
   minted for another app impersonates any user here.
3. `user_id` always comes from the verified token's `sub`, never the client.

Hiding the Admin menu is cosmetic — `admin.overview` checks the role itself.

Neither `GOOGLE_CLIENT_ID` nor `SCRIPT_URL` is a secret: the browser needs
both, so they are readable in the deployed page source. Keeping them in repo
variables only avoids GitHub scraping. This flow uses no client secret at all.

The Google ID token is a credential. It stays in JavaScript memory only:
never persist it to `localStorage`/`sessionStorage`, include it in an error, or
write it to any browser/server log. The Sheet itself must keep **General
access: Restricted** and must not be shared with app users; they access only
their own rows through the verified Apps Script API.

Search queries are reader data like progress and notes: they reach the Sheet
only through `search.push`, only while signed in, and land under the verified
`sub`. Signed out they never leave the browser session at all — see the search
history rule in "Things that break easily".

What `localStorage` *does* hold is `gazl.profile` — the **profile hint**:
`{sub, email, name, picture}` and nothing else. It exists so a returning
reader sees their own avatar on first paint while `auto_select` fetches a real
token; `readHint()` rebuilds the object field by field, so a `token`/`role`
planted there is dropped rather than trusted. Never widen it: `role` still
comes from the backend and `user_id` still comes from the verified `sub`.
Three tests in `tests/security.test.mjs` pin this.

## Before pushing

Editing study content? `docs/content-playbook.md` is the full procedure —
investigating what to change, the format rules, the VI/EN contract, and the
patch tool. The commands below are the subset CI cares about.

```bash
# everything CI enforces, in CI's order, from the same file CI calls:
# content validation · ESM syntax of every shipped module · the console-logging
# ban · every tests/*.test.mjs
node tools/check.mjs

node tools/check.mjs --audit        # + the editorial report (never fails)
node tools/check.mjs --only tests   # one stage; --list names them
node tools/check.mjs --list

# run it (python may not be on PATH — `npx serve public` works too)
cd public && python -m http.server 8080
```

`check.mjs` discovers modules and test files from disk, so a new
`tests/*.test.mjs` is picked up locally **and** in CI without editing
`deploy.yml`. The individual tools still stand alone when you want detail —
`node tools/validate-content.mjs --stats` for content statistics,
`node tools/audit-content.mjs --dense` for the prose-density report.
Anything under `public/vendor/` is skipped everywhere: it is upstream code,
pinned by directory name.

Editing `apps-script/Code.gs` requires Deploy → Manage deployments → New
version, otherwise the Web App keeps serving the old code. The `search.pull` /
`search.push` / `search.delete` actions and the `search_history` sheet were
added there — until that redeploy, signed-in search history stays on the
device and the site behaves exactly as it did before.
