<script setup lang="ts">
import { copyText } from '../../../public/lib/clipboard.js';
const props = withDefaults(defineProps<{ source: string; title?: string; lang?: 'en' | 'vi' }>(), {
  title: 'Architecture', lang: 'en'
});
const root = useTemplateRef<HTMLElement>('root');
const zoom = ref(1);
const copied = ref(false);

/* 100% means readable, not "fits the column". Shrinking a 1,600px-wide
   flowchart into a 1,000px column left its 16px labels at ~10px, so the base
   width keeps labels at READABLE of their authored size and lets the viewport
   scroll sideways instead. A diagram narrower than that still fills the column. */
const READABLE = .85;
function applyZoom(next: number) {
  zoom.value = Math.min(2, Math.max(.5, next));
  const svg = root.value?.querySelector<SVGSVGElement>('svg');
  const pre = svg?.parentElement;
  if (!svg || !pre) return;
  const style = getComputedStyle(pre);
  const column = pre.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const natural = svg.viewBox?.baseVal?.width || column;
  svg.style.maxWidth = 'none';
  svg.style.width = `${Math.round(Math.max(column, natural * READABLE) * zoom.value)}px`;
}

async function copySource() {
  // copyText keeps the execCommand fallback that local HTTP previews need.
  try { await copyText(props.source); }
  catch { window.prompt('Copy this diagram source', props.source); }
  copied.value = true;
  window.setTimeout(() => { copied.value = false; }, 1600);
}

/* Rendered on the server too, so the escaped source ships in the <pre> and the
   diagram degrades to readable, copyable Mermaid when the renderer never
   arrives. As a .client component this emitted a bare placeholder instead and
   leaked the source as an HTML attribute. */
onMounted(async () => {
  const module = await import(/* @vite-ignore */ '/lib/mermaid.js');
  await module.mountMermaidDiagrams(root.value);
  applyZoom(1);
});
</script>

<template>
  <figure ref="root" data-ui="mermaid-diagram" class="sd-diagram" data-diagram-frame>
    <figcaption>
      <strong>{{ title }}</strong>
      <span class="sd-diagram-actions">
        <button type="button" @click="copySource">{{ copied ? (lang === 'vi' ? 'Đã copy' : 'Copied') : 'Copy Mermaid' }}</button>
        <span class="sd-diagram-zoom" role="group" :aria-label="lang === 'vi' ? 'Phóng to sơ đồ' : 'Diagram zoom'">
          <button type="button" aria-label="Zoom out" @click="applyZoom(zoom - .25)">−</button>
          <button type="button" :aria-label="`${Math.round(zoom * 100)}% — reset zoom`" @click="applyZoom(1)">{{ Math.round(zoom * 100) }}%</button>
          <button type="button" aria-label="Zoom in" @click="applyZoom(zoom + .25)">+</button>
        </span>
        <a href="https://mermaid.live/" target="_blank" rel="noopener noreferrer">{{ lang === 'vi' ? 'Mở visualizer' : 'Open visualizer' }} ↗</a>
      </span>
    </figcaption>
    <div class="sd-diagram-viewport">
      <pre class="mermaid" data-mermaid-diagram>{{ source }}</pre>
    </div>
    <p class="sd-mermaid-status" data-mermaid-status hidden>Diagram renderer unavailable. The editable Mermaid source remains below.</p>
  </figure>
</template>
