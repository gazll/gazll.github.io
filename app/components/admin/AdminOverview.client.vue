<script setup lang="ts">
const props = defineProps<{ total: number }>();
const { $auth, $apiCall } = useNuxtApp() as any;
const users = ref<any[]>([]);
const message = ref('');
const loading = ref(false);
let stop: (() => void) | null = null;
const sum = (field: string) => users.value.reduce((total, user) => total + (Number(user[field]) || 0), 0);

async function load() {
  if (!$auth.token) {
    message.value = $auth.session ? 'Your session ended — sign in again.' : 'This page needs an admin account.';
    users.value = [];
    return;
  }
  loading.value = true;
  message.value = '';
  try {
    const data = await $apiCall('admin.overview', {}, $auth.token);
    users.value = data.users || [];
  } catch (error: any) {
    message.value = error.message || String(error);
  } finally { loading.value = false; }
}
onMounted(() => { stop = $auth.onChange(load); load(); });
onBeforeUnmount(() => stop?.());
</script>

<template>
  <div>
    <p v-if="loading">Loading all-user overview…</p>
    <div v-if="message" class="warn">{{ message }}</div>
    <template v-if="users.length">
      <div class="stat-row">
        <div class="stat-tile"><div class="stat-label">Users</div><div class="stat-value">{{ users.length }}</div></div>
        <div class="stat-tile"><div class="stat-label">Admin</div><div class="stat-value">{{ users.filter(user => user.role === 'admin').length }}</div></div>
        <div class="stat-tile"><div class="stat-label">Items reviewed</div><div class="stat-value">{{ sum('reviewed_count') }}</div></div>
        <div class="stat-tile"><div class="stat-label">Notes written</div><div class="stat-value">{{ sum('note_count') }}</div></div>
      </div>
      <div class="tablewrap"><table class="adtable"><thead><tr><th>User</th><th>Track progress</th><th>Notes</th><th>Interviews</th><th>Active days</th></tr></thead><tbody>
        <tr v-for="user in users" :key="user.email"><td class="ad-user"><img v-if="user.picture" class="avatar sm" :src="user.picture" alt=""><div><b>{{ user.name || '—' }}</b><span class="ad-email">{{ user.email }}</span></div><span v-if="user.role === 'admin'" class="rolebadge">ADMIN</span></td><td>{{ user.reviewed_count }}/{{ total }}</td><td>{{ user.note_count }}</td><td>{{ user.interview_count }}</td><td>{{ user.active_days }}</td></tr>
      </tbody></table></div>
    </template>
  </div>
</template>
