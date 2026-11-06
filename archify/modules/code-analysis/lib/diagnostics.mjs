import path from 'node:path';
import { createHash } from 'node:crypto';
import { fail } from '../extract/shared/diagnostics.mjs';

// Import the small SARIF subset that can be checked against a local repository.
// The adapter never downloads artifacts or executes the producing tool. Results
// outside the selected root remain visible but cannot become actionable tasks.
export function importSarif(document, { root = '.', source = 'sarif', importedAt = null } = {}) {
  if (!document || typeof document !== 'object' || !Array.isArray(document.runs)) fail('diagnostics/sarif-invalid', 'SARIF input must contain a runs array.', { supportedFixes: ['pass a SARIF 2.x document'] });
  const findings = [];
  for (const run of document.runs) {
    const tool = run?.tool?.driver || {};
    const toolName = typeof tool.name === 'string' && tool.name ? tool.name : 'unknown';
    const toolVersion = typeof tool.version === 'string' ? tool.version : null;
    const rules = new Map((Array.isArray(tool.rules) ? tool.rules : []).filter((r) => r && typeof r.id === 'string').map((r) => [r.id, r]));
    for (const result of Array.isArray(run.results) ? run.results : []) {
      if (!result || typeof result !== 'object') continue;
      const rule = typeof result.ruleId === 'string' ? result.ruleId : 'unknown';
      const level = typeof result.level === 'string' ? result.level : 'warning';
      const locations = normalizeLocations(result.locations, root);
      const primary = locations[0] || { file: null, line: null, column: null, status: 'unverifiable', reason: 'SARIF result has no supported location' };
      const message = typeof result.message?.text === 'string' && result.message.text ? result.message.text : `External diagnostic ${rule}`;
      const finding = {
        code: `external/${source.replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'sarif'}`,
        dimension: 'ai-smell', severity: 'warning', confidence: 0.5,
        message, subject: { file: primary.file, line: primary.line, column: primary.column, rule, tool: toolName },
        evidence: { threshold: null, source, tool: toolName, toolVersion, rule, originalLevel: level, ruleDescription: rules.get(rule)?.shortDescription?.text || null, locations, importedAt },
        supportedFixes: primary.status === 'ok' ? ['review the external diagnostic and verify it against the current source before changing code'] : ['re-run or export the diagnostic with a source location inside the repository'],
      };
      finding.id = `AISM-${createHash('sha256').update(JSON.stringify([finding.code, source, toolName, rule, primary.file, primary.line, message])).digest('hex').slice(0, 12)}`;
      findings.push(finding);
    }
  }
  return findings;
}

function normalizeLocations(locations, root) {
  return (Array.isArray(locations) ? locations : []).map((location) => {
    const physical = location?.physicalLocation;
    const uri = physical?.artifactLocation?.uri;
    const line = physical?.region?.startLine;
    const column = physical?.region?.startColumn;
    if (typeof uri !== 'string' || !uri || !Number.isInteger(line) || line < 1) return { file: null, line: null, column: null, status: 'unverifiable', reason: 'missing supported URI or line' };
    const clean = uri.replace(/^file:\/\//, '').replaceAll('\\', '/');
    const relative = path.isAbsolute(clean) ? path.relative(path.resolve(root), path.resolve(clean)) : clean.replace(/^\.\//, '');
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || relative.split('/').includes('..')) return { file: relative || clean, line, column: column || null, status: 'unverifiable', reason: 'location is outside the analysis root' };
    return { file: relative, line, column: column || null, status: 'ok' };
  });
}
