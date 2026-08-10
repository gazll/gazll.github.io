#!/usr/bin/env node
/* The one command to run before pushing.

     node tools/check.mjs                 # everything CI enforces
     node tools/check.mjs --audit         # + the editorial report (never fails)
     node tools/check.mjs --only syntax   # one stage (see --list for names)
     node tools/check.mjs --list          # print the stages without running them

   CI runs these same stages, in this order, from this file — so "it passed
   locally" and "it passed on GitHub" cannot drift apart. Adding a test file
   to tests/ is enough: the module check and the test stage both discover
   files from disk rather than from a list that has to be kept in sync.
*/
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

const flag = (name) => process.argv.includes(name);

/** Everything under a directory, recursively, as absolute paths. */
async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file) : [file];
  }))).flat();
}

function run(command, args, options = {}) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'], ...options });
    if (options.input !== undefined) { child.stdin.end(options.input); } else { child.stdin.end(); }
    child.on('close', code => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

/* Syntax-only parse of every module we ship. There is no build step, so this
   is the only thing standing between a typo and a blank page. stdin plus
   --input-type=module states ESM rather than trusting extension detection. */
async function checkModuleSyntax() {
  // Vendored third-party code is immutable upstream output — it ships as-is
  // and is pinned by directory name, so parsing it proves nothing about us.
  const files = (await filesBelow(PUBLIC))
    .filter(file => /\.m?js$/.test(file) && !file.includes(`${path.sep}vendor${path.sep}`))
    .sort();

  let ok = true;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (!await run(process.execPath, ['--input-type=module', '--check'], { input: source })) {
      process.stderr.write(`FAIL ${path.relative(ROOT, file)}\n`);
      ok = false;
    }
  }
  if (ok) process.stdout.write(`syntax OK — ${files.length} modules\n`);
  return ok;
}

/* Every tests/*.test.mjs, discovered rather than enumerated: a new test file
   is picked up here and in CI without editing a list in two places. */
async function runTests() {
  const files = (await readdir(path.join(ROOT, 'tests')))
    .filter(name => name.endsWith('.test.mjs'))
    .sort()
    .map(name => path.join('tests', name));
  return run(process.execPath, ['--experimental-vm-modules', '--test', ...files], {
    env: { ...process.env, NODE_NO_WARNINGS: '1' }
  });
}

/* Runtime logging is banned outright: an argument to console.* is one edit
   away from being an ID token. Vendored code is exempt — we cannot edit it,
   and lib/mermaid.js pins its log level to fatal instead. */
async function checkNoConsole() {
  const roots = [PUBLIC, path.join(ROOT, 'apps-script')];
  const pattern = /console\.(log|info|warn|error|debug)|Logger\.log/;
  let ok = true;

  for (const root of roots) {
    for (const file of await filesBelow(root)) {
      if (file.includes(`${path.sep}vendor${path.sep}`)) continue;
      // Every text file, not just modules: the ban is about what ships, and a
      // console.* can hide in inline HTML or a JSON-embedded snippet.
      if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip)$/i.test(file)) continue;
      const source = await readFile(file, 'utf8');
      source.split('\n').forEach((line, index) => {
        if (!pattern.test(line)) return;
        process.stderr.write(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}\n`);
        ok = false;
      });
    }
  }
  if (!ok) process.stderr.write('Runtime console logging is disabled to prevent accidental data leaks.\n');
  else process.stdout.write('no runtime console logging\n');
  return ok;
}

const STAGES = [
  { name: 'content', describe: 'structure of the data/ tree', run: () => run(process.execPath, ['tools/validate-content.mjs']) },
  { name: 'syntax', describe: 'every shipped module parses as ESM', run: checkModuleSyntax },
  { name: 'console', describe: 'no runtime logging under public/ or apps-script/', run: checkNoConsole },
  { name: 'tests', describe: 'every tests/*.test.mjs', run: runTests }
];

if (flag('--list')) {
  for (const stage of STAGES) process.stdout.write(`${stage.name.padEnd(9)} ${stage.describe}\n`);
  process.exit(0);
}

// --only runs a single stage; the deploy re-runs `syntax` after stamping.
const only = process.argv[process.argv.indexOf('--only') + 1];
const selected = flag('--only') ? STAGES.filter(stage => stage.name === only) : STAGES;
if (!selected.length) {
  process.stderr.write(`Unknown stage "${only}". Known: ${STAGES.map(s => s.name).join(', ')}\n`);
  process.exit(1);
}

const failed = [];
for (const stage of selected) {
  process.stdout.write(`\n── ${stage.name} — ${stage.describe}\n`);
  if (!await stage.run()) failed.push(stage.name);
}

// Editorial state is a judgement call, so it prints after the verdict and
// never changes the exit code.
if (flag('--audit')) {
  process.stdout.write('\n── audit — editorial report (never fails)\n');
  await run(process.execPath, ['tools/audit-content.mjs', '--dense']);
}

if (failed.length) {
  process.stderr.write(`\nFAILED: ${failed.join(', ')}\n`);
  process.exit(1);
}
process.stdout.write('\nAll checks passed.\n');
