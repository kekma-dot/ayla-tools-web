import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'ayla-document-regression-'));
process.env.PI_CODING_AGENT_DIR = root;
process.env.PI_WEB_ACCESS_CACHE_ROOT = root;
await writeFile(join(root, 'web-search.json'), JSON.stringify({ fetchRouting: { providers: ['http'] } }));
const { buildPassages } = await import('../source-check.ts');
const { extractContent } = await import('../extract.ts');
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; await rm(root, { recursive: true, force: true }); });
const url = 'https://example.com/docs/start';
const source = [{ rank: 1, url, title: 'Fixture', quality: 'unknown' }];
for (const [hint, text] of [
  ['Русский документ', 'Русский документ содержит точное описание изменения.'],
  ['API', 'This API ' + 'has documented configuration options '.repeat(40) + '.'],
]) test('passage remains reachable: ' + hint, () => {
  const passages = buildPassages(source, [{ url, title: 'Fixture', content: text, error: null }], hint);
  assert.ok(passages.length > 0);
  for (const p of passages) assert.equal(text.slice(p.extraction_span.start, p.extraction_span.end), p.text);
});
test('an unrelated English snippet does not replace the Russian claim hint', () => {
  const content = 'Русский документ содержит описание изменения.';
  const passages = buildPassages([{ ...source[0], snippet: 'English preview' }], [{ url, title: '', content, error: null }], 'Русский документ');
  assert.ok(passages.some(p => p.extraction_span && p.text.includes('Русский')));
});
const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
test('short HTML remains readable with an explicit partial warning', async () => {
  globalThis.fetch = async () => new Response('<html><title>Release</title><body><main><p>A valid short release note.</p></main></body></html>', { headers: { 'content-type': 'text/html' } });
  const r = await extractContent(url, undefined, { lookup });
  assert.equal(r.error, null);
  assert.match(r.content, /A valid short release note/);
  assert.equal(r.extractionStatus, 'partial');
  assert.ok(r.warnings.length);
});
test('a Markdown loading shell is not a read document', async () => {
  globalThis.fetch = async () => new Response('Loading...', { headers: { 'content-type': 'text/markdown' } });
  const r = await extractContent(url, undefined, { lookup });
  assert.ok(r.error);
  assert.match(r.error, /loading placeholder/);
});
test('a shell with a declared link is links_only, not a read page', async () => {
  globalThis.fetch = async () => new Response('<html><head><link rel="service-doc" href="/docs"></head><body><div id="root"></div><script src="/app.js"></script></body></html>', { headers: { 'content-type': 'text/html' } });
  const r = await extractContent(url, undefined, { lookup });
  assert.equal(r.extractionStatus, 'links_only');
  assert.ok(r.warnings.length);
});
test('Markdown reference links are indexed without reading code as navigation', async () => {
  globalThis.fetch = async () => new Response('# Docs\n\n' + 'Documented content. '.repeat(35) + '\n\n[Next][next]\n\n[next]: ../next\n\n```\n[Not a link](https://example.com/fake)\n```', { headers: { 'content-type': 'text/markdown' } });
  const r = await extractContent(url, undefined, { lookup });
  assert.equal(r.links.length, 1);
  assert.equal(r.links[0].url, 'https://example.com/next');
});
test('cancelled fetch cannot publish a late snapshot', async () => {
  const { createStandaloneWebToolCore } = await import('../web-tool-core.ts');
  const { clearResults, getAllResults } = await import('../storage.ts');
  clearResults();
  const controller = new AbortController();
  globalThis.fetch = async () => { controller.abort(); return new Response('late body', { headers: { 'content-type': 'text/plain' } }); };
  const result = await createStandaloneWebToolCore().fetchContent({ url: 'https://93.184.216.34/late' }, controller.signal);
  assert.equal(result.isError, true);
  assert.match(result.details.error, /Aborted/);
  assert.equal(getAllResults().length, 0);
});
test('raw HTTP failure keeps diagnostic body and failure status', async () => {
  globalThis.fetch = async () => new Response('missing body', { status: 404, headers: { 'content-type': 'text/plain' } });
  const r = await extractContent(url, undefined, { lookup, mode: 'raw' });
  assert.equal(r.status, 404);
  assert.match(r.error, /HTTP 404/);
  assert.equal(r.content, 'missing body');
});
