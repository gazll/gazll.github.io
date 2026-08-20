import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tool = path.join(root, 'tools', 'add-content.mjs');
const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;

function runTool(patchPath, directory) {
  const outputPath = path.join(directory, 'output.log');
  const output = openSync(outputPath, 'w');
  const result = spawnSync(process.execPath, [tool, patchPath, '--dry-run'], {
    cwd: root,
    env: childEnv,
    stdio: ['ignore', output, output]
  });
  closeSync(output);
  return { ...result, output: readFileSync(outputPath, 'utf8') };
}

test('content patch tool can replace a whole answer and question in dry-run mode', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'content-patch-'));
  const patchPath = path.join(dir, 'replace.patch');
  await writeFile(patchPath, [
    '@@ answer 01-java-core-jvm.concurrency.q1 en',
    'Replacement answer used only in memory.',
    '',
    '@@ question 01-java-core-jvm.concurrency.q1 vi',
    'Câu hỏi thay thế chỉ dùng trong bộ nhớ.',
    ''
  ].join('\n'), 'utf8');

  try {
    const result = runTool(patchPath, dir);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /mode=answer/);
    assert.match(result.output, /mode=question/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('content patch tool can append a bilingual item in dry-run mode', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'content-item-patch-'));
  const patchPath = path.join(dir, 'item.patch');
  const id = '03-spring-boot-deep-build.auto-configuration-build.q99';
  await writeFile(patchPath, [
    `@@ item ${id} en extra`,
    '? Which baseline should a new Spring application target?',
    'Target a supported generation and record the compatibility matrix.',
    '',
    `@@ item ${id} vi extra`,
    '? Ứng dụng Spring mới nên chọn baseline nào?',
    'Chọn một thế hệ còn được hỗ trợ và ghi lại compatibility matrix.',
    ''
  ].join('\n'), 'utf8');

  try {
    const result = runTool(patchPath, dir);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /mode=item/);
    assert.match(result.output, /2 would apply/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('content patch tool can replace one exact answer fragment in dry-run mode', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'content-fragment-patch-'));
  const patchPath = path.join(dir, 'fragment.patch');
  const topic = JSON.parse(await readFile(
    path.join(root, 'public', 'data', 'topics', '01-java-core-jvm.json'),
    'utf8'
  ));
  const item = topic.sections
    .flatMap(section => section.items)
    .find(candidate => candidate.id === '01-java-core-jvm.memory-execution-model.q1');
  const currentFirstLine = item.a.split('\n')[0];
  await writeFile(patchPath, [
    '@@ replace 01-java-core-jvm.memory-execution-model.q1 en',
    currentFirstLine,
    '=>',
    `${currentFirstLine} [dry-run replacement]`,
    ''
  ].join('\n'), 'utf8');

  try {
    const result = runTool(patchPath, dir);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /mode=replace/);
    assert.match(result.output, /1 would apply/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
