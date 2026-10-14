#!/usr/bin/env node
/* Material Design 3 colour roles for public/styles.css, generated from one
   seed so light and dark can never drift apart.

     node tools/md3-tokens.mjs           rewrite the generated block
     node tools/md3-tokens.mjs --check   fail if the committed block is stale

   The block sits between the two MARK comments at the top of styles.css. It
   holds only colour roles; type, shape, motion and the legacy aliases that map
   the older token names onto these roles are hand-written beneath it, because
   they are decisions rather than arithmetic. DESIGN.md explains the roles.

   Custom colours are MD3 custom colour groups: each content family keeps its
   hue, with a colour / on-colour / container / on-container set in both
   themes. They are derived with the same TonalSpot rules as the primary rather
   than MCU's customColor(), whose containers came out neon (teal #6FF7F6,
   brass #FFE166) — a calm reading surface cannot carry those. Slate is a grey
   and keeps a neutral scheme. Topic types and calendar categories read them
   through --g. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';

/* @material/material-color-utilities 0.4 ships ESM with extensionless relative
   imports, which Node refuses to resolve. Bundling it in memory keeps the
   latest release usable without patching node_modules. */
async function loadMcu() {
  const out = await build({
    stdin: { contents: "export * from '@material/material-color-utilities';", resolveDir: import.meta.dirname },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent'
  });
  return import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
}
const { Hct, SchemeNeutral, SchemeTonalSpot, argbFromHex, hexFromArgb } = await loadMcu();

export const SEED = '#0B6E4F';
/* The 2025 colour spec is the one M3 Expressive ships: on-container roles sit
   at tone 30 rather than 10, and dark surfaces run deeper. The custom groups
   stay on 2021: a family accent is printed as text on its own container (a
   pressed chip), and 2025's lighter accent drops that to 3.86:1. */
const SPEC = '2025';
export const CUSTOM = {
  indigo: '#3D4E8F',
  teal: '#1C7684',
  clay: '#AE4536',
  brass: '#846938',
  violet: '#5B3E8E',
  slate: '#41505F',
  rose: '#9A3B62',
  steel: '#345E7A'
};
const NEUTRAL = new Set(['slate']);
const ROLES = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
  'surface', 'surfaceDim', 'surfaceBright', 'onSurface', 'onSurfaceVariant',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh', 'surfaceContainerHighest',
  'inverseSurface', 'inverseOnSurface', 'inversePrimary',
  'outline', 'outlineVariant', 'shadow', 'scrim', 'surfaceTint'
];
const START = '/* md3:generated:start — tools/md3-tokens.mjs writes this block; never edit it by hand */';
const END = '/* md3:generated:end */';
const STYLES = path.resolve(import.meta.dirname, '../public/styles.css');

const kebab = name => name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

export function roles(dark) {
  const scheme = new SchemeTonalSpot(Hct.fromInt(argbFromHex(SEED)), dark, 0, SPEC, 'phone');
  const out = {};
  for (const role of ROLES) out[`md-sys-color-${kebab(role)}`] = hexFromArgb(scheme[role]).toUpperCase();
  for (const [name, value] of Object.entries(CUSTOM)) {
    const Scheme = NEUTRAL.has(name) ? SchemeNeutral : SchemeTonalSpot;
    const group = new Scheme(Hct.fromInt(argbFromHex(value)), dark, 0);
    const hex = role => hexFromArgb(group[role]).toUpperCase();
    out[`md-custom-${name}`] = hex('primary');
    out[`md-custom-on-${name}`] = hex('onPrimary');
    out[`md-custom-${name}-container`] = hex('primaryContainer');
    out[`md-custom-on-${name}-container`] = hex('onPrimaryContainer');
  }
  return out;
}

const declarations = tokens => Object.entries(tokens).map(([name, value]) => `--${name}:${value};`).join('\n    ');

export function block() {
  const dark = declarations(roles(true));
  return [
    START,
    `  :root{\n    color-scheme:light;\n    ${declarations(roles(false))}\n  }`,
    '  /* Dark follows the system unless the reader picked a theme; the explicit',
    '     choice is data-theme on <html>, written by the theme switch. */',
    `  @media (prefers-color-scheme: dark){\n    :root:not([data-theme="light"]){\n    color-scheme:dark;\n    ${dark}\n    }\n  }`,
    `  :root[data-theme="dark"]{\n    color-scheme:dark;\n    ${dark}\n  }`,
    END
  ].join('\n');
}

async function main() {
  const css = await readFile(STYLES, 'utf8');
  const start = css.indexOf(START);
  const end = css.indexOf(END);
  const next = block();
  if (process.argv.includes('--check')) {
    if (start < 0 || end < 0 || css.slice(start, end + END.length) !== next) {
      process.stderr.write('public/styles.css: the MD3 colour block is stale — run node tools/md3-tokens.mjs\n');
      process.exitCode = 1;
    }
    return;
  }
  const updated = start >= 0 && end >= 0
    ? css.slice(0, start) + next + css.slice(end + END.length)
    : `${next}\n${css}`;
  await writeFile(STYLES, updated);
  process.stdout.write('Wrote the MD3 colour block.\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) await main();
