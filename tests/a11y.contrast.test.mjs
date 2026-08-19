import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const STYLES = new URL('../public/styles.css', import.meta.url);

// WCAG 2.1 relative luminance. The site's small print runs at 9–10px, so every
// pair below is normal text and owes 4.5:1 — the 3:1 large-text allowance does
// not apply to any of it.
const AA_NORMAL = 4.5;

function luminance(hex) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function readTokens(css) {
  const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
  const tokens = new Map();
  for (const [, name, value] of root.matchAll(/--([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})/g)) {
    tokens.set(name, value.toUpperCase());
  }
  return tokens;
}

/* The meta rows, card tags, eyebrows and date stamps all render --muted at
   9–10px. It sat at 3.37:1 on white and 2.98:1 on the page background, so the
   smallest text on the site was also the least readable. */
test('every text colour clears WCAG AA against the surface it is printed on', async () => {
  const css = await readFile(STYLES, 'utf8');
  const tokens = readTokens(css);

  const paper = tokens.get('paper');
  const surface = tokens.get('surface');
  assert.ok(paper && surface, ':root must define --paper and --surface');

  // Body text tokens, on both page backgrounds.
  for (const name of ['ink', 'ink-soft', 'muted', 'emerald', 'emerald-deep', 'clay', 'indigo', 'brass', 'teal']) {
    const value = tokens.get(name);
    assert.ok(value, '--' + name + ' must be a hex token');
    for (const [label, background] of [['--surface', surface], ['--paper', paper]]) {
      const ratio = contrast(value, background);
      assert.ok(ratio >= AA_NORMAL,
        '--' + name + ' on ' + label + ' is ' + ratio.toFixed(2) + ':1, below ' + AA_NORMAL);
    }
  }

  // The difficulty pills print their accent on their own soft fill.
  const pills = [
    ['level-core', tokens.get('emerald-deep'), tokens.get('emerald-soft')],
    ['level-advanced', tokens.get('indigo'), tokens.get('indigo-soft')],
    ['level-extra', tokens.get('brass'), '#FAF5E9']
  ];
  for (const [label, foreground, background] of pills) {
    const ratio = contrast(foreground, background);
    assert.ok(ratio >= AA_NORMAL, '.' + label + ' is ' + ratio.toFixed(2) + ':1, below ' + AA_NORMAL);
  }

  // Card tags sit on their own near-white chip rather than on the card.
  const tagRatio = contrast(tokens.get('muted'), '#F8FAFC');
  assert.ok(tagRatio >= AA_NORMAL, '.sd-card-tags i is ' + tagRatio.toFixed(2) + ':1, below ' + AA_NORMAL);

  /* Each topic_type accent prints twice: as text on the page (an unpressed
     filter chip, the hero's day label) and as text on its own soft fill (the
     pressed chip). Both readings owe the same ratio. */
  const accents = css.matchAll(/\[data-topic-type="([\w-]+)"\]\s*\{--g:([^;]+);\s*--g-soft:([^;]+);/g);
  const resolve = value => {
    const match = value.trim().match(/^var\(--([\w-]+)\)$/);
    return (match ? tokens.get(match[1]) : value.trim()).toUpperCase();
  };
  let seen = 0;
  for (const [, type, accent, soft] of accents) {
    seen += 1;
    const foreground = resolve(accent);
    for (const [label, background] of [['--surface', surface], ['--paper', paper], ['its own fill', resolve(soft)]]) {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= AA_NORMAL,
        type + ' accent on ' + label + ' is ' + ratio.toFixed(2) + ':1, below ' + AA_NORMAL);
    }
  }
  assert.equal(seen, 6, 'every topic_type must declare an accent pair');
});
