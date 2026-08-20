<script setup lang="ts">
const { $auth, $studyStore } = useNuxtApp() as any;
const revision = ref(0);
const refresh = () => { revision.value += 1; };
let stopAuth: (() => void) | null = null;
let stopStore: (() => void) | null = null;

onMounted(() => {
  stopAuth = $auth.onChange(refresh);
  stopStore = $studyStore.onSync(refresh);
});
onBeforeUnmount(() => { stopAuth?.(); stopStore?.(); });

const state = computed(() => { revision.value; return $auth.state; });
const identity = computed(() => { revision.value; return $auth.identity; });
const sync = computed(() => { revision.value; return $studyStore.status; });
</script>

<template>
  <div class="authbar">
    <span v-if="sync && sync !== 'idle'" class="syncstate">{{ sync }}</span>
    <button v-if="state === 'signed'" class="authbtn" type="button" @click="$auth.signOut()">
      <img v-if="identity?.picture" :src="identity.picture" alt="">{{ identity?.name || identity?.email }} · Sign out
    </button>
    <button v-else-if="state !== 'offline'" class="authbtn" type="button" @click="$auth.signIn()">
      {{ state === 'connecting' ? 'Connecting…' : state === 'error' ? 'Retry sign in' : 'Sign in' }}
    </button>
    <span v-else class="syncstate">Offline</span>
  </div>
</template>
