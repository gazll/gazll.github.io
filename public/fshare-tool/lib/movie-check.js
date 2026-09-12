/* Validate movie catalog entries in order, flattening folders into file leaves.
   The catalog scan intentionally bypasses the normal folder cache: a cached
   listing is useful for browsing, but it cannot prove that a link still works. */

import { apiFolder, fetchAllPages } from './api.js';
import { MAX_DEPTH, MAX_FOLDERS, S } from './state.js';
import { fileUrl, isFolder } from './util.js';

export class MovieAbortError extends Error {
  constructor() {
    super('Validation stopped');
    this.name = 'MovieAbortError';
  }
}

export function classifyMovieError(error) {
  const message = String(error && error.message ? error.message : error || 'Unknown error');
  if (/HTTP\s+(404|410)|not found|does not exist|không tồn tại/i.test(message)) {
    return { status: 'dead', error: message };
  }
  return { status: 'unknown', error: message };
}

function codeOf(item) {
  return String(item && (item.linkcode || item.code) || '').toUpperCase();
}

/** Keep the complete JSON metadata returned by Fshare for filtering, auditing,
 * and exports. The API currently returns a flat object; copying every JSON-safe
 * value also keeps this forward-compatible when Fshare adds a field. */
export function remoteMetadata(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return {};
  try {
    const copy = JSON.parse(JSON.stringify(item));
    return copy && typeof copy === 'object' && !Array.isArray(copy) ? copy : {};
  } catch (error) {
    return {};
  }
}

function remoteItem(data, linkcode) {
  const candidates = [];
  if (data && data.current) candidates.push(data.current);
  if (data && data.item) candidates.push(data.item);
  if (data && Array.isArray(data.items)) candidates.push(...data.items);
  return candidates.find((item) => codeOf(item) === linkcode) || candidates[0] || null;
}

/** Probe a single file link through the same CORS-safe proxy as folder pages. */
export function movieFileFromPayload(item, data) {
  const linkcode = codeOf(item);
  const remote = remoteItem(data, linkcode);
  if (!remote) throw new Error('Fshare returned no file metadata');
  if (isFolder(remote)) throw new Error('Fshare returned folder metadata for file link');
  return {
    name: remote.name || remote.filename || item.name || linkcode,
    size: Number(remote.size) || Number(item.size) || 0,
    linkcode,
    link: fileUrl(linkcode),
    remote: remoteMetadata(remote),
    data
  };
}

export function probeMovieFile(item) {
  const linkcode = codeOf(item);
  if (!linkcode) return Promise.reject(new Error('File has no linkcode'));
  return apiFolder(linkcode, 1, S.sortValue)
    .then((data) => movieFileFromPayload(item, data));
}

function asFile(item, root, folderPath) {
  const linkcode = codeOf(item);
  return {
    id: `fshare-file-${linkcode}`,
    kind: 'file',
    linkcode,
    link: fileUrl(linkcode),
    name: item.name || item.filename || linkcode,
    size: Number(item.size) || 0,
    parentTitle: root.name || '',
    parentPath: item.path || folderPath || '',
    sourceIds: root.sourceIds || [],
    remote: remoteMetadata(item)
  };
}

/**
 * Walk one catalog folder. Only file leaves are download rows, but every
 * folder visited is reported too — as a record with its own status and child
 * counts — because a re-check months later needs to know what a folder was
 * like, not only which files it once held. Fetching one node at a time keeps
 * the run predictable and avoids multiplying load while a user checks a set.
 */
export async function crawlMovieFolder(root, {
  shouldStop = () => false,
  onFolder = () => {},
  fetchPages = fetchAllPages,
  maxDepth = MAX_DEPTH,
  maxFolders = MAX_FOLDERS,
  concurrency = 1
} = {}) {
  const queue = [{
    linkcode: codeOf(root),
    name: root.name || '',
    depth: 0,
    path: root.name || '',
    parent: '',
    remote: remoteMetadata(root.remote)
  }];
  const seen = new Set();
  const files = [];
  const folders = [];
  const errors = [];
  let rootName = root.name || '';
  let truncated = false;

  const fetchNode = async (node) => {
    const record = {
      linkcode: node.linkcode,
      name: node.name || '',
      path: node.path,
      depth: node.depth,
      parent: node.parent,
      files: 0,
      subfolders: 0,
      status: 'live',
      error: '',
      remote: remoteMetadata(node.remote)
    };
    try {
      const result = await fetchPages(
        node.linkcode,
        S.sortValue,
        shouldStop,
        undefined,
        { fresh: true }
      );
      const current = result.meta && result.meta.current || {};
      record.remote = remoteMetadata(current);
      if (current.name) record.name = current.name;
      return { node, record, items: Array.isArray(result.items) ? result.items : [] };
    } catch (error) {
      if (error instanceof MovieAbortError) throw error;
      const failure = classifyMovieError(error);
      record.status = failure.status;
      record.error = failure.error;
      return { node, record, items: [], failure };
    }
  };

  while (queue.length) {
    if (shouldStop()) throw new MovieAbortError();
    const batch = [];
    while (queue.length && batch.length < Math.max(1, Number(concurrency) || 1)) {
      if (seen.size >= maxFolders) { truncated = true; break; }
      const node = queue.shift();
      if (seen.has(node.linkcode)) continue;
      seen.add(node.linkcode);
      onFolder({ ...node, index: seen.size });
      batch.push(node);
    }
    if (!batch.length) break;
    const results = await Promise.all(batch.map(fetchNode));
    results.forEach(({ node, record, items, failure }) => {
      folders.push(record);
      if (failure) {
        errors.push({ node, ...failure });
        return;
      }
      if (!rootName && record.name) rootName = record.name;
      for (const item of items) {
        if (shouldStop()) throw new MovieAbortError();
        const linkcode = codeOf(item);
        if (!linkcode) continue;
        if (isFolder(item)) {
          record.subfolders++;
          if (node.depth >= maxDepth || seen.size + queue.length >= maxFolders) {
            truncated = true;
            continue;
          }
          if (!seen.has(linkcode) && !queue.some((child) => child.linkcode === linkcode)) {
            queue.push({
              linkcode,
              name: item.name || '',
              depth: node.depth + 1,
              path: item.path || `${node.path}/${item.name || linkcode}`,
              parent: node.linkcode,
              remote: remoteMetadata(item)
            });
          }
        } else {
          record.files++;
          files.push({ ...asFile(item, root, node.path), parent: node.linkcode });
        }
      }
    });
  }

  return { files, folders, errors, folderCount: seen.size, rootName, truncated };
}

function mergeFile(target, file) {
  const current = target.get(file.id);
  if (!current) {
    target.set(file.id, {
      ...file,
      parentTitles: file.parentTitle ? [file.parentTitle] : [],
      parentPaths: file.parentPath ? [file.parentPath] : []
    });
    return;
  }
  if (file.parentTitle && !current.parentTitles.includes(file.parentTitle)) {
    current.parentTitles.push(file.parentTitle);
  }
  if (file.parentPath && !current.parentPaths.includes(file.parentPath)) {
    current.parentPaths.push(file.parentPath);
  }
  if (!current.size && file.size) current.size = file.size;
  if (file.remote && Object.keys(file.remote).length) {
    current.remote = { ...(current.remote || {}), ...file.remote };
  }
}

function reportStatus(counts, folderError, truncated) {
  if (counts.live && (counts.dead || counts.unknown || folderError || truncated)) return 'partial';
  if (truncated) return 'partial';
  if (counts.live) return 'live';
  if (counts.unknown || folderError === 'unknown') return 'unknown';
  if (counts.dead || folderError === 'dead') return 'dead';
  return 'empty';
}

/** Validate catalog entries one-by-one and return a file-only result set. */
export async function validateMovieEntries(entries, {
  shouldStop = () => false,
  probe = probeMovieFile,
  fetchPages = fetchAllPages,
  onEntry = () => {},
  onFile = () => {}
} = {}) {
  const output = new Map();
  const reports = [];
  let cancelled = false;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (shouldStop()) { cancelled = true; break; }

    const report = {
      entry,
      index,
      status: 'checking',
      discovered: 0,
      checked: 0,
      live: 0,
      dead: 0,
      unknown: 0,
      folders: 0,
      truncated: false,
      error: ''
    };
    reports.push(report);
    onEntry(report, index, entries.length);

    const counts = { live: 0, dead: 0, unknown: 0 };
    let folderError = null;

    try {
      const candidates = entry.kind === 'folder'
        ? await crawlMovieFolder(entry, {
          shouldStop,
          fetchPages,
          onFolder: (folder) => {
            report.folders = folder.index;
            onEntry(report, index, entries.length);
          }
        })
        : { files: [asFile(entry, { ...entry, name: '' }, '')], errors: [], folderCount: 0 };

      report.discovered = candidates.files.length;
      report.folders = candidates.folderCount;
      report.truncated = !!candidates.truncated;
      if (report.truncated) report.error = 'Crawl stopped at the safety limit';
      if (candidates.errors.length) {
        folderError = candidates.errors.some((item) => item.status === 'unknown') ? 'unknown' : 'dead';
        report.error = candidates.errors[0].error;
      }

      for (const file of candidates.files) {
        if (shouldStop()) { cancelled = true; break; }
        try {
          const checked = await probe(file);
          const liveFile = { ...file, ...checked, status: 'live' };
          mergeFile(output, liveFile);
          counts.live++;
          onFile({ entry, file: liveFile, status: 'live', index, total: entries.length });
        } catch (error) {
          const result = classifyMovieError(error);
          counts[result.status]++;
          report.error = report.error || result.error;
          onFile({ entry, file, status: result.status, error: result.error, index, total: entries.length });
        }
        report.checked++;
        report.live = counts.live;
        report.dead = counts.dead;
        report.unknown = counts.unknown;
        onEntry(report, index, entries.length);
      }
    } catch (error) {
      if (error instanceof MovieAbortError) { cancelled = true; break; }
      const result = classifyMovieError(error);
      folderError = result.status;
      report.error = result.error;
    }

    if (cancelled) break;
    report.live = counts.live;
    report.dead = counts.dead;
    report.unknown = counts.unknown;
    report.status = reportStatus(counts, folderError, report.truncated);
    onEntry(report, index, entries.length);
  }

  return {
    cancelled,
    reports,
    files: [...output.values()]
  };
}
