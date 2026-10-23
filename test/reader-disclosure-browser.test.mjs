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

test('reader disclosure is keyboard reachable, local by default, and opens only on request', {
  skip: chrome ? false : 'Chrome is unavailable.',
}, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-disclosure-browser-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const artifact = path.join(directory, 'diagram.html');
  execFileSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'render', 'workflow', path.join(root, 'archify/examples/reader-feedback-update.workflow.json'), artifact]);
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
  await send('Page.navigate', { url: pathToFileURL(artifact).href });
  await loaded;
  const before = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => ({
    dialogOpen: document.getElementById('reader-disclosure').open,
    href: document.getElementById('reader-disclosure-feedback').href,
    printed: getComputedStyle(document.getElementById('reader-disclosure')).display
  }))()` });
  assert.equal(before.result.value.dialogOpen, false);
  assert.equal(before.result.value.href, 'https://github.com/tt-a1i/archify/issues/new?template=artifact-feedback.yml');
  await send('Runtime.evaluate', { expression: "document.getElementById('btn-reader-disclosure').focus(); document.getElementById('btn-reader-disclosure').click();" });
  const after = await send('Runtime.evaluate', { returnByValue: true, expression: "(() => { const dialog = document.getElementById('reader-disclosure'); return { open: dialog.open, focusIsModal: document.activeElement === dialog || dialog.contains(document.activeElement) }; })()" });
  assert.equal(after.result.value.open, true);
  assert.equal(after.result.value.focusIsModal, true, 'focus remains inside the opened modal');
  const intercepted = await send('Runtime.evaluate', { expression: `window.fetch = () => Promise.resolve(new Response(JSON.stringify({
    schemaVersion: 1, skillId: 'archify', channel: 'stable', version: '3.2.2', publishedAt: '2026-10-23T00:00:00Z',
    source: { repository: 'https://github.com/tt-a1i/archify', ref: 'v3.2.2', treeSha: 'a'.repeat(40) },
    artifact: { sha256: 'b'.repeat(64) }, summary: 'Reader disclosure update',
    releaseNotes: 'https://github.com/tt-a1i/archify/releases/tag/v3.2.2', severity: 'normal'
  }))); document.getElementById('reader-disclosure-update').click();` });
  assert.equal(intercepted.exceptionDetails, undefined, intercepted.exceptionDetails?.exception?.description);
  await new Promise(resolve => setTimeout(resolve, 50));
  const update = await send('Runtime.evaluate', { returnByValue: true, expression: "document.getElementById('reader-disclosure-status').textContent" });
  assert.match(update.result.value, /unavailable/i, 'a development artifact does not claim a stable update result');
});
