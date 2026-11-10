import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ChromeVisualBrowser, findChrome } from '../archify/bin/visual-check.mjs';
import { buildOverlay } from '../archify/modules/code-analysis/overlay/inject.mjs';
import { evaluate } from '../archify/modules/code-analysis/evaluate/index.mjs';
import { buildTask } from '../archify/modules/code-analysis/lib/task.mjs';

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

test('Code Analysis paginates a duplicate group without splitting its finding identity', {
  skip: chrome ? false : 'Set ARCHIFY_CHROME to run Code Analysis browser coverage.',
}, async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-duplicate-page-'));
  const root = path.join(scratch, 'repo'); fs.mkdirSync(root); t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const source = Array.from({ length: 60 }, (_, index) => `export const value_${index} = ${index};`).join('\n') + '\n';
  const files = Array.from({ length: 45 }, (_, index) => {
    const file = `src/copy-${index}.mjs`;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), source);
    return { path: file, role: 'source', loc: 60, sourceText: source };
  });
  const repository = { root, revision: null, baseRevision: null, sourceKind: 'working-tree', snapshotId: 'duplicate-page', url: null, language: 'ts', adapter: 'typescript' };
  const graph = { schema_version: 1, repository, grouping: { depth: 1, packageBoundaries: true, groups: [] }, excluded: { roles: [], files: 0 }, modules: [{ id: 'src', label: 'src', path: 'src', files: files.length, loc: 60 * files.length, fanIn: 0, fanOut: 0, instability: null, entry: files.map((file) => file.path) }], fileModules: Object.fromEntries(files.map((file) => [file.path, 'src'])), edges: [], unresolved: { external: 0, outside: 0, unknown: 0, opaque: 0 } };
  const facts = { repository, files, imports: [], symbols: [], calls: [], functions: [], unresolved: graph.unresolved };
  const findings = evaluate(graph, { rules: { coupling: { duplicateCode: { enabled: true, minTokens: 80, minLines: 10 } } } }, facts);
  const finding = findings.diagnostics.find((item) => item.code === 'coupling/duplicate-code');
  assert.ok(finding, 'the detector must create the browser finding');
  assert.equal(finding.evidence.locations.length, 45);
  const task = buildTask({ findings, facts, ids: [finding.id] });
  assert.equal(task.locations.length, 12, 'task evidence uses the general bounded excerpt cap; the reader retains all 45 ranges');
  assert.ok(task.locations.every((location) => location.kind === 'range' && location.sha256));
  const ir = { schema_version: 1, diagram_type: 'architecture', meta: { title: 'Duplicate page', output: 'duplicate.html' }, components: [{ id: 'app', type: 'backend', label: 'App', pos: [40, 40], size: [160, 60], sources: [{ path: files[0].path }] }], connections: [] };
  const file = path.join(scratch, 'duplicate.html'); fs.writeFileSync(file, buildOverlay({ ir, graph, facts, findings: [finding], html: '<html><body><div class="toolbar"></div><svg><g data-node-id="app"></g></svg></body></html>', sourceRoot: root, run: { rules: ['coupling/duplicate-code'], review: null } }).html);
  const browser = new ChromeVisualBrowser(chrome); t.after(() => browser.close()); const session = await browser.sessionPromise;
  const send = (method, params = {}) => browser.cdp.send(method, params, session); const run = async expression => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert.equal(response.exceptionDetails, undefined, response.exceptionDetails?.exception?.description); return response.result?.value; };
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session); await send('Page.navigate', { url: new URL(`file://${file.replaceAll('\\', '/')}`).href }); await loaded;
  await run("document.getElementById('btn-bauify').click(); document.querySelector('#bauify-overview [data-finding]').click(); document.querySelector('.finding-locations').open=true");
  assert.equal(await run("document.querySelectorAll('.locations-page .ref').length"), 20);
  assert.match(await run("document.querySelector('.locations-status').textContent"), /Page 1 of 3 · 1–20 of 45/);
  await run("document.querySelector('.locations-next').click()"); assert.equal(await run("document.querySelectorAll('.locations-page .ref').length"), 20);
  await run("document.querySelector('.locations-next').click()"); assert.equal(await run("document.querySelectorAll('.locations-page .ref').length"), 5);
  assert.match(await run("document.querySelector('.locations-status').textContent"), /Page 3 of 3 · 41–45 of 45/);
  await run("document.querySelector('.locations-page .ref').click()");
  assert.equal(await run("document.getElementById('bauify-code').hidden === false"), true, 'a detector-produced range opens source evidence');
});

test('Code Analysis shows external diagnostic provenance and every location', {
  skip: chrome ? false : 'Set ARCHIFY_CHROME to run Code Analysis browser coverage.',
}, async t => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-external-page-')); const root = path.join(scratch, 'repo'); fs.mkdirSync(root); t.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'a.js'), 'export const a = 1;\n'); fs.writeFileSync(path.join(root, 'b.js'), 'export const b = 2;\n');
  const repository = { root, revision: null, baseRevision: null, sourceKind: 'working-tree', snapshotId: 'external-page', url: null, language: 'ts', adapter: 'synthetic' };
  const graph = { schema_version: 1, repository, grouping: { depth: 1, packageBoundaries: true, groups: [] }, excluded: { roles: [], files: 0 }, modules: [{ id: 'root', label: 'root', path: '', files: 2, loc: 2, fanIn: 0, fanOut: 0, instability: null, entry: ['a.js', 'b.js'] }], fileModules: { 'a.js': 'root', 'b.js': 'root' }, edges: [], unresolved: { external: 0, outside: 0, unknown: 0, opaque: 0 } };
  const facts = { repository, files: [{ path: 'a.js', role: 'source', loc: 1, sourceText: 'export const a = 1;\n' }, { path: 'b.js', role: 'source', loc: 1, sourceText: 'export const b = 2;\n' }], imports: [], symbols: [], calls: [], functions: [], unresolved: graph.unresolved };
  const finding = { id: 'AISM-aaaaaaaaaaaa', code: 'external/eslint', dimension: 'ai-smell', severity: 'warning', confidence: 0.5, message: 'Avoid alert', subject: { file: 'a.js', line: 1, column: 1, rule: 'no-alert', tool: 'eslint' }, evidence: { threshold: null, source: 'sarif', tool: 'eslint', toolVersion: '9', rule: 'no-alert', originalLevel: 'error', ruleDescription: 'Avoid alert', importedAt: '2026-11-07T00:00:00Z', locations: [{ file: 'a.js', line: 1, column: 1, status: 'ok' }, { file: 'b.js', line: 1, column: 1, status: 'ok' }] }, supportedFixes: ['review it'] };
  const ir = { schema_version: 1, diagram_type: 'architecture', meta: { title: 'External', output: 'external.html' }, components: [{ id: 'app', type: 'backend', label: 'App', pos: [40, 40], size: [160, 60], sources: [{ path: 'a.js' }] }], connections: [] };
  const file = path.join(scratch, 'external.html'); fs.writeFileSync(file, buildOverlay({ ir, graph, facts, findings: [finding], html: '<html><body><div class="toolbar"></div><svg><g data-node-id="app"></g></svg></body></html>', sourceRoot: root, run: { rules: ['external/eslint'], review: null } }).html);
  const browser = new ChromeVisualBrowser(chrome); t.after(() => browser.close()); const session = await browser.sessionPromise; const send = (method, params = {}) => browser.cdp.send(method, params, session); const run = async expression => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert.equal(response.exceptionDetails, undefined, response.exceptionDetails?.exception?.description); return response.result?.value; };
  const loaded = browser.cdp.waitFor('Page.loadEventFired', session); await send('Page.navigate', { url: new URL(`file://${file.replaceAll('\\', '/')}`).href }); await loaded;
  await run("document.getElementById('btn-bauify').click(); document.querySelector('#bauify-overview [data-finding]').click(); document.querySelector('.finding-locations').open=true");
  assert.match(await run("document.querySelector('#bauify-detail h3').textContent"), /eslint: no-alert/);
  assert.match(await run("document.querySelector('#bauify-detail .level').textContent"), /original level error · 2 locations · imported 2026-11-07/);
  assert.equal(await run("document.querySelectorAll('.locations-page .ref').length"), 2);
});

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
