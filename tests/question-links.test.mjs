import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');

async function loadHelpers() {
  const source = await readFile(path.join(root, 'public/lib/question-links.js'), 'utf8');
  const context = vm.createContext({ URL, encodeURIComponent, decodeURIComponent });
  const mod = new vm.SourceTextModule(source, { context, identifier: 'question-links.js' });
  await mod.link(() => { throw new Error('question-links.js must stay dependency-free'); });
  await mod.evaluate();
  return mod.namespace;
}

test('a question id becomes a shareable absolute track URL and decodes again', async () => {
  const links = await loadHelpers();
  const id = '03-spring-boot-deep-build.ioc-container-transactions.q6';
  const url = links.questionUrl('https://gazll.github.io/#/stats', id);

  assert.equal(url, 'https://gazll.github.io/#/track/' + id + '?lang=en');
  const routeParts = new URL(url).hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean).slice(1);
  assert.equal(links.questionIdFromRoute(routeParts), id);
  assert.equal(links.questionIdFromRoute([]), null);
  assert.equal(links.questionIdFromRoute(['broken%ZZ']), null);
});

test('a moved question gets a canonical System Design URL', async () => {
  const links = await loadHelpers();
  const id = '11-system-design-cases.the-big-prompts.q1';
  const url = links.systemDesignQuestionUrl('https://gazll.github.io/#/track', 'payment-ledger', id);

  assert.equal(url, 'https://gazll.github.io/#/system-design/payment-ledger/' + id + '?lang=en');
  assert.equal(links.systemDesignQuestionHash('payment-ledger', id), '#/system-design/payment-ledger/' + id + '?lang=en');
});

test('the immutable full id distinguishes repeated Q6 labels across sections', async () => {
  const links = await loadHelpers();
  const topic = JSON.parse(await readFile(
    path.join(root, 'public/data/topics/03-spring-boot-deep-build.json'), 'utf8'));
  const firstQ6 = topic.sections[0].items.find(item => item.id.endsWith('.q6'));
  const secondQ6 = topic.sections[1].items.find(item => item.id.endsWith('.q6'));

  assert.ok(firstQ6 && secondQ6, 'topic 3 intentionally has Q6 in more than one section');
  assert.notEqual(firstQ6.id, secondQ6.id);
  const found = links.findQuestion([topic], secondQ6.id);
  assert.equal(found.topicIndex, 0);
  assert.equal(found.section.title, topic.sections[1].title);
  assert.equal(found.item.id, secondQ6.id);
});

test('the track renders and wires one copy-link control per question', async () => {
  const app = await readFile(path.join(root, 'public/app.js'), 'utf8');
  const styles = await readFile(path.join(root, 'public/styles.css'), 'utf8');

  assert.match(app, /data-copy-qid=/);
  assert.match(app, /<button class="qcopy" type="button"/);
  assert.match(app, /<button class="langswitch qlangbtn" type="button" role="switch"/);
  assert.doesNotMatch(app, /<span class="qcopy" role="button"/);
  assert.match(app, /<div class="qtop"><button class="qhead"/);
  assert.match(app, /showLinkedQuestion\(routeParts\)/);
  assert.match(app, /scrollIntoView\(\{ block: 'start'/);
  assert.match(app, /scrollToAnchor\(host, anchor, \{ behavior: 'auto' \}\)/,
    'a copied heading URL must scroll the rendered view, not only Study Track cards');
  assert.match(app, /mountResult\.then\(\(\) => requestAnimationFrame\(settleAnchor\)/,
    'async views must retry the anchor after their body finishes loading');
  assert.match(styles, /\.qcard\.link-target/);
  assert.match(styles, /scroll-margin-top/);
});
