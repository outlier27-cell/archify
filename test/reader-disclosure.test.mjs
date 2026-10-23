import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createReaderDisclosure, validateFeedbackDestination } from '../archify/renderers/shared/reader-disclosure.mjs';
import { validateSchema } from '../archify/renderers/shared/validator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('reader disclosure contains a stable, redacted artifact identity and fixed feedback route', () => {
  const disclosure = createReaderDisclosure({ artifactType: 'architecture', content: '<svg>private title</svg>' });
  assert.equal(disclosure.schemaVersion, 1);
  assert.equal(disclosure.artifact.type, 'architecture');
  assert.match(disclosure.artifact.contentSha256, /^[a-f0-9]{64}$/);
  assert.match(disclosure.artifact.generatorVersion, /^\d+\.\d+\.\d+/);
  assert.equal(disclosure.feedback.href, 'https://github.com/tt-a1i/archify/issues/new?template=artifact-feedback.yml');
  assert.equal(JSON.stringify(disclosure).includes('private title'), false);
});

test('reader disclosure only accepts an explicit safe HTTPS feedback destination', () => {
  assert.deepEqual(validateFeedbackDestination({ label: 'Team feedback', href: 'https://example.com/feedback' }), {
    label: 'Team feedback', href: 'https://example.com/feedback', source: 'author',
  });
  for (const value of [
    { label: 'Bad', href: 'http://example.com' },
    { label: 'Bad', href: 'https://user:pass@example.com' },
    { label: 'Bad', href: 'https://example.com/{context}' },
    { label: 'Bad\nlabel', href: 'https://example.com' },
  ]) assert.equal(validateFeedbackDestination(value), null);
});

test('native render emits the reader disclosure before its interaction runtime', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-reader-disclosure-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'diagram.html');
  execFileSync(process.execPath, [path.join(root, 'archify/bin/archify.mjs'), 'render', 'architecture', path.join(root, 'archify/examples/web-app.architecture.json'), output]);
  const html = fs.readFileSync(output, 'utf8');
  const match = html.match(/<script id="archify-reader-disclosure-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'native artifact includes reader disclosure data');
  const payload = JSON.parse(match[1]);
  assert.equal(payload.artifact.type, 'architecture');
  assert.ok(html.indexOf(match[0]) < html.indexOf('var Archify = {}'), 'reader payload loads before its runtime');
  assert.match(html, /id="btn-reader-disclosure"/);
});

test('typed diagrams accept only the declared feedback destination shape', () => {
  const input = JSON.parse(fs.readFileSync(path.join(root, 'archify/examples/web-app.architecture.json'), 'utf8'));
  input.meta.feedback = { label: 'Project feedback', href: 'https://example.com/feedback' };
  assert.doesNotThrow(() => validateSchema('architecture', input));
  input.meta.feedback = { label: 'Missing destination' };
  assert.throws(() => validateSchema('architecture', input), /feedback/);
});
