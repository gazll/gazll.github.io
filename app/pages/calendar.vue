<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');

useHead({ title: 'Calendar — GAZLL' });
useSeoMeta({
  description: 'Vietnamese solar and lunar calendar with public holidays, private cash flow and task horizons.'
});
</script>

<template>
  <div id="calendar-page" data-ui="calendar-page">
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <div class="page">
        <section id="calendar-intro" data-ui="calendar-intro" class="hero calendar-hero">
          <h1>{{ lang === 'vi' ? 'Lịch' : 'Calendar' }}</h1>
          <p class="intro">
            {{ lang === 'vi'
              ? 'Lịch dương và âm, ngày lễ Việt Nam, dòng tiền và việc cần làm theo mốc 1–3 tháng — mở bằng passphrase.'
              : 'Solar and lunar dates, Vietnamese public holidays, private cash flow and tasks across 1–3 month horizons — opened with a passphrase.' }}
          </p>
        </section>
        <!-- Client-only: a prerendered page would freeze "today" at build time
             and every relative line on it would be wrong until the next deploy. -->
        <ClientOnly>
          <CalendarSurface :lang="lang" />
          <template #fallback>
            <p class="loading-block">{{ lang === 'vi' ? 'Đang dựng lịch…' : 'Building the calendar…' }}</p>
          </template>
        </ClientOnly>
      </div>
    </main>
  </div>
</template>
