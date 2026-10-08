#!/usr/bin/env node
/* The production-dependency gate CI runs before building.

     node tools/audit-gate.mjs

   `npm audit --audit-level=high` has no way to say "this one advisory does
   not apply, until a date". Without that, an advisory with no patched
   version blocks every deploy until upstream ships one — even when the code
   it names never reaches the site. So the gate reads `npm audit --json`
   itself: every high or critical advisory fails it, except one listed below
   with a reason and an expiry. An expired entry fails again, so an exception
   is a decision to revisit, never a permanent silence. */

import { execFileSync } from 'node:child_process';

const TODAY = new Date().toISOString().slice(0, 10);
const BLOCKING = new Set(['high', 'critical']);

/* Each entry: the GHSA id, why it does not reach the deployed site, and the
   date the exception stops counting. Remove the entry once a patched version
   is installed — the gate does not need it then. */
const ALLOWED = Object.freeze({
  'GHSA-86w9-cpqp-85rv': {
    until: '2026-11-01',
    why: 'node-forge <= 1.4.0, no patched version. Reached only via nuxt -> @nuxt/cli -> listhen, '
      + 'which uses it to make the self-signed certificate for `nuxt dev --https`. The prerendered '
      + 'site does not contain it, and nothing here verifies RSA PKCS#1 v1.5 signatures with it.'
  },
  'GHSA-vfj7-8cjw-p6xm': {
    until: '2026-11-01',
    why: 'braces <= 3.0.3, no patched version published (3.0.3 is the latest). Reached only via nuxt -> '
      + 'nitropack -> globby -> micromatch, which expands glob patterns the build writes itself; no '
      + 'request-time input reaches it, so the nested-pattern stack exhaustion is not reachable.'
  }
});

const out = (line) => process.stdout.write(`${line}\n`);

function auditJson() {
  try {
    return execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  } catch (error) {
    // npm audit exits non-zero whenever it finds anything; the JSON is still on stdout.
    if (error.stdout) return error.stdout;
    throw error;
  }
}

const report = JSON.parse(auditJson());
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities || {})) {
  for (const via of vulnerability.via || []) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue;
    const id = String(via.url || '').match(/GHSA-[\w-]+/)?.[0] || `npm-${via.source}`;
    advisories.set(id, { id, severity: via.severity, name: via.name, title: via.title });
  }
}

let failed = 0;
for (const advisory of advisories.values()) {
  const allowed = ALLOWED[advisory.id];
  const label = `${advisory.severity} ${advisory.id} ${advisory.name}: ${advisory.title}`;
  if (allowed && TODAY <= allowed.until) { out(`allowed until ${allowed.until} — ${label}`); continue; }
  out(`${allowed ? `EXPIRED ${allowed.until} — ` : ''}BLOCKING — ${label}`);
  failed++;
}
for (const [id, entry] of Object.entries(ALLOWED)) {
  if (!advisories.has(id)) out(`note: ${id} is allowed until ${entry.until} but no longer reported — remove the entry.`);
}

if (failed) {
  out(`${failed} high/critical advisor${failed === 1 ? 'y' : 'ies'} in production dependencies.`);
  process.exit(1);
}
out(`production dependencies: no blocking advisories (${advisories.size} known, all allowed).`);
