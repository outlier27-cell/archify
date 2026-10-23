import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PROJECT_FEEDBACK_URL = 'https://github.com/tt-a1i/archify/issues/new?template=artifact-feedback.yml';
const UPDATE_MANIFEST_URL = 'https://tt-a1i.github.io/archify/skill-updates/archify/stable.json';
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
const PLACEHOLDER = /[{}]/;
const packagePath = fileURLToPath(new URL('../../package.json', import.meta.url));
const packageVersion = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;

export const readerDisclosureSchemaVersion = 1;

export function validateFeedbackDestination(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).sort().join('\0') !== 'href\0label'
    || typeof value.label !== 'string' || typeof value.href !== 'string'
    || !value.label.trim() || value.label.length > 80
    || CONTROL_OR_BIDI.test(value.label) || CONTROL_OR_BIDI.test(value.href)
    || PLACEHOLDER.test(value.href)) return null;
  let url;
  try { url = new URL(value.href); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash
    || url.href !== value.href || value.href.length > 2048) return null;
  return { label: value.label.trim(), href: value.href, source: 'author' };
}

export function createReaderDisclosure({ artifactType, content, feedback = null }) {
  if (typeof artifactType !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(artifactType)) {
    throw new Error(`Invalid reader disclosure artifact type: ${JSON.stringify(artifactType)}`);
  }
  if (typeof content !== 'string') throw new Error('Reader disclosure content must be a string.');
  return {
    schemaVersion: readerDisclosureSchemaVersion,
    artifact: {
      type: artifactType,
      generatorVersion: packageVersion,
      // This digests renderer-owned canonical content, avoiding impossible
      // self-referential hashing of the complete generated HTML file.
      contentSha256: createHash('sha256').update(content).digest('hex'),
    },
    feedback: validateFeedbackDestination(feedback) || {
      label: 'Share feedback with Archify', href: PROJECT_FEEDBACK_URL, source: 'project',
    },
    update: { manifestUrl: UPDATE_MANIFEST_URL, channel: 'stable' },
  };
}
