<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const { data, error } = await useAsyncData('presentations', () => $fetch<any>('/api/content/presentations'));
if (error.value) throw error.value;

/* Editing happens in the repository, not on the page: a topic is claimed or
   added by a pull request to board.json, so the board needs no account. */
const REPO = 'https://github.com/gazll/gazll.github.io';
const links = {
  board: `${REPO}/edit/main/public/data/presentations/board.json`,
  playbook: `${REPO}/blob/main/docs/presentation-playbook.md`
};

const labels = computed(() => lang.value === 'vi' ? {
  eyebrow: 'Chia sẻ hàng tuần', title: 'Thuyết trình',
  intro: 'Mỗi tuần một thành viên trình bày hai chủ đề: một từ công việc hiện tại ở công ty, một công nghệ mới đã tìm hiểu.',
  claim: 'Nhận hoặc thêm chủ đề', howto: 'Cách viết bài',
  upcoming: 'Sắp trình bày', upcomingHint: 'Đã có người nhận, xếp theo ngày.',
  open: 'Chủ đề còn trống', openHint: 'Chọn một chủ đề, ghi tên mình vào board.json và đặt ngày.',
  done: 'Đã trình bày', doneHint: 'Mới nhất trước.',
  current: 'Công việc hiện tại', new: 'Công nghệ mới', draft: 'Chưa có bài', answers: 'Cần trả lời',
  empty: 'Chưa có chủ đề nào ở đây.', topics: 'chủ đề'
} : {
  eyebrow: 'Weekly team sharing', title: 'Presentations',
  intro: 'Each week one member presents two topics: one from current work at the company, one new technology they investigated.',
  claim: 'Claim or add a topic', howto: 'How to write a talk',
  upcoming: 'Up next', upcomingHint: 'Claimed topics, by date.',
  open: 'Open topics', openHint: 'Pick one, put your name in board.json and set a date.',
  done: 'Presented', doneHint: 'Newest first.',
  current: 'Current work', new: 'New tech', draft: 'Not written yet', answers: 'Should answer',
  empty: 'Nothing here yet.', topics: 'topics'
});

const dateLabel = (value: string) => new Intl.DateTimeFormat(lang.value === 'vi' ? 'vi-VN' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
function byDate(rows: any[]) {
  const groups = new Map<string, any[]>();
  for (const row of rows) (groups.get(row.date) || (groups.set(row.date, []), groups.get(row.date)!)).push(row);
  return [...groups].map(([date, topics]) => ({
    key: date, label: dateLabel(date),
    people: [...new Set(topics.map(topic => topic.presenter))].join(', '), topics
  }));
}
const topics = computed<any[]>(() => data.value?.topics || []);
// Done topics sink to the bottom so what is still free stays in view.
const sections = computed(() => [
  { key: 'upcoming', groups: byDate(topics.value.filter(t => t.status === 'preparing').sort((a, b) => a.date.localeCompare(b.date))) },
  { key: 'open', groups: [{ key: 'open', label: '', people: '', topics: topics.value.filter(t => t.status === 'open') }].filter(g => g.topics.length) },
  { key: 'done', groups: byDate(topics.value.filter(t => t.status === 'done').sort((a, b) => b.date.localeCompare(a.date))) }
].map(section => ({ ...section, count: section.groups.reduce((sum, group) => sum + group.topics.length, 0) })));
const talkLink = (slug: string) => ({ path: `/presentations/${slug}`, query: lang.value === 'vi' ? { lang: 'vi' } : {} });

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${labels.value.title} — GAZLL`,
  meta: [{ name: 'description', content: labels.value.intro }],
  link: [{ rel: 'canonical', href: 'https://gazll.github.io/presentations' }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view"><div class="page rn-page pt-page">
      <header class="rn-head">
        <div class="rn-head-copy"><p class="eyebrow">{{ labels.eyebrow }}</p><h1>{{ labels.title }}</h1><p class="rn-intro">{{ labels.intro }}</p></div>
        <div class="rn-summary" role="group" :aria-label="labels.topics">
          <span v-for="section in sections" :key="section.key"><b>{{ section.count }}</b> {{ labels[section.key as 'upcoming'] }}</span>
        </div>
        <div class="pt-actions">
          <a class="pt-action" :href="links.board" target="_blank" rel="noopener noreferrer">{{ labels.claim }} ↗</a>
          <a class="pt-action" :href="links.playbook" target="_blank" rel="noopener noreferrer">{{ labels.howto }} ↗</a>
        </div>
      </header>
      <div class="pt-body">
        <section v-for="section in sections" :id="`presentations-${section.key}`" :key="section.key" class="pt-section">
          <header class="pt-section-head"><h2>{{ labels[section.key as 'upcoming'] }}</h2><p>{{ labels[`${section.key}Hint` as 'upcomingHint'] }}</p></header>
          <p v-if="!section.count" class="pt-empty">{{ labels.empty }}</p>
          <div v-for="group in section.groups" :key="group.key" class="pt-group">
            <p v-if="group.label" class="pt-group-head"><time :datetime="group.key">{{ group.label }}</time><span>{{ group.people }}</span></p>
            <div class="pt-cards">
              <article v-for="topic in group.topics" :key="topic.slug" class="pt-card" :data-kind="topic.kind">
                <p class="pt-kicker"><span class="pt-kind">{{ labels[topic.kind as 'current'] }}</span><span v-if="topic.status !== 'open' && !topic.written">{{ labels.draft }}</span></p>
                <h3><NuxtLink :to="talkLink(topic.slug)">{{ topic.title }}</NuxtLink></h3>
                <template v-if="topic.status === 'open'">
                  <p class="pt-answers">{{ labels.answers }}</p>
                  <ul class="pt-outline"><li v-for="line in topic.outline" :key="line">{{ line }}</li></ul>
                </template>
              </article>
            </div>
          </div>
        </section>
      </div>
    </div></main>
  </div>
</template>
