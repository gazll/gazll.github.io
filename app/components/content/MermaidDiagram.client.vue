<script setup lang="ts">
const props = defineProps<{ source: string }>();
const root = useTemplateRef<HTMLElement>('root');

onMounted(async () => {
  const module = await import(/* @vite-ignore */ '/lib/mermaid.js');
  await module.mountMermaidDiagrams(root.value);
});
</script>

<template>
  <figure ref="root" class="sd-diagram" data-diagram-frame>
    <div class="sd-diagram-viewport">
      <pre class="mermaid" data-mermaid-diagram>{{ props.source }}</pre>
    </div>
    <p class="sd-mermaid-status" data-mermaid-status hidden>Diagram renderer unavailable. The editable Mermaid source remains below.</p>
  </figure>
</template>
