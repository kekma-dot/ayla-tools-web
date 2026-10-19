import assert from 'node:assert/strict';
import { test } from 'node:test';
import { documentView, renderDocument } from '../document-view.ts';
const content = [
  '## Events', '',
  '[TOC](#class-eventtarget)', '',
  '```md', '## Fake[#](#class-eventtarget)', '```', '',
  '## Wrong origin[#](https://other.example/events#class-eventtarget)', '',
  '## Class: `EventTarget`[#](#class-eventtarget)', '', 'Actual section body.', '',
  '## Кириллица[¶](#%D1%82%D0%B5%D1%81%D1%82)', '', 'Unicode section.'
].join('\n');
const page = { url: 'https://example.com/events#class-eventtarget', finalUrl: 'https://example.com/events', title: 'Events', content, error: null };
const view = (patch = {}, params = {}) => documentView({ ...page, ...patch }, 'anchor', 0, 1, params);
test('fragment positions at actual heading permalink, not TOC, fenced code or another origin', () => {
  const r = view();
  assert.equal(r.lines[0].number, 11);
  assert.equal(r.anchor.fragment, 'class-eventtarget');
  assert.equal(r.anchor.line, 11);
  const rendered = renderDocument(r, 1200);
  assert.match(rendered.text, /Fragment #class-eventtarget: L11/);
  for (const line of rendered.view.lines) assert.equal(content.slice(line.start, line.end), line.text);
  assert.equal(view().hash, r.hash);
});
test('explicit line, offset and find override default fragment positioning', () => {
  assert.equal(view({}, { lineno: 1 }).lines[0].number, 1);
  assert.equal(view({}, { offset: 0 }).lines[0].start, 0);
  assert.equal(view({}, { findText: 'Events' }).lines[0].number, 1);
});
test('encoded fragment and redirected canonical permalink resolve against final URL', () => {
  assert.equal(view({ url: 'https://old.example/start#%D1%82%D0%B5%D1%81%D1%82' }).lines[0].number, 15);
});
test('legacy local paths and malformed provider provenance remain readable', () => {
  assert.equal(view({ url: '/local/snapshot' }).lines[0].number, 1);
  const r = view({ finalUrl: '/invalid-provider-url' });
  assert.equal(r.anchor.line, null);
  assert.match(renderDocument(r).text, /not found in extracted snapshot/);
});
test('missing or malformed anchor is explicit, never a guessed text match', () => {
  for (const fragment of ['missing', '%ZZ']) {
    const r = view({ url: 'https://example.com/events#' + fragment });
    assert.equal(r.anchor.line, null);
    assert.equal(r.lines[0].number, 1);
    assert.match(renderDocument(r).text, /not found in extracted snapshot/);
  }
});
