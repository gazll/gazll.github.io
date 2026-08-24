import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('navigation footer reports the stamped release and has no close button', async () => {
  const source = await readFile(new URL('../app/components/content/ContentHeader.vue', import.meta.url), 'utf8');
  assert.match(source, /new URL\('\/version\.json', window\.location\.origin\)/);
  assert.match(source, /deployed_at/);
  assert.match(source, /class="np-action np-foot-action"/);
  assert.match(source, /Last release/);
  assert.doesNotMatch(source, /class="np-foot-note"/);
  assert.match(source, /timeZone: 'Asia\/Bangkok', hour12: false/);
  assert.match(source, /releaseMetadata\.value\?\.revision\.slice\(0, 7\)/);
  assert.doesNotMatch(source, /class="np-close"/);
  assert.ok(source.indexOf("  { label: 'Experience'") < source.indexOf("{ to: '/english-study'"));

  const releasePage = await readFile(new URL('../app/pages/release-notes.vue', import.meta.url), 'utf8');
  assert.match(releasePage, /class="rn-filter-controls"/);
  assert.match(releasePage, /class="rn-day-releases"/);
});
