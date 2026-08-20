<script setup lang="ts">
/* The avatar IS the sign-in control — one 36px circle in the header, whatever
   the state, with a ring around it carrying that state (styles.css,
   `.authbtn[data-state]`). The migration shipped a stub that put the label
   *inside* the circle instead, so "Sign in" and "Name · Sign out" overflowed a
   36px round button and wrapped over the sync chip beside it. The label belongs
   in the accessible name, not in the button.

   `$auth.state` is the single value the UI switches on — never a combination of
   token and hint, which is what left the header spinner running forever. */
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

const state = computed<string>(() => { revision.value; return $auth.state; });
const identity = computed<any>(() => { revision.value; return $auth.identity; });
const sync = computed<string>(() => { revision.value; return $studyStore.status; });

const who = computed(() => identity.value?.name || identity.value?.email || '');
const initial = computed(() => (who.value.trim()[0] || '?').toUpperCase());
const label = computed(() => {
  if (state.value === 'signed') return `${who.value} · Sign out`;
  if (state.value === 'connecting') return 'Signing in…';
  if (state.value === 'error') return 'Sign in failed — retry';
  return 'Sign in with Google';
});
</script>

<template>
  <div class="authbar">
    <span v-if="sync && sync !== 'idle'" class="syncstate">{{ sync }}</span>
    <span v-if="state === 'offline'" class="syncstate">Offline</span>
    <button
      v-else
      class="authbtn"
      type="button"
      :data-state="state"
      :title="label"
      :aria-label="label"
      @click="state === 'signed' ? $auth.signOut() : $auth.signIn()"
    >
      <img v-if="state === 'signed' && identity?.picture" class="avatar" :src="identity.picture" alt="" referrerpolicy="no-referrer">
      <span v-else-if="state === 'signed'" class="avatar avatar-fallback">{{ initial }}</span>
      <span v-else class="avatar avatar-anon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.7" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      </span>
    </button>
  </div>
</template>
