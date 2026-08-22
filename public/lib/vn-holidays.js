/* Vietnamese public holidays and observances for one year.

   Two different kinds of fact, and they must not be merged. The eleven paid
   days off are STATUTE — Bộ luật Lao động 2019, Điều 112 — so they are rules,
   computed here and correct for any year. Which extra days a given Tet
   actually gets, and which Saturday is worked to pay for them, is a MINISTRY
   NOTICE published one year at a time; that cannot be computed, so it lives in
   data/calendar/holidays.json and is merged on top.

   Everything is a 'YYYY-MM-DD' string, never a Date. A Date is an instant, and
   an instant read in the browser's zone silently shifts a Vietnamese calendar
   day for anyone travelling. */

import { lunarMonthLength, lunarToSolar, solarToLunar } from './lunar.js';

export const HOLIDAY_KINDS = Object.freeze(['statutory', 'compensatory', 'observance']);

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d, m, y) => `${y}-${pad(m)}-${pad(d)}`;
const fromLunar = (day, month, year) => {
  const [d, m, y] = lunarToSolar(day, month, year, 0);
  return d ? iso(d, m, y) : null;
};

/** Shift an ISO day by whole days without going through a Date's timezone. */
export function shiftDays(date, delta) {
  const at = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  return new Date(at + delta * 86400000).toISOString().slice(0, 10);
}

export const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

/* Fixed solar dates. `off` marks the ones Điều 112 pays for; the rest are days
   the calendar should name but nobody gets off. */
const SOLAR = [
  { id: 'new-year', d: 1, m: 1, off: true, vi: 'Tết Dương lịch', en: "New Year's Day" },
  { id: 'party-founding', d: 3, m: 2, vi: 'Thành lập Đảng', en: 'Party Foundation Day' },
  { id: 'valentine', d: 14, m: 2, vi: 'Lễ tình nhân', en: "Valentine's Day" },
  { id: 'doctors-day', d: 27, m: 2, vi: 'Thầy thuốc Việt Nam', en: "Vietnamese Doctors' Day" },
  { id: 'womens-day', d: 8, m: 3, vi: 'Quốc tế Phụ nữ', en: "International Women's Day" },
  { id: 'youth-union', d: 26, m: 3, vi: 'Thành lập Đoàn', en: 'Youth Union Foundation Day' },
  { id: 'reunification', d: 30, m: 4, off: true, vi: 'Ngày Giải phóng miền Nam', en: 'Reunification Day' },
  { id: 'labour-day', d: 1, m: 5, off: true, vi: 'Quốc tế Lao động', en: 'International Workers Day' },
  { id: 'childrens-day', d: 1, m: 6, vi: 'Quốc tế Thiếu nhi', en: "International Children's Day" },
  { id: 'press-day', d: 21, m: 6, vi: 'Báo chí Cách mạng', en: 'Revolutionary Press Day' },
  { id: 'war-invalids', d: 27, m: 7, vi: 'Thương binh Liệt sĩ', en: 'War Invalids and Martyrs Day' },
  { id: 'august-revolution', d: 19, m: 8, vi: 'Cách mạng tháng Tám', en: 'August Revolution Day' },
  { id: 'national-day', d: 2, m: 9, off: true, vi: 'Quốc khánh', en: 'National Day' },
  { id: 'vn-womens-day', d: 20, m: 10, vi: 'Phụ nữ Việt Nam', en: "Vietnamese Women's Day" },
  { id: 'teachers-day', d: 20, m: 11, vi: 'Nhà giáo Việt Nam', en: "Vietnamese Teachers' Day" },
  { id: 'army-day', d: 22, m: 12, vi: 'Quân đội Nhân dân', en: "People's Army Day" },
  { id: 'christmas', d: 24, m: 12, vi: 'Giáng sinh', en: 'Christmas Eve' }
];

/* Lunar-dated observances. Giỗ Tổ is the only paid one; the rest are the days
   a Vietnamese household actually plans around. */
const LUNAR = [
  { id: 'nguyen-tieu', d: 15, m: 1, vi: 'Rằm tháng Giêng', en: 'First Full Moon Festival' },
  { id: 'han-thuc', d: 3, m: 3, vi: 'Tết Hàn thực', en: 'Cold Food Festival' },
  { id: 'hung-kings', d: 10, m: 3, off: true, vi: 'Giỗ Tổ Hùng Vương', en: 'Hung Kings Commemoration' },
  { id: 'phat-dan', d: 15, m: 4, vi: 'Lễ Phật Đản', en: "Buddha's Birthday" },
  { id: 'doan-ngo', d: 5, m: 5, vi: 'Tết Đoan Ngọ', en: 'Mid-year Festival' },
  { id: 'vu-lan', d: 15, m: 7, vi: 'Lễ Vu Lan', en: 'Ghost Festival' },
  { id: 'trung-thu', d: 15, m: 8, vi: 'Tết Trung thu', en: 'Mid-Autumn Festival' },
  { id: 'trung-cuu', d: 9, m: 9, vi: 'Tết Trùng cửu', en: 'Double Ninth Festival' },
  { id: 'ong-tao', d: 23, m: 12, vi: 'Ông Táo chầu trời', en: 'Kitchen Gods Day' }
];

/** The five statutory Tet days: the last day of tháng Chạp through mùng 4. */
export function tetDays(solarYear) {
  const eveDay = lunarMonthLength(12, solarYear - 1);
  const eve = fromLunar(eveDay, 12, solarYear - 1);
  if (!eve) return [];
  return [
    { date: eve, id: 'tet-eve', vi: 'Giao thừa', en: "Lunar New Year's Eve" },
    ...[1, 2, 3, 4].map(n => ({
      date: fromLunar(n, 1, solarYear),
      id: `tet-${n}`,
      vi: n === 1 ? 'Mùng 1 Tết' : `Mùng ${n} Tết`,
      en: `Tet day ${n}`
    }))
  ].filter(row => row.date);
}

/**
 * Every named day in `solarYear`, keyed by ISO date.
 *
 * `overrides` is data/calendar/holidays.json — the ministry notice for that
 * year. It may add compensatory days, swap which side of 02/09 the second
 * National Day falls on, and name the Saturdays worked in exchange.
 */
export function holidayMap(solarYear, overrides = {}) {
  const year = overrides?.years?.[String(solarYear)] || {};
  const map = new Map();

  const add = (date, entry) => {
    if (!date) return;
    const list = map.get(date) || [];
    list.push(entry);
    map.set(date, list);
  };

  for (const row of SOLAR) {
    add(iso(row.d, row.m, solarYear), {
      id: row.id, kind: row.off ? 'statutory' : 'observance', vi: row.vi, en: row.en
    });
  }
  for (const row of LUNAR) {
    add(fromLunar(row.d, row.m, solarYear), {
      id: row.id, kind: row.off ? 'statutory' : 'observance', vi: row.vi, en: row.en, lunar: true
    });
  }
  for (const row of tetDays(solarYear)) {
    add(row.date, { id: row.id, kind: 'statutory', vi: row.vi, en: row.en, lunar: true });
  }

  /* Điều 112 gives National Day two days: 02/09 plus one adjacent day, and
     which side is announced each year rather than fixed. */
  const adjacent = year.national_day_extra === 'after' ? 1 : -1;
  add(shiftDays(iso(2, 9, solarYear), adjacent), {
    id: 'national-day-adjacent', kind: 'statutory',
    vi: 'Nghỉ Quốc khánh', en: 'National Day holiday'
  });

  for (const row of year.extra || []) {
    add(row.date, {
      id: row.id || 'extra', kind: row.kind || 'compensatory',
      vi: row.vi, en: row.en, source: row.source
    });
  }
  for (const date of year.workdays || []) {
    add(date, {
      id: 'make-up-workday', kind: 'observance', workday: true,
      vi: 'Đi làm bù', en: 'Make-up workday', source: year.source
    });
  }
  return map;
}

/** True when the day is a paid day off — the flag the grid tints on. */
export const isDayOff = (entries) =>
  Boolean(entries?.some(row => row.kind === 'statutory' || row.kind === 'compensatory'));

/** Mùng 1 and rằm: not holidays, but the two lunar days households watch for. */
export function lunarMarker(lunar) {
  if (lunar.day === 1) return 'new-moon';
  if (lunar.day === 15) return 'full-moon';
  return null;
}

/** Named days from `from` (inclusive) forward, flattened and sorted. */
export function holidayRange(from, to, overrides = {}) {
  const rows = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year += 1) {
    for (const [date, entries] of holidayMap(year, overrides)) {
      if (date < from || date > to) continue;
      for (const entry of entries) rows.push({ ...entry, date });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export { solarToLunar };
