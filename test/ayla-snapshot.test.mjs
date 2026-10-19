import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root = await mkdtemp(join(tmpdir(), 'ayla-snapshot-'));
process.env.PI_WEB_ACCESS_CACHE_ROOT = root;
const storage = await import('../storage.ts');
const { documentView, renderDocument } = await import('../document-view.ts');
after(async () => { storage.clearResults(); await rm(root, { recursive: true, force: true }); });

test('snapshot retention survives freshness TTL, restore and bounded eviction', () => {
  const now = Date.now;
  const data = { id: 'snapshot946', type: 'fetch', timestamp: now(), snapshotVersion: 1, urls: [{ url: 'https://example.com', title: 'Snapshot', content: 'old immutable body', error: null }] };
  const metadata = storage.storeFetchedContentResult(data.id, data);
  assert.equal(metadata.urls, undefined, 'no duplicate body in journal');
  try {
    Date.now = () => now() + 3600001;
    assert.equal(storage.getResult(data.id).urls[0].content, 'old immutable body');
    storage.clearResults();
    storage.loadSessionResults({ sessionManager: { getBranch: () => [{ type: 'custom', customType: 'web-search-results', data: metadata }] } });
    assert.equal(storage.getResult(data.id).urls[0].content, 'old immutable body');
    storage.storeFetchedContentResult('snapshot947', { ...data, id: 'snapshot947', timestamp: Date.now() });
    storage.pruneExpiredFetchCache(Date.now(), { maxEntries: 1, maxBytes: 128 * 1024 * 1024 });
    const evicted = storage.getResult(data.id).urls[0];
    assert.equal(evicted.content, '');
    assert.match(evicted.error, /evicted/);
  } finally { Date.now = now; }
});
test('document lines preserve exact offsets, Unicode and giant-line continuation', () => {
  const content = 'Русский 😀\n' + 'x'.repeat(9000) + 'TARGET946\nlast';
  const page = { url: 'https://example.com', title: 'Fixture', content, error: null };
  const found = documentView(page, 'id946', 0, 1, { findText: 'TARGET946', limit: 500 });
  assert.equal(found.matches, 1);
  assert.equal(found.lines[0].number, 2);
  assert.match(found.lines[0].text, /TARGET946/);
  for (const line of found.lines) assert.equal(content.slice(line.start, line.end), line.text);
  const first = documentView(page, 'id946', 0, 1, { limit: 400 });
  assert.equal(first.outputTruncated, true);
  const next = documentView(page, 'id946', 0, 1, { offset: first.nextOffset, limit: 400 });
  assert.equal(next.lines[0].start, first.nextOffset);
  assert.throws(() => documentView(page, 'id946', 0, 1, { lineno: 0 }), /lineno/);
  const emoji = documentView({ ...page, content: '😀tail' }, 'emoji946', 0, 1, { limit: 1 });
  assert.equal(emoji.lines[0].text, '😀');
  assert.equal(emoji.nextOffset, 2);
});
test('find cursors advance across all matching rows with exact source ranges', () => {
  const content = Array.from({ length: 150 }, (_, i) => `TARGET row ${i}`).join('\n');
  const page = { url: 'https://example.com', title: '', content, error: null };
  let offset = 0, rows = [];
  do {
    const view = documentView(page, 'cursor', 0, 1, { findText: 'TARGET', offset, limit: 30000 });
    for (const line of view.lines) {
      assert.ok(line.start >= offset && line.end >= line.start);
      assert.equal(content.slice(line.start, line.end), line.text);
      rows.push(line.number);
    }
    if (view.nextOffset === null) break;
    assert.ok(view.nextOffset > offset); offset = view.nextOffset;
  } while (true);
  assert.deepEqual(rows, Array.from({ length: 150 }, (_, i) => i + 1));
  const same = documentView({ ...page, content: 'TARGET '.repeat(101) }, 'cursor', 0, 1, { findText: 'TARGET', limit: 30000 });
  assert.equal(same.matches, 101); assert.equal(same.outputTruncated, false);
  const multiple = documentView({ ...page, content: 'top\nbottom' }, 'cursor', 0, 1, { findText: ['bottom', 'top'] });
  assert.deepEqual(multiple.lines.map(line => line.number), [1, 2]);
});
test('case-insensitive find offsets remain in the original Unicode source', () => {
  const content = 'İ'.repeat(300) + '\nTARGET';
  const view = documentView({ url: 'https://example.com', title: '', content, error: null }, 'casefold', 0, 1, { findText: 'target' });
  assert.equal(view.lines[0].text, 'TARGET');
  assert.equal(view.lines[0].start, 301); assert.equal(view.lines[0].end, 307);
});
test('rendered output reconstructs giant Unicode lines without gaps or guessed cursors', () => {
  const content = 'Русский 😀'.repeat(3000);
  const page = { url: 'https://example.com', title: 'Long', content, error: null, links: [{ id: 1, text: 'Long URL', url: 'https://example.com/' + 'x'.repeat(4000) }] };
  let offset = 0, recovered = '';
  do {
    const { view, text } = renderDocument(documentView(page, 'rendered', 0, 1, { offset, limit: 6000 }), 1500);
    assert.ok(text.length <= 1500);
    for (const line of view.lines) { assert.equal(line.start, offset); assert.equal(content.slice(line.start, line.end), line.text); recovered += line.text; offset = line.end; }
    if (!view.outputTruncated) break;
    assert.equal(view.nextOffset, offset);
    assert.match(text, new RegExp('offset ' + offset + '\\.'));
  } while (offset < content.length);
  assert.equal(recovered, content);
});
