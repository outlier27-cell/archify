# Recorded validation

These results were recorded against the local c98 candidate before this public
evidence index was created. They are reproducibility leads, not a substitute for
upstream CI on an eventual PR.

| Scope | Result | Evidence boundary |
| --- | --- | --- |
| Code Analysis package suite on Node 22.23.2 | 274 passed, 0 failed | Candidate `c98f927b9f3cc6d78510e9198cfdf8c10a9733a3` |
| Root smoke suite | 19 passed, 0 failed | Candidate `c98f927b9f3cc6d78510e9198cfdf8c10a9733a3` |
| Generated checks | Passed | Candidate `c98f927b9f3cc6d78510e9198cfdf8c10a9733a3` |
| A2 focused suite on Node 22 | 4 passed, 0 failed | Latest A2 head `e164cc32825267617db61d430b871a34fe0fe662` |

The archived Node 22 package-test receipt has SHA-256:

```
f4e0a0435f50ea6478dd20fd06f4f0d262fd0ab2c2062b9c0faec832040f41ee
```

## Upstream CI status requiring interpretation

The current A1 and A2 pull requests have passing focused behavior checks but
their `full-regression` and dependent `test` jobs are blocked by the documented
Classic README source-artifact drift. That drift is being addressed separately
in `#1242`; it is not evidence that the focused A1/A2 behavior regressed.

`#1242` is still a draft and has its own maintainer confirmation/review path.
Merging or reviewing it does not automatically update the different base branch
used by `#1250`.

## Latest A2 archive identity

The latest A2 archive on `#1223` is the archive produced by
`e164cc32825267617db61d430b871a34fe0fe662` and has SHA-256:

```
A6D8973692538C462BF530BDAF3E93A05668B1C1BD754E0E9C65AF01E88C3673
```

Any composition PR that claims current A2 behavior must include the later
control-character and slash escaping fixes, not only the original A2 commit.
