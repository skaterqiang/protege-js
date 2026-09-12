# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-12

First public release on npm as **`@skaterqiang/protege-js`**.

> The unscoped name `protege-js` is unavailable: npm's name-similarity rule
> rejects it because `protegejs` (an unrelated 2018 jQuery/Prototype.js shim)
> already exists. The package is scoped to keep authorship unambiguous; the
> GitHub repository keeps the shorter name `skaterqiang/protege-js`.

### Added

- **OWL 2 model layer** — full structural spec coverage: 38 axiom types,
  26 class-expression kinds, entities, IRIs, literals, ontology container
  with signature indexes, imports / versionIRI headers.
- **Parsers (6)** — RDF/XML, Turtle (W3C 1.1), OWL 2 Functional Syntax,
  Manchester Syntax, OWL/XML, SWRL text.
- **Serializers (3)** — Turtle, Functional Syntax, RDF/XML; round-trip
  verified (import → structure → export → re-import loses no axioms).
- **OWL 2 RL reasoner** — forward-chaining semi-naive materialization of all
  78 W3C rules (eq / prp / cls / cax / dt / scm), with inconsistency
  detection (disjoint / functional violations).
- **OWL 2 QL / EL reasoners** — minimal engines over RL rule subsets.
- **SWRL reasoner** — forward chaining with 30+ built-ins (math / string /
  comparison), sharing the same TripleStore.
- **Profile validators** — `checkRL` / `checkQL` / `checkEL` compliance
  checks with violation lists; `GlobalRestrictionsValidator`.
- **ReasonerQueries** — `getSubClasses` / `getInstances` / `isSubClassOf` /
  `isSatisfiable`.
- **OntologyLoader** — format auto-detection (extension + content sniffing)
  and transitive `owl:imports` closure with cycle guard.
- **RDFGraphToOntology** — TripleStore → OWLOntology bridge.
- **Web UI** — zero-dependency Node HTTP server with a class / property
  hierarchy tree browser; optional Electron desktop shell.
- **Public API entry** — `src/index.js` with flat and namespaced exports
  (`model` / `io` / `inference` / `profiles`).
- **Tests** — 281 tests via `node:test`: core model, ≥1 test per OWL 2 RL
  rule (80), full-spec suites, 10 end-to-end business cases
  (incl. loading real BFO / OGMS / IAO / RO-core ontologies), and an
  `exports`-map regression suite.

### Fixed

- **Deep imports now resolve without the `.js` extension.** `exports` declared
  `"./src/*": "./src/*"`, but Node performs *no* extension resolution for
  subpath patterns — so `require('@skaterqiang/protege-js/src/model/IRI')`, the
  spelling used in 31 of the 34 documented import examples, threw
  `MODULE_NOT_FOUND` for real consumers. The map now carries two sibling pattern
  keys (`"./src/*.js"` and `"./src/*" → "./src/*.js"`); Node's best-match rule
  picks the more specific key by suffix length, so both spellings resolve to the
  same module.

  The existing suite could not catch this: every other test `require`s siblings
  by *relative* path, which bypasses `exports` and falls back to legacy CommonJS
  resolution (where `.js` *is* appended). `test/exports-map.test.js` closes the
  gap by resolving the package through its own name (Node self-reference) and by
  **scraping README.md and docs/API.md for every documented import specifier**,
  so the tests can never drift from the docs again.

[0.1.0]: https://github.com/skaterqiang/protege-js/releases/tag/v0.1.0
