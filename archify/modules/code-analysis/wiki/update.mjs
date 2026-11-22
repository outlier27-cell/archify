import fs from 'node:fs';
import path from 'node:path';
import { fail, rangeDigest, splitLines } from '../core/index.mjs';
import { git } from '../lib/git-sources.mjs';

const pin = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const MAX_WINDOWS = 2_000_000;
const MAX_MATCHED_LINES = 2_000_000;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const states = ['same', 'shifted', 'moved', 'touched', 'deleted', 'ambiguous', 'unavailable'];
const invalid = () => fail('wiki/update-input-invalid', 'Use an Archify wiki.json for the same scope and language, with valid pinned citation records.');

export function checkPreviousWiki(doc, scope, language) {
  if (doc?.schemaVersion !== 1 || doc.kind !== 'archify-repository-wiki' ||
      !pin.test(doc.repository?.revision) || doc.repository.scope !== scope || doc.coverage?.language !== language ||
      !Array.isArray(doc.citations) || doc.citations.length > 50_000 ||
      !Array.isArray(doc.guides) || doc.guides.length > 30) invalid();
  const prefix = scope === '.' ? '' : scope + '/';
  const ids = new Set();
  for (const item of doc.citations) {
    if (typeof item?.id !== 'string' || !/^source-[1-9]\d*$/.test(item.id) || ids.has(item.id) ||
        typeof item.path !== 'string' || !item.path.startsWith(prefix) ||
        item.path.split('/').some(part => !part || ['.', '..', '.git'].includes(part.toLowerCase()) || /[\\:\u0000-\u001f]/u.test(part)) ||
        !Number.isSafeInteger(item.startLine) || !Number.isSafeInteger(item.endLine) ||
        item.startLine < 1 || item.endLine < item.startLine || !digest.test(item.sha256)) invalid();
    ids.add(item.id);
  }
  if (doc.guides.some(guide => typeof guide?.title !== 'string' || guide.title.length > 140 ||
      !Array.isArray(guide.citations) || guide.citations.length > 8 || guide.citations.some(id => !ids.has(id)))) invalid();
}

async function renames(root, before, after) {
  if (before === after) return new Map();
  const diff = await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-relative', '--name-status', '-z',
    '--diff-filter=R', '-M50%', '-l1000', before, after, '--'], { noLazyFetch: true });
  if (!diff.length) return new Map();
  const records = decoder.decode(diff).split('\0');
  records.pop();
  const paths = new Map();
  for (let i = 0; i < records.length; i += 3) {
    if (!/^R\d+$/.test(records[i]) || !records[i + 1] || !records[i + 2]) invalid();
    paths.set(records[i + 1], records[i + 2]);
  }
  return paths;
}

function sourceReader(root, omitted, prefix) {
  const cached = new Map();
  return file => {
    if (!file.startsWith(prefix)) return { state: 'unavailable' };
    if (cached.has(file)) return cached.get(file);
    const relative = file.slice(prefix.length);
    if (omitted.has(relative) || relative.split('/').includes('node_modules')) return { state: 'unavailable' };
    let source;
    try {
      const value = fs.readFileSync(path.join(root, ...relative.split('/')));
      source = { lines: splitLines(decoder.decode(value)) };
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') source = { state: 'deleted' };
      else if (error.code === 'ERR_ENCODING_INVALID_ENCODED_DATA' || error.code === 'EISDIR') source = { state: 'unavailable' };
      else throw error;
    }
    cached.set(file, source);
    return source;
  };
}

export async function compareWikiCitations({ previous, previousSha256, repo, revision, beforeRoot, afterRoot, beforeOmitted, afterOmitted }) {
  const base = previous.repository.revision;
  const moves = await renames(repo, base, revision);
  const prefix = previous.repository.scope === '.' ? '' : previous.repository.scope + '/';
  const before = sourceReader(beforeRoot, beforeOmitted, prefix);
  const after = sourceReader(afterRoot, afterOmitted, prefix);
  let work = 0, comparedLines = 0;
  const counts = Object.fromEntries(states.map(state => [state, 0]));
  const sameTree = new Map();
  const citations = previous.citations.map(cite => {
    const original = before(cite.path);
    if (!original.lines || cite.endLine > original.lines.length || rangeDigest(original.lines, cite.startLine, cite.endLine) !== cite.sha256) {
      fail('wiki/update-citation-invalid', 'A previous wiki citation cannot be verified at its recorded commit.', {
        subject: { file: cite.path, citation: cite.id }, evidence: { commit: base },
      });
    }
    const relocatedPath = moves.get(cite.path) || cite.path;
    const target = after(relocatedPath);
    let state = target.state, next = null;
    if (target.lines) {
      const matchAt = start => {
        for (let i = 0; i <= cite.endLine - cite.startLine; i++) {
          comparedLines++;
          if (original.lines[cite.startLine - 1 + i] !== target.lines[start - 1 + i]) return false;
          if (comparedLines > MAX_MATCHED_LINES) return false;
        }
        return true;
      };
      if (!sameTree.has(cite.path)) {
        sameTree.set(cite.path, original.lines.length === target.lines.length && original.lines.every((line, i) => line === target.lines[i]));
      }
      const length = cite.endLine - cite.startLine + 1;
      let found = null;
      if (sameTree.get(cite.path)) found = cite.startLine;
      else for (let i = 1; i <= target.lines.length - length + 1; i++) {
        if (++work > MAX_WINDOWS || comparedLines > MAX_MATCHED_LINES) { state = 'unavailable'; break; }
        if (!matchAt(i)) continue;
        if (found !== null) { state = 'ambiguous'; break; }
        found = i;
      }
      if (!state && comparedLines > MAX_MATCHED_LINES && !sameTree.get(cite.path)) state = 'unavailable';
      if (!state && found === null) state = 'touched';
      if (!state) {
        next = { path: relocatedPath, startLine: found, endLine: found + length - 1, sha256: cite.sha256 };
        state = cite.path !== relocatedPath ? 'moved' : cite.startLine !== found ? 'shifted' : 'same';
      }
    }
    counts[state]++;
    return { id: cite.id, state, previous: { path: cite.path, startLine: cite.startLine, endLine: cite.endLine, sha256: cite.sha256 }, next };
  });
  const byId = new Map(citations.map(cite => [cite.id, cite]));
  const guides = previous.guides.map(guide => ({ title: guide.title, citations: guide.citations,
    evidence: guide.citations.every(id => byId.get(id).next) ? 'excerpt-continuity' : 'needs-new-evidence',
    claim: 'review-required' }));
  return { schemaVersion: 1, kind: 'archify-wiki-update', base, head: revision, scope: previous.repository.scope,
    previousSha256, counts, citations, guides };
}
