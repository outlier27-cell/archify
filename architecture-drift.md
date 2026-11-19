# Architecture drift

## Vapor DOM → Vapor slots

New, not declared

- Base: ecdeaa10d2d19c2ca4f291b882118f3638ca96ad
- Head: 1bd72c351c89808fbc8d5705a3a01f845118b51a
- Observed sites: 0 → 2
- Authored IR SHA-256: 254f1b10ffc0603450ddcd75a3119fed8ec5a8859575682affcc3d969f0dc850
- Mapping SHA-256: 90cb68852c300b4d9ab4fd43d20e62083f3a480fc8479c5b0131398a55de3efa
- Effective config SHA-256: 66d41d6b4ae7d01f7d349ef98b72b37962853ca896fc18e16f4b089788d18570
- Analyzer: typescript@5.9.3 / 22

Only static value imports between mapped components. This is not a runtime or whole-repository assessment.

### Base

751 files · 7 mapped components · 44 unmapped modules · 0 ambiguous · 0 scoped parse errors · 85 unresolved · 0 skipped links

### Head

751 files · 7 mapped components · 44 unmapped modules · 0 ambiguous · 0 scoped parse errors · 85 unresolved · 0 skipped links
- packages/runtime-vapor/src/dom/hydrateFragment.ts:38 → packages/runtime-vapor/src/slotBoundary.ts
- packages/runtime-vapor/src/dom/hydrateFragment.ts:39 → packages/runtime-vapor/src/slotFragment.ts
