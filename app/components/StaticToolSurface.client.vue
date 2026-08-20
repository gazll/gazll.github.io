<script setup lang="ts">
const props = defineProps<{
  shell: string
  controller: string
}>();

const mountPoint = useTemplateRef<HTMLElement>('mountPoint');
const failure = ref('');

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
    mountPoint.value?.replaceChildren(...document_.body.childNodes);

    const controller = new URL(props.controller, window.location.origin);
    controller.searchParams.set('v', await deployedVersion());
    await import(/* @vite-ignore */ controller.href);
  } catch (error) {
    failure.value = error instanceof Error ? error.message : String(error);
  }
});
</script>

<template>
  <div ref="mountPoint" class="static-tool-surface">
    <p v-if="failure" class="static-tool-error" role="alert">
      {{ failure }}
    </p>
  </div>
</template>
