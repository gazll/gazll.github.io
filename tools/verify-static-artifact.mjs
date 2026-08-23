#!/usr/bin/env node
import { lstat, readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.output/public');
const required = ['index.html', '404.html', '_nuxt', 'version.json'];

function checkSyntax(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--check', file], { stdio: 'inherit' });
    child.on('close', code => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function walk(directory) {
  const rows = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    const stat = await lstat(file);
    rows.push({ file, stat });
    if (stat.isDirectory()) rows.push(...await walk(file));
  }
  return rows;
}

const failures = [];
for (const name of required) {
  try { await lstat(path.join(root, name)); }
  catch { failures.push(`missing ${name}`); }
}

let rows = [];
try { rows = await walk(root); }
catch (error) { failures.push(`cannot read artifact: ${error.message}`); }

const links = rows.filter(row => row.stat.isSymbolicLink());
if (links.length) failures.push(`symbolic links are not allowed: ${links.map(row => path.relative(root, row.file)).join(', ')}`);

const nuxtAssets = rows.filter(row => row.file.includes(`${path.sep}_nuxt${path.sep}`) && row.stat.isFile());
if (!nuxtAssets.length) failures.push('_nuxt contains no generated assets');

const htmlFiles = rows.filter(row => row.stat.isFile() && row.file.endsWith('.html'));
for (const row of htmlFiles) {
  const source = await readFile(row.file, 'utf8');
  if (/(?:src|href)=["']https?:\/\/localhost|\/\@vite\/client/.test(source)) {
    failures.push(`${path.relative(root, row.file)} contains a development-only URL`);
  }
}

/* Source guardrails run before Nuxt generates the bundle. Keep a second,
   release-boundary check because build transforms and generated config can
   introduce text that never existed in a tracked source file. Public OAuth
   client IDs are intentionally excluded; private keys and bearer credentials
   are not. Vendored output is checked by its own dependency policy. */
const textFiles = rows.filter(row => row.stat.isFile()
  && /\.(?:html?|m?js|json|css|txt|xml|svg)$/i.test(row.file)
  && !row.file.includes(`${path.sep}vendor${path.sep}`));
const privateCredentialPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|ya29\.[A-Za-z0-9._-]+|GOCSPX-[A-Za-z0-9._-]+/;
for (const row of textFiles) {
  const source = await readFile(row.file, 'utf8');
  if (privateCredentialPattern.test(source)) {
    failures.push(`${path.relative(root, row.file)} contains a private credential pattern`);
  }
}

const compatibilityModules = rows.filter(row => row.stat.isFile()
  && /\.m?js$/.test(row.file)
  && !row.file.includes(`${path.sep}_nuxt${path.sep}`)
  && !row.file.includes(`${path.sep}vendor${path.sep}`));
for (const row of compatibilityModules) {
  if (!await checkSyntax(row.file)) failures.push(`${path.relative(root, row.file)} does not parse`);
}

const bytes = rows.reduce((total, row) => total + (row.stat.isFile() ? row.stat.size : 0), 0);
if (bytes >= 1024 ** 3) failures.push(`artifact is ${Math.ceil(bytes / 1024 ** 2)} MiB; GitHub Pages supports at most 1 GiB`);

if (failures.length) {
  failures.forEach(failure => process.stderr.write(`FAIL ${failure}\n`));
  process.exit(1);
}

process.stdout.write(`artifact OK — ${rows.filter(row => row.stat.isFile()).length} files, ${(bytes / 1024 ** 2).toFixed(1)} MiB\n`);
