<script setup lang="ts">
const route = useRoute();
</script>

<template>
  <StudyTopicPage :slug="String(route.params.slug)" />
</template>
