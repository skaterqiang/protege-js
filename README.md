# Protégé JS

A zero-dependency **OWL 2 / RDF / SWRL** library for Node.js — 6 parsers,
3 round-trip serializers, and a forward-chaining reasoner covering **all 78
W3C OWL 2 RL rules** plus QL / EL profiles.

[![CI](https://github.com/skaterqiang/protege-js/actions/workflows/ci.yml/badge.svg)](https://github.com/skaterqiang/protege-js/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-274%20passing-brightgreen)](https://github.com/skaterqiang/protege-js)
[![license](https://img.shields.io/badge/license-BSD--2--Clause-blue)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](./package.json)

## Install

```bash
npm install @skaterqiang/protege-js
```

```js
// Flat imports
const { OWL2RLReasoner, TripleStore, TurtleParser, checkRL } = require('@skaterqiang/protege-js');

// Or namespaced
const protege = require('@skaterqiang/protege-js');
protege.inference.OWL2RLReasoner;   // reasoners, triple store, queries
protege.io.TurtleParser;            // parsers + writers + loader
protege.model.OWLClass;             // entities, axioms, class expressions
protege.profiles.checkRL;           // RL / QL / EL profile validators

// Deep imports also work
const { OWL2RLReasoner } = require('@skaterqiang/protege-js/src/inference/OWL2RLReasoner');
```

> **Why the scoped name?** The unscoped name `protege-js` is rejected by npm's
> name-similarity rule because [`protegejs`](https://www.npmjs.com/package/protegejs)
> already exists — an unrelated 2018 jQuery/Prototype.js shim that happens to
> share the French word *protégé*. This package is scoped to make authorship
> unambiguous, which is exactly what npm's
> [package name guidelines](https://docs.npmjs.com/package-name-guidelines) ask
> for. The GitHub repository keeps the shorter name:
> [skaterqiang/protege-js](https://github.com/skaterqiang/protege-js).

Full API reference: [docs/API.md](docs/API.md).

## What this is

Protégé is a large Java/Swing application (~1498 files; ~1205 are Swing UI). This
project ports the **non-UI core** to Node.js and presents it through a web UI
served by Node, which can be wrapped in an Electron desktop window.

Only the *model layer* is reimplemented — the part that is genuinely useful in
Node.js and reusable by other projects (such as Synapse). Swing views, OSGi plugin
plumbing, and the Java desktop workspace are intentionally **not** ported.

> **Attribution**: protege-js is an independent reimplementation and is **not
> affiliated with or endorsed by Stanford University or the Protégé team**.
> Protégé is a trademark of Stanford University; the name is used for
> descriptive purposes only. See [LICENSE](./LICENSE) for details. Sample
> ontologies under `sample/ontologies/` (BFO / OGMS / IAO / RO-core) come from
> the OBO Foundry under CC-BY 4.0 / CC0 1.0 — see [sample/README.md](sample/README.md).

## Run

```bash
# As a library (no server needed):
node -e "const {TurtleParser}=require('@skaterqiang/protege-js'); console.log(new TurtleParser().parse('@prefix ex: <http://e.org/> . ex:a ex:p ex:b .').size)"

# Web UI only (no Electron dependency needed):
npm run start:web
# then open http://localhost:8899/

# Desktop (requires electron, `npm install` first):
npm start
```

## Test

```bash
npm test    # 274 tests: core model + 80 OWL 2 RL rule tests + OWL 2 full-spec + 业务案例 e2e
```

## OWL 2 全覆盖

完整覆盖 W3C OWL 2 规范，包括：

- **OWL 2 RL 推理**：78 条规则前向链接物化（见下文）
- **OWL 2 QL / EL 推理**：基于 RL 规则子集的最小推理机（`OWL2QLReasoner` / `OWL2ELReasoner`）
- **OWL 2 全结构规范**：38 种公理类型、26 种类表达式、SWRL 规则
- **解析器**：Functional Syntax、Turtle、RDF/XML、Manchester Syntax、OWL/XML
- **序列化器**：Functional Syntax、Turtle、RDF/XML
- **桥接**：RDFGraphToOntology（TripleStore → OWLOntology）、OntologyLoader（含 imports 闭包）
- **验证**：OWL2Profiles（RL/QL/EL profile 检查）、GlobalRestrictionsValidator
- **查询**：ReasonerQueries（getSubClasses / getInstances / isSubClassOf / isSatisfiable）
- **SWRL**：模型 + 解析器 + 求值器（含长尾 builtins）
- 详见 [docs/design/OWL2-缺口分析.md](docs/design/OWL2-缺口分析.md)（全部缺口已实施完成）

## OWL 2 RL inference engine

A forward-chaining, semi-naive materialization engine covering **all 78 rules**
of the [OWL 2 RL profile](https://www.w3.org/TR/owl2-profiles/) (6 categories:
eq / prp / cls / cax / dt / scm). See [docs/owl2-rl/OWL2-RL-规则细则.md](docs/owl2-rl/OWL2-RL-规则细则.md)
for the full rule list with W3C references, and [docs/owl2-rl/owl2-profiles-spec.html](docs/owl2-rl/owl2-profiles-spec.html)
for the original W3C specification snapshot.

```js
const { OWL2RLReasoner } = require('./src/inference/OWL2RLReasoner');
const r = new OWL2RLReasoner();
r.store.add('ex:A', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', 'ex:B');
r.store.add('ex:x', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'ex:A');
r.materialize();                                  // runs all 78 rules to fixpoint
r.entails('ex:x', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'ex:B'); // true
r.isConsistent();                                  // true / false (false-consequent rules)
```

Files:

```
src/inference/
  TripleStore.js        triple store with pattern matching + RDF-list walker
  rdf.js                namespace constants + literal helpers
  OWL2RLReasoner.js     fixpoint engine, inconsistency collector
  rules/owl2rl.js       the 78 OWL 2 RL rules
test/owl2rl/            80 rule tests (>=1 per rule)
docs/owl2-rl/           W3C spec snapshot + rule catalog + Chinese细则
```

## OWL 2 full structural spec

Beyond the RL profile, the model layer covers the complete
[OWL 2 structural specification](https://www.w3.org/TR/owl2-syntax/):

- **38 axiom types** (every axiom in the spec): declaration, subclass, equivalent/disjoint
  classes, disjoint union, property hierarchy (sub/equivalent/disjoint/inverse/chain),
  property domain/range, all 7 object-property characteristics (functional,
  inverse-functional, reflexive, irreflexive, symmetric, asymmetric, transitive),
  functional data property, datatype definition, has-key, same/different individuals,
  class/object/data property assertion (positive + negative), annotation assertion,
  annotation property hierarchy + domain/range.
- **26 class expression kinds**, object and data sides: intersection, union,
  complement, one-of, some/all/has-value/has-self, min/max/exact cardinality
  (qualified and unqualified), data intersection/union/complement/one-of,
  datatype restriction with facets.
- **SWRL rules** with class/object/data property atoms, sameAs/differentFrom
  atoms, and 30+ built-ins (math, string, comparison). Forward-chaining
  materialization over the same TripleStore used by OWL 2 RL.

## Parsers

Five syntax parsers:

- **RDF/XML** — [src/io/RDFXMLParser.js](src/io/RDFXMLParser.js): classic OWL/XML,
  extended to recognize disjointWith, inverseOf, sameAs, differentFrom, all
  7 property characteristics, nested class expressions (owl:Restriction /
  intersectionOf / unionOf / ...), `owl:hasKey`, anonymous individuals and punning.
- **Turtle** — [src/io/TurtleParser.js](src/io/TurtleParser.js): W3C Turtle 1.1 with
  `@prefix`/`@base`, SPARQL `PREFIX`/`BASE`, typed/lang literals, blank nodes,
  collections, auto-typed numbers/booleans.
- **OWL 2 Functional-Style** — [src/io/FunctionalSyntaxParser.js](src/io/FunctionalSyntaxParser.js):
  parses the complete functional syntax including `Prefix(...)`, `Ontology(...)`
  (with imports / versionIRI), all 38 axiom forms, and all class expressions /
  data ranges.
- **Manchester Syntax** — [src/io/ManchesterSyntaxParser.js](src/io/ManchesterSyntaxParser.js).
- **OWL/XML** — [src/io/OWLXMLParser.js](src/io/OWLXMLParser.js).
- **SWRL text** — [src/io/SWRLParser.js](src/io/SWRLParser.js).

## Serializers (writers)

- **Turtle** — [src/io/TurtleWriter.js](src/io/TurtleWriter.js)
- **OWL 2 Functional-Style** — [src/io/FunctionalSyntaxWriter.js](src/io/FunctionalSyntaxWriter.js)
- **RDF/XML** — [src/io/RDFXMLWriter.js](src/io/RDFXMLWriter.js)

All three writers round-trip: Turtle/Functional/RDF/XML 导入 → 结构化 → 导出 →
再导入不丢公理（见 sample/case4、case6、case7）。

```js
const { TurtleParser } = require('./src/io/TurtleParser');
const { FunctionalSyntaxParser } = require('./src/io/FunctionalSyntaxParser');
const { SWRLReasoner } = require('./src/inference/SWRLReasoner');

const store = new TurtleParser().parse(`
  @prefix ex: <http://example.org/> .
  ex:alice a ex:Person ; ex:age 30 .
`);

const onto = new FunctionalSyntaxParser().parse(`
  Prefix(ex:=<http://example.org/>)
  Ontology( Declaration(Class(ex:Person)) )
`);
```

## Architecture

```
main.js                        Electron shell (falls back to headless web server)
src/
  index.js                     public API entry (flat + namespaced exports)
  model/                       org.protege.editor.owl.model equivalents
    IRI.js                     org.semanticweb.owlapi.model.IRI
    OWLEntity.js               OWLClass / OWLObjectProperty / OWLDataProperty /
                               OWLNamedIndividual / OWLDatatype / OWLAnnotationProperty
    OWLAxiom.js                OWLSubClassOfAxiom, OWLDeclarationAxiom, domain/range,
                               class/property assertions, annotation assertions, ...
    OWLClassExpression.js      anonymous expressions: intersection/union/some/only/...
    OWLLiteral.js              org.semanticweb.owlapi.model.OWLLiteral
    OWLOntology.js             OWLOntology + OWLOntologyID (in-memory axiom set)
    OWLModelManager.js         OWLModelManager / OWLModelManagerImpl
    SWRL.js                    SWRLRule + class/object/data property/builtin atoms
    event/
      OWLModelManagerEvent.js  model.event.EventType + OWLModelManagerChangeEvent
    hierarchy/
      HierarchyProvider.js     AssertedClassHierarchyProvider,
                               OWLObject/DataPropertyHierarchyProvider
  io/
    RDFXMLParser.js            dependency-free RDF/XML reader (typed-node + Description style)
    RDFXMLWriter.js            RDF/XML serializer
    TurtleParser.js            W3C Turtle 1.1 reader
    TurtleWriter.js            Turtle serializer
    FunctionalSyntaxParser.js  OWL 2 functional-style reader
    FunctionalSyntaxWriter.js  functional-style serializer
    ManchesterSyntaxParser.js  Manchester Syntax reader
    OWLXMLParser.js            OWL/XML reader
    SWRLParser.js              SWRL text rule reader
    RDFGraphToOntology.js      TripleStore → OWLOntology bridge
    OntologyLoader.js          model.io.OntologyLoader (imports closure)
  inference/
    TripleStore.js             triple store with pattern matching + RDF-list walker
    rdf.js                     namespace constants + literal helpers
    OWL2RLReasoner.js          fixpoint engine, inconsistency collector (78 rules)
    rules/owl2rl.js            the 78 OWL 2 RL rules (eq / prp / cls / cax / dt / scm)
    OWL2ProfileReasoners.js    OWL2QLReasoner / OWL2ELReasoner (RL-rule subsets)
    SWRLReasoner.js            SWRL forward-chaining engine (30+ builtins)
    ReasonerQueries.js         getSubClasses / getInstances / isSubClassOf / isSatisfiable
  profiles/
    OWL2Profiles.js            OWL 2 RL / QL / EL profile validators
  validation/
    GlobalRestrictionsValidator.js  global-restriction checks
  server/
    webServer.js               Node http server + JSON API (/api/load, /api/tree, /api/stats)
    public/                    web UI (class/property hierarchy tree browser)
test/
  core.test.js                 node:test unit tests (model layer)
  owl2rl/                      80 rule tests (>=1 per OWL 2 RL rule)
  owl2/                        full-spec tests: axioms / class expressions / parsers /
                               writers / profiles / reasoner queries / sample e2e
sample/                        10 个真实业务案例 + ontologies/ 真实公开本体
                               (BFO / OGMS / RO-core / IAO, OBO Foundry 官方 PURL)
```

## Java → JS mapping notes

| Protégé / OWLAPI (Java)                  | protege-js (Node)                          |
|------------------------------------------|--------------------------------------------|
| `org.semanticweb.owlapi.model.IRI`       | `src/model/IRI.js`                         |
| `OWLEntity` hierarchy                    | `src/model/OWLEntity.js`                   |
| `OWLAxiom` hierarchy                     | `src/model/OWLAxiom.js`                    |
| `OWLClassExpression`                     | `src/model/OWLClassExpression.js`          |
| `OWLOntology` / `OWLOntologyID`          | `src/model/OWLOntology.js`                 |
| `OWLModelManager(Impl)`                  | `src/model/OWLModelManager.js`             |
| `model.event.EventType`                  | `src/model/event/OWLModelManagerEvent.js`  |
| `model.hierarchy.*HierarchyProvider`     | `src/model/hierarchy/HierarchyProvider.js` |
| `model.io.OntologyLoader` + RDF/XML      | `src/io/OntologyLoader.js`, `RDFXMLParser.js` |
| `OWLReasoner` (RL/QL/EL)                 | `src/inference/OWL2RLReasoner.js`, `OWL2ProfileReasoners.js` |
| `OWLReasoner` query API                  | `src/inference/ReasonerQueries.js`         |
| `OWL2Profile` validators                 | `src/profiles/OWL2Profiles.js`             |

## Scope

Implemented:

- Entities, IRIs, literals, class expressions (26 kinds), full 38-axiom model
- Ontology container + signature indexes + ontology headers (imports / versionIRI)
- Asserted class / object property / data property hierarchy providers + tree JSON
- Parsers: RDF/XML, Turtle, Functional Syntax, Manchester Syntax, OWL/XML, SWRL
- Serializers: RDF/XML, Turtle, Functional Syntax (round-trip verified)
- Inference: OWL 2 RL (all 78 rules), OWL 2 QL / EL, SWRL forward-chaining,
  inconsistency detection (disjoint / functional violations)
- Validation: OWL 2 RL/QL/EL profile checkers, global-restriction validator
- Query: ReasonerQueries (getSubClasses / getInstances / isSubClassOf / isSatisfiable)
- RDFGraphToOntology bridge, OntologyLoader with imports closure
- Web UI tree browser (Classes / Object Properties / Data Properties tabs)
- 10 个端到端业务案例（电商风控 / 医疗用药 / 制造 PPR / 真实 BFO-OGMS-IAO 加载 / ...）

Not implemented (out of scope for the Node core):

- Tableau-based DL reasoning (HermiT/Pellet/Openllet) — 仅提供规则式 RL/QL/EL 推理
- Editing operations, refactoring, search-importer, git integration
- Swing workspace / views / OSGi plugin system
