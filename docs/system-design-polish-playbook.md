# System Design & Case Studies — readability playbook

How to keep improving the blueprint and case-study reading experience after the
2026-08-10 formatting pass. The renderer changes described here are **generic**:
they already apply to all 18 blueprints and both languages. What remains is
mostly **content shaped to feed them**, plus the case-study surface, which has
not been touched yet.

Read `CLAUDE.md` → the System Design bullet first. The four decisions recorded
there (stacked decision rows, `splitDecision` on `:`/`—`, three-tone
`emphasize()`, collapsing TOC rail) are settled; this document is about what
comes next, not about redoing them.

---

## 1. What the renderer already does for every blueprint

You do not need to edit any of this per topic. Understanding it tells you how to
write content that renders well.

| Native System Design page/component | What it does | Fires when |
|---|---|---|
| `renderScope()` | Splits `scope` into a lead paragraph, a body paragraph, and a closing pull-quote (`.sd-thesis`) | Only if scope ≥ 260 chars **and** ≥ 3 sentences |
| `listRow()` | Promotes a `Label: rest` lead-in onto its own line | Row starts with 4–60 chars then `: ` |
| `splitDecision()` | Splits a `data_model`/`stack`/`tradeoffs` row into name + detail | Row contains ` — ` or `: ` |
| `emphasize()` | Three-tone highlight: clay `.sd-crit`, emerald `.sd-note`, ink `.sd-num` | Narrow phrase patterns only |

Current coverage across the catalog (measured, not estimated):

- scopes broken into paragraphs: **6 of 36** (the rest are already short)
- scopes with a pull-quote thesis: **5**
- list rows with a promoted label: **34 of 368 (9%)**
- emphasis density: **~0.36 spans/row** (test fails above 1.0)

### Why some sections still look flat

Because the content does not give the renderer anything to work with. A scope
that is one 200-character sentence renders as one paragraph — correctly. The
fix is editorial, not CSS.

---

## 2. Highest-value next step: shape the content

This is where the remaining reading-experience gain is. Work through
`public/data/system-design/catalog.json`, per blueprint, in both `en` and `vi`.

### 2.1 Give long scopes a thesis sentence

`renderScope()` pulls the **last** sentence into the green pull-quote when it is
≤ 160 chars and the scope has ≥ 3 sentences. So: end a long scope with a short,
declarative claim — the one line you want the reader to keep.

Good closing sentence (this already works, blueprint 16 VI):

> Gọi tên được ràng buộc đang chặn — và từ chối những nâng cấp không nhắm vào
> nó — chính là toàn bộ kỹ năng ở đây.

Three scopes currently miss out: `high-traffic-booking-search` (EN + VI, ~400
chars but only 2 sentences) and `scaling-technique-catalogue` VI (closing
sentence too long to pull out). Re-run this to check:

```bash
node -e "
const c=require('./public/data/system-design/catalog.json');
for (const d of c.designs) for (const l of ['en','vi']) {
  const s=d[l].scope, n=s.split(/(?<=[.?!])\s+/).length;
  if (s.length>=260 && n<3) console.log('needs sentence breaks:', d.slug, l, s.length, n+' sentences');
  if (s.length>=260 && n>=3 && s.split(/(?<=[.?!])\s+/).pop().length>160)
    console.log('closing sentence too long for a thesis:', d.slug, l);
}"
```

### 2.2 Add `Label:` lead-ins to dense list rows

Only 9% of rows have one. A row over ~120 chars that opens with a concept is a
candidate — put the concept first, then `: `, then the explanation. The renderer
does the rest.

Before: `Số học đi trước kiến trúc: rps đỉnh, tỷ lệ đọc/ghi, …` ✅ already good
After the same pattern applied to a currently-flat row.

As of this pass there are **53** rows over 120 chars with no label — the single
biggest remaining readability win. List them longest-first:

```bash
node -e "
const c=require('./public/data/system-design/catalog.json');
const rows=[];
for (const d of c.designs) for (const l of ['en','vi'])
  for (const f of ['functional','quality','capacity'])
    d[l][f].forEach(r=>{ if(!/^[^:—–]{4,60}:\s/.test(r) && r.length>120) rows.push([r.length,d.slug,l,f,r.slice(0,70)]); });
rows.sort((a,b)=>b[0]-a[0]).slice(0,25).forEach(r=>console.log(r.join(' | ')));"
```

### 2.3 Keep EN and VI in step

Both languages render through the same helpers, so a label added to EN and not
VI makes the two read differently. Fix them in the same edit.

---

## 3. Case Studies — not yet touched

The native collection reader and the `.cs-*` rules in `styles.css` did **not**
get this pass. The article bodies are trusted local HTML
(`data/case-studies/articles/NN-slug[.vi].html`), so the approach must differ
from the blueprints, where prose comes from JSON.

Suggested order:

1. **Reuse what exists rather than reinventing.** The case-study reader already
   has a desktop TOC with persisted state. Check whether the blueprint's
   collapsing rail (`--sd-rail`, `gazl.sd.toc`) should be generalised into a
   shared pattern, or deliberately kept separate. **Constraint from CLAUDE.md:
   the desktop TOC's persisted state must not affect the mobile `<details>`
   TOC.** That rule already exists for case studies — do not break it.
2. **Do not run `emphasize()` over article bodies.** Those are full HTML
   documents, and the current implementation escapes its input — it is built for
   plain strings from JSON, not for markup. Applying it to article HTML would
   double-escape the tags. If you want emphasis there, it belongs in the source
   HTML as real elements.
3. **The guide block is safe to improve.** `renderCaseGuide()` renders
   `guide.problem` / `core_idea` / `outcome` from JSON — those are plain strings
   and already go through `emphasize()`. Long ones could use `renderScope()`
   the same way blueprints do; that is a one-line change per field.
4. **Typographic measure.** `.sd-section>p` now caps at `74ch`. The
   `.cs-article-body` rules have no such cap; long-form articles are the place
   it matters most.

---

## 4. Ideas deliberately not done

Recorded so they are not re-proposed blindly:

- **Auto-generating sub-headings inside long scopes.** Rejected: the text has no
  reliable structure to derive headings from, and invented headings misrepresent
  the author.
- **Splitting list rows on `;` into nested bullets.** 46 rows contain `; `, but
  the clauses are usually a single thought — nesting them fragments the sentence.
- **Widening the emphasis patterns.** Already tried and reverted; see CLAUDE.md.

---

## 5. Before pushing

```bash
node tools/check.mjs          # everything CI runs, including the two new tests
```

The two guards that matter for this work:

- `the three-tone emphasis never corrupts the text it highlights` — density
  ceiling plus the sentinel/entity traps.
- `breaking prose into paragraphs and labels never loses text` — `renderScope`
  and `listRow` compared whitespace-insensitively against the source, so a
  swallowed sentence or a dropped colon fails the build.

To eyeball a real render without a browser toolchain, the harness used during
this work is worth recreating: stub `fetch`/`localStorage`, import
`lib/content.js` + `lib/system-design.js`, evaluate the view module's body with
`new Function` to reach the non-exported `renderDesignArticle`, and write the
result plus `styles.css` into a standalone HTML file.
