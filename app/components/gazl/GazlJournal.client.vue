<script setup lang="ts">
import { escapeHtml, renderMarkdown } from '~/utils/markdown.js';

const props = defineProps<{ seed: any[]; lang: 'en' | 'vi' }>();
const { $auth, $apiCall } = useNuxtApp() as any;
const companies = ref<any[]>([]);
const source = ref<'seed' | 'remote'>('seed');
const loading = ref(true);
const error = ref('');
const busy = ref('');
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const openQuestions = ref(new Set<string>());
const openCompanies = ref(new Set<string>());
let stopAuth: (() => void) | null = null;

const seedRows = computed(() => props.seed.map((company, index) => ({ ...company, id: `seed-${index}`, own: false })));
const editable = computed(() => source.value === 'remote');
const ownCount = computed(() => companies.value.filter(company => company.own).length);
const seedCount = computed(() => companies.value.filter(company => !company.own).length);
const questionCount = computed(() => companies.value.reduce((total, company) => total + (company.questions || []).length, 0));
const normalize = (value: string) => String(value || '').trim().toLocaleLowerCase();
const safeMarkdown = (value: string) => renderMarkdown(escapeHtml(value));
const labels = computed(() => props.lang === 'vi' ? {
  title: 'Gazl Try — nhật ký phỏng vấn', intro: 'Trải nghiệm phỏng vấn · playbook chuẩn bị · câu trả lời đã review kỹ thuật.',
  loading: 'Đang tải nhật ký phỏng vấn…', backendError: 'Không thể đọc backend:', backendFallback: ' — đang hiển thị sample trong repository.',
  entry: 'mục', entries: 'mục', question: 'câu hỏi', questions: 'câu hỏi', mine: 'của tôi', samples: 'sample', readOnly: 'chỉ đọc',
  signIn: 'Đăng nhập Google để thêm hoặc sửa mục.', noBackend: 'Chưa cấu hình backend — sample chỉ đọc.', noEntries: 'Chưa có mục phỏng vấn nào.', noQuestions: 'Chưa có câu hỏi nào được ghi lại.',
  addCompany: 'Thêm công ty', sample: 'Sample', edit: 'Sửa', remove: 'Xóa', saveToJournal: 'Lưu vào nhật ký', saving: 'Đang lưu…',
  created: 'Tạo lúc', updated: 'Cập nhật', source: 'Nguồn', primaryReferences: 'Nguồn tham khảo chính',
  commonTitle: 'Kiến thức chung', commonKicker: 'Sưu tầm · nhiều công ty',
  commonIntro: 'Playbook và báo cáo tổng hợp từ nhiều cuộc phỏng vấn — không gắn với một công ty cụ thể nào.',
  companiesTitle: 'Theo công ty', companiesKicker: 'Nhật ký · từng công ty',
  companiesIntro: 'Mỗi mục là một quy trình phỏng vấn: JD, tóm tắt các vòng, rồi tới câu hỏi.',
  jd: 'Mô tả công việc (JD)', brief: 'Tóm tắt quy trình', rounds: 'Các vòng', round_: 'vòng', rounds_: 'vòng',
  jdOnly: 'mới có JD',
  expand: 'Mở', collapse: 'Đóng', expandAll: 'Mở tất cả', collapseAll: 'Đóng tất cả',
  jdPlaceholder: 'Dán JD của vị trí — yêu cầu, trách nhiệm, stack.',
  briefPlaceholder: 'Quy trình diễn ra thế nào: mấy vòng, mỗi vòng bao lâu, ai phỏng vấn, không khí ra sao.',
  roundName: 'Tên vòng', roundNote: 'Diễn ra thế nào', addRound: 'Thêm vòng', removeRound: 'Xóa vòng',
  reviewedAnswer: 'Câu trả lời đã review', myAnswer: 'Cách tôi trả lời', diagramReview: 'Review diagram & thiết kế nâng cấp',
  flaws: 'Điểm yếu', upgrades: 'Nâng cấp', mermaidSource: 'Mã Mermaid', takeaway: 'Điểm rút ra',
  sampleFoot: 'Sample lấy từ interviews.json. Hãy lưu vào nhật ký trước khi chỉnh sửa.',
  editCompany: 'Sửa công ty', addCompanyTitle: 'Thêm công ty', companyName: 'Tên công ty *', role: 'Vai trò', when: 'Thời điểm', result: 'Kết quả',
  stack: 'Stack (ngăn cách bằng dấu phẩy)', questionsTitle: 'Câu hỏi', addQuestion: 'Thêm câu hỏi', round: 'Vòng', asked: 'Họ hỏi gì *',
  answered: 'Cách tôi trả lời', improve: 'Điểm rút ra / cần cải thiện', removeQuestion: 'Xóa câu hỏi', cancel: 'Hủy', save: 'Lưu',
  resultLabels: { pending: 'Đang chờ', passed: 'Đạt', offer: 'Offer', failed: 'Từ chối' },
  kindLabels: { playbook: 'Playbook học tập', 'community-report': 'Báo cáo cộng đồng' },
  deleteConfirm: (name: string) => `Xóa “${name}” và toàn bộ câu hỏi bên dưới?`, deleteFailed: 'Không thể xóa:', saveFailed: 'Không thể lưu:'
} : {
  title: 'Gazl Try — interview journal', intro: 'Interview experiences · preparation playbooks · technically reviewed answers.',
  loading: 'Loading the interview journal…', backendError: 'Could not read from the backend:', backendFallback: ' — showing repository samples instead.',
  entry: 'entry', entries: 'entries', question: 'question', questions: 'questions', mine: 'mine', samples: 'samples', readOnly: 'read-only',
  signIn: 'Sign in with Google to add or edit entries.', noBackend: 'No backend configured — sample entries are read-only.', noEntries: 'No interview entries yet.', noQuestions: 'No questions recorded yet.',
  addCompany: 'Add company', sample: 'Sample', edit: 'Edit', remove: 'Delete', saveToJournal: 'Save to my journal', saving: 'Saving…',
  created: 'Created', updated: 'Updated', source: 'Source', primaryReferences: 'Primary references',
  commonTitle: 'Common ground', commonKicker: 'Collected · many companies',
  commonIntro: 'Playbooks and reports synthesised across many interviews — not tied to any one company.',
  companiesTitle: 'By company', companiesKicker: 'Journal · one company each',
  companiesIntro: 'Each entry is one interview process: the JD, how the rounds ran, then the questions.',
  jd: 'Job description', brief: 'How the process ran', rounds: 'Rounds', round_: 'round', rounds_: 'rounds',
  jdOnly: 'JD only',
  expand: 'Open', collapse: 'Close', expandAll: 'Expand all', collapseAll: 'Collapse all',
  jdPlaceholder: 'Paste the posting — requirements, responsibilities, stack.',
  briefPlaceholder: 'How it ran: how many rounds, how long each took, who interviewed, what the tone was.',
  roundName: 'Round name', roundNote: 'How it went', addRound: 'Add round', removeRound: 'Remove round',
  reviewedAnswer: 'Reviewed answer', myAnswer: 'How I answered', diagramReview: 'Diagram review & upgraded design',
  flaws: 'Flaws', upgrades: 'Upgrades', mermaidSource: 'Mermaid source', takeaway: 'Takeaway',
  sampleFoot: 'Sample entries come from interviews.json. Save one to your journal before editing it.',
  editCompany: 'Edit company', addCompanyTitle: 'Add company', companyName: 'Company name *', role: 'Role', when: 'When', result: 'Result',
  stack: 'Stack (comma separated)', questionsTitle: 'Questions', addQuestion: 'Add question', round: 'Round', asked: 'What they asked *',
  answered: 'How I answered', improve: 'Takeaway / what to improve', removeQuestion: 'Remove question', cancel: 'Cancel', save: 'Save',
  resultLabels: { pending: 'Pending', passed: 'Passed', offer: 'Offer', failed: 'Rejected' },
  kindLabels: { playbook: 'Learning playbook', 'community-report': 'Community report' },
  deleteConfirm: (name: string) => `Delete “${name}” and every question under it?`, deleteFailed: 'Could not delete:', saveFailed: 'Could not save:'
});
const resultLabels = computed(() => labels.value.resultLabels);
const kindLabels = computed(() => labels.value.kindLabels);
const form = reactive<any>({ id: '', name: '', role: '', date: '', result: 'pending', stack: '', jd: '', brief: '', rounds: [], references: [], questions: [] });
const formError = ref('');

/* Two surfaces, one list. An entry with a `kind` was synthesised across many
   interviews, so it answers "what do these interviews have in common"; an entry
   without one is a single company's process. Mixing them made the shared
   playbooks look like just another company, and Common leads because it is what
   a reader should study before any single company's questions. */
const groups = computed(() => [
  { id: 'common', title: labels.value.commonTitle, kicker: labels.value.commonKicker, intro: labels.value.commonIntro,
    rows: companies.value.filter(company => company.kind) },
  { id: 'companies', title: labels.value.companiesTitle, kicker: labels.value.companiesKicker, intro: labels.value.companiesIntro,
    rows: companies.value.filter(company => !company.kind) }
].filter(group => group.rows.length));

/* Collapsed by default: the journal is meant to grow past what fits on a
   screen, and an entry that opens 13 questions makes the list below it
   unreachable. Opening one is a click; the state is per session, not stored. */
function isOpen(company: any) { return openCompanies.value.has(company.id); }
function toggleCompany(company: any) {
  const next = new Set(openCompanies.value);
  next.has(company.id) ? next.delete(company.id) : next.add(company.id);
  openCompanies.value = next;
}
const allOpen = computed(() => companies.value.length > 0 && companies.value.every(isOpen));
function toggleAll() {
  openCompanies.value = allOpen.value ? new Set() : new Set(companies.value.map(company => company.id));
}
const roundList = (company: any) => (company.rounds || []).filter((round: any) => round?.name || round?.note);
/* Falls back to the distinct round labels the questions already carry, so an
   entry written before `rounds` existed still reports how many rounds it had. */
const roundCount = (company: any) => roundList(company).length
  || new Set((company.questions || []).map((question: any) => String(question.round || '').trim()).filter(Boolean)).size;

async function load() {
  loading.value = true;
  error.value = '';
  if (!$auth.token) {
    companies.value = seedRows.value;
    source.value = 'seed';
    loading.value = false;
    return;
  }
  try {
    const data = await $apiCall('interviews.list', {}, $auth.token);
    const own = (data.companies || []).map((company: any) => ({ ...company, own: true }));
    const names = new Set(own.map((company: any) => normalize(company.name)));
    companies.value = own.concat(seedRows.value.filter(company => !names.has(normalize(company.name))));
    source.value = 'remote';
  } catch (reason: any) {
    error.value = reason?.message || String(reason);
    companies.value = seedRows.value;
    source.value = 'seed';
  } finally { loading.value = false; }
}

function resetForm(company?: any) {
  Object.assign(form, {
    id: company?.id || '', name: company?.name || '', role: company?.role || '', date: company?.date || '',
    result: company?.result || 'pending', stack: (company?.stack || []).join(', '),
    jd: company?.jd || '', brief: company?.brief || '',
    rounds: structuredClone(company?.rounds || []),
    references: structuredClone(company?.references || []),
    questions: structuredClone(company?.questions || [{ round: '', q: '', a: '', note: '', diagrams: [] }])
  });
  if (!form.questions.length) form.questions.push({ round: '', q: '', a: '', note: '', diagrams: [] });
  formError.value = '';
  dialog.value?.showModal();
}
function addQuestion() { form.questions.push({ round: '', q: '', a: '', note: '', diagrams: [] }); }
function removeQuestion(index: number) { form.questions.splice(index, 1); }
function addRound() { form.rounds.push({ name: '', note: '' }); }
function removeRound(index: number) { form.rounds.splice(index, 1); }

async function save() {
  if (!form.name.trim()) { formError.value = props.lang === 'vi' ? 'Cần nhập tên công ty.' : 'Company name is required.'; return; }
  busy.value = 'save';
  formError.value = '';
  const company = {
    ...(form.id ? { id: form.id } : {}), name: form.name.trim(), role: form.role.trim(), date: form.date.trim(),
    result: form.result, stack: form.stack.split(',').map((row: string) => row.trim()).filter(Boolean),
    jd: form.jd.trim(), brief: form.brief.trim(),
    rounds: form.rounds.map((round: any) => ({ name: String(round.name || '').trim(), note: String(round.note || '').trim() }))
      .filter((round: any) => round.name || round.note),
    references: structuredClone(form.references),
    questions: form.questions.map((question: any) => ({
      round: question.round.trim(), q: question.q.trim(), a: question.a.trim(), note: question.note.trim(),
      diagrams: structuredClone(question.diagrams || [])
    })).filter((question: any) => question.q)
  };
  try {
    await $apiCall('interviews.save', { company }, $auth.token);
    dialog.value?.close();
    await load();
  } catch (reason: any) { formError.value = reason?.message || String(reason); }
  finally { busy.value = ''; }
}

async function remove(company: any) {
  if (!window.confirm(labels.value.deleteConfirm(company.name))) return;
  busy.value = company.id;
  try { await $apiCall('interviews.delete', { id: company.id }, $auth.token); await load(); }
  catch (reason: any) { window.alert(`${labels.value.deleteFailed} ${reason?.message || reason}`); }
  finally { busy.value = ''; }
}

async function importSeed(company: any) {
  busy.value = company.id;
  const sourceNote = company.source?.url ? `${labels.value.source}: ${company.source.label || company.source.url} — ${company.source.url}` : '';
  const copy = {
    name: company.name, role: company.role, date: company.date, result: company.result, stack: company.stack || [],
    jd: company.jd || '', brief: company.brief || '', rounds: structuredClone(company.rounds || []),
    references: structuredClone(company.references || []),
    questions: (company.questions || []).map((question: any, index: number) => ({
      round: question.round, q: question.q, a: question.a,
      note: [question.note, index === 0 ? sourceNote : ''].filter(Boolean).join('\n\n'),
      diagrams: structuredClone(question.diagrams || [])
    }))
  };
  try { await $apiCall('interviews.save', { company: copy }, $auth.token); await load(); }
  catch (reason: any) { window.alert(`${labels.value.saveFailed} ${reason?.message || reason}`); }
  finally { busy.value = ''; }
}

function questionKey(company: any, index: number) { return `${company.id}-${index}`; }
function toggleQuestion(key: string) {
  const next = new Set(openQuestions.value);
  next.has(key) ? next.delete(key) : next.add(key);
  openQuestions.value = next;
}
function safeExternalUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '#'; }
  catch { return '#'; }
}

onMounted(() => { stopAuth = $auth.onChange(load); load(); });
onBeforeUnmount(() => stopAuth?.());
</script>

<template>
  <div id="ivRoot" class="iv-root">
    <section class="hero"><div class="hero-head"><div><h1>{{ labels.title }}</h1><p class="intro">{{ labels.intro }}</p></div></div></section>
    <p v-if="loading" class="loading-block">{{ labels.loading }}</p>
    <div v-if="error" class="warn"><b>{{ labels.backendError }}</b> {{ error }}{{ labels.backendFallback }}</div>
    <div class="toolbar"><span class="sectioncount">{{ companies.length }} {{ companies.length === 1 ? labels.entry : labels.entries }}<span v-if="editable"> ({{ ownCount }} {{ labels.mine }} · {{ seedCount }} {{ labels.samples }})</span> · {{ questionCount }} {{ questionCount === 1 ? labels.question : labels.questions }} <span v-if="!editable" class="ro">· {{ labels.readOnly }}</span></span><div class="tb-actions"><button v-if="companies.length" class="btn-ghost" type="button" @click="toggleAll">{{ allOpen ? labels.collapseAll : labels.expandAll }}</button><button v-if="editable" id="ivAdd" class="btn-primary" type="button" @click="resetForm()">+ {{ labels.addCompany }}</button><span v-else class="hint">{{ $auth.enabled ? labels.signIn : labels.noBackend }}</span></div></div>

    <div v-if="!loading && !companies.length" class="page"><p>{{ labels.noEntries }}</p></div>

    <section v-for="group in groups" :key="group.id" class="iv-group" :aria-labelledby="`iv-group-${group.id}`">
      <header class="iv-group-head">
        <div>
          <p>{{ group.kicker }}</p>
          <h2 :id="`iv-group-${group.id}`">{{ group.title }}</h2>
          <span>{{ group.intro }}</span>
        </div>
        <b>{{ group.rows.length }}</b>
      </header>

      <article v-for="company in group.rows" :key="company.id" class="company" :class="{ 'is-seed': !company.own, 'is-open': isOpen(company) }">
        <button class="iv-co-head" type="button" :aria-expanded="isOpen(company)" :aria-controls="`iv-body-${company.id}`" @click="toggleCompany(company)">
          <span class="iv-co-text">
            <span class="iv-co-name">
              <b>{{ company.name }}</b>
              <span v-if="!company.own" class="seed-badge">{{ labels.sample }}</span>
              <span v-if="kindLabels[company.kind]" class="entry-kind">{{ kindLabels[company.kind] }}</span>
              <span v-if="company.result" class="result" :class="`result-${company.result}`">{{ resultLabels[company.result] || company.result }}</span>
            </span>
            <span class="iv-co-sub">
              <span v-for="part in [company.role, company.date].filter(Boolean)" :key="part">{{ part }}</span>
              <span v-if="roundCount(company)">{{ roundCount(company) }} {{ roundCount(company) === 1 ? labels.round_ : labels.rounds_ }}</span>
              <span v-if="(company.questions || []).length">{{ company.questions.length }} {{ company.questions.length === 1 ? labels.question : labels.questions }}</span>
              <span v-else>{{ labels.jdOnly }}</span>
            </span>
          </span>
          <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="9 6 15 12 9 18" /></svg>
        </button>

        <div v-show="isOpen(company)" :id="`iv-body-${company.id}`" class="iv-co-body">
          <div v-if="editable" class="co-actions">
            <template v-if="company.own">
              <button class="btn-ghost sm" type="button" @click="resetForm(company)">{{ labels.edit }}</button>
              <button class="btn-ghost sm danger" type="button" :disabled="busy === company.id" @click="remove(company)">{{ labels.remove }}</button>
            </template>
            <button v-else class="btn-ghost sm" type="button" :disabled="busy === company.id" @click="importSeed(company)">{{ busy === company.id ? labels.saving : labels.saveToJournal }}</button>
          </div>
          <div v-if="company.created_at || company.updated_at" class="content-dates iv-content-dates"><span v-if="company.created_at"><b>{{ labels.created }}</b><time :datetime="company.created_at">{{ company.created_at }}</time></span><span v-if="company.updated_at"><b>{{ labels.updated }}</b><time :datetime="company.updated_at">{{ company.updated_at }}</time></span></div>
          <a v-if="company.source?.url" class="iv-source" :href="safeExternalUrl(company.source.url)" target="_blank" rel="noopener noreferrer">{{ labels.source }}: {{ company.source.label || company.source.url }} ↗</a>
          <div class="tags"><span v-for="tag in company.stack || []" :key="tag" class="tag">{{ tag }}</span></div>

          <section v-if="company.brief || roundList(company).length" class="iv-brief">
            <h3>{{ labels.brief }}</h3>
            <div v-if="company.brief" v-html="safeMarkdown(company.brief)" />
            <ol v-if="roundList(company).length" class="iv-rounds">
              <li v-for="(round, index) in roundList(company)" :key="index">
                <b>{{ round.name || `${labels.round_} ${index + 1}` }}</b>
                <span v-if="round.note">{{ round.note }}</span>
              </li>
            </ol>
          </section>

          <details v-if="company.jd" class="iv-jd">
            <summary>{{ labels.jd }}</summary>
            <div v-html="safeMarkdown(company.jd)" />
          </details>

          <aside v-if="company.references?.length" class="iv-references"><strong>{{ labels.primaryReferences }}</strong><ul><li v-for="reference in company.references" :key="reference.url"><a :href="safeExternalUrl(reference.url)" target="_blank" rel="noopener noreferrer">{{ reference.label || reference.url }} ↗</a></li></ul></aside>
          <p v-if="!company.questions?.length" class="intro empty-q">{{ labels.noQuestions }}</p>
          <div v-for="(question, index) in company.questions || []" :key="questionKey(company, index)" class="qcard" :class="{ open: openQuestions.has(questionKey(company, index)) }">
            <button class="qhead" type="button" :aria-expanded="openQuestions.has(questionKey(company, index))" @click="toggleQuestion(questionKey(company, index))"><span class="qid">Q{{ index + 1 }}</span><span class="qtext">{{ question.q }}</span><span class="qmeta"><span v-if="question.round" class="qround">{{ question.round }}</span><span aria-hidden="true">›</span></span></button>
            <div class="qbody"><div class="qbody-inner"><div class="answer"><div><div class="ans-label">{{ company.kind ? labels.reviewedAnswer : labels.myAnswer }}</div><div v-html="safeMarkdown(question.a)" />
              <details v-if="question.diagrams?.length" class="iv-diagrams"><summary>{{ labels.diagramReview }} <span>{{ question.diagrams.length }}</span></summary><div class="iv-diagram-list"><article v-for="diagram in question.diagrams" :key="diagram.title" class="iv-diagram"><ContentMermaidDiagram :source="diagram.mermaid" :title="diagram.title || diagram.phase" :lang="lang" /><div v-if="diagram.flaws?.length || diagram.upgrades?.length" class="iv-diagram-review"><section v-if="diagram.flaws?.length"><h5>{{ labels.flaws }}</h5><ul><li v-for="row in diagram.flaws" :key="row">{{ row }}</li></ul></section><section v-if="diagram.upgrades?.length"><h5>{{ labels.upgrades }}</h5><ul><li v-for="row in diagram.upgrades" :key="row">{{ row }}</li></ul></section></div><details class="iv-diagram-source"><summary>{{ labels.mermaidSource }}</summary><pre><code>{{ diagram.mermaid }}</code></pre></details></article></div></details>
              <div v-if="question.note" class="takeaway"><b>{{ labels.takeaway }}:</b><div v-html="safeMarkdown(question.note)" /></div>
            </div></div></div></div>
          </div>
        </div>
      </article>
    </section>

    <p v-if="editable && seedCount" class="foot-note">{{ labels.sampleFoot }}</p>
    <dialog ref="dialog" class="modal"><form class="modal-form" @submit.prevent="save"><h3>{{ form.id ? labels.editCompany : labels.addCompanyTitle }}</h3><div class="fgrid"><label class="f"><span>{{ labels.companyName }}</span><input v-model="form.name" required></label><label class="f"><span>{{ labels.role }}</span><input v-model="form.role"></label><label class="f"><span>{{ labels.when }}</span><input v-model="form.date"></label><label class="f"><span>{{ labels.result }}</span><select v-model="form.result"><option v-for="(label, value) in resultLabels" :key="value" :value="value">{{ label }}</option></select></label></div><label class="f"><span>{{ labels.stack }}</span><input v-model="form.stack"></label><label class="f"><span>{{ labels.jd }}</span><textarea v-model="form.jd" rows="4" :placeholder="labels.jdPlaceholder" /></label><label class="f"><span>{{ labels.brief }}</span><textarea v-model="form.brief" rows="3" :placeholder="labels.briefPlaceholder" /></label><div class="qeditor"><div class="qeditor-head"><span>{{ labels.rounds }}</span><button class="btn-ghost sm" type="button" @click="addRound">+ {{ labels.addRound }}</button></div><div><div v-for="(round, index) in form.rounds" :key="`round-${index}`" class="qrow"><div class="qrow-head"><span class="qid">{{ index + 1 }}</span><input v-model="round.name" :placeholder="labels.roundName"><button class="btn-ghost sm danger" type="button" :aria-label="labels.removeRound" @click="removeRound(index)">✕</button></div><textarea v-model="round.note" rows="2" :placeholder="labels.roundNote" /></div></div></div><div class="qeditor"><div class="qeditor-head"><span>{{ labels.questionsTitle }}</span><button class="btn-ghost sm" type="button" @click="addQuestion">+ {{ labels.addQuestion }}</button></div><div><div v-for="(question, index) in form.questions" :key="index" class="qrow"><div class="qrow-head"><span class="qid">Q{{ index + 1 }}</span><input v-model="question.round" :placeholder="labels.round"><button class="btn-ghost sm danger" type="button" :aria-label="labels.removeQuestion" @click="removeQuestion(index)">✕</button></div><textarea v-model="question.q" rows="2" :placeholder="labels.asked" /><textarea v-model="question.a" rows="4" :placeholder="labels.answered" /><textarea v-model="question.note" rows="2" :placeholder="labels.improve" /></div></div></div><p v-if="formError" class="form-err">{{ formError }}</p><div class="modal-actions"><button class="btn-ghost" type="button" @click="dialog?.close()">{{ labels.cancel }}</button><button class="btn-primary" type="submit" :disabled="busy === 'save'">{{ busy === 'save' ? labels.saving : labels.save }}</button></div></form></dialog>
  </div>
</template>
