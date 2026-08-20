<script setup lang="ts">
/* The knob of a .langswitch shows the ACTIVE language's flag. It used to be a
   regional-indicator emoji, which Windows renders as the bare letters "GB" —
   the icon simply vanished for anyone not on macOS. Inline SVG renders the
   same everywhere and needs no font.

   Both flags are drawn square rather than 3:2 because the knob is a circle
   that crops them; a 3:2 flag scaled into it loses its ends. */
defineProps<{ lang: 'en' | 'vi' }>();
</script>

<template>
  <svg v-if="lang === 'vi'" class="flagicon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect width="24" height="24" fill="#DA251D" />
    <path fill="#FFCD00" d="M12 4.6l1.86 5.72h6.02l-4.87 3.54 1.86 5.72L12 16.04l-4.87 3.54 1.86-5.72-4.87-3.54h6.02z" />
  </svg>
  <svg v-else class="flagicon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <rect width="24" height="24" fill="#012169" />
    <path d="M0 0l24 24M24 0L0 24" stroke="#fff" stroke-width="5.5" />
    <path d="M0 0l24 24M24 0L0 24" stroke="#C8102E" stroke-width="2.4" />
    <path d="M12 0v24M0 12h24" stroke="#fff" stroke-width="8" />
    <path d="M12 0v24M0 12h24" stroke="#C8102E" stroke-width="4.4" />
  </svg>
</template>
