/* The things you own, and the lists you tick before a trip.

   Deliberately not part of schedule.js. A reminder answers "when must I do
   this again"; an item answers "when did I buy this, what did it cost, is it
   still under warranty". The first repeats and the second never does, and the
   one date an item has — the end of its warranty — is DERIVED from the purchase
   rather than authored. Mixing them would put 80 receipts in an agenda meant
   for the six things due this quarter.

   Items are grouped and split by household, not by member. A NAS is not
   Minh's; it is the house's, and its drives and UPS are part of it rather than
   three unrelated purchases that happen to share a shelf.

   Dates are 'YYYY-MM-DD' strings, same rule as everywhere else here. */

import { addMonths, diffDays, localized, todayISO } from './schedule.js';

/** A warranty is "ending" inside this window — long enough to actually test
    the thing and file a claim before the cover lapses. */
export const WARRANTY_WARNING_DAYS = 60;

export const warrantyEnd = (item) =>
  item?.bought && Number(item.warranty_months) > 0
    ? addMonths(item.bought, Number(item.warranty_months))
    : null;

/** none · active · ending · expired. `none` means no warranty was recorded,
    which is not the same as one that ran out. */
export function warrantyStatus(item, today = todayISO()) {
  const end = warrantyEnd(item);
  if (!end) return 'none';
  const away = diffDays(today, end);
  if (away < 0) return 'expired';
  return away <= WARRANTY_WARNING_DAYS ? 'ending' : 'active';
}

/** Whole months between two dates — the honest unit for "how old is this". */
export function monthsBetween(from, to) {
  if (!from || !to) return null;
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return (ty * 12 + tm) - (fy * 12 + fm) - (td < fd ? 1 : 0);
}

export const monthsOwned = (item, today = todayISO()) => monthsBetween(item?.bought, today);

/**
 * What has been replaced inside a thing, newest first.
 *
 * The age of a device and the age of the part inside it are different numbers,
 * and it is the second one that answers the question actually being asked — a
 * four-year-old pair of earbuds whose battery was changed in June is not a
 * four-year-old battery. So a replacement resets the clock for its own `part`
 * while the item keeps its original purchase date.
 */
export function serviceLog(item, today = todayISO()) {
  return [...(item?.service || [])]
    .filter(entry => entry?.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(entry => ({ ...entry, monthsAgo: monthsBetween(entry.date, today) }));
}

/** Age of each named part: its last replacement, or the purchase if never. */
export function partAges(item, today = todayISO()) {
  const seen = new Map();
  for (const entry of serviceLog(item, today)) {
    if (!entry.part || seen.has(entry.part)) continue;   // sorted, so first is newest
    seen.set(entry.part, { part: entry.part, since: entry.date, months: entry.monthsAgo, replaced: true });
  }
  return [...seen.values()];
}

/** One resolved row per item, sorted newest purchase first. */
export function itemRows(items, { today = todayISO(), lang = 'en' } = {}) {
  return (items || []).map(item => {
    const end = warrantyEnd(item);
    return {
      id: item.id,
      item,
      name: localized(item.name, lang),
      note: localized(item.note, lang),
      bought: item.bought || null,
      price: item.price || '',
      group: item.group || null,
      household: item.household || null,
      warrantyEnd: end,
      warrantyStatus: warrantyStatus(item, today),
      warrantyDaysLeft: end ? diffDays(today, end) : null,
      monthsOwned: monthsOwned(item, today),
      service: serviceLog(item, today),
      parts: partAges(item, today)
    };
  }).sort((a, b) => String(b.bought || '').localeCompare(String(a.bought || '')) || a.id.localeCompare(b.id));
}

/**
 * Rows arranged into their groups, then the ungrouped ones.
 *
 * A group's own date is its newest part, not its oldest: a NAS rebuilt with a
 * new drive last month is a thing you touched last month, and sorting it by
 * the 2024 build date would bury it under every trinket bought since.
 */
export function groupedItems(rows, groups = []) {
  const known = new Map((groups || []).map(group => [group.id, group]));
  const buckets = new Map();
  const loose = [];

  for (const row of rows) {
    if (!row.group || !known.has(row.group)) { loose.push(row); continue; }
    if (!buckets.has(row.group)) buckets.set(row.group, []);
    buckets.get(row.group).push(row);
  }

  const grouped = [...buckets].map(([id, members]) => ({
    id,
    group: known.get(id),
    rows: members,
    newest: members.reduce((latest, row) => row.bought > latest ? row.bought : latest, ''),
    total: members.length
  }));

  return {
    groups: grouped.sort((a, b) => b.newest.localeCompare(a.newest)),
    loose
  };
}

/** Items whose cover lapses soon, newest deadline last — the one list worth
    acting on, and the reason warranties are tracked at all. */
export const endingSoon = (rows) =>
  rows.filter(row => row.warrantyStatus === 'ending')
    .sort((a, b) => String(a.warrantyEnd).localeCompare(String(b.warrantyEnd)));

/**
 * Checklist entries with their tick state resolved.
 *
 * `checks` maps an entry id to { done, at }. It is NOT part of the sealed file:
 * the file says what belongs on the list, and ticking is per-trip state that
 * changes far more often than a commit. Storage lives with the caller.
 */
export function checklistRows(checklist, checks = {}, lang = 'en') {
  const entries = (checklist?.items || []).map(entry => {
    const state = checks[entry.id] || {};
    return {
      id: entry.id,
      text: localized(entry.text, lang),
      note: localized(entry.note, lang),
      done: Boolean(state.done),
      at: state.at || null
    };
  });
  return {
    id: checklist?.id,
    name: localized(checklist?.name, lang),
    note: localized(checklist?.note, lang),
    entries,
    done: entries.filter(entry => entry.done).length,
    total: entries.length
  };
}
