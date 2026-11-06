// Small deterministic exact-token detector used for calibrated experiments.
// It keeps identifiers and literals, ignores comments/whitespace, groups
// overlapping windows, and leaves semantic similarity to the reviewer.
export function findDuplicateGroups(files, { minTokens = 40, minLines = 7, exclude = () => false } = {}) {
  const windows = new Map();
  for (const file of files) {
    if (exclude(file)) continue;
    const tokens = tokenize(file.sourceText || '');
    for (let i = 0; i + minTokens <= tokens.length; i += 1) {
      const key = tokens.slice(i, i + minTokens).join('\u0001');
      const line = lineAt(file.sourceText || '', tokens[i].offset);
      const list = windows.get(key) || [];
      if (!list.some((entry) => entry.file === file.path)) list.push({ file: file.path, startLine: line, endLine: line + minLines - 1 });
      windows.set(key, list);
    }
  }
  return [...windows.entries()].filter(([, locations]) => locations.length > 1).map(([key, locations]) => ({
    id: `DUP-${hash(key).slice(0, 12)}`, tokenCount: minTokens, locations: locations.sort((a, b) => a.file.localeCompare(b.file)),
  })).sort((a, b) => a.id.localeCompare(b.id));
}

function tokenize(source) {
  const tokens = []; let i = 0;
  while (i < source.length) {
    const rest = source.slice(i); const match = rest.match(/^(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*|\s+|([A-Za-z_$][\w$]*|\d+(?:\.\d+)?|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|===|!==|=>|==|!=|<=|>=|&&|\|\||[{}()[\].,:;?+*/%<>=!-]))/);
    if (!match) { i += 1; continue; }
    if (match[1]) tokens.push({ value: match[1], offset: i });
    i += match[0].length;
  }
  return tokens;
}
function lineAt(source, offset) { return source.slice(0, offset).split(/\r?\n/).length; }
function hash(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(16).padStart(12, '0'); }
