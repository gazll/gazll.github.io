/* The two rules the interview journal is built on, as pure functions.

   The journal shows two lists as one: the reader's own rows from the Google
   Sheet (writable, signed in only) and the repo's interviews.json (read-only,
   always available). Signed out that leaves only the seed; signed in the seed
   stays visible underneath as reference, so shared entries do not vanish the
   moment someone logs in. The seed is also the fallback when the backend is
   down.

   `own` is what tells the two apart everywhere else — only own rows can be
   edited or deleted, because only they exist in the Sheet.

   These live here rather than inside the view because they are the invariant,
   not the rendering: the component owns the I/O (through the Nuxt plugin) and
   calls into this for the rules, and the tests drive the same functions the
   component does. They were duplicated once already — a data-layer module that
   nothing rendered, tested green while the view reimplemented the merge
   slightly differently. */

const norm = value => String(value || '').trim().toLowerCase();

/** Sheet ids are UUIDs, so the 'seed-' prefix can never collide with one —
    which is what lets both lists share a single id space in the view. */
export function seedRows(companies) {
  return (companies || []).map((company, index) => ({ ...company, id: `seed-${index}`, own: false }));
}

/** Own rows first, then the seed entries the reader has not already imported. */
export function mergeJournal(own, seed) {
  const mine = (own || []).map(company => ({ ...company, own: true }));
  const taken = new Set(mine.map(company => norm(company.name)));
  return mine.concat((seed || []).filter(company => !taken.has(norm(company.name))));
}

/**
 * A seed entry as a new own row.
 *
 * Every id is dropped, so the backend creates rows rather than editing the
 * seed. Attribution rides on the first question only: repeating the source URL
 * on every row would bury the reader's own takeaways under one link.
 */
export function seedImport(company, sourceLabel = 'Source') {
  const sourceNote = company.source?.url
    ? `${sourceLabel}: ${company.source.label || company.source.url} — ${company.source.url}`
    : '';
  return {
    name: company.name,
    role: company.role,
    date: company.date,
    result: company.result,
    stack: company.stack || [],
    jd: company.jd || '',
    brief: company.brief || '',
    rounds: (company.rounds || []).map(round => ({ ...round })),
    references: (company.references || []).map(reference => ({ ...reference })),
    questions: (company.questions || []).map((question, index) => ({
      round: question.round,
      q: question.q,
      a: question.a,
      note: [question.note, index === 0 ? sourceNote : ''].filter(Boolean).join('\n\n'),
      diagrams: (question.diagrams || []).map(diagram => ({
        ...diagram,
        flaws: [...(diagram.flaws || [])],
        upgrades: [...(diagram.upgrades || [])]
      }))
    }))
  };
}
