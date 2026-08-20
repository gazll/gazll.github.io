<script setup lang="ts">const route = useRoute();</script>
<template><ContentCollectionArticle collection="photography" :slug="String(route.params.slug)" /></template>
