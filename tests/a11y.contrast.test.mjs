import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const STYLES = new URL('../public/styles.css', import.meta.url);

// WCAG 2.1 relative luminance. The site's small print runs at 11–12px, so every
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

function declarations(block) {
  const tokens = new Map();
  for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens.set(name, value.trim());
  return tokens;
}

const blockAfter = (css, opener) => {
  const start = css.indexOf(opener);
  assert.ok(start >= 0, `styles.css must contain ${opener}`);
  return css.slice(start, css.indexOf('}', start));
};

/* Colour tokens are MD3 roles generated per theme (tools/md3-tokens.mjs), and
   the names the rules use are aliases onto them — often through color-mix().
   So a token is only measurable once resolved in a theme: dark roles override
   light ones, and every alias is followed to a hex value. */
function themes(css) {
  const generated = blockAfter(css, ':root{');
  const handStart = css.indexOf(':root{', css.indexOf('md3:generated:end'));
  const hand = blockAfter(css.slice(handStart), ':root{');
  const light = new Map([...declarations(hand), ...declarations(generated)]);
  const dark = new Map([...light, ...declarations(blockAfter(css, ':root[data-theme="dark"]{'))]);
  return { light, dark };
}

function resolver(tokens) {
  const mix = (a, b, weight) => '#' + [1, 3, 5].map(i => Math.round(
    parseInt(a.slice(i, i + 2), 16) * weight + parseInt(b.slice(i, i + 2), 16) * (1 - weight)
  ).toString(16).padStart(2, '0')).join('').toUpperCase();
  const value = raw => {
    const text = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(text)) return text.toUpperCase();
    const ref = text.match(/^var\(--([\w-]+)\)$/);
    if (ref) return resolve(ref[1]);
    const mixed = text.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(.+)\)$/);
    if (mixed) return mix(value(mixed[1]), value(mixed[3]), Number(mixed[2]) / 100);
    throw new Error(`cannot resolve colour "${text}"`);
  };
  const resolve = name => {
    assert.ok(tokens.has(name), `--${name} must be defined`);
    return value(tokens.get(name));
  };
  return { resolve, value };
}

/* The meta rows, card tags, eyebrows and date stamps all render --muted. It
   once sat at 3.37:1 on white and 2.98:1 on the page background, so the
   smallest text on the site was also the least readable. Dark mode owes the
   same floor, which is why every pair is measured in both themes. */
test('every text colour clears WCAG AA against the surface it is printed on, in light and dark', async () => {
  const css = await readFile(STYLES, 'utf8');
  for (const [theme, tokens] of Object.entries(themes(css))) {
    const { resolve, value } = resolver(tokens);
    const check = (label, foreground, background, backgroundLabel) => {
      const ratio = contrast(foreground, background);
      assert.ok(ratio >= AA_NORMAL, `${theme}: ${label} on ${backgroundLabel} is ${ratio.toFixed(2)}:1, below ${AA_NORMAL}`);
    };
    const paper = resolve('paper');
    const surface = resolve('surface');

    for (const name of ['ink', 'ink-soft', 'muted', 'emerald', 'emerald-deep', 'clay', 'indigo', 'brass', 'teal']) {
      check('--' + name, resolve(name), surface, '--surface');
      check('--' + name, resolve(name), paper, '--paper');
    }

    // Reading roles stay semantic: each is measured on the surface it is
    // printed on, and code text against the terminal rather than the page.
    const readingRoles = [
      ['text-normal', 'surface'], ['text-header', 'surface'], ['text-meta', 'surface'],
      ['text-label', 'surface-reading-info'], ['text-high-attention', 'surface-reading-attention'],
      ['text-rule', 'surface'], ['text-link', 'surface'],
      ['text-code', 'surface-code'], ['text-code-muted', 'surface-code'], ['text-code-inline', 'surface-code-inline'],
      ['text-migrated', 'surface-migrated'], ['text-migrated-heading', 'surface-migrated'],
      ['text-migrated-accent', 'surface-migrated-soft'],
      ['text-topbar', 'surface-topbar'], ['text-topbar-muted', 'surface-topbar'],
      ['text-topbar-accent', 'surface-topbar'], ['focus-topbar', 'surface-topbar']
    ];
    for (const [name, background] of readingRoles) check('--' + name, resolve(name), resolve(background), '--' + background);

    // Difficulty pills print their on-container colour on their container.
    for (const [label, rule] of [['level-core', '.level-core{'], ['level-advanced', '.level-advanced{'], ['level-extra', '.level-extra{']]) {
      const block = blockAfter(css, rule);
      check('.' + label, value(block.match(/color:([^;]+);/)[1]), value(block.match(/background:([^;]+);/)[1]), 'its own fill');
    }

    /* Each family accent prints as text on the page (an unpressed filter chip,
       the hero's day label) and on its own container (the pressed chip), and
       its on-container colour prints on that container too. */
    const families = [...css.matchAll(/\[data-(topic-type|cal-cat)="([\w-]+)"\]\s*\{--g:([^;]+);\s*--g-soft:([^;}]+)[;}]/g)];
    let topics = 0;
    for (const [, kind, name, accent, soft] of families) {
      if (kind === 'topic-type') topics += 1;
      const foreground = value(accent);
      const fill = value(soft);
      check(`${name} accent`, foreground, surface, '--surface');
      check(`${name} accent`, foreground, paper, '--paper');
      check(`${name} accent`, foreground, fill, 'its own container');
    }
    assert.equal(topics, 6, 'every topic_type must declare an accent pair');
    for (const [, name, onContainer] of css.matchAll(/\[data-topic-type="([\w-]+)"\]\s*\{[^}]*--g-on:([^;}]+)/g)) {
      const soft = css.match(new RegExp(`\\[data-topic-type="${name}"\\]\\s*\\{--g:[^;]+;\\s*--g-soft:([^;]+);`))[1];
      check(`${name} on-container`, value(onContainer), value(soft), 'its own container');
    }
  }
});

test('the generated MD3 colour block matches its seed', async () => {
  const { block } = await import('../tools/md3-tokens.mjs');
  const css = await readFile(STYLES, 'utf8');
  assert.ok(css.includes(block()), 'run node tools/md3-tokens.mjs — the colour block in styles.css is stale');
});
