import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));

test('repository runner discovers every test suite from an unrelated working directory', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-discovery-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const preload = path.join(directory, 'capture.cjs');
  fs.writeFileSync(preload, `
const childProcess = require('node:child_process');
childProcess.spawnSync = (command, args, options) => {
  console.log(JSON.stringify({ command, args, cwd: options.cwd }));
  return { status: 0 };
};
require('node:module').syncBuiltinESMExports();
`);
  const result = spawnSync(process.execPath, ['--require', preload, path.join(repoRoot, 'scripts/run-tests.mjs')], {
    cwd: directory, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const invocation = JSON.parse(result.stdout);
  assert.equal(fs.realpathSync(invocation.cwd), fs.realpathSync(repoRoot));
  const expected = fs.readdirSync(path.join(repoRoot, 'test'))
    .filter(file => file.endsWith('.test.mjs')).sort().map(file => path.join('test', file));
  assert.deepEqual(invocation.args.filter(arg => !arg.startsWith('--')), expected);
  for (const file of expected) assert.ok(fs.existsSync(path.join(invocation.cwd, file)), file);
  assert.equal(fs.existsSync(path.join(repoRoot, 'archify/test')), false);
});
