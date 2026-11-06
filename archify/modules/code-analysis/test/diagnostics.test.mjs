import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importSarif } from '../lib/diagnostics.mjs';

const sarif = (result) => ({ version: '2.1.0', runs: [{ tool: { driver: { name: 'eslint', version: '9', rules: [{ id: 'no-alert', shortDescription: { text: 'Avoid alert' } }] } }, results: [result] }] });

test('SARIF import preserves source, rule, original level, location and normalized warning', () => {
  const [finding] = importSarif(sarif({ ruleId: 'no-alert', level: 'error', message: { text: 'Avoid alert.' }, locations: [{ physicalLocation: { artifactLocation: { uri: 'src/app.js' }, region: { startLine: 4, startColumn: 2 } } }] }), { root: 'D:/repo', source: 'eslint', importedAt: '2026-11-06T00:00:00Z' });
  assert.equal(finding.code, 'external/eslint');
  assert.equal(finding.severity, 'warning');
  assert.equal(finding.evidence.originalLevel, 'error');
  assert.deepEqual(finding.subject, { file: 'src/app.js', line: 4, column: 2, rule: 'no-alert', tool: 'eslint' });
  assert.equal(finding.evidence.locations[0].status, 'ok');
  assert.equal(finding.evidence.ruleDescription, 'Avoid alert');
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
