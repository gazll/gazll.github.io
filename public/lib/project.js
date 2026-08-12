import { fetchJson } from './i18n.js';

const MANIFEST_URL = 'data/projects/calebzone/manifest.json';
const textCache = new Map();

async function fetchText(path) {
  if (!textCache.has(path)) {
    textCache.set(path, fetch(path, { cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status + ' ' + path);
      return response.text();
    }).catch(error => {
      textCache.delete(path);
      throw error;
    }));
  }
  return textCache.get(path);
}

export const ProjectDocs = {
  manifest: null,
  loaded: false,
  _loadPromise: null,

  async load() {
    if (!this._loadPromise) {
      this._loadPromise = fetchJson(MANIFEST_URL).then(manifest => {
        this.manifest = manifest;
        this.loaded = true;
        return manifest;
      }).catch(error => {
        this._loadPromise = null;
        throw error;
      });
    }
    return this._loadPromise;
  },

  document(documentMeta) { return fetchText('data/' + documentMeta.file); },
  sample(sampleMeta) { return fetchText('data/' + sampleMeta.file); }
};
