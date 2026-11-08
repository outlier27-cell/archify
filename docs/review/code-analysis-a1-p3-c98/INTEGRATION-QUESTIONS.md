# Maintainer decisions and routing

## Decisions requested

1. **Composition route:** Is `#1250` retained as a maintained A1/A2 composition
   experiment, or should A1 and A2 be reviewed only through their original PRs?
   If retained, what is the approved method for incorporating the latest A2
   commits `07134ec0`, `17ed256b`, and `e164cc32`?
2. **Baseline route:** What is the intended disposition of the baseline UX work
   in `#1224`, and what remaining gate must be satisfied before a replacement
   proposal is reviewable? Is `#1242` the only required fixture/source-artifact
   repair for the current CI drift?
3. **Next product scope:** Which single P1/P2/P3 candidate should be rebuilt as
   the next formal PR? The evidence suggests P1 accuracy/coverage as a possible
   first candidate, but it is not a decision made by this branch.

## Routing rules after a decision

| Maintainer decision | Resulting work |
| --- | --- |
| Keep `#1250` | Update it with the approved latest-A2 route, rerun its focused and integration checks, then request review as a composition candidate. |
| Do not keep `#1250` | Keep `#1222` and `#1223` as the review units; close or clearly archive the experiment only at maintainer direction. |
| Approve a P1 item | Rebuild one atomic PR from the selected Labs-compatible base; include only its behavior, tests, and documentation. |
| Approve a P2 item | Rebuild one bounded integration PR with compatibility and reader/CLI tests. |
| Approve a P3 item | Rebuild one duplicate/organization PR with direct detector and reader-flow tests. |
| Require a baseline proposal first | Do not route baseline commits through P1-P3; satisfy the explicit `#1224` feature-proposal gate first. |

## Non-goals of this branch

- It does not ask to merge every local change.
- It does not change product priorities or replace maintainer review.
- It does not turn local test logs into CI approval.
- It does not supersede the source PRs, their current heads, or their review
  conversations.
