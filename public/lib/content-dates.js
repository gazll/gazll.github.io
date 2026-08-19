const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LABELS = {
  en: { published: 'Source published', created: 'Added to Gazl', updated: 'Updated', reviewed: 'Technically reviewed' },
  vi: { published: 'Nguồn xuất bản', created: 'Đưa lên Gazl', updated: 'Cập nhật', reviewed: 'Đã kiểm chứng kỹ thuật' }
};

export function formatContentDate(value, lang = 'en') {
  if (!ISO_DATE.test(String(value || ''))) return '';
  const date = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function contentDateFacts(row, lang = 'en', { includePublished = false } = {}) {
  const labels = LABELS[lang] || LABELS.en;
  const candidates = [
    includePublished && ['published', row?.published_at],
    ['created', row?.created_at],
    row?.updated_at !== row?.created_at && ['updated', row?.updated_at],
    ['reviewed', row?.reviewed_at]
  ].filter(Boolean);

  return candidates.map(([kind, value]) => ({
    kind,
    label: labels[kind],
    value: ISO_DATE.test(String(value || '')) ? String(value) : '',
    formatted: formatContentDate(value, lang)
  })).filter(fact => fact.formatted);
}

export function contentActivityDate(row) {
  return [row?.created_at, row?.updated_at, row?.reviewed_at]
    .filter(value => ISO_DATE.test(String(value || '')))
    .sort()
    .at(-1) || '';
}
