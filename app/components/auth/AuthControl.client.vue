<script setup lang="ts">
/* The avatar opens Google's own rendered button instead of relying only on
   One Tap. FedCM and third-party-cookie rules can suppress One Tap on mobile,
   while the official button remains an explicit, tappable sign-in path. */
const { $auth, $studyStore } = useNuxtApp() as any;
const revision = ref(0);
const menuOpen = ref(false);
const googleButtonFailed = ref(false);
const retrying = ref(false);
const authRoot = ref<HTMLElement | null>(null);
const googleHolder = ref<HTMLElement | null>(null);
let stopAuth: (() => void) | null = null;
let stopStore: (() => void) | null = null;

const refresh = () => {
  revision.value += 1;
  if ($auth.state === 'signed') menuOpen.value = false;
};

const state = computed<string>(() => { revision.value; return $auth.state; });
const identity = computed<any>(() => { revision.value; return $auth.identity; });
const sync = computed<string>(() => { revision.value; return $studyStore.status; });
const error = computed<string>(() => { revision.value; return $auth.error || ''; });

const who = computed(() => identity.value?.name || identity.value?.email || '');
const initial = computed(() => (who.value.trim()[0] || '?').toUpperCase());
const label = computed(() => {
  if (state.value === 'signed') return `${who.value} · Open account`;
  if (state.value === 'connecting') return 'Open sign-in while reconnecting';
  if (state.value === 'error') return 'Open sign-in · retry';
  return 'Open Google sign-in';
});
const note = computed(() => {
  if (state.value === 'connecting') return 'Google is trying to restore your session. You can also use the button below.';
  if (state.value === 'stale') return 'Your previous session ended. Sign in again to resume syncing; local progress remains safe.';
  if (state.value === 'error') return 'Google sign-in could not be opened. Try the button again.';
  return 'Sign in with Google to sync progress, notes and the interview journal.';
});

async function mountGoogleButton() {
  googleButtonFailed.value = false;
  await nextTick();
  if (!menuOpen.value || state.value === 'signed' || !googleHolder.value) return;
  const mounted = await $auth.renderButton(googleHolder.value);
  if (!mounted && menuOpen.value && state.value !== 'signed') googleButtonFailed.value = true;
}

function toggleMenu() {
  if (state.value === 'offline') return;
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) googleButtonFailed.value = false;
}

function closeMenu() {
  menuOpen.value = false;
  googleButtonFailed.value = false;
}

async function retrySignIn() {
  if (retrying.value) return;
  retrying.value = true;
  try { await $auth.signIn(); } finally { retrying.value = false; }
}

function onDocumentClick(event: MouseEvent) {
  if (menuOpen.value && authRoot.value && !authRoot.value.contains(event.target as Node)) closeMenu();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && menuOpen.value) closeMenu();
}

onMounted(() => {
  stopAuth = $auth.onChange(refresh);
  stopStore = $studyStore.onSync(() => { revision.value += 1; });
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  stopAuth?.();
  stopStore?.();
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});

watch(menuOpen, open => { if (open) void mountGoogleButton(); });
watch(state, next => {
  if (next === 'signed') closeMenu();
  else if (menuOpen.value) void mountGoogleButton();
});
</script>

<template>
  <div ref="authRoot" class="authbar" @click.stop>
    <span v-if="sync && sync !== 'idle'" class="syncstate">{{ sync }}</span>
    <span v-if="state === 'offline'" class="syncstate">Offline</span>
    <button
      v-else
      class="authbtn"
      type="button"
      :data-state="state"
      :title="label"
      :aria-label="label"
      aria-haspopup="dialog"
      :aria-expanded="menuOpen"
      aria-controls="authMenu"
      @click="toggleMenu"
    >
      <img v-if="state === 'signed' && identity?.picture" class="avatar" :src="identity.picture" alt="" referrerpolicy="no-referrer">
      <span v-else-if="state === 'signed'" class="avatar avatar-fallback">{{ initial }}</span>
      <span v-else class="avatar avatar-anon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="8.5" r="3.7" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
      </span>
    </button>

    <div v-if="menuOpen" id="authMenu" class="authmenu" role="dialog" aria-label="Account">
      <template v-if="state === 'signed'">
        <div class="am-id">
          <div class="am-name">{{ who }}</div>
          <div v-if="identity?.email" class="am-mail">{{ identity.email }}</div>
        </div>
        <p class="am-note ok">Progress, notes and the interview journal are syncing to your Google Sheet.</p>
        <button class="am-action danger" type="button" @click="$auth.signOut(); closeMenu()">Sign out</button>
      </template>
      <template v-else>
        <p v-if="error" class="am-note err">{{ error }}</p>
        <p class="am-note">{{ note }}</p>
        <div ref="googleHolder" class="gis-holder" aria-live="polite"></div>
        <button v-if="googleButtonFailed" class="am-action" type="button" :disabled="retrying" @click="retrySignIn">
          {{ retrying ? 'Opening Google sign-in…' : 'Try again' }}
        </button>
      </template>
    </div>
  </div>
</template>
