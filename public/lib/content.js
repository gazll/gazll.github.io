/* data/manifest.json lists every topic (including the Microservices track,
   topic_type "microservice") and points at its content file; data/meta.json
   holds label/title/intro/tags for both complete language sources. Each
   topic's base file (data/topics/NN-slug.json) is English by default, and
   the complete Vietnamese source exists at the same path with a `.vi.json`
   suffix. The active pair loads first; the rest arrive on navigation or when
   a global feature such as Search needs the complete corpus. */

import {
  CONTENT_LANGS,
  fetchJson,
  loadBilingualJsonRows,
  localizedRecord,
  readContentLanguage,
  writeContentLanguage
} from './i18n.js';

const listeners = new Set();

function cloneSections(sections) {
  return (sections || []).map(s => ({ ...s, items: (s.items || []).map(it => ({ ...it })) }));
}

function applyMeta(target, metaEntry, lang) {
  if (!metaEntry) return;
  const src = localizedRecord(metaEntry, lang);
  const fallback = metaEntry.en || metaEntry.vi || {};
  for (const k of ['label', 'title', 'intro']) target[k] = src[k] || fallback[k];
  const tags = (Array.isArray(src.tags) && src.tags.length) ? src.tags : fallback.tags;
  if (Array.isArray(tags)) target.tags = [...tags];
}

export const Content = {
  topics: [],
  loaded: false,
  error: null,

  lang: readContentLanguage(),

  /** Lightweight metadata plus whichever bilingual topic pairs have been requested. */
  _manifest: null,
  _meta: null,
  _reviews: null,
  _index: null,
  _en: null,
  _vi: null,
  _loadPromise: null,
  _allPromise: null,
  _topicLoads: null,
  allLoaded: false,
  _itemPairs: null,   // id -> {en:{q,a}, vi:{q,a}|null}, for the per-item language toggle

  async load(reference = '') {
    if (!this._loadPromise) {
      this._loadPromise = Promise.all([
        fetchJson('data/manifest.json'),
        fetchJson('data/meta.json'),
        fetchJson('data/content-reviews.json'),
        fetchJson('data/content-index.json')
      ]).then(([manifest, meta, reviews, index]) => {
        this._manifest = manifest;
        this._meta = meta;
        this._reviews = reviews;
        this._index = index;
        this._en = new Map();
        this._vi = new Map();
        this._topicLoads = new Map();
        this._buildItemPairs();
      }).catch(error => {
        this._loadPromise = null;
        throw error;
      });
    }
    await this._loadPromise;
    await this.ensureTopic(reference || this._firstTrackRow()?.n);
    this.loaded = true;
    return this;
  },

  _firstTrackRow() {
    return (this._manifest?.topics || []).find(row => !row.surface || row.surface === 'track') || null;
  },

  _rowFor(reference) {
    let decoded = '';
    try { decoded = decodeURIComponent(String(reference || '')); } catch (error) {}
    const key = decoded.split('.')[0];
    return (this._manifest?.topics || []).find(row => row.n === Number(decoded)
      || this._meta?.topics?.[String(row.n)]?.key === decoded
      || this._meta?.topics?.[String(row.n)]?.key === key) || this._firstTrackRow();
  },

  async ensureTopic(reference) {
    const row = this._rowFor(reference);
    if (!row || this._en?.has(row.n)) return row;
    if (!this._topicLoads.has(row.n)) {
      this._topicLoads.set(row.n, loadBilingualJsonRows([row]).then(pairs => {
        const pair = pairs.get(row.n);
        this._en.set(row.n, { row, content: pair.en });
        this._vi.set(row.n, pair.vi);
        this._buildItemPairs();
        this._apply();
        return row;
      }).finally(() => this._topicLoads.delete(row.n)));
    }
    return this._topicLoads.get(row.n);
  },

  async loadAll() {
    await this.load();
    if (this.allLoaded) return this;
    if (!this._allPromise) {
      this._allPromise = (async () => {
        await Promise.all(this._topicLoads.values());
        const missing = (this._manifest.topics || []).filter(row => !this._en.has(row.n));
        if (missing.length) {
          const pairs = await loadBilingualJsonRows(missing);
          for (const [n, pair] of pairs) {
            this._en.set(n, { row: pair.row, content: pair.en });
            this._vi.set(n, pair.vi);
          }
          this._buildItemPairs();
          this._apply();
        }
        this.allLoaded = true;
        return this;
      })().catch(error => {
        this._allPromise = null;
        throw error;
      });
    }
    return this._allPromise;
  },

  /** id -> {en, vi} text, matched by position so a per-item toggle can show the other language. */
  _buildItemPairs() {
    const pairs = new Map(Object.entries(this._index?.items || {}).map(([id, item]) => [id, {
      en: { q: item.en, a: '' },
      vi: item.vi ? { q: item.vi, a: '' } : null
    }]));
    for (const [n, { content: en }] of this._en) {
      const vi = this._vi.get(n);
      (en.sections || []).forEach((sec, si) => {
        (sec.items || []).forEach((it, ii) => {
          const viIt = vi?.sections?.[si]?.items?.[ii];
          pairs.set(it.id, { en: { q: it.q, a: it.a }, vi: viIt ? { q: viIt.q, a: viIt.a } : null });
        });
      });
    }
    this._itemPairs = pairs;
  },

  /** {en, vi} text for one item id, or null; `vi` is null with no companion. */
  itemPair(id) {
    return this._itemPairs ? (this._itemPairs.get(id) || null) : null;
  },

  _apply() {
    const topics = [];
    for (const row of this._manifest?.topics || []) {
      const n = row.n;
      // Some numbered sources are retained for cross-references but rendered
      // on a purpose-built Experience surface instead of the Study Track.
      if (row.surface && row.surface !== 'track') continue;
      const en = this._en.get(n)?.content;
      const vi = this._vi.get(n);
      const movedItems = new Set(row.system_design_items || []);
      const source = this.lang === 'vi' && vi ? vi : en;
      const sections = cloneSections(source?.sections || [])
        .map(section => ({
          ...section,
          items: section.items.filter(item => !movedItems.has(item.id)).map(item => ({
            ...item,
            reviewed_at: this._reviews?.[item.id]?.reviewed_at || ''
          }))
        }))
        .filter(section => section.items.length);
      const topic = {
        n,
        // The filename stem, and the prefix of every item id in this topic —
        // the stable handle other views use to name a topic.
        key: this._meta.topics[String(n)]?.key || '',
        topic_type: row.topic_type,
        created_at: this._meta.topics[String(n)]?.created_at || '',
        updated_at: this._meta.topics[String(n)]?.updated_at || '',
        item_ids: [...(this._index?.topics?.find(topic => topic.n === n)?.track_item_ids || [])],
        tags: [],
        sections
      };
      applyMeta(topic, this._meta.topics[String(n)], this.lang);
      topics.push(topic);
    }
    topics.sort((a, b) => a.n - b.n);
    this.topics = topics;
  },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  async setLang(lang) {
    if (!CONTENT_LANGS.includes(lang) || lang === this.lang) return;
    this.lang = lang;
    writeContentLanguage(lang);
    this._apply();
    for (const fn of listeners) { try { fn(this); } catch (e) {} }
  },

  /** All items across every topic — the denominator of the progress ring. */
  get topicItemIds() {
    return new Set((this._index?.topics || []).flatMap(topic => topic.track_item_ids || []));
  },

  get totalTopicItems() {
    return this.topicItemIds.size;
  },

  topicCounts() {
    return this.topics.map(t => ({
      n: t.n,
      label: t.label,
      topic_type: t.topic_type || '',
      ids: [...t.item_ids]
    }));
  }
};
