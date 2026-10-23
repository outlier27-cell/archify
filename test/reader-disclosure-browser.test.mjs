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

async function installNetworkProbe(send, manifest = stableManifest()) {
  const source = `(() => {
    const calls = [];
    Object.defineProperty(window, '__archifyNetworkCalls', { value: calls });
    const record = (kind, value) => calls.push({ kind, url: String(value) });
    window.fetch = (input) => {
      record('fetch', input);
      return Promise.resolve(new Response(JSON.stringify(${JSON.stringify(manifest)}), {
        status: 200, headers: { 'content-type': 'application/json' }
      }));
    };
    const xhrOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (_method, url, ...rest) {
      record('xhr', url);
      return xhrOpen.call(this, _method, url, ...rest);
    };
    for (const key of ['WebSocket', 'EventSource']) {
      const Native = window[key];
      if (!Native) continue;
      const Wrapped = function (...args) { record(key.toLowerCase(), args[0]); return new Native(...args); };
      Wrapped.prototype = Native.prototype;
      window[key] = Wrapped;
    }
  })();`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source });
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
  await installNetworkProbe(send);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  const before = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
    dialogOpen: document.getElementById('reader-update').open,
    trigger: document.getElementById('btn-reader-update').textContent,
    feedback: document.querySelector('[data-reader-feedback]'),
    requests: window.__archifyNetworkCalls
  }))()` });
  assert.equal(before.result.value.dialogOpen, false);
  assert.match(before.result.value.trigger, /Version 3\.2\.1/);
  assert.equal(before.result.value.feedback, null);
  assert.deepEqual(before.result.value.requests, [], 'loading the artifact makes no fetch, XHR, WebSocket, or EventSource request');

  const intercepted = await send('Runtime.evaluate', { expression: `document.getElementById('btn-reader-update').focus(); document.getElementById('btn-reader-update').click(); document.getElementById('reader-update-check').click();` });
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
      requests: window.__archifyNetworkCalls,
    };
  })()` });
  assert.equal(after.result.value.open, true);
  assert.equal(after.result.value.focusIsModal, true, 'focus remains inside the opened dialog');
  assert.equal(after.result.value.trigger, 'New version 3.2.2');
  assert.match(after.result.value.current, /3\.2\.1/);
  assert.match(after.result.value.available, /3\.2\.2/);
  assert.deepEqual(after.result.value.summaries, ['Reader update notice is available.']);
  assert.equal(after.result.value.releaseNotes, 'https://github.com/tt-a1i/archify/releases/tag/v3.2.2');
  assert.deepEqual(after.result.value.requests, [{ kind: 'fetch', url: 'https://tt-a1i.github.io/archify/skill-updates/archify/stable.json' }]);
});

test('explainer initial load makes no network requests', {
  skip: chrome ? false : 'Chrome is unavailable.',
}, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-update-explainer-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const { renderExplainer } = await import('../archify/explainer/render.mjs');
  const artifact = path.join(directory, 'explainer.html');
  fs.writeFileSync(artifact, renderExplainer({
    schema_version: 1, diagram_type: 'explainer', meta: { id: 'offline-explainer', title: 'Offline explainer', locale: 'en' },
    answer: { summary: 'Read locally.' }, panels: [{ id: 'main', title: 'Main', blocks: [{ id: 'text', type: 'prose', text: 'No network request is needed.' }] }], sources: [],
  }, { sourceText: '{}' }));
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  await installNetworkProbe(send);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  const result = await send('Runtime.evaluate', { returnByValue: true, expression: 'window.__archifyNetworkCalls' });
  assert.deepEqual(result.result.value, [], 'loading an explainer makes no fetch, XHR, WebSocket, or EventSource request');
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
