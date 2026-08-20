import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/* Study Track reading surfaces: the DSA step animations and the prose
   structuring shared by every long-form reader.

   Merged from: dsa-anim, prose.
   Each block keeps its own scope so fixtures and helpers cannot collide. */

// ---- from dsa-anim.test.mjs ----
{
  /* The DSA step animations: data contract and frame rendering.

     The player itself needs a DOM, and this project has no test DOM library, so
     what is pinned here is everything that can go wrong without one: the frame
     schema, both languages' captions, the SVG the renderer emits, and the link
     between an item's placeholder and an animation that actually exists.

     lib/dsa-anim.js is deliberately pure — no DOM, no fetch — precisely so this
     can run in plain Node. */






  const root = path.resolve(import.meta.dirname, '..');
  const pub = path.join(root, 'public');

  const { renderFrame, frameExtent, validateAnimation, CELL } =
    await import(pathToFileURL(path.join(pub, 'lib/dsa-anim.js')).href);

  const DATA = JSON.parse(await readFile(path.join(pub, 'data/dsa-animations.json'), 'utf8'));
  const ANIMS = Object.entries(DATA.animations || {});
  const LANGS = ['en', 'vi'];

  const captionsOf = (anim, lang) => anim[lang]?.notes || {};
  const captionAt = (anim, lang, i) =>
    captionsOf(anim, lang)[i] ?? captionsOf(anim, lang)[String(i)] ?? anim.frames[i]?.note;

  test('there are animations, and every one passes its own schema check', () => {
    assert.ok(ANIMS.length >= 15, `only ${ANIMS.length} animations`);
    for (const [id, anim] of ANIMS) {
      assert.deepEqual(validateAnimation(anim, id), [], id);
    }
  });

  test('every frame has a caption in both languages, and they differ', () => {
    for (const [id, anim] of ANIMS) {
      anim.frames.forEach((f, i) => {
        for (const lang of LANGS) {
          const note = captionAt(anim, lang, i);
          assert.ok(String(note || '').trim(), `${id}#${i}: no ${lang} caption`);
        }
        // A VI caption identical to EN means the translation was never written.
        assert.notEqual(captionAt(anim, 'vi', i), captionAt(anim, 'en', i),
          `${id}#${i}: vi caption is a copy of en`);
      });
    }
  });

  test('pointers and spans stay inside their row, and cell states are known', () => {
    const states = new Set(Object.values(CELL));
    for (const [id, anim] of ANIMS) {
      anim.frames.forEach((f, i) => {
        for (const row of f.rows || []) {
          const n = (row.cells || []).length;
          for (const p of row.pointers || []) {
            assert.ok(p.at >= 0 && p.at < n, `${id}#${i}: pointer ${p.label} at ${p.at}, row has ${n}`);
          }
          if (row.span?.from != null) {
            assert.ok(row.span.from >= 0 && row.span.to < n && row.span.from <= row.span.to,
              `${id}#${i}: span ${row.span.from}..${row.span.to} outside 0..${n - 1}`);
          }
          for (const c of row.cells || []) {
            if (c.state) assert.ok(states.has(c.state), `${id}#${i}: state "${c.state}"`);
          }
        }
      });
    }
  });

  test('every frame renders to balanced SVG with no undefined leaking through', () => {
    for (const [id, anim] of ANIMS) {
      const extent = frameExtent(anim.frames);
      assert.ok(extent.w > 0 && extent.h > 0, id);
      for (const lang of LANGS) {
        anim.frames.forEach((f, i) => {
          const html = renderFrame({ ...f, note: captionAt(anim, lang, i) });
          assert.ok(html.trim(), `${id}#${i} ${lang}: rendered empty`);
          const open = (html.match(/<g[\s>]/g) || []).length;
          const close = (html.match(/<\/g>/g) || []).length;
          assert.equal(open, close, `${id}#${i} ${lang}: ${open} <g> vs ${close} </g>`);
          assert.equal(/undefined|NaN|\[object/.test(html), false, `${id}#${i} ${lang}: bad value in output`);
        });
      }
    }
  });

  test('the extent covers every frame, so the viewBox never jumps mid-playback', () => {
    for (const [id, anim] of ANIMS) {
      const extent = frameExtent(anim.frames);
      for (const f of anim.frames) {
        const solo = frameExtent([f]);
        assert.ok(solo.w <= extent.w, `${id}: a frame is wider than the shared extent`);
        assert.ok(solo.h <= extent.h, `${id}: a frame is taller than the shared extent`);
      }
    }
  });

  test('renderFrame escapes values rather than trusting them', () => {
    const html = renderFrame({
      rows: [{
        cells: [{ v: '<script>x</script>' }, { v: 'a & b', caption: '"q"' }],
        pointers: [{ at: 0, label: '<b>' }],
        span: { from: 0, to: 1, label: '<i>' }
      }]
    });
    assert.equal(/<script|<b>|<i>/.test(html), false, 'raw markup survived into the SVG');
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('a &amp; b'));
  });

  test('the caption is not drawn inside the SVG — <text> cannot wrap', () => {
    const long = 'x'.repeat(220);
    const html = renderFrame({ rows: [{ cells: [{ v: 1 }] }], note: long });
    assert.equal(html.includes(long), false, 'a long caption would overflow the viewBox');
  });

  test('captions carry no callout or colour syntax — the player prints them as text', () => {
    for (const [id, anim] of ANIMS) {
      for (const lang of LANGS) {
        anim.frames.forEach((f, i) => {
          const note = String(captionAt(anim, lang, i));
          assert.equal(/:::|\[\[[a-z]:/.test(note), false, `${id}#${i} ${lang}: markdown syntax in a caption`);
        });
      }
    }
  });

  test('every placeholder in topic 19 names a real animation, in both languages', async () => {
    const ids = new Set(Object.keys(DATA.animations || {}));
    const used = new Set();
    for (const stem of ['19-dsa-leetcode', '19-dsa-leetcode.vi']) {
      const topic = JSON.parse(await readFile(path.join(pub, `data/topics/${stem}.json`), 'utf8'));
      const items = topic.sections.flatMap(s => s.items)
        .filter(it => it.id.includes('fifteen-patterns-visualized'));
      assert.equal(items.length, 15, `${stem}: ${items.length} pattern items`);
      for (const it of items) {
        const m = /data-dsa='([a-z0-9-]+)'/.exec(it.a);
        assert.ok(m, `${stem}: ${it.id} has no animation placeholder`);
        assert.ok(ids.has(m[1]), `${stem}: ${it.id} names unknown animation "${m[1]}"`);
        used.add(m[1]);
        // The static trace was replaced, not kept alongside — no duplicate SVG.
        assert.equal(/<svg/.test(it.a), false, `${stem}: ${it.id} still carries a static SVG`);
      }
    }
    assert.equal(used.size, 15, `${used.size} distinct animations referenced, expected 15`);
  });

  test('an item and its Vietnamese twin point at the same animation', async () => {
    const read = async (stem) => {
      const topic = JSON.parse(await readFile(path.join(pub, `data/topics/${stem}.json`), 'utf8'));
      return new Map(topic.sections.flatMap(s => s.items)
        .filter(it => it.id.includes('fifteen-patterns-visualized'))
        .map(it => [it.id, (/data-dsa='([a-z0-9-]+)'/.exec(it.a) || [])[1]]));
    };
    const en = await read('19-dsa-leetcode');
    const vi = await read('19-dsa-leetcode.vi');
    for (const [id, anim] of en) {
      assert.equal(vi.get(id), anim, `${id}: en uses "${anim}", vi uses "${vi.get(id)}"`);
    }
  });
}

// ---- from prose.test.mjs ----
{
  const root = path.resolve(import.meta.dirname, '..');
  const publicRoot = path.join(root, 'public');
  const { SENTENCE, bulletParts, labelledParts, sentences } = await import(pathToFileURL(
    path.join(publicRoot, 'lib/prose.js')).href);

  test('sentences split on real boundaries, in both languages', () => {
    assert.deepEqual(sentences('One claim. Two claims.'), ['One claim.', 'Two claims.']);
    // an accented capital opens a sentence too, or VI prose never breaks
    assert.deepEqual(sentences('Câu đầu tiên. Đây là câu thứ hai.'),
      ['Câu đầu tiên.', 'Đây là câu thứ hai.']);
    // a decimal separator and an abbreviation inside a word are not boundaries
    assert.deepEqual(sentences('Khoảng 2.500 rps peak theo planning factor.').length, 1);
    assert.deepEqual(sentences(''), []);
    assert.ok(SENTENCE instanceof RegExp);
  });

  test('a labelled run needs two labels, and keeps every part in order', () => {
    const row = 'Problem solved: pull large reads off the origin. Flow position: the client fetches from the edge. '
      + 'Failure / cost: a bad cache key serves stale content. Tier verdict: 1M worth it; 10M mandatory.';
    const parts = labelledParts(row);
    assert.deepEqual(parts.map(part => part.label),
      ['Problem solved', 'Flow position', 'Failure / cost', 'Tier verdict']);
    assert.equal(parts[0].body, 'pull large reads off the origin.');
    assert.equal(parts.at(-1).body, '1M worth it; 10M mandatory.');

    // One label is the ordinary "label: rest" list row, not a labelled run.
    assert.equal(labelledParts('Stock invariant: available stock never goes negative.'), null);
    assert.equal(labelledParts('No label at all here.'), null);
    // A mid-sentence colon introduces a clause; a label never runs that long.
    assert.equal(labelledParts('Use the supplied diagram as the logical target for the promotion: CDN at the edge. '
      + 'The picture says 1M DAU while the yardstick is requests per day.'), null);
  });

  test('a labelled run survives a preamble before the first label', () => {
    const parts = labelledParts('Redis is a data-structure server. Problem solved: sub-millisecond reads. '
      + 'Tier verdict: 1M worth it.');
    assert.equal(parts.length, 3);
    assert.equal(parts[0].label, '');
    assert.equal(parts[0].body, 'Redis is a data-structure server.');
    assert.equal(parts[1].label, 'Problem solved');
  });

  test('bullets are for prose that enumerates, and nothing shorter', () => {
    // three sentences: the first introduces, the rest are the list
    const three = bulletParts('Redis is a data-structure server. It buys sorted sets and counters. It costs a failure domain.');
    assert.equal(three.lead, 'Redis is a data-structure server.');
    assert.equal(three.items.length, 2);

    // three clauses behind a lead
    const clauses = bulletParts('Use the diagram as the target: CDN at the edge; search isolated; each database owns an outbox.');
    assert.equal(clauses.lead, 'Use the diagram as the target:');
    assert.deepEqual(clauses.items, ['CDN at the edge', 'search isolated', 'each database owns an outbox.']);

    // two of either is a compound sentence, not a list
    assert.deepEqual(bulletParts('One claim. Its qualifier.').items, []);
    assert.deepEqual(bulletParts('One clause; its qualifier.').items, []);
    assert.equal(bulletParts('One claim. Its qualifier.').lead, 'One claim. Its qualifier.');
  });

  test('an enumeration with no lead is still returned, and callers decide', () => {
    // No colon: the caller (a labelled part) supplies the introduction, and a
    // caller with neither must keep the paragraph.
    const bare = bulletParts('1M worth it; 10M mandatory; 100M needs its own scaling story.');
    assert.equal(bare.lead, '');
    assert.equal(bare.items.length, 3);
  });

  test('structuring never loses a character of the source', async () => {
    const catalog = JSON.parse(await readFile(
      path.join(publicRoot, 'data/system-design/catalog.json'), 'utf8'));
    // Semicolons become list boundaries; nothing else may be consumed.
    const bare = value => String(value).replace(/[\s;]+/g, '');

    for (const design of catalog.designs) {
      for (const lang of ['en', 'vi']) {
        for (const field of ['scope', 'functional', 'quality', 'capacity', 'data_model', 'stack', 'tradeoffs']) {
          for (const row of [design[lang][field]].flat()) {
            const parts = labelledParts(row) || [{ label: '', body: row }];
            const rebuilt = parts.map(part => {
              const { lead, items } = bulletParts(part.body);
              return (part.label ? part.label + ':' : '') + (items.length ? lead + items.join('') : part.body);
            }).join('');
            assert.equal(bare(rebuilt), bare(row), `${design.slug}.${lang}.${field}: text changed`);
          }
        }
      }
    }
  });
}
