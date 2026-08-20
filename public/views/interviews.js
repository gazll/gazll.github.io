/* "Gazl Try" view — interview journal, editable in place.
   Own rows (Google Sheet) and the repo's seed entries render in one list;
   only own rows get Edit/Delete, seed entries get "Save to my journal" instead. */
import { Interviews } from '../lib/interviews.js';
import { Auth } from '../lib/auth.js';
import { Content } from '../lib/content.js';
import { escapeHtml as esc, renderUser, inlineUser } from '../lib/markdown.js';
import { chevSVG } from '../lib/ui.js';
import { loadingBlock } from '../lib/loading.js';
import { mountMermaidDiagrams } from '../lib/mermaid.js';
import { PROMPT_ORIGINS, REFERENCE_ORIGINS, originGuard } from '../lib/constants.js';
import { contentDateFacts } from '../lib/content-dates.js';

const RESULT = { pending: 'Pending', passed: 'Passed', offer: 'Offer', failed: 'Rejected' };
const ENTRY_KIND = {
  playbook: 'Learning playbook',
  'community-report': 'Community report'
};
// Only an own interview was actually answered by the reader; a playbook or a
// community report carries a reviewed answer, so the label must not claim it.
const ANSWER_LABEL = {
  playbook: 'Reviewed answer',
  'community-report': 'Reviewed answer'
};
const sourceHref = originGuard([PROMPT_ORIGINS, REFERENCE_ORIGINS]);

/** Hidden JSON payloads the form carries but never edits. Refusing a corrupt
    one keeps a save from quietly replacing it with an empty list. */
function parseHidden(raw, what) {
  try {
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return parsed;
  } catch {
    throw new Error('The ' + what + ' data on this entry could not be read, so saving would erase it. Reload the page and try again.');
  }
}

function sourceLabel(source) {
  if (source?.label) return source.label;
  try { return new URL(source?.url).hostname; }
  catch { return 'external source'; }
}

function interviewReferences(references = []) {
  const rows = Array.isArray(references)
    ? references.filter(reference => reference?.url && sourceHref(reference.url) !== '#')
    : [];
  if (!rows.length) return '';
  return '<aside class="iv-references"><strong>Primary references</strong><ul>'
    + rows.map(reference => '<li><a href="' + esc(sourceHref(reference.url))
      + '" target="_blank" rel="noopener noreferrer">' + esc(sourceLabel(reference)) + ' ↗</a></li>').join('')
    + '</ul></aside>';
}

function interviewDates(company) {
  const facts = contentDateFacts(company, Content.lang);
  if (!facts.length) return '';
  return '<div class="content-dates iv-content-dates">' + facts.map(fact => '<span><b>' + esc(fact.label)
    + '</b><time datetime="' + esc(fact.value) + '">' + esc(fact.formatted) + '</time></span>').join('') + '</div>';
}

function interviewDiagrams(diagrams = []) {
  const rows = Array.isArray(diagrams) ? diagrams.filter(row => row && typeof row === 'object') : [];
  if (!rows.length) return '';
  const cards = rows.map(diagram => {
    const flaws = (Array.isArray(diagram.flaws) ? diagram.flaws : [])
      .map(row => '<li>' + inlineUser(row) + '</li>').join('');
    const upgrades = (Array.isArray(diagram.upgrades) ? diagram.upgrades : [])
      .map(row => '<li>' + inlineUser(row) + '</li>').join('');
    return '<figure class="iv-diagram" data-diagram-frame><figcaption><span>' + esc(diagram.phase || 'Diagram review')
      + '</span><strong>' + esc(diagram.title || 'Untitled diagram') + '</strong></figcaption>'
      + '<div class="iv-diagram-viewport"><pre class="mermaid" data-mermaid-diagram>' + esc(diagram.mermaid || '') + '</pre></div>'
      + '<p class="iv-diagram-status" data-mermaid-status hidden>Diagram renderer unavailable; Mermaid source remains below.</p>'
      + ((flaws || upgrades) ? '<div class="iv-diagram-review">'
        + (flaws ? '<section><h5>Flaws</h5><ul>' + flaws + '</ul></section>' : '')
        + (upgrades ? '<section><h5>Upgrades</h5><ul>' + upgrades + '</ul></section>' : '') + '</div>' : '')
      + '<details class="iv-diagram-source"><summary>Mermaid source</summary><pre><code>' + esc(diagram.mermaid || '')
      + '</code></pre></details></figure>';
  }).join('');
  return '<details class="iv-diagrams"><summary>Diagram review &amp; upgraded design <span>'
    + rows.length + '</span></summary><div class="iv-diagram-list">' + cards + '</div></details>';
}

export function renderInterviews() {
  return '<div id="ivRoot" class="iv-root">' + loadingBlock('Loading the interview journal…') + '</div>';
}

export function mountInterviews(host) {
  const root = host.querySelector('#ivRoot');
  if (!root) return;

  const repaint = () => paint(root, repaint);
  Interviews.load().then(repaint);

  // Signing in or out while on this view switches the data source.
  const off = Auth.onChange(() => {
    if (!root.isConnected) { off(); return; }
    Interviews.load().then(repaint);
  });
}

/* ---------------------------------------------------------------------
   Render
--------------------------------------------------------------------- */

function paint(root, repaint) {
  const cos = Interviews.companies;
  const totalQ = cos.reduce((s, c) => s + (c.questions || []).length, 0);
  const editable = Interviews.editable;
  const nOwn = Interviews.ownCompanies.length;
  const nSeed = Interviews.seedCompanies.length;

  let html = '<section class="hero"><div class="hero-head"><div>'
    + '<h2>Gazl Try — interview journal</h2>'
    + '<p class="intro">Interview experiences · preparation playbooks · technically reviewed answers.</p>'
    + '</div></div></section>';

  if (Interviews.error) {
    html += '<div class="warn"><b>Could not read from the backend:</b> ' + esc(Interviews.error)
      + ' — showing the sample entries from <code>interviews.json</code> instead.</div>';
  }

  const breakdown = editable && nSeed
    ? ' (' + nOwn + ' mine · ' + nSeed + ' samples)'
    : '';

  html += '<div class="toolbar">'
    + '<span class="sectioncount">' + cos.length + (cos.length === 1 ? ' entry' : ' entries') + breakdown
    + ' · ' + totalQ + (totalQ === 1 ? ' question' : ' questions')
    + (editable ? '' : ' · <span class="ro">read-only</span>') + '</span>'
    + '<div class="tb-actions">'
    + (editable
      ? '<button class="btn-primary" id="ivAdd">+ Add company</button>'
      : '<span class="hint">' + (Auth.enabled
        ? 'Sign in with Google to add or edit entries and save them to your Sheet.'
        : 'No backend configured — see the README to turn on storage.') + '</span>')
    + '</div></div>';

  if (!cos.length) {
    html += '<div class="page"><p>' + (editable
      ? 'No companies yet. Hit <b>+ Add company</b> to start.'
      : 'Nothing here yet.') + '</p></div>';
  }

  for (const c of cos) html += companyCard(c, editable);
  if (editable && nSeed) {
    html += '<p class="foot-note">Entries marked <b>Sample</b> come from <code>interviews.json</code> in the repo — '
      + 'everyone sees them and nobody can edit them. Hit <b>Save to my journal</b> to copy one into your own '
      + 'journal, where it is yours to edit.</p>';
  }
  html += formDialog();

  root.innerHTML = html;
  wire(root, repaint);
}

function companyCard(c, editable) {
  const res = c.result
    ? '<span class="result result-' + esc(c.result) + '">' + (RESULT[c.result] || esc(c.result)) + '</span>'
    : '';
  const meta = [c.role, c.date].filter(Boolean).map(esc).join(' · ');
  const stack = (c.stack || []).map(t => '<span class="tag">' + esc(t) + '</span>').join('');

  // Seed rows live in the repo, not the Sheet: importing is the only write.
  const seedBadge = c.own ? '' : '<span class="seed-badge">Sample</span>';
  const kindBadge = ENTRY_KIND[c.kind]
    ? '<span class="entry-kind">' + ENTRY_KIND[c.kind] + '</span>'
    : '';
  const answerLabel = ANSWER_LABEL[c.kind] || 'How I answered';
  const source = c.source?.url
    ? '<a class="iv-source" href="' + esc(sourceHref(c.source.url))
      + '" target="_blank" rel="noopener noreferrer">Source: '
      + esc(sourceLabel(c.source)) + ' ↗</a>'
    : '';
  let actions = '';
  if (editable && c.own) {
    actions = '<div class="co-actions">'
      + '<button class="btn-ghost sm" data-edit="' + esc(c.id) + '">Edit</button>'
      + '<button class="btn-ghost sm danger" data-del="' + esc(c.id) + '">Delete</button></div>';
  } else if (editable) {
    actions = '<div class="co-actions">'
      + '<button class="btn-ghost sm" data-import="' + esc(c.id) + '">Save to my journal</button></div>';
  }

  const qs = (c.questions || []).map((it, idx) => {
    const round = it.round ? '<span class="qround">' + esc(it.round) + '</span>' : '';
    const note = it.note ? '<div class="takeaway"><b>Takeaway:</b> ' + inlineUser(it.note) + '</div>' : '';
    return '<div class="qcard"><button class="qhead" aria-expanded="false">'
      + '<span class="qid">Q' + (idx + 1) + '</span>'
      + '<span class="qtext">' + inlineUser(it.q) + '</span>'
      + '<span class="qmeta">' + round + chevSVG + '</span></button>'
      + '<div class="qbody"><div class="qbody-inner"><div class="answer"><div>'
      + '<div class="ans-label">' + answerLabel + '</div>' + renderUser(it.a) + interviewDiagrams(it.diagrams) + note
      + '</div></div></div></div></div>';
  }).join('');

  return '<div class="company' + (c.own ? '' : ' is-seed') + '">'
    + '<div class="company-head"><h3>' + esc(c.name) + '</h3>'
    + seedBadge + kindBadge + res + actions + '</div>'
    + (meta ? '<div class="company-meta">' + meta + '</div>' : '')
    + interviewDates(c)
    + source
    + (stack ? '<div class="tags">' + stack + '</div>' : '')
    + interviewReferences(c.references)
    + (qs || '<p class="intro empty-q">No questions recorded yet.</p>')
    + '</div>';
}

/* Add/edit form. <dialog> gives the overlay, focus trap and Esc for free. */

function formDialog() {
  return '<dialog class="modal" id="ivDialog">'
    + '<form id="ivForm" class="modal-form">'
    + '<h3 id="ivTitle">Add company</h3>'
    + '<input type="hidden" name="id">'
    + '<textarea name="references" hidden></textarea>'
    + '<div class="fgrid">'
    + field('name', 'Company name *', 'text', 'e.g. Grab', true)
    + field('role', 'Role', 'text', 'e.g. Senior Backend Engineer')
    + field('date', 'When', 'text', 'e.g. 2026-06')
    + '<label class="f"><span>Result</span><select name="result">'
    + Object.entries(RESULT).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('')
    + '</select></label>'
    + '</div>'
    + field('stack', 'Stack (comma separated)', 'text', 'Java, Spring Boot, PostgreSQL')
    + '<div class="qeditor">'
    + '<div class="qeditor-head"><span>Questions</span>'
    + '<button type="button" class="btn-ghost sm" id="ivAddQ">+ Add question</button></div>'
    + '<div id="ivQList"></div>'
    + '</div>'
    + '<p class="form-err" id="ivErr" hidden></p>'
    + '<div class="modal-actions">'
    + '<button type="button" class="btn-ghost" id="ivCancel">Cancel</button>'
    + '<button type="submit" class="btn-primary" id="ivSave">Save</button>'
    + '</div></form></dialog>';
}

function field(name, label, type, placeholder, required) {
  return '<label class="f"><span>' + label + '</span>'
    + '<input type="' + type + '" name="' + name + '" placeholder="' + esc(placeholder || '') + '"'
    + (required ? ' required' : '') + '></label>';
}

/** One question block; the answer and note fields accept markdown. */
function questionRow(q = {}, idx = 0) {
  const diagrams = JSON.stringify(q.diagrams || []);
  return '<div class="qrow" data-qrow>'
    + '<div class="qrow-head"><span class="qid">Q' + (idx + 1) + '</span>'
    + '<input type="text" data-f="round" placeholder="Round (e.g. Round 1 · Technical)" value="' + esc(q.round || '') + '">'
    + '<button type="button" class="btn-ghost sm danger" data-rmq aria-label="Remove question">✕</button></div>'
    + '<textarea data-f="q" rows="2" placeholder="What they asked *">' + esc(q.q || '') + '</textarea>'
    + '<textarea data-f="a" rows="4" placeholder="How I answered (**bold**, `code` and - lists work here)">' + esc(q.a || '') + '</textarea>'
    + '<textarea data-f="note" rows="2" placeholder="Takeaway / what to do differently">' + esc(q.note || '') + '</textarea>'
    + '<textarea data-f="diagrams" hidden>' + esc(diagrams) + '</textarea>'
    + '</div>';
}

/* ---------------------------------------------------------------------
   Wiring
--------------------------------------------------------------------- */

function wire(root, repaint) {
  root.querySelectorAll('.company .qcard').forEach(card => {
    const head = card.querySelector('.qhead');
    head.addEventListener('click', () => {
      const open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open);
    });
  });

  root.querySelectorAll('.iv-diagrams').forEach(group => group.addEventListener('toggle', () => {
    if (!group.open || group.dataset.mermaidMounted) return;
    group.dataset.mermaidMounted = 'true';
    requestAnimationFrame(async () => {
      const rendered = await mountMermaidDiagrams(group);
      if (!rendered) delete group.dataset.mermaidMounted;
    });
  }));

  const dlg = root.querySelector('#ivDialog');
  const form = root.querySelector('#ivForm');
  const qlist = root.querySelector('#ivQList');
  const errEl = root.querySelector('#ivErr');
  if (!dlg || !form) return;

  const renumber = () => {
    qlist.querySelectorAll('[data-qrow]').forEach((r, i) => {
      r.querySelector('.qid').textContent = 'Q' + (i + 1);
    });
  };
  const addQ = (q) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = questionRow(q, qlist.children.length);
    qlist.appendChild(wrap.firstElementChild);
    renumber();
  };

  const open = (company) => {
    form.reset();
    errEl.hidden = true;
    root.querySelector('#ivTitle').textContent = company ? 'Edit company' : 'Add company';
    form.id.value = company?.id || '';
    form.name.value = company?.name || '';
    form.role.value = company?.role || '';
    form.date.value = company?.date || '';
    form.result.value = company?.result || 'pending';
    form.stack.value = (company?.stack || []).join(', ');
    form.references.value = JSON.stringify(company?.references || []);
    qlist.innerHTML = '';
    (company?.questions || []).forEach(q => addQ(q));
    if (!qlist.children.length) addQ();
    dlg.showModal();
  };

  root.querySelector('#ivAdd')?.addEventListener('click', () => open(null));
  root.querySelectorAll('[data-edit]').forEach(b =>
    b.addEventListener('click', () => open(Interviews.find(b.dataset.edit))));

  root.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const c = Interviews.find(b.dataset.del);
    if (!c || !confirm('Delete "' + c.name + '" and every question under it?')) return;
    b.disabled = true;
    try { await Interviews.remove(c.id); repaint(); }
    catch (e) { alert('Could not delete: ' + (e.message || e)); b.disabled = false; }
  }));

  root.querySelectorAll('[data-import]').forEach(b => b.addEventListener('click', async () => {
    const c = Interviews.find(b.dataset.import);
    if (!c) return;
    b.disabled = true;
    b.textContent = 'Saving…';
    try {
      await Interviews.importSeed(c.id);
      repaint();          // the copy is now an own row; the seed card drops out
    } catch (e) {
      alert('Could not save: ' + (e.message || e));
      b.disabled = false;
      b.textContent = 'Save to my journal';
    }
  }));

  root.querySelector('#ivAddQ').addEventListener('click', () => addQ());
  qlist.addEventListener('click', e => {
    if (!e.target.closest('[data-rmq]')) return;
    e.target.closest('[data-qrow]').remove();
    renumber();
  });

  root.querySelector('#ivCancel').addEventListener('click', () => dlg.close());

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const save = root.querySelector('#ivSave');

    let questions, references;
    try {
      questions = [...qlist.querySelectorAll('[data-qrow]')].map(r => {
        const get = f => r.querySelector('[data-f="' + f + '"]').value.trim();
        return {
          round: get('round'), q: get('q'), a: get('a'), note: get('note'),
          diagrams: parseHidden(get('diagrams'), 'diagram')
        };
      }).filter(q => q.q);      // drop empty blocks so the Sheet stays clean
      references = parseHidden(form.references.value, 'reference');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      return;
    }

    const company = {
      id: form.id.value || undefined,
      name: form.name.value.trim(),
      role: form.role.value.trim(),
      date: form.date.value.trim(),
      result: form.result.value,
      stack: form.stack.value.split(',').map(s => s.trim()).filter(Boolean),
      references,
      questions
    };

    save.disabled = true;
    save.textContent = 'Saving…';
    try {
      await Interviews.save(company);
      dlg.close();
      repaint();
    } catch (err) {
      errEl.textContent = err.message || String(err);
      errEl.hidden = false;
    } finally {
      save.disabled = false;
      save.textContent = 'Save';
    }
  });
}
