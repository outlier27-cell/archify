import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ChromeVisualBrowser, findChrome } from '../archify/bin/visual-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = findChrome();

function stableManifest() {
  return {
    schemaVersion: 1, skillId: 'archify', channel: 'stable', version: '3.2.2', publishedAt: '2026-10-23T00:00:00Z',
    source: { repository: 'https://github.com/tt-a1i/archify', ref: 'v3.2.2', treeSha: 'a'.repeat(40) },
    artifact: { sha256: 'b'.repeat(64) }, summary: 'Reader update notice is available.',
    releaseNotes: 'https://github.com/tt-a1i/archify/releases/tag/v3.2.2', severity: 'normal',
  };
}

test('reader update is local on load and exposes a strict, accessible notice only after an explicit check', {
  skip: chrome ? false : 'Chrome is unavailable.',
}, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-update-browser-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, 'diagram.html');
  execFileSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'render', 'workflow', path.join(root, 'archify/examples/agent-tool-call.workflow.json'), artifact]);
  // This fixture models an already-released generator. Development builds must
  // never claim a stable result, which is covered by the ordinary fixture.
  fs.writeFileSync(artifact, fs.readFileSync(artifact, 'utf8').replace(/"generatorVersion":"[^"]+"/, '"generatorVersion":"3.2.1"'));
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  const before = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
    dialogOpen: document.getElementById('reader-update').open,
    trigger: document.getElementById('btn-reader-update').textContent,
    feedback: document.querySelector('[data-reader-feedback]'),
    requests: window.__readerUpdateRequests || 0
  }))()` });
  assert.equal(before.result.value.dialogOpen, false);
  assert.match(before.result.value.trigger, /Version 3\.2\.1/);
  assert.equal(before.result.value.feedback, null);
  assert.equal(before.result.value.requests, 0, 'loading the artifact does not fetch a manifest');

  const intercepted = await send('Runtime.evaluate', { expression: `window.__readerUpdateRequests = 0; window.fetch = () => {
    window.__readerUpdateRequests += 1;
    return Promise.resolve(new Response(JSON.stringify(${JSON.stringify(stableManifest())})));
  }; document.getElementById('btn-reader-update').focus(); document.getElementById('btn-reader-update').click(); document.getElementById('reader-update-check').click();` });
  assert.equal(intercepted.exceptionDetails, undefined, intercepted.exceptionDetails?.exception?.description);
  await new Promise(resolve => setTimeout(resolve, 50));
  const after = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const dialog = document.getElementById('reader-update');
    return {
      open: dialog.open,
      focusIsModal: document.activeElement === dialog || dialog.contains(document.activeElement),
      trigger: document.getElementById('btn-reader-update').textContent,
      current: document.getElementById('reader-update-current').textContent,
      available: document.getElementById('reader-update-available').textContent,
      summaries: [...document.querySelectorAll('#reader-update-summaries li')].map(node => node.textContent),
      releaseNotes: document.getElementById('reader-update-release-notes').href,
      requests: window.__readerUpdateRequests,
    };
  })()` });
  assert.equal(after.result.value.open, true);
  assert.equal(after.result.value.focusIsModal, true, 'focus remains inside the opened dialog');
  assert.equal(after.result.value.trigger, 'New version 3.2.2');
  assert.match(after.result.value.current, /3\.2\.1/);
  assert.match(after.result.value.available, /3\.2\.2/);
  assert.deepEqual(after.result.value.summaries, ['Reader update notice is available.']);
  assert.equal(after.result.value.releaseNotes, 'https://github.com/tt-a1i/archify/releases/tag/v3.2.2');
  assert.equal(after.result.value.requests, 1);
});

test('development artifacts never claim a stable result', {
  skip: chrome ? false : 'Chrome is unavailable.',
}, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-update-dev-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, 'diagram.html');
  execFileSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'render', 'workflow', path.join(root, 'archify/examples/agent-tool-call.workflow.json'), artifact]);
  fs.writeFileSync(artifact, fs.readFileSync(artifact, 'utf8').replace(/"generatorVersion":"[^"]+"/, '"generatorVersion":"3.2.1-dev.1"'));
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  await send('Runtime.evaluate', { expression: `window.fetch = () => Promise.resolve(new Response(JSON.stringify(${JSON.stringify(stableManifest())}))); document.getElementById('btn-reader-update').click(); document.getElementById('reader-update-check').click();` });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = await send('Runtime.evaluate', { returnByValue: true, expression: "document.getElementById('reader-update-status').textContent" });
    if (!/Checking the fixed stable manifest/.test(status.result.value)) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const result = await send('Runtime.evaluate', { returnByValue: true, expression: `({
    trigger: document.getElementById('btn-reader-update').textContent,
    status: document.getElementById('reader-update-status').textContent,
    notesHidden: document.getElementById('reader-update-release-notes').hidden
  })` });
  assert.match(result.result.value.status, /development artifact/i);
  assert.doesNotMatch(result.result.value.trigger, /New version/i);
  assert.equal(result.result.value.notesHidden, true);
});

test('a malformed stable manifest cannot promote an artifact to a new version', {
  skip: chrome ? false : 'Chrome is unavailable.',
}, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-update-invalid-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, 'diagram.html');
  execFileSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'render', 'workflow', path.join(root, 'archify/examples/agent-tool-call.workflow.json'), artifact]);
  fs.writeFileSync(artifact, fs.readFileSync(artifact, 'utf8').replace(/"generatorVersion":"[^"]+"/, '"generatorVersion":"3.2.1"'));
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  const invalid = { ...stableManifest(), summary: `Unexpected${String.fromCharCode(0)}control character` };
  await send('Runtime.evaluate', { expression: `window.fetch = () => Promise.resolve(new Response(JSON.stringify(${JSON.stringify(invalid)}))); document.getElementById('btn-reader-update').click(); document.getElementById('reader-update-check').click();` });
  await new Promise(resolve => setTimeout(resolve, 50));
  const result = await send('Runtime.evaluate', { returnByValue: true, expression: `({
    trigger: document.getElementById('btn-reader-update').textContent,
    status: document.getElementById('reader-update-status').textContent,
    notesHidden: document.getElementById('reader-update-release-notes').hidden
  })` });
  assert.match(result.result.value.status, /unavailable/i);
  assert.doesNotMatch(result.result.value.trigger, /New version/i);
  assert.equal(result.result.value.notesHidden, true);
});
