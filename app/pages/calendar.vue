<script setup lang="ts">
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');

useHead({ title: 'Calendar — GAZLL' });
useSeoMeta({
  description: 'Vietnamese solar and lunar calendar with public holidays, five years ahead.'
});
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <div class="page">
        <section class="hero">
          <h1>{{ lang === 'vi' ? 'Lịch' : 'Calendar' }}</h1>
          <p class="intro">
            {{ lang === 'vi'
              ? 'Lịch dương và âm, ngày lễ Việt Nam, xem trước năm năm — và những mốc riêng cần để ý, mở bằng passphrase.'
              : 'Solar and lunar dates, Vietnamese public holidays, five years ahead — plus the private reminders, opened with a passphrase.' }}
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
