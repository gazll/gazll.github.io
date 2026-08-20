<script setup lang="ts">const route = useRoute();</script>
<template><ContentCollectionArticle collection="homelab" :slug="String(route.params.slug)" /></template>
