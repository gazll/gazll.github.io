<script setup lang="ts">
const props = defineProps<{ source: string }>();
const root = useTemplateRef<HTMLElement>('root');

onMounted(async () => {
  const module = await import(/* @vite-ignore */ '/lib/mermaid.js');
  await module.mountMermaidDiagrams(root.value);
});
</script>

<template>
  <div ref="root" class="diagram-frame" data-diagram-frame>
    <pre class="mermaid">{{ props.source }}</pre>
  </div>
</template>
