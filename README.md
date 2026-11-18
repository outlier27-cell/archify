# Archify #1391 and #1392 validation

Frozen real project: [`tt-a1i/hive`](https://github.com/tt-a1i/hive/tree/11184ef42627dbaeaf3cd1d5a6c00ad7ef75fb31), revision `11184ef42627dbaeaf3cd1d5a6c00ad7ef75fb31`.
The checkout was detached and not edited. Each candidate ran its public CLI:

```text
node archify/bin/archify.mjs code-analysis prepare <frozen-hive> --language ts --out <isolated-output> --locale zh-CN
```

Both runs captured 519 analyzed JS/TS files, excluded 431 files by role and reported 151 findings (0 error, 65 warning, 86 info). There were 13 unresolved unknown imports and 1597 external imports; architecture boundaries and duplicate code were not checked. These observations are not a full-project accuracy or recall measurement.

## #1392

Candidate `ae5f34f4b27939748c861b4b383c7d9d9f52de72`, based on Labs `fc99a76758fccc46a6924abe959d66747a6a001c`.

- Before correction, right-side in-app Chromium reproduced finding→file leaving the old finding card, and file→module/clear leaving the old file card. A real headless Chrome regression failed the first transition on the old candidate.
- After correction, the same in-app browser used ordinary clicks to select `src/cli/team.ts`, switch to `mobile`, clear selection, open source evidence and return. Keyboard arrows/Home/End, Chinese labels and a narrow viewport were exercised.
- That run downloaded `team (1).md` using the normal button, 1388 bytes, exactly equal to the preview. The file contains the path, module and 31 captured function names/lines. It explicitly excludes source content and complete diagnostic/task evidence.
- A final narrow-layout correction prevents Files from shrinking to its padding height. Isolated headless Chrome with CDP mouse input verified a 390px-high pane at 390×844, with query and first result visible together. It downloaded a fresh `team.md`, again 1388 bytes and equal to the preview. `1392-file.png` and `1392-narrow.png` show this final candidate.
- The final automated workflow passed in English and Chinese, both themes and desktop/narrow layouts; it also checks actual downloads, selection restoration and no repainting of the hidden cycle map. 21 Atlas/overlay/locale module tests passed.

## #1391

Candidate `6b9327ccfc6ceb54ed1a8e71cd0f951663270685`, same Labs base.

- Isolated headless Chrome with CDP mouse input selected `runTeamCommand` and observed `src/cli/team.ts:1016:31-1579:2`, plus the Chinese statement that this locates captured source and does not represent a runtime call. Opening source evidence and returning retained the selected finding. `1391-range.png` shows this state.
- 46 focused extractor/complexity/Atlas/calls/range tests and 5 shared Python/Java definition tests passed. The Unicode line-separator regression failed before the correction and passed after it.
- The tests cover UTF-16 columns with non-BMP text, CRLF-preserving hashes, U+2028/U+2029, separate line-policy caches and historical facts without the new field. The test-only owner resolver was removed; it did not represent product behavior.
- Frozen Vue excerpts retain their source commits, original line extents and the original MIT notice. They demonstrate these measured implementations, not whole-repository recall.

All browser evidence here is automated/agent evidence, not a contributor's personal human review. The right-side browser became unavailable before the final narrow-layout and #1391 run; those final screenshots are explicitly isolated headless Chrome. No desktop pointer or user's main browser was operated. Remote CI and scope/personal-review status are recorded separately on the PRs.
