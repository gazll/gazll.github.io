<script setup lang="ts">
const props = defineProps<{ data: any, lang: 'en' | 'vi' }>();
const { $auth, $studyStore } = useNuxtApp() as any;
const labels = computed(() => props.lang === 'vi' ? {
  notSigned: 'Chưa đăng nhập', notSignedDetail: 'chỉ hoạt động trên thiết bị này được hiển thị.', reviewed: 'Đã ôn', track: 'của lộ trình',
  activeDays: 'Ngày hoạt động', loading: 'đang tải…', allTime: 'từ trước đến nay', currentStreak: 'Chuỗi hiện tại', longestStreak: 'Chuỗi dài nhất',
  daysInRow: 'ngày liên tiếp', activity: 'Hoạt động trong 26 tuần qua', less: 'ít', more: 'nhiều', progress: 'Tiến độ theo chủ đề', item: 'mục', items: 'mục'
} : {
  notSigned: 'Not signed in', notSignedDetail: 'only activity on this device is available.', reviewed: 'Reviewed', track: 'of the track',
  activeDays: 'Active days', loading: 'loading…', allTime: 'all time', currentStreak: 'Current streak', longestStreak: 'Longest streak',
  daysInRow: 'days in a row', activity: 'Activity, last 26 weeks', less: 'less', more: 'more', progress: 'Progress by topic', item: 'item', items: 'items'
});
const revision = ref(0);
const log = ref<any[]>([]);
const loading = ref(true);
const reviewed = computed<Set<string>>(() => { revision.value; return $studyStore.reviewed; });
const done = computed(() => [...reviewed.value].filter(id => props.data.topics.some((topic: any) => topic.ids.includes(id))).length);
const notes = computed(() => { revision.value; return Object.values($studyStore.notes).filter((row: any) => row.body).length; });
const byDay = computed(() => {
  const counts = new Map<string, number>();
  for (const row of log.value) {
    if (!row.opened_at) continue;
    const day = new Date(row.opened_at).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
});
const localDay = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const daysApart = (a: string, b: string) => Math.round(
  (new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000
);
const streak = computed(() => {
  const days = [...byDay.value.keys()].sort();
  if (!days.length) return { current: 0, longest: 0 };
  const set = new Set(days);
  let longest = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    run = daysApart(days[index - 1]!, days[index]!) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const today = localDay();
  const yesterday = localDay(new Date(Date.now() - 86400000));
  let cursor: string | null = set.has(today) ? today : set.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = localDay(new Date(new Date(`${cursor}T12:00:00`).getTime() - 86400000));
  }
  return { current, longest };
});
const months = computed(() => props.lang === 'vi'
  ? ['Th1', 'Th2', 'Th3', 'Th4', 'Th5', 'Th6', 'Th7', 'Th8', 'Th9', 'Th10', 'Th11', 'Th12']
  : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
const heatmap = computed(() => {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() - end.getDay() + 6);
  const cursor = new Date(end);
  cursor.setDate(cursor.getDate() - (26 * 7 - 1));
  const max = Math.max(1, ...byDay.value.values());
  return Array.from({ length: 26 }, () => {
    let label = '';
    const days = Array.from({ length: 7 }, (_, dayIndex) => {
      const key = localDay(cursor);
      const count = byDay.value.get(key) || 0;
      const future = cursor > today;
      const ratio = count / max;
      const level = future ? 'f' : count === 0 ? 0 : ratio <= .25 ? 1 : ratio <= .5 ? 2 : ratio <= .75 ? 3 : 4;
      if (cursor.getDate() <= 7 && dayIndex === 0) label = months.value[cursor.getMonth()]!;
      cursor.setDate(cursor.getDate() + 1);
      return { key, count, level, future };
    });
    return { label, days };
  });
});
let stopStore: (() => void) | null = null;
let stopAuth: (() => void) | null = null;

async function load() {
  loading.value = true;
  log.value = await $studyStore.fetchStudyLog();
  loading.value = false;
}
onMounted(() => {
  stopStore = $studyStore.onSync(() => { revision.value += 1; });
  stopAuth = $auth.onChange(load);
  load();
});
onBeforeUnmount(() => { stopStore?.(); stopAuth?.(); });
</script>

<template>
  <div>
    <div v-if="!$auth.session" class="warn"><b>{{ labels.notSigned }}:</b> {{ labels.notSignedDetail }}</div>
    <div class="stat-row">
      <div class="stat-tile"><div class="stat-label">{{ labels.reviewed }}</div><div class="stat-value">{{ done }} / {{ data.total }}</div><div class="stat-sub">{{ data.total ? Math.round(done / data.total * 100) : 0 }}% {{ labels.track }}</div></div>
      <div class="stat-tile"><div class="stat-label">{{ labels.activeDays }}</div><div class="stat-value">{{ byDay.size }}</div><div class="stat-sub">{{ loading ? labels.loading : labels.allTime }}</div></div>
      <div class="stat-tile"><div class="stat-label">{{ labels.currentStreak }}</div><div class="stat-value">{{ streak.current }}</div><div class="stat-sub">{{ labels.daysInRow }}</div></div>
      <div class="stat-tile"><div class="stat-label">{{ labels.longestStreak }}</div><div class="stat-value">{{ streak.longest }}</div><div class="stat-sub">{{ labels.daysInRow }}</div></div>
    </div>
    <section>
      <div class="toolbar"><span class="sectioncount">{{ labels.activity }}</span><div class="hm-legend"><span>{{ labels.less }}</span><span v-for="level in 5" :key="level" class="hm-cell" :class="`lvl-${level - 1}`" /><span>{{ labels.more }}</span></div></div>
      <div class="heatmap-wrap"><div class="heatmap"><div class="hm-months"><span v-for="(week, index) in heatmap" :key="index" class="hm-mlabel">{{ week.label }}</span></div><div class="hm-grid"><div v-for="(week, index) in heatmap" :key="index" class="hm-col"><span v-for="day in week.days" :key="day.key" class="hm-cell" :class="`lvl-${day.level}`" :title="day.future ? '' : `${day.key} · ${day.count} ${day.count === 1 ? labels.item : labels.items}`" /></div></div></div></div>
    </section>
    <section class="perday"><h2>{{ labels.progress }}</h2>
      <NuxtLink v-for="topic in data.topics" :key="topic.n" class="pd-row" :to="{ path: `/topics/${topic.key}`, query: lang === 'vi' ? { lang: 'vi' } : {} }">
        <span class="pd-name">{{ lang === 'vi' ? topic.vi : topic.en }}</span>
        <span class="pd-bar"><span class="pd-fill" :style="{ width: `${Math.round(topic.ids.filter((id: string) => reviewed.has(id)).length / topic.ids.length * 100)}%` }" /></span>
        <span class="pd-count">{{ topic.ids.filter((id: string) => reviewed.has(id)).length }}/{{ topic.ids.length }}</span>
      </NuxtLink>
    </section>
  </div>
</template>
