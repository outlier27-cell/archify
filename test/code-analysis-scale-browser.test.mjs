import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ChromeVisualBrowser, findChrome } from '../archify/bin/visual-check.mjs';
import { buildOverlay } from '../archify/modules/code-analysis/overlay/inject.mjs';

const chrome = process.env.ARCHIFY_CHROME ? findChrome() : null;

function fixture(size, root) {
  const source = Array.from({ length: 12 }, (_, i) => `export function function_${i}() { return ${i}; }`).join('\n') + '\n';
  fs.writeFileSync(path.join(root, 'src.mjs'), source);
  const graph = {
    schema_version: 1,
    repository: { root, revision: null, baseRevision: null, sourceKind: 'working-tree', snapshotId: 'scale', url: null, language: 'ts', adapter: 'synthetic' },
    grouping: { depth: 1, packageBoundaries: true, groups: [] },
    excluded: { roles: ['test', 'generated'], files: 0 },
    modules: [{ id: 'src', label: 'src', path: 'src', files: 1, loc: 12, fanIn: 0, fanOut: 0, instability: null, entry: ['src.mjs'] }],
    fileModules: { 'src.mjs': 'src' },
    edges: [], unresolved: { external: 0, outside: 0, unknown: 0, opaque: 0 },
  };
  const facts = { repository: graph.repository, files: [{ path: 'src.mjs', role: 'source', loc: 12, sourceText: source }], imports: [], symbols: [], calls: [], functions: [], unresolved: graph.unresolved };
  const findings = Array.from({ length: size }, (_, i) => ({
    id: `COMP-${i.toString(16).padStart(12, '0')}`,
    code: 'complexity/function', dimension: 'complexity', severity: 'warning', confidence: 0.7,
    message: `Synthetic finding ${i} for scale measurement`,
    subject: { file: 'src.mjs', function: `function_${i % 12}`, line: (i % 12) + 1, endLine: (i % 12) + 1 },
    evidence: { threshold: { complexity: 15, nesting: 5 }, complexity: 20, nesting: 2, length: 1, deepestLine: (i % 12) + 1 },
    supportedFixes: ['review the function before changing it'],
  }));
  const ir = { schema_version: 1, diagram_type: 'architecture', meta: { title: `Scale ${size}`, output: 'scale.html' }, components: [{ id: 'app', type: 'backend', label: 'App', pos: [40, 40], size: [160, 60], sources: [{ path: 'src.mjs' }] }], connections: [] };
  const html = '<html><body><div class="toolbar"></div><svg><g data-node-id="app"></g></svg></body></html>';
  return buildOverlay({ ir, graph, facts, findings, html, sourceRoot: root, run: { rules: ['complexity/function'], review: null } }).html;
}

test('Code Analysis browser scale baseline measures 500 and 5000 findings', {
  skip: chrome ? false : 'Set ARCHIFY_CHROME to run Code Analysis browser coverage.',
}, async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-analysis-scale-'));
  const root = path.join(scratch, 'repo'); fs.mkdirSync(root);
  t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const browser = new ChromeVisualBrowser(chrome);
  t.after(() => browser.close());
  const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session);
  const run = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert.equal(response.exceptionDetails, undefined, response.exceptionDetails?.exception?.description);
    return response.result?.value;
  };
  const rows = [];
  for (const size of [500, 5000]) {
    const file = path.join(scratch, `scale-${size}.html`);
    fs.writeFileSync(file, fixture(size, root));
    const loaded = browser.cdp.waitFor('Page.loadEventFired', session);
    const navigationStart = performance.now();
    await send('Page.navigate', { url: new URL(`file://${file.replaceAll('\\', '/')}`).href });
    await loaded;
    const loadMs = performance.now() - navigationStart;
    const toggleStart = performance.now();
    await run("document.getElementById('btn-bauify').click()");
    await run("new Promise(resolve => requestAnimationFrame(() => resolve(true)))");
    const toggleMs = performance.now() - toggleStart;
    const rendered = await run("JSON.parse(document.getElementById('bauify-analysis').textContent).totals.findings");
    const searchStart = performance.now();
    await run("(() => { const input=document.querySelector('.finding-search'); input.value='Synthetic finding " + (size - 1) + "'; input.dispatchEvent(new Event('input', { bubbles: true })); })()");
    await run("new Promise(resolve => requestAnimationFrame(() => resolve(true)))");
    const searchMs = performance.now() - searchStart;
    const rowEntries = await run("document.querySelectorAll('#bauify-overview [data-finding]').length");
    const shown = await run("document.querySelector('#bauify-overview .ev').textContent.match(/(\\d+) finding/)[1]");
    const sourceStart = performance.now();
    await run("document.querySelector('#bauify-overview [data-finding]').click()");
    await run("new Promise(resolve => requestAnimationFrame(() => resolve(true)))");
    const detailMs = performance.now() - sourceStart;
    const sourceRef = await run("document.querySelector('#bauify-detail .ref') !== null");
    assert.equal(sourceRef, true, 'scale findings retain a source evidence link');
    await run("document.querySelector('#bauify-detail .ref').click()");
    const sourceOpen = await run("document.getElementById('bauify-code').hidden === false");
    rows.push({ size, loadMs: +loadMs.toFixed(2), toggleMs: +toggleMs.toFixed(2), searchMs: +searchMs.toFixed(2), detailMs: +detailMs.toFixed(2), rendered, shown: Number(shown), rowEntries, sourceOpen, heapUsedMb: +(await run("performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : null"))?.toFixed?.(2) || null });
  }
  console.log(JSON.stringify(rows));
  assert.deepEqual(rows.map(row => [row.size, row.rendered, row.shown, row.rowEntries, row.sourceOpen]), [[500, 500, 1, 2, true], [5000, 5000, 1, 2, true]]);
});
