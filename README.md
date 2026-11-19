# Replaying the two architecture drift cases

Product candidate: `85c610b0aa0b22242c4019047b9b6a9c70ad22fd` on Labs `25bf6378252458c616c2e4e7d26a2a804071d865`. Node 22.23.2, TypeScript 5.9.3 (extractor revision 22). [Scope discussion](https://github.com/tt-a1i/archify/issues/1409).

| Case | Git base | Git head | Expected |
| --- | --- | --- | --- |
| [Vue #15467](https://github.com/vuejs/core/pull/15467) | `ecdeaa10d2d19c2ca4f291b882118f3638ca96ad` | `1bd72c351c89808fbc8d5705a3a01f845118b51a` | 1 new undeclared pair, Vapor DOM → Vapor slots; 2 head source anchors |
| [Vue #14575](https://github.com/vuejs/core/pull/14575) | `508edbe3c22d6050d269d09a1219ad671c98f7ee` | `9687845fefd46d4be4bf1c07a887c351e7e2fdad` | 9 previously observed pairs; 0 new or no longer observed |

With both commits available locally, run the following using the matching `positive` or `move` evidence directory. No Vue dependencies or build are required. Do not edit the input mapping between captures.

```sh
node archify/bin/archify.mjs code-analysis drift <local-vue-repo> \
  --base <base-sha> --head <head-sha> \
  --ir <case>/architecture.json --map <case>/map.json \
  --config <case>/analysis.json --out <new-output-directory> --json
```

Each case contains the authored review fixture, mapping, configuration and versioned JSON result. The fixtures are not Vue's official architecture. Both cases omit unmapped modules and static dependencies that cannot be resolved; the comparison does not assess runtime behavior. `observed-baseline.json` preserves the earlier existing-CLI reproduction, with its original Labs SHA. The Chrome screenshots were captured using coordinate-driven automated input on the final candidate. The Markdown is the actual file downloaded from the positive report. No right-side browser was available in the author session.
