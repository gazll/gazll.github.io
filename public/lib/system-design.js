import { fetchJson, localizedRecord } from './i18n.js';
import { Content } from './content.js';
import { CaseStudies } from './case-studies.js';

const CATALOG_URL = 'data/system-design/catalog.json';
const PRODUCTION_CATEGORY = 'systems-architecture';

export const SystemDesign = {
  library: {},
  production: {},
  categories: [],
  designs: [],
  cases: [],
  caseOverviews: new Map(),
  lang: 'en',
  _catalog: null,
  _loadPromise: null,

  async load(lang = 'en') {
    if (!this._loadPromise) {
      this._loadPromise = fetchJson(CATALOG_URL).then(catalog => {
        this._catalog = catalog;
      }).catch(error => {
        this._loadPromise = null;
        throw error;
      });
    }
    // Migrated source notes need full answers, but paying that cost is deferred
    // until this library (or Search) is actually opened.
    await Promise.all([this._loadPromise, CaseStudies.load(lang), Content.loadAll()]);
    this.apply(lang);
    return this;
  },

  apply(lang = 'en') {
    this.lang = lang;
    this.library = { ...localizedRecord(this._catalog?.library, lang) };
    this.production = { ...localizedRecord(this._catalog?.production, lang) };
    this.categories = (this._catalog?.categories || []).map(category => ({
      id: category.id,
      ...localizedRecord(category, lang)
    }));

    this.designs = (this._catalog?.designs || []).map(row => {
      const localized = localizedRecord(row, lang);
      const referenceImage = row.reference_image ? {
        src: row.reference_image.src,
        width: row.reference_image.width,
        height: row.reference_image.height,
        ...localizedRecord(row.reference_image, lang)
      } : null;
      const sourceNotes = (row.source_items || []).map(id => {
        const pair = Content.itemPair(id);
        const item = pair ? (pair[lang] || pair.en) : null;
        return item ? { id, ...item } : null;
      }).filter(Boolean);
      return {
        n: row.n,
        slug: row.slug,
        category: row.category,
        effort: row.effort,
        level: row.level || 'advanced',
        featured: Boolean(row.featured),
        created_at: row.created_at || '',
        updated_at: row.updated_at || '',
        reviewed_at: row.reviewed_at || '',
        diagram: row.diagram,
        source_url: row.source_url || '',
        reference_image: referenceImage,
        source_items: [...(row.source_items || [])],
        ...localized,
        tags: [...(localized.tags || [])],
        sourceNotes
      };
    }).sort((a, b) => a.n - b.n);

    this.cases = CaseStudies.articles.filter(article => article.category === PRODUCTION_CATEGORY);
    this.caseOverviews = new Map(Object.entries(this._catalog?.case_overviews || {}).map(([slug, overview]) => [
      slug,
      { ...localizedRecord(overview, lang), diagram: overview.diagram }
    ]));
  },

  design(slug) { return this.designs.find(row => row.slug === slug) || null; },
  designForSourceItem(itemId) {
    return this.designs.find(row => row.source_items.includes(itemId)) || null;
  },
  productionCase(slug) { return this.cases.find(row => row.slug === slug) || null; },
  caseOverview(slug) { return this.caseOverviews.get(slug) || null; }
};
