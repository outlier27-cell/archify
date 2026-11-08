# Code Analysis A1-P3 candidate review evidence

This directory is a public, sanitized review index for the local Code Analysis
candidate history. It is evidence for review, not an approval, release claim,
or a request to merge this branch as one change.

## Snapshot

| Item | Status | Canonical review route |
| --- | --- | --- |
| A1 complexity threshold | Existing upstream PR | [#1222](https://github.com/tt-a1i/archify/pull/1222) at `f0b53b72031953ffd956409332f11fd9534326f4` |
| A2 coverage CLI exit policy | Existing upstream PR | [#1223](https://github.com/tt-a1i/archify/pull/1223) at `e164cc32825267617db61d430b871a34fe0fe662` |
| A1/A2 composition experiment | Maintainer-owned draft | [#1250](https://github.com/tt-a1i/archify/pull/1250), not a Labs merge request |
| Baseline accept/revoke UX | Deferred pending feature proposal | [#1224](https://github.com/tt-a1i/archify/pull/1224) |
| P1 accuracy and coverage candidates | Needs maintainer scope selection | This branch only |
| P2 external integration candidates | Needs maintainer scope selection | This branch only |
| P3 duplicate/organization candidates | Needs maintainer scope selection | This branch only |

The evidence branch is `evidence/code-analysis-a1-p3-c98`, currently at
`c98f927b9f3cc6d78510e9198cfdf8c10a9733a3`. It is based on the local c98
candidate and is deliberately separate from the existing upstream PRs.

## Important boundaries

- Do not merge this branch wholesale. Its 22 commits include superseded A1/A2
  snapshots, deferred baseline work, and cross-cutting implementation commits.
- `#1250` contains the original A2 and earlier archive refreshes, but does not
  contain the later A2 control-character and slash-escaping commits
  `07134ec0`, `17ed256b`, and `e164cc32`. The latest A2 review target remains
  `#1223` until a maintainer chooses another route.
- Local test evidence records candidate behavior only. It does not override the
  upstream review, CI, or scope decision.
- Raw local sessions, machine paths, credentials, and full logs are intentionally
  excluded. The recorded results are reproduced in [VALIDATION.md](VALIDATION.md).

## Review order

1. Decide whether `#1250` remains a composition experiment and how it must pick
   up the current A2 security delta.
2. Decide the baseline policy and the disposition of `#1224` and `#1242`.
3. Review A1 and A2 through `#1222` and `#1223`; they remain independently
   reviewable regardless of the composition decision.
4. Select one narrowly-scoped P1/P2/P3 candidate from the commit audit, rebuild
   it without unrelated history, and open a formal PR only after that scope is
   confirmed.
5. Repeat step 4 for the next accepted scope. Do not advance from candidate to
   merge target based solely on this evidence branch.

## Evidence map

- [COMMIT-AUDIT.md](COMMIT-AUDIT.md): every c98 commit, its disposition, and
  why it is or is not a direct PR candidate.
- [VALIDATION.md](VALIDATION.md): recorded local validation and known upstream
  CI limitations.
- [INTEGRATION-QUESTIONS.md](INTEGRATION-QUESTIONS.md): decisions requested
  from maintainers and the resulting PR routing rules.

## Review accountability

The contributing author has personally reviewed the submitted evidence and is
responsible for its accuracy. Codex using the GPT-6.1 Sol model assisted with
implementation, investigation, test execution, and documentation; human review
remains the basis for the submitted claims and requested decisions.
