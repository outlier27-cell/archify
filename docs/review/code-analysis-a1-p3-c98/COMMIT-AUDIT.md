# c98 commit audit

This is an audit of every commit between the Labs base and
`c98f927b9f3cc6d78510e9198cfdf8c10a9733a3`. "Candidate" means eligible for
future scope discussion, not accepted product scope. "Rebuild" means a future
PR must extract the intended behavior rather than cherry-pick the commit.

| # | Commit | Subject | Disposition | Review action |
| --- | --- | --- | --- | --- |
| 1 | `16016a29` | A1 complexity threshold | Superseded | Review through `#1222`; do not carry this older copy forward. |
| 2 | `1d024014` | A2 coverage CLI exit policy | Superseded | Review through `#1223`; do not carry this older copy forward. |
| 3 | `14a95fce` | stale automatic mappings | P1 candidate | Rebuild as an accuracy-focused PR after scope confirmation. |
| 4 | `b29cc6ce` | baseline accept/revoke | Deferred | Belongs to the baseline UX discussion in `#1224`. |
| 5 | `258056fa` | page review flow | Deferred | Depends on the same baseline UX/product decision. |
| 6 | `4d7c9fbd` | stale baseline presentation | Deferred | Depends on the same baseline UX/product decision. |
| 7 | `f7500d84` | serialized baseline state | Deferred | Depends on the same baseline UX/product decision. |
| 8 | `169b2e67` | opt-in concentration rule | P2 candidate | Confirm whether this rule belongs in the current external-integration scope. |
| 9 | `42c0c08` | bounded SARIF adapter | P2 candidate | Rebuild as a bounded adapter with an explicit compatibility contract. |
| 10 | `2b54e5a` | finding filters reader | P2 candidate | Pair only with an approved external/filter reader scope. |
| 11 | `c1a1421` | SARIF/filter CLI and UI | P2 candidate | Rebuild from the selected adapter and reader behavior. |
| 12 | `dd0bea55` | documentation stages | Documentation candidate | Carry only with the accepted feature it documents. |
| 13 | `66d792b` | filtered state preservation | P2 candidate | Rebuild with the selected filtering behavior. |
| 14 | `c709e35` | exact token duplicate detector | P3 candidate | Can be reviewed as a narrowly scoped duplicate-detection change. |
| 15 | `a77a83c` | structural cycles and severity | P1 candidate | Rebuild as an accuracy/severity proposal after expected semantics are agreed. |
| 16 | `c7e8ac47` | integrated P1-P3 implementation | Cross-cutting | Never cherry-pick; use it only as implementation evidence while rebuilding chosen scope. |
| 17 | `47230694` | scale-contract tests | Cross-cutting | Extract only the tests relevant to an accepted feature. |
| 18 | `f8fd3687` | stable numeric hashes | Scope-dependent | Evaluate with the accepted baseline/comparability route; not a standalone merge request. |
| 19 | `f78eef28` | bounded test concurrency | Test infrastructure | Include only when a selected PR needs it and its ownership is agreed. |
| 20 | `9296eb85` | final G1/G2 review gaps | Cross-cutting | Never cherry-pick; reconstruct the selected fixes with their direct tests. |
| 21 | `1573f613` | duplicate reader flow tests | P3 test candidate | Carry with an accepted P3 duplicate-reader change. |
| 22 | `c98f927b` | ESLint and Ruff together | P2 candidate | Rebuild only after external diagnostic/tool scope is accepted. |

## Consequences

- The first two commits must not create duplicate A1/A2 PRs: their current
  upstream review targets are `#1222` and `#1223`.
- Commits 4-7 cannot bypass the explicit feature-proposal gate on `#1224`.
- Commits 16 and 20 are evidence that the candidate was exercised, not atomic
  review units. A formal PR must begin from a clean chosen base and contain only
  the selected behavior and tests.
- The natural near-term candidate is P1 accuracy/coverage, because the published
  product direction prioritizes accuracy and coverage. This still requires a
  maintainer to choose the exact behavior before a PR is opened.
