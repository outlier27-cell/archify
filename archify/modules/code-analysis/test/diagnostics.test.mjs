import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { importEslint, importRuff, importSarif } from '../lib/diagnostics.mjs';
import { buildTask } from '../lib/task.mjs';
import { readJsonInput } from '../lib/analysis.mjs';
import { findDuplicateGroups } from '../lib/duplicate.mjs';

const sarif = (result) => ({ version: '2.1.0', runs: [{ tool: { driver: { name: 'eslint', version: '9', rules: [{ id: 'no-alert', shortDescription: { text: 'Avoid alert' } }] } }, results: [result] }] });

function rootWithFiles(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-diagnostics-'));
  for (const file of files) { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, 'source\n'); }
  return root;
}

test('SARIF import preserves source, rule, original level, location and normalized warning', (t) => {
  const root = rootWithFiles(['src/app.js']); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const [finding] = importSarif(sarif({ ruleId: 'no-alert', level: 'error', message: { text: 'Avoid alert.' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/app.js' }, region: { startLine: 1, startColumn: 2 } } }] }), { root, source: 'eslint', importedAt: '2026-11-06T00:00:00Z' });
  assert.equal(finding.code, 'external/eslint');
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.evidence.originalLevel, 'error');
  assert.deepEqual(finding.subject, { file: 'src/app.js', line: 1, column: 2, rule: 'no-alert', tool: 'eslint' });
  assert.equal(finding.evidence.locations[0].status, 'ok');
  assert.equal(finding.evidence.ruleDescription, 'Avoid alert');
});

test('external evidence digest covers every valid SARIF location', (t) => {
  const root = rootWithFiles(['test/fixtures/py-basic/app.py', 'test/fixtures/py-basic/engine.py']); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const [finding] = importSarif(sarif({ ruleId: 'x', message: { text: 'two files' }, locations: [
    { physicalLocation: { artifactLocation: { uri: 'test/fixtures/py-basic/app.py' }, region: { startLine: 1 } } },
    { physicalLocation: { artifactLocation: { uri: 'test/fixtures/py-basic/engine.py' }, region: { startLine: 1 } } },
  ] }), { root });
  assert.deepEqual(finding.evidenceDigest.files, ['test/fixtures/py-basic/app.py', 'test/fixtures/py-basic/engine.py']);
});

test('SARIF file URLs resolve to repository-relative paths on the current platform', (t) => {
  const root = rootWithFiles(['src/app.js']); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const uri = pathToFileURL(path.join(root, 'src/app.js')).href;
  const [finding] = importSarif(sarif({ ruleId: 'x', message: { text: 'url' }, locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: 1 } } }] }), { root });
  assert.equal(finding.subject.file, 'src/app.js');
  assert.equal(finding.evidence.locations[0].status, 'ok');
});

test('SARIF related locations are preserved and included in the evidence digest', (t) => {
  const root = rootWithFiles(['src/a.js', 'src/b.js']); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const [finding] = importSarif(sarif({ ruleId: 'x', message: { text: 'related' }, locations: [
    { physicalLocation: { artifactLocation: { uri: 'src/a.js' }, region: { startLine: 1 } } },
  ], relatedLocations: [
    { physicalLocation: { artifactLocation: { uri: 'src/b.js' }, region: { startLine: 1 } } },
  ] }), { root });
  assert.deepEqual(finding.evidence.locations.map(({ file }) => file), ['src/a.js', 'src/b.js']);
  assert.deepEqual(finding.evidenceDigest.files, ['src/a.js', 'src/b.js']);
});

test('SARIF structural limits fail closed', () => {
  assert.throws(() => importSarif({ runs: Array.from({ length: 2 }, () => ({})) }, { limits: { maxRuns: 1 } }), (error) => error.diagnostics[0].code === 'diagnostics/sarif-too-large');
  assert.throws(() => importSarif({ runs: [{ results: [{ locations: Array.from({ length: 2 }, () => ({})) }] }] }, { limits: { maxLocations: 1 } }), (error) => error.diagnostics[0].code === 'diagnostics/sarif-too-large');
});

test('SARIF import keeps outside, missing and duplicate locations explicit', () => {
  const [finding] = importSarif(sarif({ ruleId: 'x', message: { text: 'x' }, locations: [
    { physicalLocation: { artifactLocation: { uri: '../secret.js' }, region: { startLine: 1 } } },
    { physicalLocation: { artifactLocation: { uri: 'src/a.js' }, region: {} } },
  ] }), { root: 'D:/repo' });
  assert.equal(finding.subject.file, '../secret.js');
  assert.equal(finding.evidence.locations[0].status, 'unverifiable');
  assert.equal(finding.evidence.locations[1].status, 'unverifiable');
  assert.match(finding.supportedFixes[0], /re-run|export/);
});

test('SARIF invalid input fails closed', () => {
  assert.throws(() => importSarif({}), (error) => error.diagnostics[0].code === 'diagnostics/sarif-invalid');
});

test('external diagnostic import limits and malformed members fail closed', (t) => {
  assert.throws(() => importSarif({ runs: [{ results: [null] }] }), (error) => error.diagnostics[0].code === 'diagnostics/sarif-invalid');
  assert.throws(() => importEslint([{ filePath: 'a.js', messages: [{ message: 'a' }, { message: 'b' }] }], { limits: { maxResults: 1 } }), (error) => error.diagnostics[0].code === 'diagnostics/eslint-too-large');
  assert.throws(() => importEslint([{ filePath: 'a.js', messages: [null] }]), (error) => error.diagnostics[0].code === 'diagnostics/eslint-invalid');
  assert.throws(() => importRuff([{}, {}], { limits: { maxResults: 1 } }), (error) => error.diagnostics[0].code === 'diagnostics/ruff-too-large');
  assert.throws(() => importRuff([null]), (error) => error.diagnostics[0].code === 'diagnostics/ruff-invalid');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-diagnostic-size-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'input.json'); fs.writeFileSync(file, '{"value":123}');
  assert.throws(() => readJsonInput(file, 'test input', { maxBytes: 5 }), (error) => error.diagnostics[0].code === 'diagnostics/input-too-large');
});

test('native ESLint and Ruff JSON preserve source facts and normalize findings to warning', () => {
  const [eslint] = importEslint([{ filePath: 'D:/repo/src/a.js', messages: [{ ruleId: 'no-alert', severity: 2, message: 'Avoid alert', line: 3, column: 4 }] }], { root: 'D:/repo', importedAt: '2026-11-07T00:00:00Z' });
  assert.equal(eslint.evidence.tool, 'eslint');
  assert.equal(eslint.evidence.originalLevel, 'error');
  assert.equal(eslint.subject.file, 'src/a.js');
  assert.equal(eslint.severity, 'warning');
  assert.equal(eslint.evidence.importedAt, '2026-11-07T00:00:00Z');
  const [ruff] = importRuff([{ filename: 'src/a.py', code: 'F401', message: 'unused import', location: { row: 5, column: 1 } }], { root: 'D:/repo' });
  assert.equal(ruff.evidence.tool, 'ruff');
  assert.equal(ruff.evidence.rule, 'F401');
  assert.equal(ruff.subject.line, 5);
});

test('repeated external diagnostics are idempotent while different tools remain distinct', () => {
  const result = { ruleId: 'same', level: 'warning', message: { text: 'same text' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/app.js' }, region: { startLine: 1 } } }] };
  const sarif = importSarif({ runs: [
    { tool: { driver: { name: 'eslint' } }, results: [result, result] },
    { tool: { driver: { name: 'eslint' } }, results: [result] },
    { tool: { driver: { name: 'ruff' } }, results: [result] },
  ] });
  assert.equal(sarif.length, 2);
  assert.deepEqual(sarif.map((finding) => finding.evidence.tool).sort(), ['eslint', 'ruff']);
});

test('unverifiable external locations never enter a task modification scope', () => {
  const [finding] = importSarif(sarif({ ruleId: 'x', message: { text: 'outside' }, locations: [{ physicalLocation: { artifactLocation: { uri: '../secret.js' }, region: { startLine: 1 } } }] }), { root: 'D:/repo' });
  const task = buildTask({ findings: { diagnostics: [finding], repository: { language: 'ts' } }, facts: { files: [], repository: { language: 'ts' } }, ids: [finding.id] });
  assert.deepEqual(task.scope.modify, []);
  assert.deepEqual(task.locations, []);
});

test('duplicate detector groups exact token windows across files and excludes configured files', () => {
  const body = Array.from({ length: 45 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const groups = findDuplicateGroups([{ path: 'a.py', sourceText: body }, { path: 'b.py', sourceText: `# header\n${body}` }, { path: 'tests/c.py', sourceText: body }], { minTokens: 40, exclude: (file) => file.path.startsWith('tests/') });
  assert.equal(groups.length, 1);
  assert.deepEqual([...new Set(groups[0].locations.map((location) => location.file))], ['a.py', 'b.py']);
});

test('duplicate detector uses token contents and merges sliding windows into maximal occurrences', () => {
  const body = Array.from({ length: 80 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const groups = findDuplicateGroups([{ path: 'a.js', sourceText: body }, { path: 'b.js', sourceText: body }], { minTokens: 40, minLines: 7 });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].locations, [
    { file: 'a.js', startLine: 1, endLine: 80 },
    { file: 'b.js', startLine: 1, endLine: 80 },
  ]);
  const different = findDuplicateGroups([
    { path: 'a.js', sourceText: 'alpha beta gamma delta epsilon' },
    { path: 'b.js', sourceText: 'one two three four five' },
  ], { minTokens: 4, minLines: 1 });
  assert.deepEqual(different, [], 'token objects must not collapse to the same string key');
});

test('duplicate detector does not bridge different sequences through one common file', () => {
  const groups = findDuplicateGroups([
    { path: 'a.js', sourceText: 'a b c d e' },
    { path: 'b.js', sourceText: 'a b c d z' },
    { path: 'c.js', sourceText: 'z b c d e' },
  ], { minTokens: 4, minLines: 1 });
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.locations.map((location) => location.file).sort()).sort(), [['a.js', 'b.js'], ['a.js', 'c.js']]);
});

test('duplicate detector keeps separated repeated blocks separate', () => {
  const block = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const separator = Array.from({ length: 64 }, (_, i) => `const separator${i} = true;`).join('\n');
  const groups = findDuplicateGroups([{ path: 'a.js', sourceText: `${block}\n${separator}\n${block}` }, { path: 'b.js', sourceText: block }], { minTokens: 40, minLines: 7 });
  assert.ok(groups.some((group) => group.locations.filter((location) => location.file === 'a.js').length >= 2), JSON.stringify(groups));
});

test('duplicate detector retains separate occurrences within one file', () => {
  const block = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const separator = Array.from({ length: 64 }, (_, i) => `const separator${i} = true;`).join('\n');
  const groups = findDuplicateGroups([{ path: 'a.js', sourceText: `${block}\n${separator}\n${block}` }, { path: 'b.js', sourceText: block }], { minTokens: 40, minLines: 7 });
  const locations = groups.flatMap((group) => group.locations.filter((location) => location.file === 'a.js'));
  assert.ok(locations.length >= 2, JSON.stringify(groups));
  assert.ok(locations.some((location) => location.startLine === 1));
  assert.ok(locations.some((location) => location.startLine > block.split('\n').length));
});

test('duplicate detector bounds dense groups without dropping occurrence ranges', () => {
  const body = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const files = Array.from({ length: 120 }, (_, i) => ({ path: `src/${i}.js`, sourceText: body }));
  const groups = findDuplicateGroups(files, { minTokens: 40, minLines: 7 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locations.length, 120, 'one duplicate group retains every occurrence; the reader paginates it');
  assert.equal(new Set(groups[0].locations.map((location) => location.file)).size, 120);
  assert.ok(groups[0].locations.every((location) => location.startLine === 1 && location.endLine === 18));
});

test('duplicate detector keeps three separated occurrences with the same separator', () => {
  const block = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const separator = Array.from({ length: 64 }, (_, i) => `const separator${i} = true;`).join('\n');
  const groups = findDuplicateGroups([
    { path: 'many.js', sourceText: [block, separator, block, separator, block].join('\n') },
    { path: 'peer.js', sourceText: block },
  ], { minTokens: 40, minLines: 7 });
  const repeatedBlock = groups.find((group) => group.locations.some((location) => location.file === 'peer.js'));
  assert.ok(repeatedBlock, JSON.stringify(groups));
  const occurrences = repeatedBlock.locations.filter((location) => location.file === 'many.js');
  assert.equal(occurrences.length, 3, JSON.stringify(repeatedBlock));
  assert.ok(occurrences.every((location, index, all) => index === 0 || all[index - 1].endLine < location.startLine));
});

test('duplicate detector applies minLines after expanding a dense token seed', () => {
  const dense = Array.from({ length: 7 }, (_, line) => Array.from({ length: 10 }, (_, token) => `v${line}_${token}`).join(' + ')).join('\n');
  const groups = findDuplicateGroups([{ path: 'a.js', sourceText: dense }, { path: 'b.js', sourceText: dense }], { minTokens: 40, minLines: 7 });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].locations, [{ file: 'a.js', startLine: 1, endLine: 7 }, { file: 'b.js', startLine: 1, endLine: 7 }]);
});

test('duplicate detector keeps one stable group beyond one reader page', () => {
  const block = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const files = Array.from({ length: 101 }, (_, index) => ({ path: `src/${index}.js`, sourceText: block }));
  const groups = findDuplicateGroups(files, { minTokens: 40, minLines: 7 });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].locations.length, 101);
});

test('duplicate detector identity changes with members and ignores an unrelated group', () => {
  const block = Array.from({ length: 18 }, (_, i) => `value${i} = value${i} + 1`).join('\n');
  const other = Array.from({ length: 18 }, (_, i) => `other${i} = other${i} * 2`).join('\n');
  const run = (files) => findDuplicateGroups(files, { minTokens: 40, minLines: 7 });
  const before = run([{ path: 'a.js', sourceText: block }, { path: 'b.js', sourceText: block }]);
  const withUnrelated = run([{ path: 'a.js', sourceText: block }, { path: 'b.js', sourceText: block }, { path: 'x.js', sourceText: other }, { path: 'y.js', sourceText: other }]);
  const afterMember = run([{ path: 'a.js', sourceText: block }, { path: 'b.js', sourceText: block }, { path: 'c.js', sourceText: block }]);
  const firstId = before[0].id;
  assert.ok(withUnrelated.some((group) => group.id === firstId), 'an unrelated duplicate group keeps the original identity');
  assert.ok(!afterMember.some((group) => group.id === firstId), 'adding a member changes the group identity');
});

test('duplicate rule is opt-in and records every repeated range', async () => {
  const { evaluate } = await import('../evaluate/index.mjs');
  const source = Array.from({ length: 18 }, (_, i) => `const value${i} = input${i} + 1;`).join('\n');
  const facts = { repository: { language: 'ts' }, files: [{ path: 'a.js', role: 'source', sourceText: source }, { path: 'b.js', role: 'source', sourceText: source }], imports: [], functions: [] };
  const graph = { repository: facts.repository, modules: [], edges: [], fileModules: {}, excluded: { roles: ['test', 'generated'], files: 0 } };
  assert.equal(evaluate(graph, {}, facts).rules.includes('coupling/duplicate-code'), false);
  const findings = evaluate(graph, { rules: { coupling: { duplicateCode: { enabled: true, minTokens: 40, minLines: 7 } } } }, facts);
  const duplicate = findings.diagnostics.find((finding) => finding.code === 'coupling/duplicate-code');
  assert.ok(duplicate);
  assert.equal(duplicate.confidence, 0.75);
  assert.ok(duplicate.subject.groupId.startsWith('DUP-'));
  assert.deepEqual([...new Set(duplicate.evidence.locations.map((location) => location.file))], ['a.js', 'b.js']);
  assert.deepEqual(duplicate.evidence.threshold, { minTokens: 40, minLines: 7 });
  const task = buildTask({ findings, facts, ids: [duplicate.id] });
  assert.equal(task.locations.length, 2);
  assert.ok(task.locations.every((location) => location.kind === 'range' && location.sha256));
  assert.equal(evaluate(graph, { rules: { coupling: { duplicateCode: { enabled: true, minTokens: 40, minLines: 7 } } } }, { ...facts, repository: { language: 'py' } }).rules.includes('coupling/duplicate-code'), false);
});

test('duplicate finding identity survives unrelated groups', async () => {
  const { evaluate } = await import('../evaluate/index.mjs');
  const repeated = Array.from({ length: 18 }, (_, i) => `const value${i} = input${i} + 1;`).join('\n');
  const files = [{ path: 'a.js', role: 'source', sourceText: repeated }, { path: 'b.js', role: 'source', sourceText: repeated }];
  const graph = { repository: { language: 'ts' }, modules: [], edges: [], fileModules: {}, excluded: { roles: ['test', 'generated'], files: 0 } };
  const config = { rules: { coupling: { duplicateCode: { enabled: true, minTokens: 40, minLines: 7 } } } };
  const first = evaluate(graph, config, { repository: graph.repository, files, imports: [], functions: [] }).diagnostics.find((finding) => finding.code === 'coupling/duplicate-code');
  const nextFiles = [...files, { path: 'c.js', role: 'source', sourceText: 'const other = true;' }, { path: 'd.js', role: 'source', sourceText: 'const other = true;' }];
  const next = evaluate(graph, config, { repository: graph.repository, files: nextFiles, imports: [], functions: [] }).diagnostics.find((finding) => finding.subject.groupId === first.subject.groupId);
  assert.equal(next.id, first.id);
});

test('organization heuristics are opt-in and preserve explainable role evidence', async () => {
  const { evaluate } = await import('../evaluate/index.mjs');
  const facts = { repository: { language: 'ts' }, files: [
    { path: 'src/util.js', role: 'source', sourceText: 'export function util() {}\n' },
    { path: 'src/entry.js', role: 'source', sourceText: 'const fs = require("fs"); process.argv; render(view); class Model {}\n' },
  ], imports: [], functions: [] };
  const graph = { repository: facts.repository, modules: [], edges: [], fileModules: {}, excluded: { roles: ['test', 'generated'], files: 0 } };
  const config = { rules: { organization: { mixedRoles: { enabled: true }, folderRoles: { enabled: false }, genericName: { enabled: true } } }, ignore: [] };
  const findings = evaluate(graph, config, facts);
  assert.ok(findings.diagnostics.some((finding) => finding.code === 'organization/generic-name'));
  const mixed = findings.diagnostics.find((finding) => finding.code === 'organization/mixed-roles');
  assert.ok(mixed);
  assert.equal(mixed.dimension, 'organization');
  assert.ok(Object.hasOwn(mixed.evidence, 'threshold'));
  assert.deepEqual(mixed.evidence.roles, ['entry', 'io', 'model', 'view']);
  assert.deepEqual(mixed.evidence.triggers.map(({ role }) => role), ['entry', 'io', 'view', 'model']);
  assert.ok(mixed.evidence.triggers.every(({ line, text }) => Number.isInteger(line) && text));
  assert.equal(evaluate(graph, {}, facts).rules.some((rule) => rule.startsWith('organization/')), false);
});

test('organization heuristics honor the graph test and generated exclusions', async () => {
  const { evaluate } = await import('../evaluate/index.mjs');
  const facts = { repository: { language: 'ts' }, files: [
    { path: 'src/util.ts', role: 'source', sourceText: 'export function util() {}' },
    { path: 'src/a.ts', role: 'source', sourceText: 'process.argv; const fs = require("fs"); render(view); class Model {}' },
    { path: 'test/util.ts', role: 'test', sourceText: 'process.argv; const fs = require("fs"); render(view); class Model {}' },
    { path: 'generated/common.ts', role: 'generated', sourceText: 'process.argv; const fs = require("fs"); render(view); class Model {}' },
  ], imports: [], functions: [] };
  const graph = { repository: facts.repository, modules: [], edges: [], fileModules: {}, excluded: { roles: ['test', 'generated'], files: 2 } };
  const config = { rules: { organization: { mixedRoles: { enabled: true }, folderRoles: { enabled: true }, genericName: { enabled: true } } }, ignore: [] };
  const findings = evaluate(graph, config, facts).diagnostics.filter((finding) => finding.dimension === 'organization');
  assert.ok(findings.length);
  assert.ok(findings.every((finding) => !JSON.stringify(finding).includes('test/') && !JSON.stringify(finding).includes('generated/')));
});
