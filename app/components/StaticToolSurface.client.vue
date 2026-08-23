<script setup lang="ts">
const props = defineProps<{
  shell: string
  controller: string
  lang?: 'en' | 'vi'
}>();

const mountPoint = useTemplateRef<HTMLElement>('mountPoint');
const failure = ref('');
const loading = ref(true);
const labels = computed(() => props.lang === 'vi'
  ? { loading: 'Đang tải công cụ…', error: 'Không thể tải công cụ này.', retry: 'Thử lại' }
  : { loading: 'Loading tool…', error: 'This tool could not be loaded.', retry: 'Try again' });

async function deployedVersion() {
  try {
    const url = new URL('/version.json', window.location.origin);
    url.searchParams.set('_', String(Date.now()));
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return 'dev';
    const release = await response.json();
    return /^[A-Za-z0-9._-]+$/.test(release.version || '') ? release.version : 'dev';
  } catch (error) {
    return 'dev';
  }
}

onMounted(async () => {
  try {
    const response = await fetch(props.shell, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load ${props.shell}`);
    const source = await response.text();
    const document_ = new DOMParser().parseFromString(source, 'text/html');
    document_.querySelectorAll('script').forEach(script => script.remove());
    const target = mountPoint.value;
    if (!target) throw new Error('Could not mount the tool surface');
    target.replaceChildren(...Array.from(document_.body.childNodes));

    const controller = new URL(props.controller, window.location.origin);
    controller.searchParams.set('v', await deployedVersion());
    await import(/* @vite-ignore */ controller.href);
  } catch (error) {
    failure.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
});
function retry() {
  if (import.meta.client) window.location.reload();
}
</script>

<template>
  <div class="static-tool-surface" :aria-busy="loading">
    <div ref="mountPoint" class="static-tool-mount"></div>
    <p v-show="loading" class="static-tool-status" role="status" aria-live="polite">
      {{ labels.loading }}
    </p>
    <div v-show="!loading && failure" class="static-tool-status static-tool-error" role="alert">
      <span>{{ labels.error }}</span>
      <button type="button" class="static-tool-retry" @click="retry">{{ labels.retry }}</button>
    </div>
  </div>
</template>
