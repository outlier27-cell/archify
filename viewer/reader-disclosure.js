(function () {
  'use strict';
  var trigger = document.getElementById('btn-reader-disclosure');
  var dialog = document.getElementById('reader-disclosure');
  var payloadNode = document.getElementById('archify-reader-disclosure-data');
  if (!trigger || !dialog || !payloadNode) return;
  var payload;
  try { payload = JSON.parse(payloadNode.textContent); } catch (_) { trigger.hidden = true; return; }
  var artifact = payload && payload.artifact;
  var feedback = payload && payload.feedback;
  var update = payload && payload.update;
  var safeHttps = function (value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.hash && url.href === value ? url : null;
    } catch (_) { return null; }
  };
  var stableVersion = function (value) { return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value); };
  var exactKeys = function (value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\0') === keys.slice().sort().join('\0'); };
  var validManifest = function (value) {
    if (!exactKeys(value, ['schemaVersion', 'skillId', 'channel', 'version', 'publishedAt', 'source', 'artifact', 'summary', 'releaseNotes', 'severity'])
      || value.schemaVersion !== 1 || value.skillId !== 'archify' || value.channel !== 'stable' || !stableVersion(value.version)
      || !exactKeys(value.source, ['repository', 'ref', 'treeSha']) || value.source.repository !== 'https://github.com/tt-a1i/archify' || value.source.ref !== 'v' + value.version || !/^[a-f0-9]{40}$/.test(value.source.treeSha)
      || !exactKeys(value.artifact, ['sha256']) || !/^[a-f0-9]{64}$/.test(value.artifact.sha256)
      || typeof value.summary !== 'string' || !value.summary || value.summary.length > 160 || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value.summary)
      || value.releaseNotes !== 'https://github.com/tt-a1i/archify/releases/tag/v' + value.version || !['normal', 'security'].includes(value.severity)
      || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(value.publishedAt) || Number.isNaN(Date.parse(value.publishedAt))) return null;
    return value;
  };
  var compareStableVersion = function (left, right) { var a = left.split('.').map(Number), b = right.split('.').map(Number); for (var i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
  if (!artifact || payload.schemaVersion !== 1 || !/^[a-f0-9]{64}$/.test(artifact.contentSha256)
    || !safeHttps(feedback && feedback.href) || !safeHttps(update && update.manifestUrl)) { trigger.hidden = true; return; }
  var facts = document.getElementById('reader-disclosure-facts');
  var summary = document.getElementById('reader-disclosure-summary');
  var status = document.getElementById('reader-disclosure-status');
  var feedbackLink = document.getElementById('reader-disclosure-feedback');
  var originalFocus = null;
  var context = [
    'Archify artifact feedback',
    'type: ' + artifact.type,
    'generator: ' + artifact.generatorVersion,
    'content-sha256: ' + artifact.contentSha256,
  ].join('\n');
  summary.textContent = 'This standalone artifact includes a local build identity. Nothing is sent until you copy context, open feedback, or check for an update.';
  [['Type', artifact.type], ['Generator', artifact.generatorVersion], ['Content identity', artifact.contentSha256]].forEach(function (pair) {
    var term = document.createElement('dt'); term.textContent = pair[0];
    var definition = document.createElement('dd'); definition.textContent = pair[1];
    facts.appendChild(term); facts.appendChild(definition);
  });
  feedbackLink.href = feedback.href;
  feedbackLink.textContent = feedback.label;
  trigger.textContent = 'Archify ' + artifact.generatorVersion;
  trigger.addEventListener('click', function () { originalFocus = trigger; dialog.showModal(); dialog.querySelector('header button').focus(); });
  dialog.addEventListener('close', function () { if (originalFocus) originalFocus.focus(); });
  document.getElementById('reader-disclosure-copy').addEventListener('click', function () {
    copyReaderText(context).then(function (copied) { status.textContent = copied ? 'Diagnostic context copied locally.' : 'Copy was unavailable; select the identity above instead.'; });
  });
  document.getElementById('reader-disclosure-update').addEventListener('click', function () {
    var button = this;
    button.disabled = true; status.textContent = 'Checking the fixed stable manifest…';
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 5000);
    fetch(update.manifestUrl, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal })
      .then(function (response) { if (!response.ok) throw new Error('manifest unavailable'); return response.text(); })
      .then(function (text) {
        if (text.length > 65536) throw new Error('manifest too large');
        var manifest = validManifest(JSON.parse(text));
        if (!manifest || !stableVersion(artifact.generatorVersion)) { status.textContent = 'Update status unavailable for this development artifact. No update result was recorded.'; return; }
        status.textContent = compareStableVersion(artifact.generatorVersion, manifest.version) >= 0 ? 'Current stable version: ' + manifest.version + '.' : 'Stable version available: ' + manifest.version + '.';
      })
      .catch(function () { status.textContent = 'Update status unavailable. No update result was recorded.'; })
      .finally(function () { clearTimeout(timeout); button.disabled = false; });
  });
})();
