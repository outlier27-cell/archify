# Story SVG regression evidence

Candidate implementation: tt-a1i/archify PR #1393, 5f74658eac3a0f13421f0c6c70e461a16744fcfa.
Base: Labs fc99a76758fccc46a6924abe959d66747a6a001c.
Date: 2026-11-18. Node 22.23.2, bundled zlib 1.3.1-e00f703.

The sample is the checked-in workflow-agent-tool-call-rendered.html and a synthetic two-scene version-2 brief. It is not a real PR accuracy measurement.
The command was the public story svg CLI. The two outputs are included beside this record.

Local regression: node --test test/story-svg.test.mjs test/story.test.mjs test/skill-installation.test.mjs: 34 passed, 2 platform skips, 0 failures.
Tests cover XML namespaces and actual scene text, both output/input aliases, external resource rejection, unrelated temporary file preservation, persistent old-byte recovery and JSON/plain error reporting, ordinary path labels, long headings, figure captions/fields and transformed native SVG ancestors.
The old whole-file URL regex was removed: it falsely rejected the embedded font's license/attribution URLs in CSS comments. The replacement tests exercise actual resource references.

Browser automation: the Codex in-app Chromium browser, no desktop pointer.
The SVG was loaded both as an image and as a standalone SVG document. Four actual DOM samples observed exactly one visible frame:
- animation time 33ms: first frame (0–6s)
- 8017ms: Follow the change (7.55–14.3s)
- 17016ms: Read the evidence (16.5–23.25s)
- 25016ms: ending (23.9–28.9s)
This checks sampled ordered states, not every boundary instant. Screenshot timing may differ slightly from the paired DOM sample.
Both image elements loaded with natural size 1200×720; no browser warning/error was observed.
The ordinary download links requested story.svg and story.still.svg. Existing downloads led Chromium to save story (2).svg and story.still (2).svg; those actual disk files were opened/parsed and matched the exported bytes.

SHA-256:
- story.svg (368965 bytes): 2ed9e5fda288e648162c1396bcf603348cd9896973f5878942fad51a0ef8848e
- story.still.svg (362126 bytes): 51f183407fd69e7c1dd313b6a2cc92256054c9867a8288670b5c53f37743cf0e

The HTML page used for download checks is a regression harness, not a new product UI.
The SVG preserves discrete scenes and annotation/caption timing, but not the HTML player's audio, interactive camera or native edge-transfer choreography. Dense overview labels may need zoom.
This is automated/agent visual evidence. It is not the accountable contributor's personal review or a maintainer scope decision.
