/* The reminder engine: hand-written events in, dated occurrences out.

   Two families of recurrence, and confusing them is the whole reason this file
   exists. A CALENDAR-FIXED event happens on a date the calendar decides — a
   card's annual fee, a death anniversary, a monthly statement — and paying it
   late does not move next year. A ROLLING event is measured from the last time
   it was actually done: an oil change five months after the previous one, a
   deworming six months after the last dose. Skip a rolling one and everything
   after it shifts; skip a fixed one and only that occurrence is missed.

   `history` is what separates them. For a rolling event it is the input the
   next date is computed from. For a fixed event it only records which
   occurrences are settled, so a paid year stops being shown as due.

   Dates are 'YYYY-MM-DD' strings throughout, never Date objects — see the
   note in vn-holidays.js. */

import { lunarMonthLength, lunarToSolar, solarToLunar } from './lunar.js';

export const CATEGORIES = Object.freeze([
  'finance', 'vehicle', 'health', 'pet', 'home', 'device', 'document', 'family', 'subscription'
]);
export const SEVERITIES = Object.freeze(['critical', 'normal', 'optional']);
export const REPEAT_KINDS = Object.freeze(['once', 'yearly', 'lunar-yearly', 'monthly', 'rolling']);

/** How early each severity starts warning, when an event does not say. */
export const DEFAULT_LEAD_DAYS = Object.freeze({ critical: 30, normal: 14, optional: 7 });

/** Runaway guard: `every: 1, unit: day` over five years is 1,800 rows. */
const MAX_OCCURRENCES = 400;

const pad = (n) => String(n).padStart(2, '0');
const parts = (date) => [Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10))];
const utc = (date) => { const [y, m, d] = parts(date); return Date.UTC(y, m - 1, d); };
const at = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export const addDays = (date, days) => new Date(utc(date) + days * 86400000).toISOString().slice(0, 10);
export const diffDays = (from, to) => Math.round((utc(to) - utc(from)) / 86400000);

/** Days in a Gregorian month, so a 31st clamps rather than rolling over. */
const monthLength = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addMonths(date, months) {
  const [y, m, d] = parts(date);
  const total = (y * 12 + (m - 1)) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return at(year, month, Math.min(d, monthLength(year, month)));
}

export const todayISO = (now = new Date()) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** Fields are either a plain string or an { en, vi } pair. */
export function localized(value, lang = 'en') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.vi || '';
}

const step = (date, every, unit) => unit === 'day'
  ? addDays(date, every)
  : addMonths(date, unit === 'year' ? every * 12 : every);

/** Nominal length of one cycle, used to size the settle window. */
function periodDays(repeat) {
  if (repeat.kind === 'monthly') return 30;
  if (repeat.kind === 'yearly' || repeat.kind === 'lunar-yearly') return 365;
  if (repeat.kind === 'rolling') {
    const every = Number(repeat.every) || 1;
    return repeat.unit === 'day' ? every : every * (repeat.unit === 'year' ? 365 : 30);
  }
  return 365;
}

/* A payment made 40 days early and one made 20 days late both settle the same
   occurrence, so the match is a window rather than an exact date. Half the
   period caps it: a monthly bill must not let one payment settle two months. */
const settleWindow = (repeat) => Math.min(45, Math.floor(periodDays(repeat) / 2));

const sortedHistory = (event) =>
  [...(event.history || [])].filter(Boolean).sort((a, b) => b.localeCompare(a));

/** The lunar occurrence of (day, month) that falls inside solar year `y`. */
function lunarOccurrence(day, month, lunarYear) {
  const wanted = month === 12 ? Math.min(day, lunarMonthLength(12, lunarYear)) : day;
  const [d, m, y] = lunarToSolar(wanted, month, lunarYear, 0);
  return d ? at(y, m, d) : null;
}

/**
 * Every occurrence of one event inside [from, to].
 *
 * Fixed kinds are enumerated straight off the calendar. A rolling event has
 * only one real date — last done plus the interval — so anything past that is
 * a projection, and every projected row says so.
 */
export function occurrencesBetween(event, from, to) {
  const repeat = event.repeat || { kind: 'once', on: event.on };
  const rows = [];
  const push = (date, extra = {}) => {
    if (date && date >= from && date <= to) rows.push({ date, ...extra });
  };

  if (repeat.kind === 'once') {
    push(repeat.on);
    return rows;
  }

  if (repeat.kind === 'yearly') {
    const [, m, d] = parts(repeat.anchor || `2000-${repeat.on || '01-01'}`);
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y += 1) {
      push(at(y, m, Math.min(d, monthLength(y, m))));
    }
    return rows;
  }

  if (repeat.kind === 'lunar-yearly') {
    const day = Number(repeat.day) || 1;
    const month = Number(repeat.month) || 1;
    // The lunar year straddles the solar one, so both neighbours can land inside.
    for (let y = Number(from.slice(0, 4)) - 1; y <= Number(to.slice(0, 4)) + 1; y += 1) {
      push(lunarOccurrence(day, month, y), { lunarAnchored: true });
    }
    return rows;
  }

  if (repeat.kind === 'monthly') {
    const day = Number(repeat.day) || 1;
    let cursor = at(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 1);
    while (cursor <= to && rows.length < MAX_OCCURRENCES) {
      const [y, m] = parts(cursor);
      push(at(y, m, Math.min(day, monthLength(y, m))));
      cursor = addMonths(cursor, 1);
    }
    return rows;
  }

  // Rolling: walk forward from the last completion, marking projections.
  const every = Number(repeat.every) || 1;
  const start = sortedHistory(event)[0] || repeat.anchor || event.created_at;
  if (!start) return rows;
  let cursor = step(start, every, repeat.unit || 'month');
  let index = 0;
  while (cursor <= to && index < MAX_OCCURRENCES) {
    push(cursor, index > 0 ? { projected: true } : {});
    cursor = step(cursor, every, repeat.unit || 'month');
    index += 1;
  }
  return rows;
}

/** True when `history` already covers this occurrence. */
export function isSettled(event, date) {
  const window = settleWindow(event.repeat || { kind: 'yearly' });
  return sortedHistory(event).some(done => Math.abs(diffDays(date, done)) <= window);
}

/**
 * Odometer-driven maintenance, as an advisory second opinion.
 *
 * An oil change is due at 5,000 km OR five months, whichever lands first, and
 * only the months half is a date. Distance is turned into one by the reader's
 * own average, so the result is an estimate and is always labelled as one.
 */
export function odometerEstimate(event) {
  const odo = event.odometer;
  if (!odo?.every_km || !odo?.per_month) return null;
  const last = sortedHistory(event)[0] || event.repeat?.anchor;
  if (!last) return null;
  const done = Math.max(0, Number(odo.km_since) || 0);
  const months = (Number(odo.every_km) - done) / Number(odo.per_month);
  return { date: addMonths(last, Math.max(0, Math.round(months))), estimated: true };
}

const leadDaysFor = (event) =>
  Number.isFinite(Number(event.lead_days))
    ? Number(event.lead_days)
    : DEFAULT_LEAD_DAYS[event.severity] ?? DEFAULT_LEAD_DAYS.normal;

/**
 * The next date this event needs attention, with why that date was chosen.
 * `driver` is 'date' or 'odometer' — an oil change that comes due on distance
 * before it comes due on time should say so rather than quietly move.
 */
export function nextDue(event, today = todayISO()) {
  const repeat = event.repeat || {};
  /* How long a missed occurrence stays the one to worry about. A rolling event
     has exactly one live date and skipping it does not summon the next — an
     oil change three weeks late is still the oil change you owe. A fixed
     occurrence expires: a statement date two months gone is history, and the
     next one is what the reader needs, so it stops being live once its own
     warning window has run out. Without this split an overdue rolling event
     silently jumped a whole cycle into the future. */
  const staleAfter = repeat.kind === 'rolling' ? periodDays(repeat) : leadDaysFor(event);
  const horizon = `${Number(today.slice(0, 4)) + 8}-12-31`;
  const rows = occurrencesBetween(event, addDays(today, -staleAfter), horizon)
    .filter(row => !isSettled(event, row.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const next = rows[0] || null;
  const odo = odometerEstimate(event);
  if (!next) return odo ? { ...odo, driver: 'odometer' } : null;
  if (odo && odo.date < next.date) return { ...odo, driver: 'odometer', calendarDate: next.date };
  return { ...next, driver: 'date' };
}

/** overdue -> due -> soon -> later. The one value the UI switches on. */
export function statusOf(date, today, leadDays) {
  const away = diffDays(today, date);
  if (away < 0) return 'overdue';
  if (away <= leadDays) return 'due';
  if (away <= 90) return 'soon';
  return 'later';
}

/**
 * Every active event resolved to its next date, sorted soonest first.
 * Rows carry the lunar date too, because an event anchored to the lunar
 * calendar is unreadable without it.
 */
export function agenda(events, { today = todayISO(), lang = 'en' } = {}) {
  return (events || [])
    .filter(event => event.active !== false)
    .map(event => {
      const due = nextDue(event, today);
      if (!due) return null;
      const leadDays = leadDaysFor(event);
      const [d, m, y] = parts(due.date);
      return {
        id: event.id,
        event,
        member: event.member || null,
        date: due.date,
        lunar: solarToLunar(d, m, y),
        estimated: Boolean(due.estimated),
        driver: due.driver,
        calendarDate: due.calendarDate || null,
        daysAway: diffDays(today, due.date),
        leadDays,
        status: statusOf(due.date, today, leadDays),
        title: localized(event.title, lang),
        note: localized(event.note, lang),
        lastDone: sortedHistory(event)[0] || null
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

/** Agenda rows bucketed for the timeline. Empty buckets are dropped by the view. */
export function agendaGroups(rows, today = todayISO()) {
  const endOfMonth = `${today.slice(0, 7)}-31`;
  const bucketOf = (row) => {
    if (row.status === 'overdue') return 'overdue';
    if (row.status === 'due') return 'due';
    if (row.date <= endOfMonth) return 'month';
    if (row.daysAway <= 90) return 'ninety';
    return 'later';
  };
  return ['overdue', 'due', 'month', 'ninety', 'later']
    .map(id => ({ id, rows: rows.filter(row => bucketOf(row) === id) }))
    .filter(group => group.rows.length);
}

/**
 * Occurrences keyed by ISO date for one month grid, so a cell is one lookup.
 * Projected rows are included: a five-year view of an oil change is exactly
 * the projection, and hiding it would leave the year view empty.
 */
export function occurrenceMap(events, from, to, { today = todayISO(), lang = 'en' } = {}) {
  const map = new Map();
  for (const event of events || []) {
    if (event.active === false) continue;
    const leadDays = leadDaysFor(event);
    for (const row of occurrencesBetween(event, from, to)) {
      const settled = isSettled(event, row.date);
      const list = map.get(row.date) || [];
      list.push({
        id: event.id,
        event,
        member: event.member || null,
        date: row.date,
        settled,
        projected: Boolean(row.projected),
        title: localized(event.title, lang),
        status: settled ? 'settled' : statusOf(row.date, today, leadDays)
      });
      map.set(row.date, list);
    }
  }
  return map;
}
