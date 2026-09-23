import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const statuses = new Set(['planned', 'observed', 'supported', 'unknown']);
const id = /^[A-Za-z][A-Za-z0-9_-]*$/;
const hash = /^[a-f0-9]{64}$/;

export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function diagnostic(code, subject, message, supportedFixes = []) {
  return { code, severity: 'error', subject, message, evidence: {}, supportedFixes };
}

function collect(records, field, diagnostics) {
  const ids = new Set();
  for (const [index, record] of (records || []).entries()) {
    if (!record || typeof record !== 'object' || !id.test(record.id || '')) {
      diagnostics.push(diagnostic('research/invalid-id', { path: `/${field}/${index}/id` }, 'Every record requires a stable id.'));
      continue;
    }
    if (ids.has(record.id)) diagnostics.push(diagnostic('research/duplicate-id', { path: `/${field}/${index}/id`, id: record.id }, 'Record ids must be unique.'));
    ids.add(record.id);
    if (!statuses.has(record.status)) diagnostics.push(diagnostic('research/invalid-status', { path: `/${field}/${index}/status`, id: record.id }, 'Status must be planned, observed, supported, or unknown.'));
    if (['datasets', 'code', 'assets'].includes(field) && !hash.test(record.sha256 || '')) diagnostics.push(diagnostic('research/missing-hash', { path: `/${field}/${index}/sha256`, id: record.id }, 'Evidence sources require a SHA-256 hash.'));
  }
  return ids;
}

export function validateManifest(manifest) {
  const diagnostics = [];
  if (!manifest || manifest.schema_version !== 1 || manifest.kind !== 'research-evidence-manifest') {
    diagnostics.push(diagnostic('research/schema', { path: '/' }, 'Expected schema_version 1 and kind research-evidence-manifest.'));
    return diagnostics;
  }
  if (!manifest.revision || !id.test(manifest.revision.id || '') || !hash.test(manifest.revision.sha256 || '') || !manifest.revision.commit) {
    diagnostics.push(diagnostic('research/revision-invalid', { path: '/revision' }, 'Revision requires id, commit, and SHA-256.'));
  }
  const datasets = collect(manifest.datasets, 'datasets', diagnostics);
  const code = collect(manifest.code, 'code', diagnostics);
  const runs = collect(manifest.runs, 'runs', diagnostics);
  const assets = collect(manifest.assets, 'assets', diagnostics);
  collect(manifest.claims, 'claims', diagnostics);
  for (const run of manifest.runs || []) {
    if (run.revision !== manifest.revision?.id) diagnostics.push(diagnostic('research/revision-drift', { id: run?.id }, 'Run revision must bind to the manifest revision.', ['set run.revision to the manifest revision id']));
    if (!datasets.has(run.dataset)) diagnostics.push(diagnostic('research/source-missing', { id: run?.id, source: run?.dataset }, 'Run dataset source does not exist.'));
    if (!code.has(run.code)) diagnostics.push(diagnostic('research/source-missing', { id: run?.id, source: run?.code }, 'Run code source does not exist.'));
  }
  for (const asset of manifest.assets || []) if (!runs.has(asset.run)) diagnostics.push(diagnostic('research/source-missing', { id: asset?.id, source: asset?.run }, 'Asset run does not exist.'));
  for (const claim of manifest.claims || []) {
    if (!Array.isArray(claim.evidence) || !claim.evidence.length) diagnostics.push(diagnostic('research/claim-without-evidence', { id: claim?.id }, 'Claims require at least one evidence asset.'));
    for (const evidence of claim.evidence || []) if (!assets.has(evidence)) diagnostics.push(diagnostic('research/source-missing', { id: claim?.id, source: evidence }, 'Claim evidence asset does not exist.'));
    if (claim.status === 'supported' && !(claim.evidence || []).length) diagnostics.push(diagnostic('research/unsupported-supported-claim', { id: claim?.id }, 'Supported claims require declared evidence.'));
  }
  return diagnostics.sort((a, b) => `${a.code}:${JSON.stringify(a.subject)}`.localeCompare(`${b.code}:${JSON.stringify(b.subject)}`));
}

export function renderManifest(manifest) {
  const rows = (manifest.claims || []).map(claim => `<li data-claim-id="${claim.id}" data-status="${claim.status}"><strong>${escape(claim.id)}</strong>: ${escape(claim.statement)} <small>${escape(claim.status)} | ${claim.evidence.map(escape).join(', ')}</small></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Research Evidence Manifest</title><style>body{font-family:system-ui;max-width:900px;margin:2rem auto;color:#172033}li{margin:.7rem 0}small{color:#52657b}</style></head><body><h1>Research Evidence Manifest</h1><p>Revision: ${escape(manifest.revision.id)} @ ${escape(manifest.revision.commit)}</p><h2>Claims</h2><ul>${rows}</ul></body></html>\n`;
}

function escape(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }

export function readManifest(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
export function writeArtifact(file, html) { fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true }); fs.writeFileSync(file, html); }
