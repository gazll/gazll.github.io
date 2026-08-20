<script setup lang="ts">
const props = withDefaults(defineProps<{ source: string; title?: string; lang?: 'en' | 'vi' }>(), {
  title: 'Architecture', lang: 'en'
});
const root = useTemplateRef<HTMLElement>('root');
const zoom = ref(1);
const copied = ref(false);

function applyZoom(next: number) {
  zoom.value = Math.min(2, Math.max(.5, next));
  const svg = root.value?.querySelector<SVGElement>('svg');
  if (svg) svg.style.width = `${zoom.value * 100}%`;
}

async function copySource() {
  try {
    await navigator.clipboard.writeText(props.source);
  } catch {
    const area = document.createElement('textarea');
    area.value = props.source;
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1600);
}

onMounted(async () => {
  const module = await import(/* @vite-ignore */ '/lib/mermaid.js');
  await module.mountMermaidDiagrams(root.value);
  applyZoom(1);
});
</script>

<template>
  <figure ref="root" class="sd-diagram" data-diagram-frame>
    <figcaption>
      <strong>{{ title }}</strong>
      <span class="sd-diagram-actions">
        <button type="button" @click="copySource">{{ copied ? (lang === 'vi' ? 'Đã copy' : 'Copied') : 'Copy Mermaid' }}</button>
        <span class="sd-diagram-zoom" role="group" :aria-label="lang === 'vi' ? 'Phóng to sơ đồ' : 'Diagram zoom'">
          <button type="button" aria-label="Zoom out" @click="applyZoom(zoom - .25)">−</button>
          <button type="button" aria-label="Reset zoom" @click="applyZoom(1)">{{ Math.round(zoom * 100) }}%</button>
          <button type="button" aria-label="Zoom in" @click="applyZoom(zoom + .25)">+</button>
        </span>
        <a href="https://mermaid.live/" target="_blank" rel="noopener noreferrer">{{ lang === 'vi' ? 'Mở visualizer' : 'Open visualizer' }} ↗</a>
      </span>
    </figcaption>
    <div class="sd-diagram-viewport">
      <pre class="mermaid" data-mermaid-diagram>{{ props.source }}</pre>
    </div>
    <p class="sd-mermaid-status" data-mermaid-status hidden>Diagram renderer unavailable. The editable Mermaid source remains below.</p>
  </figure>
</template>
