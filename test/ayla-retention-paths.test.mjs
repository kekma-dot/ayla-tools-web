import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const root = await mkdtemp(join(tmpdir(), 'ayla-retention-paths-'));
process.env.PI_CODING_AGENT_DIR = root; process.env.PI_WEB_ACCESS_CACHE_ROOT = root;
await writeFile(join(root, 'web-search.json'), JSON.stringify({ provider: 'exa', documentSnapshots: true, fetchRouting: { providers: ['http'] }, proxy: '' }));
const { default: initialize } = await import('../index.ts');
const storage = await import('../storage.ts');
const { createWebToolCore, DEFAULT_TOOL_NAMES, resolveFetchModeConfig } = await import('../web-tool-core.ts');
const nativeFetch = globalThis.fetch, nativeNow = Date.now;
after(async () => { globalThis.fetch = nativeFetch; Date.now = nativeNow; storage.clearResults(); await rm(root, { recursive: true, force: true }); });
const url = 'https://93.184.216.34/retained';
const page = { url, title: 'Fixture', content: 'RETAINED_946', error: null };
test('inline includeContent snapshots retain bodies after freshness expiry', () => {
  const core = createWebToolCore({ settings: { toolNames: DEFAULT_TOOL_NAMES, enabledTools: { webSearch: true, sourceCheck: true, fetchContent: true, getSearchContent: true }, maxInlineContentChars: 30000, fetchModes: resolveFetchModeConfig({}) }, storeFetchedContent: (id, data) => storage.storeFetchedContentResult(id, data) });
  const result = core.buildSearchReturn({ queryList: ['q'], results: [{ query: 'q', answer: '', error: null, results: [{ title: 'Fixture', url, snippet: '' }] }], urls: [url], inlineContent: [page], includeContent: true });
  const id = result.details.fetchId;
  try { Date.now = () => nativeNow() + 3600001; assert.equal(storage.getResult(id).snapshotVersion, 1); assert.equal(storage.getResult(id).urls[0].content, page.content); }
  finally { Date.now = nativeNow; }
});
test('background includeContent uses the same retained snapshot policy', { timeout: 10000 }, async () => {
  let completed; const ready = new Promise(resolve => { completed = resolve; });
  const tools = new Map(), handlers = new Map(), entries = [];
  initialize({ registerTool(t) { tools.set(t.name, t); }, registerCommand() {}, registerShortcut() {}, on(name, fn) { handlers.set(name, [...(handlers.get(name) ?? []), fn]); }, appendEntry(customType, data) { entries.push({ type: 'custom', customType, data }); }, sendMessage(message) { if (message.customType === 'web-search-content-ready') completed(); } });
  const ctx = { hasUI: false, sessionManager: { getBranch: () => entries }, ui: { setWidget() {}, notify() {} }, modelRegistry: { getAvailable() { return []; }, find() {} }, isProjectTrusted() { return true; } };
  globalThis.fetch = async input => {
    if (String(input).startsWith('https://mcp.exa.ai/')) return Response.json({ result: { content: [{ type: 'text', text: JSON.stringify({ results: [{ title: 'Fixture', url }] }) }] } });
    assert.equal(String(input), url); return new Response(page.content, { headers: { 'content-type': 'text/plain' } });
  };
  const emit = async name => { for (const fn of handlers.get(name) ?? []) await fn({ type: name }, ctx); };
  await emit('session_start');
  try {
    const result = await tools.get('web_search').execute('background', { query: 'fixture', provider: 'exa', includeContent: true, workflow: 'none' }, undefined, undefined, ctx);
    await ready;
    const id = result.details.fetchId; assert.ok(id);
    Date.now = () => nativeNow() + 3600001;
    assert.equal(storage.getResult(id).snapshotVersion, 1);
    assert.equal(storage.getResult(id).urls[0].content, page.content);
    assert.ok(entries.some(e => e.data.id === id && e.data.snapshotVersion === 1));
  } finally { Date.now = nativeNow; await emit('session_shutdown'); }
});
