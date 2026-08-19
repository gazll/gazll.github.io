import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');
const now = new Date();
const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
const stale = [];
const gitCache = new Map();

function git(args) {
  const cacheKey = JSON.stringify(args);
  if (gitCache.has(cacheKey)) return gitCache.get(cacheKey);
  const output = execFileSync('git', ['-c', 'core.excludesFile=', ...args], {
    cwd: root,
    encoding: 'utf8'
  }).trim();
  gitCache.set(cacheKey, output);
  return output;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function emitJson(relativePath, value) {
  const expected = JSON.stringify(value, null, 2) + '\n';
  const absolute = path.join(root, relativePath);
  if (checkOnly) {
    if (readFileSync(absolute, 'utf8') !== expected) stale.push(relativePath);
  } else {
    writeFileSync(absolute, expected);
  }
}

function commitRows(relativePaths, follow = false) {
  if (follow && relativePaths.length > 1) {
    const byHash = new Map();
    relativePaths.forEach(relativePath => commitRows([relativePath], true).forEach(row => byHash.set(row.hash, row)));
    return [...byHash.values()].sort((a, b) => b.date.localeCompare(a.date));
  }
  const args = ['log', '--format=%H%x09%cs'];
  if (follow) args.push('--follow');
  args.push('--', ...relativePaths);
  const output = git(args);
  return output ? output.split(/\r?\n/).map(line => {
    const [hash, date] = line.split('\t');
    return { hash, date };
  }) : [];
}

function isDirty(relativePaths) {
  return Boolean(git(['status', '--porcelain', '--', ...relativePaths]));
}

function pathDates(relativePaths) {
  const commits = commitRows(relativePaths, true);
  if (!commits.length) return { created_at: today, updated_at: today };
  return {
    created_at: commits.map(row => row.date).sort()[0],
    updated_at: isDirty(relativePaths) ? today : commits.map(row => row.date).sort().at(-1)
  };
}

function withoutDates(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = structuredClone(value);
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

function trackRows(target, rows, keyOf, date) {
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const fingerprint = JSON.stringify(withoutDates(row));
    const known = target.get(key);
    if (!known) {
      target.set(key, { created_at: date, updated_at: date, fingerprint });
    } else if (known.fingerprint !== fingerprint) {
      known.updated_at = date;
      known.fingerprint = fingerprint;
    }
  }
}

function jsonRowsHistory(relativePath, rowsOf, keyOf) {
  const history = new Map();
  for (const commit of commitRows([relativePath]).reverse()) {
    try {
      const parsed = JSON.parse(git(['show', commit.hash + ':' + relativePath]));
      trackRows(history, rowsOf(parsed), keyOf, commit.date);
    } catch {}
  }
  trackRows(history, rowsOf(readJson(relativePath)), keyOf, today);
  return history;
}

function minDate(...values) {
  return values.filter(Boolean).sort()[0] || today;
}

function maxDate(...values) {
  return values.filter(Boolean).sort().at(-1) || today;
}

function mergeDates(...rows) {
  return {
    created_at: minDate(...rows.map(row => row?.created_at)),
    updated_at: maxDate(...rows.map(row => row?.updated_at))
  };
}

const topicManifestPath = 'public/data/manifest.json';
const topicMetaPath = 'public/data/meta.json';
const manifest = readJson(topicManifestPath);
const topicMeta = readJson(topicMetaPath);
const topicManifestHistory = jsonRowsHistory(topicManifestPath, value => value.topics || [], row => String(row.n));
const topicMetaHistory = jsonRowsHistory(topicMetaPath,
  value => Object.entries(value.topics || {}).map(([n, row]) => ({ n, ...row })), row => String(row.n));
for (const row of manifest.topics || []) {
  const base = 'public/data/' + row.file;
  const vi = base.replace(/\.json$/, '.vi.json');
  Object.assign(topicMeta.topics[String(row.n)], mergeDates(
    pathDates([base, vi]), topicManifestHistory.get(String(row.n)), topicMetaHistory.get(String(row.n))
  ));
}
emitJson(topicMetaPath, topicMeta);

const catalogPath = 'public/data/system-design/catalog.json';
const designHistory = jsonRowsHistory(catalogPath, value => value.designs || [], row => row.slug);
const overviewHistory = jsonRowsHistory(catalogPath,
  value => Object.entries(value.case_overviews || {}).map(([slug, row]) => ({ slug, ...row })), row => row.slug);
const catalog = readJson(catalogPath);
for (const design of catalog.designs || []) {
  delete design.fingerprint;
  const dates = designHistory.get(design.slug) || { created_at: today, updated_at: today };
  design.created_at = dates.created_at;
  design.updated_at = dates.updated_at;
}
emitJson(catalogPath, catalog);

const caseManifestPath = 'public/data/case-studies/manifest.json';
const caseMetaPath = 'public/data/case-studies/meta.json';
const caseManifest = readJson(caseManifestPath);
const caseManifestHistory = jsonRowsHistory(caseManifestPath, value => value.articles || [], row => row.slug);
const caseMetaHistory = jsonRowsHistory(caseMetaPath,
  value => Object.entries(value.articles || {}).map(([n, row]) => ({ n, ...row })), row => String(row.n));
for (const article of caseManifest.articles || []) {
  const base = 'public/data/' + article.file;
  const stem = path.basename(article.file, '.json');
  const contentDates = pathDates([
    base,
    base.replace(/\.json$/, '.vi.json'),
    'public/data/case-studies/articles/' + stem + '.html',
    'public/data/case-studies/articles/' + stem + '.vi.html'
  ]);
  Object.assign(article, mergeDates(
    contentDates,
    caseManifestHistory.get(article.slug),
    caseMetaHistory.get(String(article.n)),
    overviewHistory.get(article.slug)
  ));
}
emitJson(caseManifestPath, caseManifest);

const projectPath = 'public/data/projects/calebzone/manifest.json';
const project = readJson(projectPath);
const projectHistory = jsonRowsHistory(projectPath, value => {
  const row = structuredClone(value);
  delete row.documents;
  delete row.samples;
  return [row];
}, row => row.slug);
const documentHistory = jsonRowsHistory(projectPath, value => value.documents || [], row => row.id);
const sampleHistory = jsonRowsHistory(projectPath, value => value.samples || [], row => row.id);
for (const document of project.documents || []) {
  Object.assign(document, mergeDates(pathDates(['public/data/' + document.file]), documentHistory.get(document.id)));
}
for (const sample of project.samples || []) {
  Object.assign(sample, mergeDates(pathDates(['public/data/' + sample.file]), sampleHistory.get(sample.id)));
}
const projectFiles = [...(project.documents || []), ...(project.samples || [])].map(row => 'public/data/' + row.file);
Object.assign(project, mergeDates(
  pathDates(projectFiles), projectHistory.get(project.slug), ...documentHistory.values(), ...sampleHistory.values()
));
emitJson(projectPath, project);

const interviewsPath = 'public/data/interviews.json';
const interviews = readJson(interviewsPath);
const interviewKey = row => row.source?.url || row.name;
const interviewHistory = jsonRowsHistory(interviewsPath, value => value.companies || [], interviewKey);
for (const company of interviews.companies || []) {
  delete company.fingerprint;
  const dates = interviewHistory.get(interviewKey(company)) || { created_at: today, updated_at: today };
  company.created_at = dates.created_at;
  company.updated_at = dates.updated_at;
}
emitJson(interviewsPath, interviews);

if (stale.length) {
  throw new Error('Content dates are stale. Run node tools/stamp-content-dates.mjs:\n- ' + stale.join('\n- '));
}

process.stdout.write((checkOnly ? 'Verified' : 'Stamped') + ' dates for '
  + (manifest.topics || []).length + ' topics, ' + (catalog.designs || []).length + ' system designs, '
  + (caseManifest.articles || []).length + ' case studies, one project and '
  + (interviews.companies || []).length + ' interview entries.\n');
