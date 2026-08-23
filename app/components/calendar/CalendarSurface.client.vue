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
import { isEnvelope, MAX_ENVELOPE_JSON_CHARS, unseal } from '../../../public/lib/schedule-crypto.js';
import { checklistRows, endingSoon, groupedItems, itemRows } from '../../../public/lib/inventory.js';
import { copyText } from '../../../public/lib/clipboard.js';

const props = defineProps<{ lang: 'en' | 'vi' }>();
const nuxtApp = useNuxtApp() as any;

const SEALED_URL = '/data/schedule/private.enc.json';
const OVERRIDES_URL = '/data/calendar/holidays.json';
const VIEW_KEY = 'gazll:calendar-view';
const KEY_STORE = 'gazll:schedule-key';
const CHECKS_KEY = 'gazll:calendar-checks';
const VIEW_TABS = ['month', 'year', 'agenda', 'items'] as const;
type CalendarView = typeof VIEW_TABS[number];
const CATEGORY_OPTIONS = ['finance', 'vehicle', 'health', 'pet', 'home', 'document', 'family', 'subscription'] as const;

const today = ref(todayISO());
const view = ref<CalendarView>('month');
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
const showPassphrase = ref(false);
const hint = ref('');
const hintShown = ref(false);
const authState = ref('loading');
const unlockInput = ref<HTMLInputElement | null>(null);
const selectedInline = ref<HTMLElement | null>(null);

const inbox = ref<any[]>([]);
const inboxBody = ref('');
const inboxCategory = ref('');
const inboxHint = ref('');
const inboxNotice = ref('');
const inboxBusy = ref(false);
const copiedId = ref('');
const removeCandidate = ref<string | null>(null);
const clearMergedPending = ref(false);
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
  upcomingHolidays: 'Ngày lễ sắp tới', noPrivate: 'Chưa có mục nào trong lịch riêng.', category: 'Nhóm nhắc việc',
  overdue: 'Quá hạn', due: 'Cần làm ngay', monthGroup: 'Trong tháng này',
  ninety: '90 ngày tới', later: 'Xa hơn', daysLeft: 'còn', daysOver: 'trễ', days: 'ngày',
  lastDone: 'lần cuối', estimate: 'ước tính theo số km', every: 'Mỗi', once: 'Một lần',
  yearly: 'Hằng năm', monthly: 'Hằng tháng', lunarYearly: 'Hằng năm (âm lịch)',
  day: 'ngày', months: 'tháng', years: 'năm', dayWord: 'ngày',
  inbox: 'Hộp chờ', inboxIntro: 'Ghi nhanh khi chưa tiện sửa JSON. Chuyển vào file rồi đánh dấu đã xử lý.',
  inboxAdd: 'Thêm ghi chú', inboxPlaceholder: 'Ví dụ: gia hạn bảo hiểm xe máy tháng 11',
  inboxHintPlaceholder: 'Mốc thời gian (tuỳ chọn)', inboxEmpty: 'Hộp chờ trống.',
  copyJson: 'Copy JSON', copied: 'Đã copy', markMerged: 'Đã chuyển', reopen: 'Mở lại',
  remove: 'Xoá', confirmRemove: 'Xoá mục này?', cancel: 'Huỷ', merged: 'Đã chuyển', clearMerged: 'Xoá mục đã chuyển', confirmClearMerged: 'Xoá tất cả mục đã chuyển?',
  backendMissing: 'Backend chưa có action schedule.* — cần Deploy → New version cho Apps Script.',
  checkLocalOnly: 'Tài khoản này chưa nằm trong nhóm lịch riêng, nên dấu tick chỉ lưu trên máy này.',
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
  upcomingHolidays: 'Upcoming holidays', noPrivate: 'Nothing in the private schedule yet.', category: 'Reminder category',
  overdue: 'Overdue', due: 'Due now', monthGroup: 'Later this month',
  ninety: 'Next 90 days', later: 'Further out', daysLeft: 'in', daysOver: 'late by', days: 'days',
  lastDone: 'last done', estimate: 'estimated from distance', every: 'Every', once: 'One-off',
  yearly: 'Yearly', monthly: 'Monthly', lunarYearly: 'Yearly (lunar)',
  day: 'day', months: 'months', years: 'years', dayWord: 'day',
  inbox: 'Inbox', inboxIntro: 'Capture a reminder when editing JSON is not convenient, then transcribe it and mark it merged.',
  inboxAdd: 'Add note', inboxPlaceholder: 'e.g. renew motorbike insurance in November',
  inboxHintPlaceholder: 'When, roughly (optional)', inboxEmpty: 'The inbox is empty.',
  copyJson: 'Copy JSON', copied: 'Copied', markMerged: 'Mark merged', reopen: 'Reopen',
  remove: 'Delete', confirmRemove: 'Delete this note?', cancel: 'Cancel', merged: 'Merged', clearMerged: 'Clear merged notes', confirmClearMerged: 'Delete all merged notes?',
  backendMissing: 'The backend has no schedule.* actions yet — redeploy Apps Script (Deploy → New version).',
  checkLocalOnly: 'This account is not in the schedule group, so ticks stay on this device only.',
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

const ux = computed(() => vi.value ? {
  reminders: 'nhắc việc', records: 'mục', privateLabel: 'Lịch riêng',
  show: 'Hiện', hide: 'Ẩn', opening: 'Đang mở…', selectedDay: 'Ngày đã chọn',
  holidayLegend: 'Ngày lễ', reminderLegend: 'Nhắc việc', lunarLegend: 'Mùng 1 / Rằm',
  openPrivate: 'Mở lịch riêng để xem nội dung này', twelveMonths: '12 tháng',
  calendarViews: 'Chế độ xem lịch'
} : {
  reminders: 'reminders', records: 'records', privateLabel: 'Private schedule',
  show: 'Show', hide: 'Hide', opening: 'Opening…', selectedDay: 'Selected day',
  holidayLegend: 'Public holiday', reminderLegend: 'Reminder', lunarLegend: 'New / full moon',
  openPrivate: 'Open the private schedule to see this content', twelveMonths: '12 months',
  calendarViews: 'Calendar views'
});

/* Keep storage values stable while presenting a language-appropriate label.
   Category names are part of the private data contract, not UI copy. */
const categoryLabels = computed<Record<string, string>>(() => vi.value ? {
  finance: 'Tài chính', vehicle: 'Xe cộ', health: 'Sức khỏe', pet: 'Thú cưng',
  home: 'Nhà cửa', document: 'Giấy tờ', family: 'Gia đình', subscription: 'Định kỳ'
} : {
  finance: 'Finance', vehicle: 'Vehicle', health: 'Health', pet: 'Pet',
  home: 'Home', document: 'Documents', family: 'Family', subscription: 'Subscription'
});
const categoryLabel = (value: string) => categoryLabels.value[value] || value;

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
/* A month is a dense 42-button surface. Keep only one date in the normal Tab
   order, then let arrow keys move by day/row without forcing a keyboard user
   through every cell before reaching the next control. */
const monthFocusDate = computed(() => {
  const cells = monthCells.value;
  return cells.find(cell => cell.date === selected.value)?.date
    || cells.find(cell => cell.inMonth)?.date || cells[0]?.date || '';
});
function moveMonthCell(event: KeyboardEvent, date: string) {
  const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1
    : event.key === 'ArrowUp' ? -7 : event.key === 'ArrowDown' ? 7 : 0;
  const index = monthCells.value.findIndex(cell => cell.date === date);
  if (index < 0 || !delta) {
    if (index >= 0 && event.key === 'Home') {
      event.preventDefault();
      const target = monthCells.value[index - (index % 7)];
      openDay(target.date);
      void nextTick(() => document.getElementById(`calendar-cell-${target.date}`)?.focus());
    } else if (index >= 0 && event.key === 'End') {
      event.preventDefault();
      const target = monthCells.value[Math.min(index + (6 - (index % 7)), monthCells.value.length - 1)];
      openDay(target.date);
      void nextTick(() => document.getElementById(`calendar-cell-${target.date}`)?.focus());
    }
    return;
  }
  const nextIndex = index + delta;
  const target = monthCells.value[nextIndex];
  if (!target) return;
  event.preventDefault();
  openDay(target.date);
  void nextTick(() => document.getElementById(`calendar-cell-${target.date}`)?.focus());
}
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

const eventAria = (row: any) => row.event?.category
  ? `${row.title} (${categoryLabel(row.event.category)})`
  : row.title;
function cellAria(cell: any) {
  const details = [formatDate(cell.date), lunarText(cell.lunar)];
  if (cell.label) details.push(cell.label);
  if (cell.events.length) {
    details.push(`${cell.events.length} ${ux.value.reminders}: ${cell.events.map(eventAria).join(', ')}`);
  }
  return details.join('. ');
}

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
const viewSubtitle = computed(() => {
  if (view.value === 'month') return monthTitle.value.lunar;
  if (view.value === 'year') return ux.value.twelveMonths;
  if (locked.value) return ux.value.privateLabel;
  const count = view.value === 'agenda' ? agendaRows.value.length : itemList.value.length;
  return `${count} ${view.value === 'agenda' ? ux.value.reminders : ux.value.records}`;
});
const viewTitle = computed(() => {
  if (view.value === 'month') return monthTitle.value.solar;
  if (view.value === 'year') return String(cursorYear.value);
  return t.value[view.value];
});
const tabCount = (tab: CalendarView) => {
  if (locked.value || (tab !== 'agenda' && tab !== 'items')) return null;
  return tab === 'agenda' ? agendaRows.value.length : itemList.value.length;
};
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
const canStepPrev = computed(() => view.value === 'year'
  ? cursorYear.value > minYear.value
  : cursor.value > `${minYear.value}-01`);
const canStepNext = computed(() => view.value === 'year'
  ? cursorYear.value < maxYear.value
  : cursor.value < `${maxYear.value}-12`);
function stepMonth(delta: number) {
  const [y, m] = cursor.value.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const year = clampYear(Math.floor(total / 12));
  cursor.value = `${year}-${String((total % 12) + 1).padStart(2, '0')}`;
  cursorYear.value = year;
}
function goToday() {
  if (view.value !== 'month') setView('month');
  cursor.value = today.value.slice(0, 7);
  cursorYear.value = Number(today.value.slice(0, 4));
  selected.value = today.value;
}
function openDay(date: string, reveal = false) {
  selected.value = date;
  cursor.value = date.slice(0, 7);
  cursorYear.value = Number(date.slice(0, 4));
  if (view.value !== 'month') setView('month');
  if (reveal && typeof window !== 'undefined' && window.matchMedia('(max-width: 1040px)').matches) {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    void nextTick(() => selectedInline.value?.scrollIntoView({ behavior, block: 'nearest' }));
  }
}
function setView(next: CalendarView) {
  view.value = next;
  try { localStorage.setItem(VIEW_KEY, next); } catch (error) { /* private mode */ }
}
function moveView(event: KeyboardEvent, current: CalendarView) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const index = VIEW_TABS.indexOf(current);
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? VIEW_TABS.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + VIEW_TABS.length) % VIEW_TABS.length;
  setView(VIEW_TABS[nextIndex]);
  void nextTick(() => document.getElementById(`cal-tab-${VIEW_TABS[nextIndex]}`)?.focus());
}
function focusUnlock() {
  void nextTick(() => {
    const behavior = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    unlockInput.value?.scrollIntoView({ behavior, block: 'center' });
    unlockInput.value?.focus({ preventScroll: true });
  });
}

/* ---------- unlocking ---------- */

async function openSealed(secret: string) {
  const response = await fetch(SEALED_URL, { cache: 'no-cache' });
  if (!response.ok) { sealedMissing.value = true; throw new Error(t.value.sealedMissing); }
  const text = await response.text();
  if (text.length > MAX_ENVELOPE_JSON_CHARS) throw new Error(t.value.sealedMissing);
  let envelope;
  try { envelope = JSON.parse(text); } catch (error) { throw new Error(t.value.sealedMissing); }
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
    const text = await response.text();
    if (text.length > MAX_ENVELOPE_JSON_CHARS) return;
    let envelope;
    try { envelope = JSON.parse(text); } catch (error) { return; }
    if (!isEnvelope(envelope)) return;
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
  unlockError.value = '';
  passphrase.value = '';
  showPassphrase.value = false;
  hint.value = '';
  hintShown.value = false;
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
  try { await callBackend('schedule.check', { id, done }); inboxNotice.value = ''; }
  catch (error: any) {
    const message = error?.message || String(error);
    inboxNotice.value = /cấp quyền|not in the schedule|schedule group/i.test(message)
      ? t.value.checkLocalOnly : message;
  }
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
  if (inboxBusy.value) return;
  inboxBusy.value = true;
  try { await callBackend('schedule.update', { id: row.id, status }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
  finally { inboxBusy.value = false; }
}
async function removeNote(row: any) {
  if (inboxBusy.value) return;
  if (removeCandidate.value !== row.id) {
    removeCandidate.value = row.id;
    clearMergedPending.value = false;
    return;
  }
  inboxBusy.value = true;
  try { await callBackend('schedule.delete', { id: row.id }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
  finally { inboxBusy.value = false; removeCandidate.value = null; }
}
function cancelRemove() {
  removeCandidate.value = null;
}
async function clearMerged() {
  if (inboxBusy.value) return;
  if (!clearMergedPending.value) {
    clearMergedPending.value = true;
    removeCandidate.value = null;
    return;
  }
  inboxBusy.value = true;
  try { await callBackend('schedule.delete', { merged: true }); await loadInbox(); }
  catch (error: any) { inboxNotice.value = error?.message || String(error); }
  finally { inboxBusy.value = false; clearMergedPending.value = false; }
}
function cancelClearMerged() {
  clearMergedPending.value = false;
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
  <div id="calendar-surface" data-ui="calendar-surface" class="cal" :data-private="locked ? 'locked' : 'open'">
    <div id="calendar-toolbar" data-ui="calendar-toolbar" class="cal-bar">
      <div id="calendar-date-nav" data-ui="calendar-date-nav" class="cal-nav" :aria-label="vi ? 'Điều hướng lịch' : 'Calendar navigation'">
        <button v-if="view === 'month' || view === 'year'" type="button" class="cal-step" :aria-label="t.prev" :disabled="!canStepPrev" @click="view === 'year' ? cursorYear = clampYear(cursorYear - 1) : stepMonth(-1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div class="cal-title" aria-live="polite" aria-atomic="true">
          <b>{{ viewTitle }}</b>
          <span>{{ viewSubtitle }}</span>
        </div>
        <button v-if="view === 'month' || view === 'year'" type="button" class="cal-step" :aria-label="t.next" :disabled="!canStepNext" @click="view === 'year' ? cursorYear = clampYear(cursorYear + 1) : stepMonth(1)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
        <button v-if="view === 'month' || view === 'year'" type="button" class="cal-today" @click="goToday">{{ t.todayLabel }}</button>
      </div>

      <div id="calendar-views" data-ui="calendar-views" class="cal-views" role="tablist" :aria-label="ux.calendarViews">
        <button v-for="tab in VIEW_TABS" :id="`cal-tab-${tab}`" :key="tab" type="button" role="tab"
                class="cal-tab" :aria-selected="view === tab" aria-controls="cal-view-panel"
                :tabindex="view === tab ? 0 : -1" @click="setView(tab)" @keydown="moveView($event, tab)">
          <span>{{ t[tab] }}</span><b v-if="tabCount(tab) != null">{{ tabCount(tab) }}</b>
        </button>
      </div>

      <button id="calendar-lock" data-ui="calendar-lock" type="button" class="cal-lock" :class="{ 'is-open': !locked }"
              :aria-expanded="!locked" :aria-controls="locked ? 'calendar-unlock' : undefined"
              @click="locked ? focusUnlock() : lock()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
          <path v-if="locked" d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z" />
          <path v-else d="M7 11V8a5 5 0 0 1 9.5-2M5 11h14v9H5z" />
        </svg>
        {{ locked ? t.unlock : t.lock }}
      </button>
    </div>

    <!-- One filter for the whole page: it narrows the dots on the grid, the
         agenda and the standing notes together. -->
    <div v-if="!locked && view === 'items' && households.length" id="calendar-household-filter" data-ui="calendar-household-filter"
         class="cal-members" role="group" :aria-label="vi ? 'Lọc theo hộ gia đình' : 'Filter by household'">
      <button type="button" class="cal-mchip" :aria-pressed="householdFilter === 'all'" @click="householdFilter = 'all'">{{ t.allMembers }}</button>
      <button v-for="house in households" :key="house.id" type="button" class="cal-mchip"
              :aria-pressed="householdFilter === house.id" @click="householdFilter = house.id">
        {{ localized(house.name, props.lang) }}
      </button>
    </div>
    <div v-else-if="!locked && members.length" id="calendar-member-filter" data-ui="calendar-member-filter"
         class="cal-members" role="group" :aria-label="vi ? 'Lọc theo thành viên' : 'Filter by member'">
      <button type="button" class="cal-mchip" :aria-pressed="memberFilter === 'all'" @click="memberFilter = 'all'">{{ t.allMembers }}</button>
      <button v-for="member in members" :key="member.id" type="button" class="cal-mchip"
              :aria-pressed="memberFilter === member.id" @click="memberFilter = member.id">
        {{ localized(member.name, props.lang) }}
      </button>
    </div>

    <section id="calendar-today-strip" data-ui="calendar-today-strip" class="cal-today-strip"
             aria-labelledby="calendar-today-strip-label">
      <div class="cal-today-strip-main">
        <span id="calendar-today-strip-label" class="cal-today-strip-label">{{ t.todayLabel }}</span>
        <strong>{{ todayCard.solar }}</strong>
        <span class="cal-today-strip-meta">{{ todayCard.weekday }} · {{ todayCard.lunarDay }}</span>
        <span v-if="todayCard.holidays.length" class="cal-today-strip-holiday">{{ todayCard.holidays[0][props.lang] || todayCard.holidays[0].en }}</span>
      </div>
      <button type="button" class="cal-today-strip-action" aria-controls="cal-view-panel" @click="goToday">{{ t.todayLabel }}</button>
    </section>

    <div class="cal-body">
      <div id="cal-view-panel" data-ui="calendar-view-panel" class="cal-main" role="tabpanel" :aria-labelledby="`cal-tab-${view}`">
        <!-- Month grid -->
        <div v-if="view === 'month'" id="calendar-month-grid" data-ui="calendar-month-grid" class="cal-grid">
          <div class="cal-head">
            <div v-for="(name, index) in t.weekdays" :key="name"
                 class="cal-dow" :class="{ 'is-weekend': index > 4 }">{{ name }}</div>
          </div>
          <div class="cal-weeks">
            <button v-for="cell in monthCells" :id="`calendar-cell-${cell.date}`" :key="cell.date" type="button"
                    class="cal-cell"
                    :class="{ 'is-out': !cell.inMonth, 'is-today': cell.isToday, 'is-off': cell.dayOff,
                              'is-weekend': cell.weekend, 'is-selected': cell.date === selected }"
                    :aria-label="cellAria(cell)" :aria-pressed="cell.date === selected"
                    :aria-current="cell.isToday ? 'date' : undefined" :tabindex="cell.date === monthFocusDate ? 0 : -1"
                    @click="openDay(cell.date, true)" @keydown="moveMonthCell($event, cell.date)">
              <span class="cal-solar">{{ cell.day }}</span>
              <span class="cal-lunar" :class="cell.marker ? `is-${cell.marker}` : ''">{{ cell.lunarLabel }}</span>
              <span v-if="cell.label" class="cal-cell-flag" :class="{ 'is-work': cell.workday }" aria-hidden="true">{{ cell.workday ? (vi ? 'Bù' : 'WORK') : (vi ? 'Nghỉ' : 'OFF') }}</span>
              <span v-if="cell.label" class="cal-label" :class="{ 'is-work': cell.workday }">{{ cell.label }}</span>
              <span v-if="cell.events.length" class="cal-cell-events" aria-hidden="true">
                <span v-for="row in cell.events.slice(0, 2)" :key="row.id" class="cal-cell-event" :data-cal-cat="row.event.category">{{ row.title }}</span>
                <span v-if="cell.events.length > 2" class="cal-cell-more">+{{ cell.events.length - 2 }}</span>
              </span>
              <span v-if="cell.events.length" class="cal-event-count" aria-hidden="true">{{ cell.events.length }}</span>
              <span v-if="cell.events.length" class="cal-dots" aria-hidden="true">
                <i v-for="row in cell.events.slice(0, 4)" :key="row.id"
                   :data-cal-cat="row.event.category" :class="{ 'is-done': row.settled, 'is-late': row.status === 'overdue' }" />
              </span>
            </button>
          </div>
          <div id="calendar-legend" data-ui="calendar-legend" class="cal-legend" role="group" :aria-label="props.lang === 'vi' ? 'Chú giải lịch' : 'Calendar legend'">
            <span class="is-holiday"><i />{{ ux.holidayLegend }}</span>
            <span class="is-reminder"><i />{{ ux.reminderLegend }}</span>
            <span class="is-lunar"><i />{{ ux.lunarLegend }}</span>
          </div>
          <section v-if="selectedCell" id="calendar-selected-inline" data-ui="calendar-selected-day" ref="selectedInline"
                   class="cal-card cal-selected cal-selected-inline" aria-live="polite" aria-labelledby="calendar-selected-inline-label">
            <p id="calendar-selected-inline-label" class="cal-kicker">{{ ux.selectedDay }}</p>
            <div class="cal-selected-head"><b>{{ formatDate(selectedCell.date) }}</b><span>{{ selectedCell.lunar.day }} {{ lunarMonthName(selectedCell.lunar.month, selectedCell.lunar.leap, props.lang) }} · {{ selectedPillar }}</span></div>
            <ul v-if="selectedCell.holidays.length || selectedCell.events.length" class="cal-daylist">
              <li v-for="row in selectedCell.holidays" :key="row.id" :data-kind="row.kind">{{ row[props.lang] || row.en }}<em v-if="row.kind === 'statutory' || row.kind === 'compensatory'">{{ t.dayOff }}</em><em v-else-if="row.workday">{{ t.workday }}</em></li>
              <li v-for="row in selectedCell.events" :key="row.id" :data-cal-cat="row.event.category" class="is-event"><span>{{ row.title }}</span><small v-if="row.event.category" class="cal-event-cat">{{ categoryLabel(row.event.category) }}</small></li>
            </ul>
            <p v-else class="cal-muted">{{ t.nothingOn }}</p>
          </section>
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
                      :aria-label="cellAria(cell)" :aria-pressed="cell.date === selected"
                      :aria-current="cell.isToday ? 'date' : undefined"
                      :title="`${formatDate(cell.date)}${cell.label ? ' — ' + cell.label : ''}`"
                      @click="openDay(cell.date, true)">{{ cell.day }}</button>
            </div>
          </section>
        </div>

        <!-- Agenda -->
        <div v-else-if="view === 'agenda'" class="cal-agenda">
          <div v-if="locked" class="cal-locked">
            <h3>{{ t.lockedTitle }}</h3>
            <p>{{ t.lockedBody }}</p>
            <button type="button" class="cal-primary" @click="focusUnlock">{{ ux.openPrivate }}</button>
          </div>
          <p v-else-if="!agendaRows.length" class="cal-empty">{{ t.noPrivate }}</p>
          <section v-for="group in agendaBuckets" :key="group.id" class="cal-group">
            <h3 class="cal-group-head" :data-status="group.id">{{ groupLabel(group.id) }}<span>{{ group.rows.length }}</span></h3>
            <article v-for="row in group.rows" :key="row.id" class="cal-item" :data-cal-cat="row.event.category" :data-status="row.status">
              <div class="cal-item-main">
                <h4>{{ row.title }}</h4>
                <p class="cal-item-meta">
                  <span v-if="row.member" class="cal-owner">{{ memberName(row.member) }}</span>
                  <span class="cal-cat">{{ categoryLabel(row.event.category) }}</span>
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
            <button type="button" class="cal-primary" @click="focusUnlock">{{ ux.openPrivate }}</button>
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
                    <p v-for="entry in row.service" :key="`${entry.date}:${entry.what}`" class="cal-iservice">
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
                    <p v-for="entry in row.service" :key="`${entry.date}:${entry.what}`" class="cal-iservice">
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

      <aside id="calendar-rail" data-ui="calendar-rail" class="cal-rail" :aria-label="vi ? 'Thông tin lịch' : 'Calendar context'">
        <section id="calendar-today-card" data-ui="calendar-today-card" class="cal-card cal-today-card" :class="{ 'is-selected-today': selected === today && view === 'month' }" aria-labelledby="calendar-today-card-label">
          <h2 id="calendar-today-card-label" class="cal-kicker">{{ todayCard.weekday }}</h2>
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

        <section v-if="selectedCell && (selectedCell.date !== today || selectedCell.holidays.length || selectedCell.events.length)" id="calendar-selected-rail" data-ui="calendar-selected-day" class="cal-card cal-selected cal-selected-rail" aria-live="polite" aria-labelledby="calendar-selected-rail-label">
          <p id="calendar-selected-rail-label" class="cal-kicker">{{ ux.selectedDay }}</p>
          <div class="cal-selected-head"><b>{{ formatDate(selectedCell.date) }}</b><span>{{ selectedCell.lunar.day }} {{ lunarMonthName(selectedCell.lunar.month, selectedCell.lunar.leap, props.lang) }} · {{ selectedPillar }}</span></div>
          <ul v-if="selectedCell.holidays.length || selectedCell.events.length" class="cal-daylist">
            <li v-for="row in selectedCell.holidays" :key="row.id" :data-kind="row.kind">
              {{ row[props.lang] || row.en }}
              <em v-if="row.kind === 'statutory' || row.kind === 'compensatory'">{{ t.dayOff }}</em>
              <em v-else-if="row.workday">{{ t.workday }}</em>
            </li>
            <li v-for="row in selectedCell.events" :key="row.id" :data-cal-cat="row.event.category" class="is-event">
              <span>{{ row.title }}</span><small v-if="row.event.category" class="cal-event-cat">{{ categoryLabel(row.event.category) }}</small>
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

        <section id="calendar-upcoming-holidays" data-ui="calendar-upcoming-holidays" class="cal-card" aria-labelledby="calendar-upcoming-holidays-label">
          <h2 id="calendar-upcoming-holidays-label" class="cal-kicker">{{ t.upcomingHolidays }}</h2>
          <ul class="cal-next">
            <li v-for="row in nextHolidays" :key="row.date + row.label">
              <button type="button" @click="openDay(row.date, true)">
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
        <section v-if="locked" id="calendar-unlock" data-ui="calendar-unlock" class="cal-card cal-unlock" aria-labelledby="calendar-unlock-title">
          <h2 id="calendar-unlock-title" class="cal-kicker">{{ t.lockedTitle }}</h2>
          <p v-if="sealedMissing" class="cal-muted">{{ t.sealedMissing }}</p>
          <form v-else :aria-busy="unlocking" @submit.prevent="unlock">
            <label class="cal-field">
              <span>{{ t.passphrase }}</span>
              <span class="cal-password">
                <input ref="unlockInput" v-model="passphrase" :type="showPassphrase ? 'text' : 'password'" autocomplete="off" spellcheck="false" :disabled="unlocking">
                <button type="button" :disabled="unlocking" @click="showPassphrase = !showPassphrase">{{ showPassphrase ? ux.hide : ux.show }}</button>
              </span>
            </label>
            <label class="cal-check"><input v-model="remember" type="checkbox" :disabled="unlocking">{{ t.rememberDevice }}</label>
            <button type="submit" class="cal-primary" :disabled="!passphrase || unlocking">{{ unlocking ? ux.opening : t.unlock }}</button>
            <p v-if="unlockError" class="cal-error" role="alert">{{ unlockError }}</p>
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
    <section v-if="!locked && signedIn" id="calendar-inbox" data-ui="calendar-inbox" class="cal-inbox" aria-labelledby="calendar-inbox-title" :aria-busy="inboxBusy">
      <div class="cal-inbox-head">
        <h2 id="calendar-inbox-title">{{ t.inbox }}</h2>
        <p>{{ t.inboxIntro }}</p>
      </div>
      <form class="cal-inbox-form" @submit.prevent="addNote">
        <input v-model="inboxBody" type="text" :placeholder="t.inboxPlaceholder" :aria-label="t.inboxPlaceholder" maxlength="2000">
        <input v-model="inboxHint" type="text" :placeholder="t.inboxHintPlaceholder" :aria-label="t.inboxHintPlaceholder" maxlength="60">
        <select v-model="inboxCategory" :aria-label="t.category">
          <option value="">—</option>
          <option v-for="name in CATEGORY_OPTIONS" :key="name" :value="name">{{ categoryLabel(name) }}</option>
        </select>
        <button type="submit" class="cal-primary" :disabled="!inboxBody.trim() || inboxBusy">{{ t.inboxAdd }}</button>
      </form>
      <p v-if="inboxNotice" class="cal-error" role="alert">{{ inboxNotice }}</p>
      <p v-if="!inbox.length && !inboxNotice" class="cal-muted">{{ t.inboxEmpty }}</p>
      <ul class="cal-notes">
        <li v-for="row in pendingInbox" :key="row.id">
          <div>
            <p class="cal-note-body">{{ row.body }}</p>
            <p class="cal-note-meta">
              <span v-if="row.category" :data-cal-cat="row.category" class="cal-cat">{{ categoryLabel(row.category) }}</span>
              <span v-if="row.due_hint">{{ row.due_hint }}</span>
              <span>{{ String(row.created_at).slice(0, 10) }}</span>
            </p>
          </div>
          <div class="cal-note-actions">
            <button type="button" :disabled="inboxBusy" @click="copyNote(row)">{{ copiedId === row.id ? t.copied : t.copyJson }}</button>
            <button type="button" :disabled="inboxBusy" @click="setStatus(row, 'merged')">{{ t.markMerged }}</button>
            <button type="button" class="is-danger" :disabled="inboxBusy" @click="removeNote(row)">{{ removeCandidate === row.id ? t.confirmRemove : t.remove }}</button>
            <button v-if="removeCandidate === row.id" type="button" class="cal-linkbtn cal-inline-cancel" :disabled="inboxBusy" @click="cancelRemove">{{ t.cancel }}</button>
          </div>
        </li>
        <li v-for="row in mergedInbox" :key="row.id" class="is-merged">
          <div>
            <p class="cal-note-body">{{ row.body }}</p>
            <p class="cal-note-meta"><span>{{ t.merged }}</span><span>{{ String(row.updated_at).slice(0, 10) }}</span></p>
          </div>
          <div class="cal-note-actions">
            <button type="button" :disabled="inboxBusy" @click="setStatus(row, 'pending')">{{ t.reopen }}</button>
            <button type="button" class="is-danger" :disabled="inboxBusy" @click="removeNote(row)">{{ removeCandidate === row.id ? t.confirmRemove : t.remove }}</button>
            <button v-if="removeCandidate === row.id" type="button" class="cal-linkbtn cal-inline-cancel" :disabled="inboxBusy" @click="cancelRemove">{{ t.cancel }}</button>
          </div>
        </li>
      </ul>
      <button v-if="mergedInbox.length" type="button" class="cal-ghost" :disabled="inboxBusy" @click="clearMerged">{{ clearMergedPending ? t.confirmClearMerged : t.clearMerged }}</button>
      <button v-if="clearMergedPending" type="button" class="cal-linkbtn cal-inline-cancel" :disabled="inboxBusy" @click="cancelClearMerged">{{ t.cancel }}</button>
    </section>
  </div>
</template>
