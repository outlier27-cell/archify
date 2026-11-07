# Language Reference

Each run selects one language. The examples below use the checked-in fixtures
and require no project build or runtime execution.

## JavaScript and TypeScript

```sh
node bin/archify.mjs code-analysis check test/fixtures/ts-basic --language ts --out out/ts
```

`src/index.mjs` records static imports, re-exports, namespace imports and
literal dynamic imports. Function bodies and deferred imports remain distinct
from module-scope edges. The computed dynamic import in the fixture is retained
as unresolved evidence rather than guessed as a file edge. TypeScript uses the
project's captured `tsconfig` and path aliases; type-only imports do not become
runtime dependencies.

## Python

```sh
BAUIFY_PYTHON=/path/to/python node bin/archify.mjs code-analysis check test/fixtures/py-basic --language py --out out/py
```

The adapter records package-relative imports and measures functions. Namespace
packages and `__init__.py` package initialization affect dependency resolution.
The `py-basic` fixture includes malformed source and a namespace package to
show that parse failures and unresolved imports remain visible in coverage.
Python code is parsed by the configured interpreter; a parser error is not
recovered by silently choosing another interpreter.

## Java

```sh
node bin/archify.mjs code-analysis check test/fixtures/java-basic --language java --out out/java
```

The adapter records unambiguous source-level type dependencies and method
complexity without running a JDK, Maven, Gradle or project tests. The fixture
includes declarations, imports and an external-supertype case whose inherited
member type is deliberately left unresolved. Java cycles are structural
dependencies; they do not claim class-initialization failure. See
[Java support and limitations](JAVA.md) for parser and resolution boundaries.

## Evidence

For every language, `raw-facts.json` records parsed files, source locations,
imports and unresolved counters. `findings.json` records the selected adapter,
rule versions, configuration digest and coverage. A clean run only describes
the checks that ran; it does not establish that unmodeled dependencies or
runtime behavior are absent.
