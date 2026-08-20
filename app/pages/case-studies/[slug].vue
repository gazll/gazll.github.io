<script setup lang="ts">const route = useRoute();</script>
<template><ContentCollectionArticle collection="case-studies" :slug="String(route.params.slug)" /></template>
