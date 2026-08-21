<script setup lang="ts">
import type { NuxtError } from '#app';

/* Nuxt's built-in error page is a standalone template: no header, no search,
   no way back into the site. On a prerendered Pages deploy every unknown path
   lands on 404.html, and the retired hash URLs (legacy-hash.global.client.ts)
   only cover the ones we knew about — so this is the page a stale bookmark
   actually reaches. It carries the real chrome for that reason. */
const props = defineProps<{ error: NuxtError }>();
const route = useRoute();
const lang = computed<'en' | 'vi'>(() => route.query.lang === 'vi' ? 'vi' : 'en');
const notFound = computed(() => props.error?.statusCode === 404);

const copy = computed(() => lang.value === 'vi'
  ? {
      code404: 'Không tìm thấy trang', codeOther: 'Có lỗi xảy ra',
      lead404: 'Địa chỉ này không trỏ tới nội dung nào. Link có thể đã cũ, hoặc chủ đề đã được đổi tên.',
      leadOther: 'Trang không tải được. Thử lại thường là đủ; nếu vẫn lỗi thì quay về Lộ trình học.',
      search: 'Tìm toàn bộ nội dung', home: 'Về Lộ trình học', retry: 'Thử lại',
      elsewhere: 'Hoặc đi thẳng tới:',
      links: { design: 'System Design', cases: 'Case Studies', gazl: 'Gazl Try', notes: 'Ghi chú phát hành' }
    }
  : {
      code404: 'Page not found', codeOther: 'Something went wrong',
      lead404: 'This address does not point at any content. The link may be an old one, or the topic may have been renamed.',
      leadOther: 'The page failed to load. Retrying usually clears it; otherwise head back to the Study Track.',
      search: 'Search everything', home: 'Back to the Study Track', retry: 'Try again',
      elsewhere: 'Or go straight to:',
      links: { design: 'System Design', cases: 'Case Studies', gazl: 'Gazl Try', notes: 'Release Notes' }
    });

const withLang = (path: string) => lang.value === 'vi' ? `${path}?lang=vi` : path;

useHead(() => ({
  htmlAttrs: { lang: lang.value },
  title: `${notFound.value ? copy.value.code404 : copy.value.codeOther} — GAZLL`,
  meta: [{ name: 'robots', content: 'noindex,nofollow' }]
}));
</script>

<template>
  <div>
    <ContentHeader :lang="lang" />
    <main id="view-host" tabindex="-1" class="view">
      <div class="page err-page">
        <p class="err-code">{{ error?.statusCode || 500 }}</p>
        <h1>{{ notFound ? copy.code404 : copy.codeOther }}</h1>
        <p class="err-lead">{{ notFound ? copy.lead404 : copy.leadOther }}</p>
        <p v-if="!notFound && error?.message" class="err-detail">{{ error.message }}</p>

        <div class="err-actions">
          <NuxtLink class="btn-primary" :to="withLang('/')">{{ copy.home }}</NuxtLink>
          <NuxtLink class="btn-ghost" :to="withLang('/search')">{{ copy.search }}</NuxtLink>
          <button v-if="!notFound" class="btn-ghost" type="button" @click="clearError({ redirect: withLang('/') })">{{ copy.retry }}</button>
        </div>

        <p class="err-elsewhere">{{ copy.elsewhere }}</p>
        <div class="err-links">
          <NuxtLink :to="withLang('/system-design')">{{ copy.links.design }}</NuxtLink>
          <NuxtLink :to="withLang('/case-studies')">{{ copy.links.cases }}</NuxtLink>
          <NuxtLink :to="withLang('/gazl-try')">{{ copy.links.gazl }}</NuxtLink>
          <NuxtLink :to="withLang('/release-notes')">{{ copy.links.notes }}</NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>
