import path from 'node:path';
import { analyzedFiles, confidence, enabled, roleEvidence } from './helpers.mjs';
export const code = 'organization/folder-roles';
export const dimension = 'organization';
export const severity = 'warning';
export const version = 1;
export const enabledRule = (config, facts) => enabled(config, 'folderRoles', facts);
export { enabledRule as enabled };
export function run({ graph, facts }) {
  const folders = new Map();
  for (const file of analyzedFiles(graph, facts)) {
    const folder = path.posix.dirname(file.path);
    const roles = new Set(roleEvidence(file).map((entry) => entry.role));
    if (!folders.has(folder)) folders.set(folder, new Map());
    for (const role of roles) { if (!folders.get(folder).has(role)) folders.get(folder).set(role, []); folders.get(folder).get(role).push({ file: file.path, triggers: roleEvidence(file).filter((entry) => entry.role === role) }); }
  }
  return [...folders].filter(([, roles]) => roles.size >= 3).map(([folder, roles]) => ({
    code, dimension, severity, confidence, message: `${folder} contains files from ${roles.size} detected responsibilities.`,
    subject: { module: folder }, evidence: { threshold: null, roles: Object.fromEntries([...roles].sort().map(([role, files]) => [role, files.sort((a, b) => a.file.localeCompare(b.file))])) },
    supportedFixes: ['review whether the directory boundary matches ownership and change patterns', 'keep mixed responsibilities together when the project convention makes the boundary intentional'],
  }));
}
