<script setup lang="ts">
/* The calendar surface: a public Vietnamese calendar, and a private reminder
   tracker layered on top of it.

   Client-only, and that is a decision rather than an oversight. The site is
   prerendered onto GitHub Pages, so anything rendered on the server would bake
   the BUILD date in as "today" and every relative line on the page — days
   away, overdue, this month — would be wrong until the next deploy.

   The two layers have different gates. The calendar is public and needs
   nothing. The reminder list is decrypted in the browser from a sealed file,
   and the KEY is the gate — never sign-in on its own, which would buy no
   privacy over ciphertext while locking you out whenever Google is
   unreachable. There are two ways to hold that key: type the passphrase, or
   sign in with an account the owner listed in the schedule_access sheet and
   let the backend hand it over. A backend-delivered key is used and dropped,
   never stored, so deleting the row actually takes access away. */

import { canChiDay, canChiMonth, canChiYear, lunarMonthName, solarToLunar } from '../../../public/lib/lunar.js';
import { holidayMap, isDayOff, lunarMarker, shiftDays } from '../../../public/lib/vn-holidays.js';
import { agenda, agendaGroups, diffDays, localized, occurrenceMap, todayISO } from '../../../public/lib/schedule.js';
import { isEnvelope, unseal } from '../../../public/lib/schedule-crypto.js';
import { checklistRows, endingSoon, groupedItems, itemRows } from '../../../public/lib/inventory.js';
import { copyText } from '../../../public/lib/clipboard.js';

const props = defineProps<{ lang: 'en' | 'vi' }>();
const nuxtApp = useNuxtApp() as any;

const SEALED_URL = '/data/schedule/private.enc.json';
const OVERRIDES_URL = '/data/calendar/holidays.json';
const VIEW_KEY = 'gazll:calendar-view';
const KEY_STORE = 'gazll:schedule-key';
const CHECKS_KEY = 'gazll:calendar-checks';

const today = ref(todayISO());
const view = ref<'month' | 'year' | 'agenda' | 'items'>('month');
const cursor = ref(today.value.slice(0, 7));
const cursorYear = ref(Number(today.value.slice(0, 4)));
const selected = ref<string | null>(null);
const overrides = ref<any>({});

const events = ref<any[]>([]);
const members = ref<any[]>([]);
const standingNotes = ref<any[]>([]);
const memberFilter = ref('all');
const items = ref<any[]>([]);
const groups = ref<any[]>([]);
const households = ref<any[]>([]);
const checklists = ref<any[]>([]);
const checks = ref<Record<string, { done: boolean; at: string }>>({});
const householdFilter = ref('all');
const locked = ref(true);
const sealedMissing = ref(false);
const passphrase = ref('');
const remember = ref(false);
const unlockError = ref('');
const unlocking = ref(false);
const hint = ref('');
const hintShown = ref(false);
const authState = ref('loading');

const inbox = ref<any[]>([]);
const inboxBody = ref('');
const inboxCategory = ref('');
const inboxHint = ref('');
const inboxNotice = ref('');
const inboxBusy = ref(false);
const copiedId = ref('');
let stopAuth: (() => void) | null = null;

/* Five years forward is the promise; one year back is there so January does
   not dead-end when you step backwards to check what already happened. */
const minYear = computed(() => Number(today.value.slice(0, 4)) - 1);
const maxYear = computed(() => Number(today.value.slice(0, 4)) + 4);

const vi = computed(() => props.lang === 'vi');
const t = computed(() => vi.value ? {
  month: 'Tháng', year: 'Năm', agenda: 'Sắp tới', todayLabel: 'Hôm nay',
  prev: 'Trước', next: 'Sau', dayOff: 'Nghỉ lễ', workday: 'Đi làm bù',
  lunarShort: 'ÂL', unlock: 'Mở lịch riêng', lock: 'Khoá lại', forgot: 'Quên passphrase?', hintLabel: 'Gợi ý',
  passphrase: 'Passphrase', rememberDevice: 'Nhớ trên thiết bị này',
  signInFirst: 'Cần đăng nhập để dùng hộp chờ.', signInForInbox: 'Hộp chờ cần đăng nhập; lịch riêng thì không.',
  sealedMissing: 'Chưa có file lịch riêng. Chạy `node tools/schedule-seal.mjs init` rồi `seal`.',
  lockedTitle: 'Lịch riêng đang khoá',
  lockedBody: 'Danh sách nhắc việc được mã hoá trong repo. Nhập passphrase để mở ngay trên trình duyệt.',
  grantedHint: 'Hoặc đăng nhập bằng tài khoản đã được cấp quyền — trang sẽ tự mở.',
  upcomingHolidays: 'Ngày lễ sắp tới', noPrivate: 'Chưa có mục nào trong lịch riêng.',
  overdue: 'Quá hạn', due: 'Cần làm ngay', monthGroup: 'Trong tháng này',
  ninety: '90 ngày tới', later: 'Xa hơn', daysLeft: 'còn', daysOver: 'trễ', days: 'ngày',
  lastDone: 'lần cuối', estimate: 'ước tính theo số km', every: 'Mỗi', once: 'Một lần',
  yearly: 'Hằng năm', monthly: 'Hằng tháng', lunarYearly: 'Hằng năm (âm lịch)',
  day: 'ngày', months: 'tháng', years: 'năm', dayWord: 'ngày',
  inbox: 'Hộp chờ', inboxIntro: 'Ghi nhanh khi chưa tiện sửa JSON. Chuyển vào file rồi đánh dấu đã xử lý.',
  inboxAdd: 'Thêm ghi chú', inboxPlaceholder: 'Ví dụ: gia hạn bảo hiểm xe máy tháng 11',
  inboxHintPlaceholder: 'Mốc thời gian (tuỳ chọn)', inboxEmpty: 'Hộp chờ trống.',
  copyJson: 'Copy JSON', copied: 'Đã copy', markMerged: 'Đã chuyển', reopen: 'Mở lại',
  remove: 'Xoá', merged: 'Đã chuyển', clearMerged: 'Xoá mục đã chuyển',
  backendMissing: 'Backend chưa có action schedule.* — cần Deploy → New version cho Apps Script.',
  nothingOn: 'Không có gì trong ngày này.', allMembers: 'Tất cả', standing: 'Ghi chú',
  items: 'Đồ đạc', other: 'Khác', noItems: 'Chưa có món nào.', bought: 'Mua',
  warrantyTo: 'BH đến', warrantyLeft: 'BH còn', warrantyOver: 'Hết bảo hành',
  warrantyWatch: 'Sắp hết bảo hành', owned: 'đã dùng', replaced: 'Đã thay', ago: 'trước',
  underMonth: 'dưới 1 tháng', yearWord: 'năm',
  weekdays: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
  weekdaysLong: ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'],
  monthNames: Array.from({ length: 12 }, (_, i) => `Tháng ${i + 1}`),
  dayPillar: 'Ngày', monthPillar: 'Tháng', yearPillar: 'Năm'
} : {
  month: 'Month', year: 'Year', agenda: 'Upcoming', todayLabel: 'Today',
  prev: 'Previous', next: 'Next', dayOff: 'Public holiday', workday: 'Make-up workday',
  lunarShort: 'Lunar', unlock: 'Open private schedule', lock: 'Lock again', forgot: 'Forgot the passphrase?', hintLabel: 'Hint',
  passphrase: 'Passphrase', rememberDevice: 'Remember on this device',
  signInFirst: 'Sign in to use the inbox.', signInForInbox: 'The inbox needs sign-in; the schedule itself does not.',
  sealedMissing: 'No sealed schedule yet. Run `node tools/schedule-seal.mjs init`, then `seal`.',
  lockedTitle: 'Private schedule is locked',
  lockedBody: 'The reminder list ships encrypted. Enter the passphrase to open it in this browser.',
  grantedHint: 'Or sign in with an account that has been granted access — the page opens itself.',
  upcomingHolidays: 'Upcoming holidays', noPrivate: 'Nothing in the private schedule yet.',
  overdue: 'Overdue', due: 'Due now', monthGroup: 'Later this month',
  ninety: 'Next 90 days', later: 'Further out', daysLeft: 'in', daysOver: 'late by', days: 'days',
  lastDone: 'last done', estimate: 'estimated from distance', every: 'Every', once: 'One-off',
  yearly: 'Yearly', monthly: 'Monthly', lunarYearly: 'Yearly (lunar)',
  day: 'day', months: 'months', years: 'years', dayWord: 'day',
  inbox: 'Inbox', inboxIntro: 'Capture a reminder when editing JSON is not convenient, then transcribe it and mark it merged.',
  inboxAdd: 'Add note', inboxPlaceholder: 'e.g. renew motorbike insurance in November',
  inboxHintPlaceholder: 'When, roughly (optional)', inboxEmpty: 'The inbox is empty.',
  copyJson: 'Copy JSON', copied: 'Copied', markMerged: 'Mark merged', reopen: 'Reopen',
  remove: 'Delete', merged: 'Merged', clearMerged: 'Clear merged notes',
  backendMissing: 'The backend has no schedule.* actions yet — redeploy Apps Script (Deploy → New version).',
  nothingOn: 'Nothing on this day.', allMembers: 'Everyone', standing: 'Notes',
  items: 'Things', other: 'Other', noItems: 'Nothing recorded yet.', bought: 'Bought',
  warrantyTo: 'Warranty to', warrantyLeft: 'Warranty ends in', warrantyOver: 'Out of warranty',
  warrantyWatch: 'Warranty ending', owned: 'owned', replaced: 'Replaced', ago: 'ago',
  underMonth: 'under a month', yearWord: 'y',
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  dayPillar: 'Day', monthPillar: 'Month', yearPillar: 'Year'
});

/* One holidayMap per year, kept because the year view asks for the same year
   twelve times and each map does its own lunar conversions. */
const holidayCache = new Map<number, Map<string, any[]>>();
watch(overrides, () => holidayCache.clear());
function holidaysFor(year: number) {
  if (!holidayCache.has(year)) holidayCache.set(year, holidayMap(year, overrides.value));
  return holidayCache.get(year)!;
}

const parts = (date: string) => date.split('-').map(Number) as [number, number, number];
const weekdayIndex = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

function formatDate(date: string) {
  const [y, m, d] = parts(date);
  const short = t.value.weekdays[(weekdayIndex(date) + 6) % 7];
  return vi.value ? `${short}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
    : `${short}, ${d} ${t.value.monthNames[m - 1].slice(0, 3)} ${y}`;
}
const shortDate = (date: string) => {
  const [y, m, d] = parts(date);
  return vi.value ? `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}` : `${d}/${m}/${y}`;
};
/** Zero-padded day/month, so a cadence line reads 05/03 and not 5/3/2. */
const dayMonth = (date: string) => {
  const [, m, d] = parts(date);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};
const lunarText = (lunar: any) =>
  `${lunar.day}/${lunar.month}${lunar.leap ? (vi.value ? 'N' : 'L') : ''} ${t.value.lunarShort}`;

/* One filter drives the dots, the agenda and the notes together, so picking a
   member narrows the whole page rather than just the list under it. */
const memberName = (id: string) => {
  const row = members.value.find(member => member.id === id);
  return row ? localized(row.name, props.lang) : id;
};
const visibleEvents = computed(() => memberFilter.value === 'all'
  ? events.value
  : events.value.filter(event => event.member === memberFilter.value));
const visibleNotes = computed(() => memberFilter.value === 'all'
  ? standingNotes.value
  : standingNotes.value.filter(note => note.member === memberFilter.value));

/* Items and checklists are split by HOUSEHOLD, not by member: a NAS belongs
   to a house rather than to one of the people in it. One chip row serves both
   axes and switches meaning with the tab, because showing two filters at once
   only raises the question of which is in charge. */
const visibleItems = computed(() => householdFilter.value === 'all'
  ? items.value
  : items.value.filter(item => item.household === householdFilter.value));
const itemList = computed(() => itemRows(visibleItems.value, { today: today.value, lang: props.lang }));
const itemGroups = computed(() => groupedItems(itemList.value, groups.value));
const warrantyWatch = computed(() => endingSoon(itemList.value));
const checklistViews = computed(() => checklists.value
  .filter(list => householdFilter.value === 'all' || list.household === householdFilter.value)
  .map(list => checklistRows(list, checks.value, props.lang)));
const householdName = (id: string) => {
  const row = households.value.find(house => house.id === id);
  return row ? localized(row.name, props.lang) : id;
};

/** Months as something a person says out loud: "2 năm 3 tháng", not "27". */
function duration(months: number | null) {
  if (months == null) return '';
  if (months < 1) return t.value.underMonth;
  if (months < 12) return `${months} ${t.value.months}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} ${t.value.yearWord} ${rest} ${t.value.months}` : `${years} ${t.value.yearWord}`;
}

function warrantyText(row: any) {
  if (row.warrantyStatus === 'none') return '';
  if (row.warrantyStatus === 'expired') return t.value.warrantyOver;
  if (row.warrantyStatus === 'ending') return `${t.value.warrantyLeft} ${row.warrantyDaysLeft} ${t.value.days}`;
  return `${t.value.warrantyTo} ${shortDate(row.warrantyEnd)}`;
}

/** The private occurrences for whatever range is on screen, keyed by date. */
const occurrences = computed(() => {
  if (locked.value || !visibleEvents.value.length) return new Map();
  const from = view.value === 'year' ? `${cursorYear.value}-01-01` : shiftDays(`${cursor.value}-01`, -7);
  const to = view.value === 'year' ? `${cursorYear.value}-12-31` : shiftDays(`${cursor.value}-01`, 44);
  return occurrenceMap(visibleEvents.value, from, to, { today: today.value, lang: props.lang });
});

function cellFor(date: string, month: number) {
  const [y, m, d] = parts(date);
  const lunar = solarToLunar(d, m, y);
  const entries = holidaysFor(y).get(date) || [];
  const named = entries.find(row => row.kind === 'statutory' || row.kind === 'compensatory') || entries[0] || null;
  const weekday = weekdayIndex(date);
  return {
    date,
    day: d,
    inMonth: m === month,
    lunar,
    lunarLabel: lunar.day === 1 ? `${lunar.day}/${lunar.month}` : String(lunar.day),
    marker: lunarMarker(lunar),
    holidays: entries,
    label: named ? (named[props.lang] || named.en) : '',
    dayOff: isDayOff(entries),
    workday: entries.some(row => row.workday),
    weekend: weekday === 0 || weekday === 6,
    isToday: date === today.value,
    events: (occurrences.value.get(date) || []) as any[]
  };
}

/** Always 42 cells so stepping between months never changes the page height. */
function gridFor(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const offset = (weekdayIndex(first) + 6) % 7;
  const start = shiftDays(first, -offset);
  return Array.from({ length: 42 }, (_, index) => cellFor(shiftDays(start, index), m));
}

const monthCells = computed(() => gridFor(cursor.value));
const yearMonths = computed(() => Array.from({ length: 12 }, (_, index) => ({
  ym: `${cursorYear.value}-${String(index + 1).padStart(2, '0')}`,
  label: t.value.monthNames[index],
  cells: gridFor(`${cursorYear.value}-${String(index + 1).padStart(2, '0')}`)
})));

const monthTitle = computed(() => {
  const [y, m] = cursor.value.split('-').map(Number);
  const firstLunar = solarToLunar(1, m, y);
  return {
    solar: vi.value ? `Tháng ${m}, ${y}` : `${t.value.monthNames[m - 1]} ${y}`,
    lunar: `${lunarMonthName(firstLunar.month, firstLunar.leap, props.lang)} ${canChiYear(firstLunar.year)}`
  };
});

const todayCard = computed(() => {
  const [y, m, d] = parts(today.value);
  const lunar = solarToLunar(d, m, y);
  const entries = holidaysFor(y).get(today.value) || [];
  return {
    date: today.value,
    weekday: t.value.weekdaysLong[weekdayIndex(today.value)],
    solar: shortDate(today.value),
    lunarDay: `${lunar.day} ${lunarMonthName(lunar.month, lunar.leap, props.lang)}`,
    canDay: canChiDay(d, m, y),
    canMonth: canChiMonth(lunar.month, lunar.year),
    canYear: canChiYear(lunar.year),
    holidays: entries
  };
});

const selectedCell = computed(() => {
  if (!selected.value) return null;
  return cellFor(selected.value, Number(selected.value.slice(5, 7)));
});
const selectedPillar = computed(() => {
  if (!selected.value) return '';
  const [y, m, d] = parts(selected.value);
  return canChiDay(d, m, y);
});

/** The next public holidays — the rail's content for everyone, locked or not. */
const nextHolidays = computed(() => {
  const rows: any[] = [];
  for (let year = Number(today.value.slice(0, 4)); year <= maxYear.value && rows.length < 6; year += 1) {
    for (const [date, entries] of holidaysFor(year)) {
      if (date < today.value || !isDayOff(entries)) continue;
      const named = entries.find(row => row.kind === 'statutory' || row.kind === 'compensatory')!;
      rows.push({ date, label: named[props.lang] || named.en, away: diffDays(today.value, date) });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
});

const agendaRows = computed(() =>
  locked.value ? [] : agenda(visibleEvents.value, { today: today.value, lang: props.lang }));
const agendaBuckets = computed(() => agendaGroups(agendaRows.value, today.value));
const groupLabel = (id: string) => ({
  overdue: t.value.overdue, due: t.value.due, month: t.value.monthGroup,
  ninety: t.value.ninety, later: t.value.later
} as Record<string, string>)[id] || id;

/** How an event repeats, in one line, so a row explains its own date. */
function cadence(event: any) {
  const repeat = event.repeat || {};
  if (repeat.kind === 'once') return t.value.once;
  if (repeat.kind === 'yearly') return `${t.value.yearly} · ${dayMonth(repeat.anchor)}`;
  if (repeat.kind === 'lunar-yearly') return `${t.value.lunarYearly} · ${repeat.day}/${repeat.month} ${t.value.lunarShort}`;
  if (repeat.kind === 'monthly') return `${t.value.monthly} · ${t.value.dayWord} ${repeat.day}`;
  const unit = { day: t.value.day, month: t.value.months, year: t.value.years }[repeat.unit as string] || repeat.unit;
  return `${t.value.every} ${repeat.every} ${unit}`;
}
const awayText = (row: any) => row.daysAway < 0
  ? `${t.value.daysOver} ${Math.abs(row.daysAway)} ${t.value.days}`
  : `${t.value.daysLeft} ${row.daysAway} ${t.value.days}`;

/* ---------- navigation ---------- */

const clampYear = (year: number) => Math.min(maxYear.value, Math.max(minYear.value, year));
function stepMonth(delta: number) {
  const [y, m] = cursor.value.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = clampYear(Math.floor(total / 12));
  cursor.value = `${year}-${String((total % 12) + 1).padStart(2, '0')}`;
  cursorYear.value = year;
}
function goToday() {
  cursor.value = today.value.slice(0, 7);
  cursorYear.value = Number(today.value.slice(0, 4));
  selected.value = today.value;
}
function openDay(date: string) {
  selected.value = date;
  cursor.value = date.slice(0, 7);
  cursorYear.value = Number(date.slice(0, 4));
  if (view.value === 'year') view.value = 'month';
}
function setView(next: 'month' | 'year' | 'agenda' | 'items') {
  view.value = next;
  try { localStorage.setItem(VIEW_KEY, next); } catch (error) { /* private mode */ }
}

/* ---------- unlocking ---------- */

async function openSealed(secret: string) {
  const response = await fetch(SEALED_URL, { cache: 'no-cache' });
  if (!response.ok) { sealedMissing.value = true; throw new Error(t.value.sealedMissing); }
  const envelope = await response.json();
  if (!isEnvelope(envelope)) throw new Error(t.value.sealedMissing);
  const document = await unseal(envelope, secret);
  events.value = Array.isArray(document.events) ? document.events : [];
  members.value = Array.isArray(document.members) ? document.members : [];
  standingNotes.value = Array.isArray(document.notes) ? document.notes : [];
  items.value = Array.isArray(document.items) ? document.items : [];
  groups.value = Array.isArray(document.groups) ? document.groups : [];
  households.value = Array.isArray(document.households) ? document.households : [];
  checklists.value = Array.isArray(document.checklists) ? document.checklists : [];
  locked.value = false;
}

async function revealHint() {
  hintShown.value = true;
  if (hint.value) return;
  try {
    const response = await fetch(SEALED_URL, { cache: 'no-cache' });
    if (!response.ok) return;
    const envelope = await response.json();
    hint.value = String(envelope?.hint || '');
  } catch (error) { /* no file yet: the toggle simply shows nothing */ }
}

async function unlock() {
  if (!passphrase.value || unlocking.value) return;
  unlocking.value = true;
  unlockError.value = '';
  try {
    await openSealed(passphrase.value);
    /* Session by default, device only when asked — the same promise search
       history makes, and for the same reason: a borrowed browser must not
       keep the key to someone else's reminders. */
    const store = remember.value ? localStorage : sessionStorage;
    try { store.setItem(KEY_STORE, passphrase.value); } catch (error) { /* private mode */ }
    passphrase.value = '';
  } catch (error: any) {
    unlockError.value = error?.message || String(error);
    void revealHint();
  } finally {
    unlocking.value = false;
  }
}

function lock() {
  locked.value = true;
  events.value = [];
  members.value = [];
  standingNotes.value = [];
  items.value = [];
  groups.value = [];
  households.value = [];
  checklists.value = [];
  memberFilter.value = 'all';
  householdFilter.value = 'all';
  inbox.value = [];
  try { sessionStorage.removeItem(KEY_STORE); localStorage.removeItem(KEY_STORE); } catch (error) { /* private mode */ }
}

/**
 * Ask the backend for the passphrase, for accounts the owner has granted.
 *
 * This is how other people get in without ever seeing a passphrase: they sign
 * in, the Sheet says they are allowed, and the page opens. The key is used and
 * dropped — deliberately never written to storage, because a cached copy would
 * survive the row being deleted and make revocation a lie.
 */
async function tryBackendKey() {
  if (!locked.value || !nuxtApp.$auth?.token) return;
  try {
    const data = await callBackend('schedule.key');
    if (data?.key) await openSealed(data.key);
  } catch (error) { /* not granted, or no key configured: the passphrase box stays */ }
}

async function restore() {
  let stored = '';
  try { stored = sessionStorage.getItem(KEY_STORE) || localStorage.getItem(KEY_STORE) || ''; } catch (error) { return; }
  if (!stored) return;
  try { await openSealed(stored); } catch (error) { /* stale key or no file: stay locked */ }
}

/* ---------- checklists ---------- */

/* Ticking is state, not content: it changes several times a trip and must not
   need a commit. The browser is the store so it works signed out and offline;
   the Sheet is a sync layer, and the later timestamp wins when they disagree. */
function readLocalChecks(): Record<string, { done: boolean; at: string }> {
  try { return JSON.parse(localStorage.getItem(CHECKS_KEY) || '{}'); } catch (error) { return {}; }
}
function writeLocalChecks(value: Record<string, any>) {
  try { localStorage.setItem(CHECKS_KEY, JSON.stringify(value)); } catch (error) { /* private mode */ }
}

async function toggleCheck(id: string, done: boolean) {
  checks.value = { ...checks.value, [id]: { done, at: new Date().toISOString() } };
  writeLocalChecks(checks.value);
  if (!signedIn.value) return;
  try { await callBackend('schedule.check', { id, done }); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
}

/* ---------- inbox ---------- */

const signedIn = computed(() => authState.value === 'signed');
const pendingInbox = computed(() => inbox.value.filter(row => row.status !== 'merged'));
const mergedInbox = computed(() => inbox.value.filter(row => row.status === 'merged'));

async function callBackend(action: string, payload: any = {}) {
  const token = nuxtApp.$auth?.token;
  if (!token) throw new Error(t.value.signInFirst);
  return nuxtApp.$apiCall(action, payload, token);
}

async function loadInbox() {
  if (!signedIn.value) { inbox.value = []; return; }
  try {
    const data = await callBackend('schedule.list');
    inbox.value = data.inbox || [];
    const merged = { ...checks.value };
    for (const [id, remote] of Object.entries(data.checks || {}) as [string, any][]) {
      const local = merged[id];
      if (!local || String(remote.at || '') > String(local.at || '')) merged[id] = remote;
    }
    checks.value = merged;
    writeLocalChecks(merged);
    inboxNotice.value = '';
  } catch (error: any) {
    // An Apps Script deployment without these actions answers "Action không
    // hợp lệ." That is a pending redeploy, not a fault the reader caused.
    inboxNotice.value = /không hợp lệ|invalid action/i.test(error?.message || '')
      ? t.value.backendMissing : (error?.message || String(error));
  }
}

async function addNote() {
  if (!inboxBody.value.trim() || inboxBusy.value) return;
  inboxBusy.value = true;
  try {
    await callBackend('schedule.add', {
      body: inboxBody.value.trim(),
      category: inboxCategory.value,
      due_hint: inboxHint.value.trim()
    });
    inboxBody.value = ''; inboxHint.value = ''; inboxCategory.value = '';
    await loadInbox();
  } catch (error: any) {
    inboxNotice.value = error?.message || String(error);
  } finally { inboxBusy.value = false; }
}

async function setStatus(row: any, status: string) {
  try { await callBackend('schedule.update', { id: row.id, status }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
}
async function removeNote(row: any) {
  try { await callBackend('schedule.delete', { id: row.id }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
}
async function clearMerged() {
  try { await callBackend('schedule.delete', { merged: true }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
}

/** A note becomes a skeleton event, ready to paste into secret/schedule.json. */
function noteAsJson(row: any) {
  const slug = String(row.body).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'new-reminder';
  return JSON.stringify({
    id: slug,
    title: { vi: row.body, en: row.body },
    category: row.category || 'home',
    severity: 'normal',
    repeat: { kind: 'yearly', anchor: row.due_hint || today.value },
    note: { vi: '', en: '' }
  }, null, 2);
}
async function copyNote(row: any) {
  await copyText(noteAsJson(row));
  copiedId.value = row.id;
  setTimeout(() => { if (copiedId.value === row.id) copiedId.value = ''; }, 1600);
}

onMounted(async () => {
  today.value = todayISO();
  cursor.value = today.value.slice(0, 7);
  cursorYear.value = Number(today.value.slice(0, 4));
  selected.value = today.value;
  checks.value = readLocalChecks();
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (['month', 'year', 'agenda', 'items'].includes(stored || '')) view.value = stored as typeof view.value;
  } catch (error) { /* private mode */ }

  try {
    const response = await fetch(OVERRIDES_URL, { cache: 'no-cache' });
    if (response.ok) overrides.value = await response.json();
  } catch (error) { /* statutory rules alone are still a correct calendar */ }

  const sync = () => {
    authState.value = nuxtApp.$auth?.state || 'anon';
    if (signedIn.value) { void loadInbox(); void tryBackendKey(); }
  };
  sync();
  stopAuth = nuxtApp.$auth?.onChange(sync) || null;
  await restore();
});
onBeforeUnmount(() => stopAuth?.());
</script>

<template>
  <div class="cal">
    <div class="cal-bar">
      <div class="cal-nav">
        <button type="button" class="cal-step" :aria-label="t.prev" :disabled="view === 'agenda' || view === 'items'" @click="view === 'year' ? cursorYear = clampYear(cursorYear - 1) : stepMonth(-1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div class="cal-title">
          <b>{{ view === 'year' ? cursorYear : monthTitle.solar }}</b>
          <span v-if="view !== 'year'">{{ monthTitle.lunar }}</span>
        </div>
        <button type="button" class="cal-step" :aria-label="t.next" :disabled="view === 'agenda' || view === 'items'" @click="view === 'year' ? cursorYear = clampYear(cursorYear + 1) : stepMonth(1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <button type="button" class="cal-today" @click="goToday">{{ t.todayLabel }}</button>
      </div>

      <div class="cal-views" role="tablist" :aria-label="t.month">
        <button v-for="tab in (['month', 'year', 'agenda', 'items'] as const)" :key="tab" type="button" role="tab"
                class="cal-tab" :aria-selected="view === tab" @click="setView(tab)">{{ t[tab] }}</button>
      </div>

      <button v-if="!locked" type="button" class="cal-lock is-open" @click="lock">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 9.5-2M5 11h14v9H5z" /></svg>
        {{ t.lock }}
      </button>
    </div>

    <!-- One filter for the whole page: it narrows the dots on the grid, the
         agenda and the standing notes together. -->
    <div v-if="!locked && view === 'items' && households.length" class="cal-members">
      <button type="button" class="cal-mchip" :aria-pressed="householdFilter === 'all'" @click="householdFilter = 'all'">{{ t.allMembers }}</button>
      <button v-for="house in households" :key="house.id" type="button" class="cal-mchip"
              :aria-pressed="householdFilter === house.id" @click="householdFilter = house.id">
        {{ localized(house.name, props.lang) }}
      </button>
    </div>
    <div v-else-if="!locked && members.length" class="cal-members">
      <button type="button" class="cal-mchip" :aria-pressed="memberFilter === 'all'" @click="memberFilter = 'all'">{{ t.allMembers }}</button>
      <button v-for="member in members" :key="member.id" type="button" class="cal-mchip"
              :aria-pressed="memberFilter === member.id" @click="memberFilter = member.id">
        {{ localized(member.name, props.lang) }}
      </button>
    </div>

    <div class="cal-body">
      <div class="cal-main">
        <!-- Month grid -->
        <div v-if="view === 'month'" class="cal-grid">
          <div class="cal-head">
            <div v-for="(name, index) in t.weekdays" :key="name"
                 class="cal-dow" :class="{ 'is-weekend': index > 4 }">{{ name }}</div>
          </div>
          <div class="cal-weeks">
            <button v-for="cell in monthCells" :key="cell.date" type="button"
                    class="cal-cell"
                    :class="{ 'is-out': !cell.inMonth, 'is-today': cell.isToday, 'is-off': cell.dayOff,
                              'is-weekend': cell.weekend, 'is-selected': cell.date === selected }"
                    :aria-selected="cell.date === selected" @click="openDay(cell.date)">
              <span class="cal-solar">{{ cell.day }}</span>
              <span class="cal-lunar" :class="cell.marker ? `is-${cell.marker}` : ''">{{ cell.lunarLabel }}</span>
              <span v-if="cell.label" class="cal-label" :class="{ 'is-work': cell.workday }">{{ cell.label }}</span>
              <span v-if="cell.events.length" class="cal-dots">
                <i v-for="row in cell.events.slice(0, 4)" :key="row.id"
                   :data-cal-cat="row.event.category" :class="{ 'is-done': row.settled, 'is-late': row.status === 'overdue' }" />
              </span>
            </button>
          </div>
        </div>

        <!-- Year grid -->
        <div v-else-if="view === 'year'" class="cal-year">
          <section v-for="mini in yearMonths" :key="mini.ym" class="cal-mini">
            <h3>{{ mini.label }}</h3>
            <div class="cal-mini-head"><span v-for="name in t.weekdays" :key="name">{{ name.slice(0, 1) }}</span></div>
            <div class="cal-mini-grid">
              <button v-for="cell in mini.cells" :key="cell.date" type="button"
                      class="cal-mini-day"
                      :class="{ 'is-out': !cell.inMonth, 'is-today': cell.isToday, 'is-off': cell.dayOff,
                                'has-event': cell.events.length > 0 }"
                      :title="`${formatDate(cell.date)}${cell.label ? ' — ' + cell.label : ''}`"
                      @click="openDay(cell.date)">{{ cell.day }}</button>
            </div>
          </section>
        </div>

        <!-- Agenda -->
        <div v-else-if="view === 'agenda'" class="cal-agenda">
          <div v-if="locked" class="cal-locked">
            <h3>{{ t.lockedTitle }}</h3>
            <p>{{ t.lockedBody }}</p>
          </div>
          <p v-else-if="!agendaRows.length" class="cal-empty">{{ t.noPrivate }}</p>
          <section v-for="group in agendaBuckets" :key="group.id" class="cal-group">
            <h3 class="cal-group-head" :data-status="group.id">{{ groupLabel(group.id) }}<span>{{ group.rows.length }}</span></h3>
            <article v-for="row in group.rows" :key="row.id" class="cal-item" :data-cal-cat="row.event.category" :data-status="row.status">
              <div class="cal-item-main">
                <h4>{{ row.title }}</h4>
                <p class="cal-item-meta">
                  <span v-if="row.member" class="cal-owner">{{ memberName(row.member) }}</span>
                  <span class="cal-cat">{{ row.event.category }}</span>
                  <span>{{ cadence(row.event) }}</span>
                  <span v-if="row.lastDone">{{ t.lastDone }} {{ shortDate(row.lastDone) }}</span>
                  <span v-if="row.event.cost">{{ row.event.cost }}</span>
                </p>
                <p v-if="row.note" class="cal-item-note">{{ row.note }}</p>
                <p v-if="row.driver === 'odometer'" class="cal-item-est">{{ t.estimate }}</p>
              </div>
              <div class="cal-item-when">
                <b>{{ shortDate(row.date) }}<i v-if="row.estimated" aria-hidden="true">≈</i></b>
                <span>{{ lunarText(row.lunar) }}</span>
                <span class="cal-away" :data-status="row.status">{{ awayText(row) }}</span>
              </div>
            </article>
          </section>
        </div>
        <!-- Things owned. Not the agenda: a receipt is not a to-do, and 80 of
             them would bury the six things actually due this quarter. -->
        <div v-else class="cal-items">
          <div v-if="locked" class="cal-locked">
            <h3>{{ t.lockedTitle }}</h3>
            <p>{{ t.lockedBody }}</p>
          </div>
          <p v-else-if="!itemList.length" class="cal-empty">{{ t.noItems }}</p>
          <template v-else>
            <section v-if="warrantyWatch.length" class="cal-warranty">
              <h3>{{ t.warrantyWatch }}</h3>
              <ul>
                <li v-for="row in warrantyWatch" :key="row.id">
                  <b>{{ row.name }}</b>
                  <span>{{ shortDate(row.warrantyEnd) }} · {{ t.warrantyLeft }} {{ row.warrantyDaysLeft }} {{ t.days }}</span>
                </li>
              </ul>
            </section>

            <section v-for="bucket in itemGroups.groups" :key="bucket.id" class="cal-igroup">
              <h3>{{ localized(bucket.group.name, props.lang) }}<span>{{ bucket.total }}</span></h3>
              <ul class="cal-ilist">
                <li v-for="row in bucket.rows" :key="row.id">
                  <div class="cal-iname">
                    <b>{{ row.name }}</b>
                    <p v-if="row.note">{{ row.note }}</p>
                    <p v-for="entry in row.service" :key="entry.date" class="cal-iservice">
                      {{ t.replaced }}: {{ entry.what }} — {{ shortDate(entry.date) }}
                      <i>({{ duration(entry.monthsAgo) }} {{ t.ago }})</i>
                      <em v-if="entry.price">{{ entry.price }}</em>
                    </p>
                  </div>
                  <div class="cal-imeta">
                    <span v-if="row.bought">{{ shortDate(row.bought) }}</span>
                    <span v-if="row.monthsOwned != null" class="cal-iage">{{ t.owned }} {{ duration(row.monthsOwned) }}</span>
                    <span v-if="row.price">{{ row.price }}</span>
                    <span v-if="row.warrantyStatus !== 'none'" class="cal-iwarr" :data-warranty="row.warrantyStatus">{{ warrantyText(row) }}</span>
                  </div>
                </li>
              </ul>
            </section>

            <section v-if="itemGroups.loose.length" class="cal-igroup">
              <h3>{{ t.other }}<span>{{ itemGroups.loose.length }}</span></h3>
              <ul class="cal-ilist">
                <li v-for="row in itemGroups.loose" :key="row.id">
                  <div class="cal-iname">
                    <b>{{ row.name }}</b>
                    <p v-if="row.note">{{ row.note }}</p>
                    <p v-for="entry in row.service" :key="entry.date" class="cal-iservice">
                      {{ t.replaced }}: {{ entry.what }} — {{ shortDate(entry.date) }}
                      <i>({{ duration(entry.monthsAgo) }} {{ t.ago }})</i>
                      <em v-if="entry.price">{{ entry.price }}</em>
                    </p>
                  </div>
                  <div class="cal-imeta">
                    <span v-if="row.bought">{{ shortDate(row.bought) }}</span>
                    <span v-if="row.monthsOwned != null" class="cal-iage">{{ t.owned }} {{ duration(row.monthsOwned) }}</span>
                    <span v-if="row.price">{{ row.price }}</span>
                    <span v-if="row.warrantyStatus !== 'none'" class="cal-iwarr" :data-warranty="row.warrantyStatus">{{ warrantyText(row) }}</span>
                  </div>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </div>

      <aside class="cal-rail">
        <section class="cal-card cal-today-card">
          <p class="cal-kicker">{{ todayCard.weekday }}</p>
          <p class="cal-bigdate">{{ todayCard.solar }}</p>
          <p class="cal-bigmoon">{{ todayCard.lunarDay }}</p>
          <dl class="cal-pillars">
            <div><dt>{{ t.dayPillar }}</dt><dd>{{ todayCard.canDay }}</dd></div>
            <div><dt>{{ t.monthPillar }}</dt><dd>{{ todayCard.canMonth }}</dd></div>
            <div><dt>{{ t.yearPillar }}</dt><dd>{{ todayCard.canYear }}</dd></div>
          </dl>
          <p v-for="row in todayCard.holidays" :key="row.id" class="cal-today-holiday" :data-kind="row.kind">
            {{ row[props.lang] || row.en }}
          </p>
        </section>

        <section v-if="selectedCell" class="cal-card">
          <p class="cal-kicker">{{ formatDate(selectedCell.date) }}</p>
          <p class="cal-daymoon">{{ selectedCell.lunar.day }} {{ lunarMonthName(selectedCell.lunar.month, selectedCell.lunar.leap, props.lang) }} · {{ selectedPillar }}</p>
          <ul v-if="selectedCell.holidays.length || selectedCell.events.length" class="cal-daylist">
            <li v-for="row in selectedCell.holidays" :key="row.id" :data-kind="row.kind">
              {{ row[props.lang] || row.en }}
              <em v-if="row.kind === 'statutory' || row.kind === 'compensatory'">{{ t.dayOff }}</em>
              <em v-else-if="row.workday">{{ t.workday }}</em>
            </li>
            <li v-for="row in selectedCell.events" :key="row.id" :data-cal-cat="row.event.category" class="is-event">
              {{ row.title }}
            </li>
          </ul>
          <p v-else class="cal-muted">{{ t.nothingOn }}</p>
        </section>

        <!-- Trip checklists. Ticking is per-trip state, so it lives in the
             browser and syncs to the Sheet — never in the sealed file. -->
        <section v-for="list in checklistViews" :key="list.id" class="cal-card cal-checklist">
          <p class="cal-kicker">{{ list.name }}<b>{{ list.done }}/{{ list.total }}</b></p>
          <p v-if="list.note" class="cal-muted cal-cl-note">{{ list.note }}</p>
          <ul>
            <li v-for="entry in list.entries" :key="entry.id">
              <label :class="{ 'is-done': entry.done }">
                <input type="checkbox" :checked="entry.done"
                       @change="toggleCheck(entry.id, ($event.target as HTMLInputElement).checked)">
                <span>{{ entry.text }}<i v-if="entry.note">{{ entry.note }}</i></span>
              </label>
            </li>
          </ul>
        </section>

        <!-- Standing notes: true, but not dated. What is in the cupboard, why
             a schedule is on hold. They never enter the agenda. -->
        <section v-if="visibleNotes.length" class="cal-card">
          <p class="cal-kicker">{{ t.standing }}</p>
          <ul class="cal-standing">
            <li v-for="note in visibleNotes" :key="note.id" :data-cal-cat="note.category">
              <b v-if="note.title">{{ localized(note.title, props.lang) }}</b>
              <span>{{ localized(note.body, props.lang) }}</span>
              <i v-if="note.member">{{ memberName(note.member) }}</i>
            </li>
          </ul>
        </section>

        <section class="cal-card">
          <p class="cal-kicker">{{ t.upcomingHolidays }}</p>
          <ul class="cal-next">
            <li v-for="row in nextHolidays" :key="row.date + row.label">
              <button type="button" @click="openDay(row.date)">
                <b>{{ shortDate(row.date) }}</b><span>{{ row.label }}</span><i>{{ row.away }}{{ vi ? 'n' : 'd' }}</i>
              </button>
            </li>
          </ul>
        </section>

        <!-- The passphrase is the only gate, and deliberately the only one.
             Adding "must be signed in" on top would buy no privacy — the file
             is already ciphertext — while inventing a way to be locked out of
             your own calendar whenever Google sign-in is unavailable, which is
             exactly the state of local development. Sign-in gates the Sheet
             inbox below, and nothing else. -->
        <section v-if="locked" class="cal-card cal-unlock">
          <p class="cal-kicker">{{ t.lockedTitle }}</p>
          <p v-if="sealedMissing" class="cal-muted">{{ t.sealedMissing }}</p>
          <form v-else @submit.prevent="unlock">
            <label class="cal-field">
              <span>{{ t.passphrase }}</span>
              <input v-model="passphrase" type="password" autocomplete="off" spellcheck="false">
            </label>
            <label class="cal-check"><input v-model="remember" type="checkbox">{{ t.rememberDevice }}</label>
            <button type="submit" class="cal-primary" :disabled="!passphrase || unlocking">{{ t.unlock }}</button>
            <p v-if="unlockError" class="cal-error">{{ unlockError }}</p>
            <button v-if="!hintShown" type="button" class="cal-linkbtn" @click="revealHint">{{ t.forgot }}</button>
            <p v-else-if="hint" class="cal-hint"><span>{{ t.hintLabel }}</span>{{ hint }}</p>
            <p class="cal-muted">{{ t.grantedHint }}</p>
            <p v-if="!signedIn" class="cal-muted">{{ t.signInForInbox }}</p>
          </form>
        </section>
      </aside>
    </div>

    <!-- Inbox: the holding pen between "I remembered something" and "it is in
         the sealed file". Signed in only, because it is the one part that
         lives in the Sheet. -->
    <section v-if="!locked && signedIn" class="cal-inbox">
      <div class="cal-inbox-head">
        <h2>{{ t.inbox }}</h2>
        <p>{{ t.inboxIntro }}</p>
      </div>
      <form class="cal-inbox-form" @submit.prevent="addNote">
        <input v-model="inboxBody" type="text" :placeholder="t.inboxPlaceholder" maxlength="2000">
        <input v-model="inboxHint" type="text" :placeholder="t.inboxHintPlaceholder" maxlength="60">
        <select v-model="inboxCategory">
          <option value="">—</option>
          <option v-for="name in ['finance', 'vehicle', 'health', 'pet', 'home', 'document', 'family', 'subscription']" :key="name" :value="name">{{ name }}</option>
        </select>
        <button type="submit" class="cal-primary" :disabled="!inboxBody.trim() || inboxBusy">{{ t.inboxAdd }}</button>
      </form>
      <p v-if="inboxNotice" class="cal-error">{{ inboxNotice }}</p>
      <p v-if="!inbox.length && !inboxNotice" class="cal-muted">{{ t.inboxEmpty }}</p>
      <ul class="cal-notes">
        <li v-for="row in pendingInbox" :key="row.id">
          <div>
            <p class="cal-note-body">{{ row.body }}</p>
            <p class="cal-note-meta">
              <span v-if="row.category" :data-cal-cat="row.category" class="cal-cat">{{ row.category }}</span>
              <span v-if="row.due_hint">{{ row.due_hint }}</span>
              <span>{{ String(row.created_at).slice(0, 10) }}</span>
            </p>
          </div>
          <div class="cal-note-actions">
            <button type="button" @click="copyNote(row)">{{ copiedId === row.id ? t.copied : t.copyJson }}</button>
            <button type="button" @click="setStatus(row, 'merged')">{{ t.markMerged }}</button>
            <button type="button" class="is-danger" @click="removeNote(row)">{{ t.remove }}</button>
          </div>
        </li>
        <li v-for="row in mergedInbox" :key="row.id" class="is-merged">
          <div>
            <p class="cal-note-body">{{ row.body }}</p>
            <p class="cal-note-meta"><span>{{ t.merged }}</span><span>{{ String(row.updated_at).slice(0, 10) }}</span></p>
          </div>
          <div class="cal-note-actions">
            <button type="button" @click="setStatus(row, 'pending')">{{ t.reopen }}</button>
            <button type="button" class="is-danger" @click="removeNote(row)">{{ t.remove }}</button>
          </div>
        </li>
      </ul>
      <button v-if="mergedInbox.length" type="button" class="cal-ghost" @click="clearMerged">{{ t.clearMerged }}</button>
    </section>
  </div>
</template>
