// A2: the CLI summary repeats the coverage the overview already records.
// A parse failure or a file in another language must be visible in both the
// text and the JSON receipt. Showing it does not change the gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const CHECK = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'check.mjs');

function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-check-coverage-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

function check(root, args) {
  return spawnSync(process.execPath, [CHECK, root, ...args], { encoding: 'utf8', timeout: 60000 });
}

test('check: the summary shows a parse failure and a language that was not analyzed', (t) => {
  const root = fixture(t, {
    'src/ok.py': 'value = 1\n',
    'src/broken.py': 'value = 1\0\n',
    'src/Note.java': 'class Note {}',
  });
  const out = path.join(root, 'out');

  const json = check(root, ['--language', 'py', '--out', out, '--json']);
  assert.equal(json.status, 0, json.stdout + json.stderr);
  const receipt = JSON.parse(json.stdout);
  assert.deepEqual(receipt.coverage.parseErrors, ['src/broken.py']);
  assert.deepEqual(receipt.coverage.otherLanguages, [{ adapter: 'java', files: 1 }]);

  const overview = JSON.parse(fs.readFileSync(path.join(out, 'overview.json'), 'utf8'));
  assert.deepEqual(receipt.coverage.parseErrors, overview.coverage.files.parseErrors);
  assert.deepEqual(receipt.coverage.otherLanguages, overview.coverage.otherLanguages);

  const text = check(root, ['--language', 'py']);
  assert.equal(text.status, 0, text.stdout + text.stderr);
  assert.match(text.stdout, /Not analyzed, parse failed: src\/broken\.py/);
  assert.match(text.stdout, /Not analyzed, other language: 1 java/);
});

test('check: a clean run says nothing about coverage and the gate is unchanged', (t) => {
  const root = fixture(t, { 'src/ok.py': 'value = 1\n' });
  const json = check(root, ['--language', 'py', '--json']);
  assert.equal(json.status, 0, json.stdout + json.stderr);
  const receipt = JSON.parse(json.stdout);
  assert.deepEqual(receipt.coverage, { parseErrors: [], otherLanguages: [] });
  assert.equal(receipt.status, 'ok');

  const text = check(root, ['--language', 'py']);
  assert.equal(text.status, 0, text.stdout + text.stderr);
  assert.doesNotMatch(text.stdout, /Not analyzed/);
});

test('check: imports bounded SARIF findings without running the external tool', (t) => {
  const root = fixture(t, { 'src/ok.py': 'value = 1\n' });
  const sarif = path.join(root, 'results.sarif');
  fs.writeFileSync(sarif, JSON.stringify({ version: '2.1.0', runs: [{ tool: { driver: { name: 'ruff' } }, results: [{ ruleId: 'X001', level: 'error', message: { text: 'review this' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/ok.py' }, region: { startLine: 1 } } }] }] }] }));
  const json = check(root, ['--language', 'py', '--sarif', sarif, '--json']);
  assert.equal(json.status, 1, json.stdout + json.stderr);
  const receipt = JSON.parse(json.stdout);
  assert.equal(receipt.gate.failing[0].code, 'external/ruff');
  assert.equal(receipt.gate.failing[0].severity, 'warning');
  assert.equal(receipt.rules.includes('external/ruff'), true);
});

test('check: imports native ESLint and Ruff JSON without executing either tool', (t) => {
  const root = fixture(t, { 'src/ok.py': 'value = 1\n', 'src/app.js': 'alert(1)\n' });
  const eslint = path.join(root, 'eslint.json');
  fs.writeFileSync(eslint, JSON.stringify([{ filePath: path.join(root, 'src/app.js'), messages: [{ ruleId: 'no-alert', severity: 2, message: 'Avoid alert', line: 1, column: 1 }] }]));
  const eslintRun = check(root, ['--language', 'py', '--eslint', eslint, '--json']);
  assert.equal(eslintRun.status, 1, eslintRun.stdout + eslintRun.stderr);
  const eslintReceipt = JSON.parse(eslintRun.stdout);
  assert.equal(eslintReceipt.gate.failing[0].code, 'external/eslint');
  const ruff = path.join(root, 'ruff.json');
  fs.writeFileSync(ruff, JSON.stringify([{ filename: 'src/ok.py', code: 'F401', message: 'unused import', location: { row: 1, column: 1 } }]));
  const ruffRun = check(root, ['--language', 'py', '--ruff', ruff, '--json']);
  assert.equal(ruffRun.status, 1, ruffRun.stdout + ruffRun.stderr);
  assert.equal(JSON.parse(ruffRun.stdout).gate.failing[0].code, 'external/ruff');
});

test('check: external diagnostics participate in a comparable follow-up run', (t) => {
  const root = fixture(t, { 'src/app.js': 'alert(1)\n' });
  const report = path.join(root, 'eslint.json');
  const out = path.join(root, 'out');
  fs.writeFileSync(report, JSON.stringify([{ filePath: path.join(root, 'src/app.js'), messages: [{ ruleId: 'no-alert', severity: 2, message: 'Avoid alert', line: 1, column: 1 }] }]));
  const first = check(root, ['--language', 'ts', '--eslint', report, '--out', out, '--json', '--fail-on', 'never']);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const previous = path.join(out, 'findings.json');
  fs.writeFileSync(path.join(root, 'src/app.js'), 'alert(2)\n');
  const second = check(root, ['--language', 'ts', '--eslint', report, '--compare', previous, '--json', '--fail-on', 'never']);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  const receipt = JSON.parse(second.stdout);
  assert.equal(receipt.review.comparison.comparable, true);
  assert.equal(receipt.review.comparison.evidenceChanged, 1);
});
