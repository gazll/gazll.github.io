import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { lunarToSolar, solarToLunar, canChiYear } from '../public/lib/lunar.js';
import { holidayMap, isDayOff } from '../public/lib/vn-holidays.js';
import { agenda, nextDue, occurrencesBetween } from '../public/lib/schedule.js';
import { isEnvelope, seal, unseal } from '../public/lib/schedule-crypto.js';
import { groupedItems, itemRows, warrantyEnd, warrantyStatus } from '../public/lib/inventory.js';

describe('lunar calendar', () => {
  /* Every date on the calendar hangs off this conversion, and a wrong lunar
     day does not look wrong — it looks like a lunar day. These are the real
     Tet dates, which is the only way to notice the algorithm has drifted. */
  test('Tet lands on the day Vietnam actually observed it', () => {
    const expected = {
      2023: '22/1/2023', 2024: '10/2/2024', 2025: '29/1/2025', 2026: '17/2/2026',
      2027: '6/2/2027', 2028: '26/1/2028', 2029: '13/2/2029', 2030: '2/2/2030'
    };
    for (const [year, date] of Object.entries(expected)) {
      assert.equal(lunarToSolar(1, 1, Number(year), 0).join('/'), date, `Tet ${year}`);
    }
    assert.equal(canChiYear(2026), 'Bính Ngọ');
  });

  test('a leap month exists where the calendar says it does', () => {
    // Ất Tỵ 2025 ran a leap sixth month, starting 25/07/2025.
    assert.equal(lunarToSolar(1, 6, 2025, 1).join('/'), '25/7/2025');
    const back = solarToLunar(25, 7, 2025);
    assert.deepEqual([back.day, back.month, back.leap], [1, 6, 1]);
    // A leap month the year does not have must be refused, not approximated.
    assert.deepEqual(lunarToSolar(1, 6, 2026, 1), [0, 0, 0]);
  });

  test('solar and lunar round-trip for six consecutive years', () => {
    for (let year = 2025; year <= 2030; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (const day of [1, 14, 28]) {
          const lunar = solarToLunar(day, month, year);
          assert.deepEqual(
            lunarToSolar(lunar.day, lunar.month, lunar.year, lunar.leap),
            [day, month, year],
            `${day}/${month}/${year}`
          );
        }
      }
    }
  });
});

describe('Vietnamese holidays', () => {
  /* Điều 112 of the 2019 labour code grants exactly eleven paid days. The
     count is the pin: a Tet span computed one day short, or a National Day
     that forgot its adjacent day, still renders a plausible-looking calendar. */
  test('every year carries exactly eleven statutory days off', () => {
    for (let year = 2025; year <= 2031; year += 1) {
      const dates = [...holidayMap(year)].filter(([, entries]) => isDayOff(entries));
      assert.equal(dates.length, 11, `${year} should have 11 days off, got ${dates.length}`);
    }
  });

  test('a ministry notice adds days and workdays without touching the statute', () => {
    const overrides = { years: { 2026: {
      national_day_extra: 'after',
      extra: [{ date: '2026-02-20', kind: 'compensatory', vi: 'Nghỉ bù', en: 'Compensatory day' }],
      workdays: ['2026-02-28']
    } } };
    const map = holidayMap(2026, overrides);
    assert.ok(isDayOff(map.get('2026-02-20')), 'the added day is a day off');
    assert.ok(isDayOff(map.get('2026-09-03')), 'national_day_extra: after moves the second day');
    assert.ok(!map.has('2026-09-01') || !isDayOff(map.get('2026-09-01')), 'and drops the day before');
    // A make-up workday is named on the calendar but is not a day off.
    assert.ok(!isDayOff(map.get('2026-02-28')), 'a make-up workday is not a holiday');
  });
});

describe('reminder recurrence', () => {
  const today = '2026-08-22';

  /* The regression this exists for: a rolling event whose date has passed was
     skipped in favour of the next cycle, so "deworming was due five weeks ago"
     silently rendered as "due in five months" — the one failure mode that
     makes the whole tracker worse than no tracker. */
  test('an overdue rolling event stays overdue instead of jumping a cycle', () => {
    const event = {
      id: 'deworm', title: 'x', category: 'health',
      repeat: { kind: 'rolling', every: 6, unit: 'month' }, history: ['2026-01-15']
    };
    const due = nextDue(event, today);
    assert.equal(due.date, '2026-07-15');
    assert.equal(agenda([event], { today })[0].status, 'overdue');
  });

  /* The other half of the same rule. A fixed occurrence is only live for its
     warning window; past that the next one is what the reader needs. */
  test('a fixed occurrence expires once its lead window has run out', () => {
    const event = {
      id: 'inspection', title: 'x', category: 'vehicle', severity: 'critical',
      repeat: { kind: 'yearly', anchor: '2025-03-06' }
    };
    assert.equal(nextDue(event, today).date, '2027-03-06', 'March is long gone');
    assert.equal(nextDue(event, '2026-03-20').date, '2026-03-06', 'still inside the 30-day window');
  });

  test('history settles the cycle it belongs to and only that one', () => {
    const event = {
      id: 'fee', title: 'x', category: 'finance',
      repeat: { kind: 'yearly', anchor: '2024-11-18' }, history: ['2025-11-18']
    };
    assert.equal(nextDue(event, today).date, '2026-11-18');
    assert.equal(nextDue({ ...event, history: ['2025-11-18', '2026-11-20'] }, today).date, '2027-11-18');
  });

  test('a lunar-anchored event follows the lunar calendar, not the solar one', () => {
    const event = { id: 'gio', title: 'x', category: 'family', repeat: { kind: 'lunar-yearly', day: 10, month: 9 } };
    const dates = occurrencesBetween(event, '2026-01-01', '2029-01-01').map(row => row.date);
    assert.deepEqual(dates, ['2026-10-19', '2027-10-09', '2028-10-27']);
  });

  /* Distance and time are two different due dates and the earlier one wins,
     but only the time half is a fact — so the row must admit it is a guess. */
  test('an odometer estimate can win, and says that it is an estimate', () => {
    const event = {
      id: 'oil', title: 'x', category: 'vehicle',
      repeat: { kind: 'rolling', every: 5, unit: 'month' }, history: ['2026-05-10'],
      odometer: { every_km: 5000, per_month: 1400, km_since: 1200 }
    };
    const due = nextDue(event, today);
    assert.equal(due.driver, 'odometer');
    assert.equal(due.estimated, true);
    assert.equal(due.calendarDate, '2026-10-10', 'the date-driven answer is kept alongside');
  });
});

describe('things owned', () => {
  const today = '2026-08-22';

  test('a warranty is derived from the purchase, and says which of three states it is in', () => {
    const bought = { id: 'a', name: 'x', bought: '2025-08-12', warranty_months: 24 };
    assert.equal(warrantyEnd(bought), '2027-08-12');
    assert.equal(warrantyStatus(bought, today), 'active');
    assert.equal(warrantyStatus(bought, '2027-07-01'), 'ending');
    assert.equal(warrantyStatus(bought, '2027-09-01'), 'expired');
    // No warranty recorded is not the same claim as one that ran out.
    assert.equal(warrantyStatus({ id: 'b', name: 'x', bought: '2020-01-01' }, today), 'none');
  });

  /* The distinction the whole `service` field exists for: a four-year-old pair
     of earbuds whose battery was changed in June is not a four-year-old
     battery, and collapsing the two makes the history answer the wrong
     question while still looking right. */
  test('replacing a part resets that part, not the age of the thing', () => {
    const [row] = itemRows([{
      id: 'airpods', name: 'AirPods', bought: '2023-02-15',
      service: [{ date: '2026-06-09', what: 'Pin 2 tai', part: 'pin' }]
    }], { today });

    assert.equal(row.monthsOwned, 42, 'the device keeps its own purchase date');
    assert.equal(row.parts.find(part => part.part === 'pin').months, 2, 'the battery is two months old');
    assert.deepEqual(row.service.map(entry => entry.date), ['2026-06-09']);
  });

  test('service entries read newest first however they were written', () => {
    const [row] = itemRows([{
      id: 'wave', name: 'Xe', service: [
        { date: '2023-01-05', what: 'Lọc gió' },
        { date: '2026-08-11', what: 'Acquy' },
        { date: '2025-08-13', what: 'Bugi' }
      ]
    }], { today });
    assert.deepEqual(row.service.map(entry => entry.what), ['Acquy', 'Bugi', 'Lọc gió']);
  });

  /* A group is dated by its newest part, not its oldest: a NAS given a new
     drive last month is something you touched last month, and sorting it by
     the 2024 build date would bury it under every trinket bought since. */
  test('a group sorts by its newest part', () => {
    const rows = itemRows([
      { id: 'nas', name: 'NAS', group: 'nas', bought: '2024-09-20' },
      { id: 'disk', name: 'Ổ 8TB', group: 'nas', bought: '2026-06-20' },
      { id: 'lamp', name: 'Đèn', group: 'desk', bought: '2024-12-22' }
    ], { today });
    const { groups } = groupedItems(rows, [{ id: 'nas', name: 'NAS' }, { id: 'desk', name: 'Bàn' }]);
    assert.deepEqual(groups.map(bucket => bucket.id), ['nas', 'desk']);
    assert.equal(groups[0].newest, '2026-06-20');
  });

  test('an item with no purchase date is kept, not guessed at', () => {
    const [row] = itemRows([{ id: 'jbl', name: 'JBL', service: [{ date: '2022-09-21', what: 'Pin' }] }], { today });
    assert.equal(row.bought, null);
    assert.equal(row.monthsOwned, null);
    assert.equal(row.warrantyStatus, 'none');
  });
});

describe('sealed schedule', () => {
  const document = {
    version: 1,
    events: [{ id: 'card', title: { vi: 'Phí thường niên thẻ', en: 'Card annual fee' }, category: 'finance' }]
  };

  test('the envelope opens with the passphrase and refuses any other', async () => {
    const envelope = await seal(document, 'correct horse battery');
    assert.ok(isEnvelope(envelope));
    assert.deepEqual(await unseal(envelope, 'correct horse battery'), document);
    await assert.rejects(() => unseal(envelope, 'correct horse batteru'));
  });

  /* The one assertion that matters for privacy: this file is served publicly
     by GitHub Pages, so nothing readable may survive into it. */
  test('nothing from the plaintext survives into the committed file', async () => {
    const serialized = JSON.stringify(await seal(document, 'a passphrase'));
    for (const secret of ['annual', 'card', 'finance', 'thường niên']) {
      assert.ok(!serialized.includes(secret), `"${secret}" leaked into the envelope`);
    }
  });

  test('two seals of the same content differ, so the salt is not reused', async () => {
    const [first, second] = await Promise.all([seal(document, 'k'), seal(document, 'k')]);
    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.ct, second.ct);
  });
});
