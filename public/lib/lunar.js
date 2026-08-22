/* Vietnamese lunar calendar — Ho Ngoc Duc's algorithm, the reference
   implementation every VN calendar agrees with.

   Astronomical, not tabular: a lunar month starts on the day of the new moon
   as seen at UTC+7, and month 11 is the one containing the winter solstice.
   That is why every conversion carries a timezone — the same instant falls on
   two different lunar days either side of a timezone boundary, and a calendar
   printed in Hanoi must use Hanoi's. */

/** Vietnam. A stored lunar date means nothing without the zone it was read in. */
export const VN_TZ = 7;

const PI = Math.PI;
const INT = Math.floor;

/** Julian day number for a Gregorian (or Julian, before 1582) date. */
export function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  const jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  return jd < 2299161 ? dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083 : jd;
}

/** Inverse of jdFromDate. Returns [day, month, year]. */
export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) {
    a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4);
  } else {
    b = 0; c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return [e - INT((153 * m + 2) / 5) + 1, m + 3 - 12 * INT(m / 10), b * 100 + d - 4800 + INT(m / 10)];
}

/** Julian day of the k-th new moon since 1900-01-01, per Meeus chapter 47. */
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 = c1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 = c1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 = c1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 = c1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  c1 = c1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 = c1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + c1 - deltat;
}

/** Apparent solar longitude in radians. */
function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  dl = dl + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  const L = (L0 + dl) * dr;
  return L - PI * 2 * INT(L / (PI * 2));
}

/** Which 30-degree zodiac sector the sun sits in — 0..11, the "major term" index. */
function sunSector(dayNumber, tz) {
  return INT(sunLongitude(dayNumber - 0.5 - tz / 24) / PI * 6);
}

function newMoonDay(k, tz) {
  return INT(newMoon(k) + 0.5 + tz / 24);
}

/** First day of lunar month 11 — the month holding the winter solstice. */
function lunarMonth11(yy, tz) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = newMoonDay(k, tz);
  return sunSector(nm, tz) >= 9 ? newMoonDay(k - 1, tz) : nm;
}

/** In a 13-month year, the leap month is the first one with no major term. */
function leapMonthOffset(a11, tz) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1, last = 0, arc = sunSector(newMoonDay(k + i, tz), tz);
  do {
    last = arc;
    i += 1;
    arc = sunSector(newMoonDay(k + i, tz), tz);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Solar to lunar. Returns { day, month, year, leap }. */
export function solarToLunar(dd, mm, yy, tz = VN_TZ) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = newMoonDay(k, tz);

  let a11 = lunarMonth11(yy, tz), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = lunarMonth11(yy - 1, tz); }
  else { lunarYear = yy + 1; b11 = lunarMonth11(yy + 1, tz); }

  const diff = INT((monthStart - a11) / 29);
  let leap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const offset = leapMonthOffset(a11, tz);
    if (diff >= offset) {
      lunarMonth = diff + 10;
      if (diff === offset) leap = 1;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: dayNumber - monthStart + 1, month: lunarMonth, year: lunarYear, leap };
}

/** Lunar to solar. Returns [day, month, year], or [0,0,0] for a leap month that year does not have. */
export function lunarToSolar(lunarDay, lunarMonth, lunarYear, leap = 0, tz = VN_TZ) {
  const a11 = lunarMonth11(lunarMonth < 11 ? lunarYear - 1 : lunarYear, tz);
  const b11 = lunarMonth11(lunarMonth < 11 ? lunarYear : lunarYear + 1, tz);
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) off += 12;
  /* A 12-month lunar year has no leap month at all. The reference algorithm
     only guards this inside the 13-month branch, so asking for a leap month in
     an ordinary year quietly returned the ordinary month's date instead — a
     wrong date that looks entirely plausible. */
  if (leap && b11 - a11 <= 365) return [0, 0, 0];
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11, tz);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && lunarMonth !== leapMonth) return [0, 0, 0];
    if (leap || off >= leapOff) off += 1;
  }
  return jdToDate(newMoonDay(k + off, tz) + lunarDay - 1);
}

/** 29 or 30. Tet depends on it: a year with no 30th puts Giao thua on the 29th. */
export function lunarMonthLength(month, year, leap = 0, tz = VN_TZ) {
  const [d30, m30, y30] = lunarToSolar(30, month, year, leap, tz);
  if (!d30) return 29;
  const back = solarToLunar(d30, m30, y30, tz);
  return back.day === 30 && back.month === month ? 30 : 29;
}

export const CAN = Object.freeze(['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']);
export const CHI = Object.freeze(['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']);

export const canChiYear = (lunarYear) => `${CAN[(lunarYear + 6) % 10]} ${CHI[(lunarYear + 8) % 12]}`;
export const canChiMonth = (lunarMonth, lunarYear) => `${CAN[(lunarYear * 12 + lunarMonth + 3) % 10]} ${CHI[(lunarMonth + 1) % 12]}`;
/* Day pillars run on the Julian day number itself, unbroken since antiquity —
   the one cycle no calendar reform ever interrupted. */
export const canChiDay = (dd, mm, yy) => {
  const jd = jdFromDate(dd, mm, yy);
  return `${CAN[(jd + 9) % 10]} ${CHI[(jd + 1) % 12]}`;
};

/** Lunar month names as a Vietnamese calendar prints them. */
export function lunarMonthName(month, leap = 0, lang = 'vi') {
  const vi = { 1: 'Giêng', 11: 'Một', 12: 'Chạp' }[month] || String(month);
  const name = lang === 'vi' ? `Tháng ${vi}` : `Month ${month}`;
  return leap ? `${name} ${lang === 'vi' ? 'nhuận' : '(leap)'}` : name;
}
