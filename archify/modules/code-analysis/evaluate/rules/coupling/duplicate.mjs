import { findDuplicateGroups } from '../../../lib/duplicate.mjs';

export const code = 'coupling/duplicate-code';
export const dimension = 'coupling';
export const severity = 'warning';
export const confidence = 0.75;
export const version = 3;

export function enabled(config, facts) {
  return config?.rules?.coupling?.duplicateCode?.enabled === true
    && facts?.repository?.language === 'ts'
    && Boolean(facts?.files?.some((file) => typeof file.sourceText === 'string'));
}

export function run({ config, facts }) {
  const options = config.rules.coupling.duplicateCode;
  const excluded = new Set(facts.files.filter((file) => ['test', 'generated', 'vendor', 'third-party'].includes(file.role) || /(^|\/)(node_modules|vendor|third_party|site-packages)(\/|$)/i.test(file.path)).map((file) => file.path));
  return findDuplicateGroups(facts.files.filter((file) => typeof file.sourceText === 'string'), {
    minTokens: options.minTokens,
    minLines: options.minLines,
    exclude: (file) => excluded.has(file.path),
  }).map((group) => ({
    code, dimension, severity, confidence,
    message: `${group.locations.length} JavaScript/TypeScript locations contain an exact repeated lexical sequence of ${group.tokenCount} tokens. This text-level signal does not establish equivalent behavior; review context before considering shared code.`,
    subject: { groupId: group.id, files: [...new Set(group.locations.map((location) => location.file))] },
    evidence: { threshold: { minTokens: options.minTokens, minLines: options.minLines }, tokenCount: group.tokenCount, locations: group.locations },
    supportedFixes: ['compare the repeated ranges side by side and check whether they share behavior, not only syntax', 'keep intentionally similar code separate when ownership or behavior differs'],
  }));
}
