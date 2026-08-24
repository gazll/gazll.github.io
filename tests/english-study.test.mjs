import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseEnglishStudyPlan } from '../app/utils/english-study.js';

test('English Study keeps the complete plan as 85 collapsible top-level notes', async () => {
  const markdown = await readFile(new URL('../docs/english-speaking-os-complete-2026.md', import.meta.url), 'utf8');
  const plan = parseEnglishStudyPlan(markdown);
  assert.equal(plan.title, 'English Speaking OS 2026');
  assert.equal(plan.sections.length, 85);
  assert.equal(plan.sections[0].title, '1. Mục tiêu thực tế');
  assert.equal(plan.sections.at(-1).title, '85. Changelog — v2.0');
  assert.match(plan.sections.find(section => section.title.startsWith('26.'))?.markdown || '', /# English Learning Ledger/);
  assert.doesNotMatch(plan.sections.map(section => section.title).join('\n'), /English Learning Ledger/);
});

test('the navigation keeps menu titles in English and localizes only descriptions', async () => {
  const source = await readFile(new URL('../app/components/content/ContentHeader.vue', import.meta.url), 'utf8');
  assert.match(source, /<h2 class="nv-sectitle">\{\{ group\.label \}\}<\/h2>/);
  assert.match(source, /<span class="nv-label">\{\{ link\.label \}\}<\/span><span class="nv-desc">\{\{ localize\(link\.desc\) \}\}<\/span>/);
  assert.match(source, /label: 'English Study'/);
});
