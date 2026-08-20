const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86400000;

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

/* "Updated 3 days ago" answers the question a date stamp is actually asked —
   is this still current? — which an absolute date only answers after the
   reader does the arithmetic.

   It only helps while the answer is still "recently" — past a month the reader
   wants the date itself, because "6 years ago" for a 2020 publisher article
   says less than "Nov 12, 2020", and a whole library stamped in one batch
   reads as a vague claim rather than as data. So RECENT_DAYS is the whole
   rule: inside it, relative; outside it, the absolute date.

   The caller must render this AFTER mount and keep `formatted` for the server
   pass: a prerendered "2 days ago" is stale the moment the artifact is a week
   old, and it would hydrate against a different string. */
const RECENT_DAYS = 30;

export function relativeContentDate(value, lang = 'en', now = Date.now()) {
  if (!ISO_DATE.test(String(value || ''))) return '';
  const then = Date.parse(value + 'T00:00:00Z');
  if (Number.isNaN(then)) return '';
  // Both sides floored to a UTC day, so "yesterday" does not depend on the
  // hour the reader opened the page.
  const days = Math.round((then - Math.floor(now / DAY_MS) * DAY_MS) / DAY_MS);
  if (Math.abs(days) > RECENT_DAYS) return formatContentDate(value, lang);

  const locale = lang === 'vi' ? 'vi-VN' : 'en';
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(days) < 7) return relative.format(days, 'day');
  return relative.format(Math.round(days / 7), 'week');
}

export function contentDateFacts(row, lang = 'en', { includePublished = false } = {}) {
  const labels = LABELS[lang] || LABELS.en;
  /* When the two Gazl dates are equal nothing was actually updated, so only one
     stamp is printed — but it is labelled `updated`, not `created`. "Updated"
     is the fact a reader is checking for, and a page that only ever says "Added
     to Gazl" reads as if the freshness stamp went missing. */
  const unchanged = Boolean(row?.created_at) && row?.updated_at === row?.created_at;
  const candidates = [
    includePublished && ['published', row?.published_at],
    !unchanged && ['created', row?.created_at],
    ['updated', row?.updated_at],
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
