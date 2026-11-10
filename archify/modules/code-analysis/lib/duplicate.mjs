import { createHash } from 'node:crypto';

// Small deterministic exact-token detector used for calibrated experiments.
// It keeps identifiers and literals, ignores comments/whitespace, grows equal
// seed windows into maximal matches, and leaves semantic similarity to review.
export function findDuplicateGroups(files, { minTokens = 40, minLines = 7, exclude = () => false } = {}) {
  const sources = [];
  const windows = new Map();
  for (const file of files) {
    if (exclude(file)) continue;
    const source = { file: file.path, tokens: tokenize(file.sourceText || '') };
    sources.push(source);
    for (let index = 0; index + minTokens <= source.tokens.length; index += 1) {
      const seed = source.tokens.slice(index, index + minTokens);
      const key = seed.map((token) => token.value).join('\u0001');
      const list = windows.get(key) || [];
      list.push({ source, index });
      windows.set(key, list);
    }
  }

  const matches = new Map();
  for (const occurrences of windows.values()) {
    if (occurrences.length < 2) continue;
    for (const [first, second] of comparisonPairs(occurrences)) addMaximalMatch(matches, first, second, minTokens, minLines);
  }

  const groups = removeContainedGroups([...matches.values()].filter((group) => group.occurrences.size > 1));
  return groups.map((group) => {
    const occurrences = [...group.occurrences.values()].sort((a, b) => a.file.localeCompare(b.file) || a.startToken - b.startToken || a.endToken - b.endToken);
    const identity = occurrences.map((location) => `${location.file}:${location.startToken}-${location.endToken}`).join('\u0001');
    return {
      id: `DUP-${createHash('sha256').update(`${group.sequenceKey}\u0000${identity}`).digest('hex').slice(0, 12)}`,
      tokenCount: group.tokenCount,
      locations: occurrences.map(({ file, startLine, endLine }) => ({ file, startLine, endLine })),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function comparisonPairs(occurrences) {
  const byFile = new Map();
  for (const occurrence of occurrences) {
    const list = byFile.get(occurrence.source.file) || [];
    list.push(occurrence);
    byFile.set(occurrence.source.file, list);
  }
  const files = [...byFile.keys()].sort();
  const pairs = [];
  // Adjacent positions are enough to discover separate occurrences in one file.
  for (const file of files) {
    const local = byFile.get(file).sort((a, b) => a.index - b.index);
    for (let index = 1; index < local.length; index += 1) pairs.push([local[index - 1], local[index]]);
  }
  // One representative per file establishes cross-file membership. Every other
  // occurrence is compared with a representative from another file, so its
  // maximal range is still recovered without the full cross product.
  if (files.length > 1) {
    const representatives = files.map((file) => byFile.get(file)[0]);
    for (let index = 1; index < representatives.length; index += 1) pairs.push([representatives[0], representatives[index]]);
    const alternate = representatives[1];
    for (const file of files) for (const occurrence of byFile.get(file).slice(1)) pairs.push([file === files[0] ? alternate : representatives[0], occurrence]);
  }
  return pairs;
}

function addMaximalMatch(matches, first, second, minTokens, minLines) {
  const a = first.source.tokens;
  const b = second.source.tokens;
  let aStart = first.index;
  let bStart = second.index;
  let aEnd = first.index + minTokens - 1;
  let bEnd = second.index + minTokens - 1;
  const sameSource = first.source === second.source;
  while (aStart > 0 && bStart > 0 && (!sameSource || aStart - 1 > bEnd || bStart - 1 > aEnd) && a[aStart - 1].value === b[bStart - 1].value) { aStart -= 1; bStart -= 1; }
  while (aEnd + 1 < a.length && bEnd + 1 < b.length && (!sameSource || aEnd + 1 < bStart || bEnd + 1 < aStart) && a[aEnd + 1].value === b[bEnd + 1].value) { aEnd += 1; bEnd += 1; }
  if (sameSource && aStart <= bEnd && bStart <= aEnd) return;
  if (a[aEnd].line - a[aStart].line + 1 < minLines || b[bEnd].line - b[bStart].line + 1 < minLines) return;

  const values = a.slice(aStart, aEnd + 1).map((token) => token.value);
  const sequenceKey = `${values.length}\u0000${values.join('\u0001')}`;
  const group = matches.get(sequenceKey) || { sequenceKey, tokenCount: values.length, occurrences: new Map() };
  addOccurrence(group, first.source, aStart, aEnd);
  addOccurrence(group, second.source, bStart, bEnd);
  matches.set(sequenceKey, group);
}

function addOccurrence(group, source, startToken, endToken) {
  const occurrence = {
    file: source.file,
    startToken,
    endToken,
    startLine: source.tokens[startToken].line,
    endLine: source.tokens[endToken].line,
  };
  group.occurrences.set(`${occurrence.file}:${startToken}-${endToken}`, occurrence);
}

// A maximal sequence can still be discovered from several seeds. Keep one copy,
// and drop a shorter group only when the same occurrence set is completely
// contained by a longer group. A sequence repeated in more places remains useful.
function removeContainedGroups(groups) {
  const ordered = [...groups].sort((a, b) => b.tokenCount - a.tokenCount || a.sequenceKey.localeCompare(b.sequenceKey));
  const kept = [];
  for (const group of ordered) {
    const occurrences = [...group.occurrences.values()];
    const contained = kept.some((larger) => larger.occurrences.size === group.occurrences.size && occurrences.every((small) =>
      [...larger.occurrences.values()].some((large) => large.file === small.file && large.startToken <= small.startToken && large.endToken >= small.endToken)));
    if (!contained) kept.push(group);
  }
  return kept;
}

function tokenize(source) {
  const tokens = []; let index = 0;
  while (index < source.length) {
    if (source[index] === '`') {
      const start = index; index += 1;
      while (index < source.length) {
        if (source[index] === '\\') { index += 2; continue; }
        if (source[index] === '`') { index += 1; break; }
        index += 1;
      }
      tokens.push({ value: source.slice(start, index), offset: start });
      continue;
    }
    const rest = source.slice(index); const match = rest.match(/^(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|\s+|([A-Za-z_$][\w$]*|\d+(?:\.\d+)?|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|===|!==|=>|==|!=|<=|>=|&&|\|\||[{}()[\].,:;?+*/%<>=!-]))/);
    if (!match) { index += 1; continue; }
    if (match[1]) tokens.push({ value: match[1], offset: index });
    index += match[0].length;
  }
  let line = 1; let cursor = 0;
  for (const token of tokens) {
    for (let position = cursor; position < token.offset; position += 1) if (source[position] === '\n') line += 1;
    token.line = line;
    cursor = token.offset;
  }
  return tokens;
}
