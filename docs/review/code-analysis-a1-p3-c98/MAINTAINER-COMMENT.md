@tt-a1i @yijiez666-alt

I have published a sanitized, public review-evidence index for the A1/A2 and
c98 local candidate history:

https://github.com/outlier27-cell/archify/tree/evidence/code-analysis-a1-p3-c98/docs/review/code-analysis-a1-p3-c98

It contains a 22-commit audit, recorded validation, and routing questions. It
is deliberately an evidence branch, not a request to merge all local work.

Current boundaries:

- `#1222` at `f0b53b7` and `#1223` at `e164cc3` remain the independent A1/A2
  review targets. Their author disclosure and personal review confirmation are
  recorded on those PRs.
- `#1250` correctly preserves the original A1/A2 ancestry but is a Draft
  composition experiment targeting `codex/code-analysis-investigation-final`,
  not a Labs merge request. Its A2 merge base is `2b43eb3`; it does not include
  later A2 control-character and slash-escaping commits `07134ec0`,
  `17ed256b`, and `e164cc32`. It should therefore not be treated as the latest
  A2 candidate until its route is decided.
- The c98 history also contains older A1/A2 snapshots, deferred baseline work
  associated with `#1224`, and cross-cutting P1-P3 experiments. It must not be
  bulk-merged or turned into duplicate PRs.

Requested decisions, in review order:

1. Should `#1250` remain the maintained composition route? If yes, what is the
   approved route for bringing in the latest A2 delta and rerunning integration
   validation?
2. What is the intended baseline route for `#1224`, and is `#1242` the only
   remaining fixture/source-artifact repair for the current README-driven CI
   drift?
3. Should A1 and A2 proceed through their source PRs regardless of the
   composition decision?
4. Which one narrowly scoped P1/P2/P3 item should be rebuilt as the next formal
   Labs-compatible PR? The published direction suggests P1 accuracy/coverage,
   but this needs maintainer confirmation.

After those decisions, I will rebuild the selected item from a clean base with
only its behavior, tests, and documentation, then submit it for normal review.
The evidence index preserves the full local work and a clear audit trail while
keeping scope, CI status, and maintainer ownership explicit.
