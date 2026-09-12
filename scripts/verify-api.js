'use strict';

// ---------------------------------------------------------------------------
// scripts/verify-api.js — smoke test for the public API entry point.
//
// Verifies that src/index.js exports every symbol the README documents, and
// that the OWL 2 RL reasoner actually entails a trivial subsumption.
// Run: node scripts/verify-api.js   (also used by CI)
// ---------------------------------------------------------------------------

const path = require('path');
const p = require(path.join(__dirname, '..', 'src', 'index.js'));

const need = [
  // reasoners / inference
  'OWL2RLReasoner', 'OWL2QLReasoner', 'OWL2ELReasoner', 'SWRLReasoner',
  'TripleStore', 'ReasonerQueries',
  // parsers
  'TurtleParser', 'parseTurtle', 'parseRDFXML', 'FunctionalSyntaxParser',
  'ManchesterSyntaxParser', 'OWLXMLParser', 'SWRLParser',
  // writers
  'writeTurtle', 'writeRDFXML', 'writeFunctionalSyntax',
  // bridges / loader
  'triplesToOntology', 'OntologyLoader',
  // profiles / validation
  'checkRL', 'checkQL', 'checkEL', 'checkProfile', 'isInProfile',
  'GlobalRestrictionsValidator',
  // model
  'IRI', 'OWLLiteral', 'OWLOntology', 'OWLModelManager',
  'OWLClass', 'OWLSubClassOfAxiom',
  // namespaces
  'model', 'io', 'inference', 'profiles'
];

const miss = need.filter((k) => !(k in p));
if (miss.length) {
  console.error('FAIL — missing exports:', miss.join(', '));
  process.exit(1);
}

// Functional smoke: cax-sco + prp-type entailment through the flat API.
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const r = new p.OWL2RLReasoner(new p.TripleStore());
r.store.add('ex:A', RDFS, 'ex:B');
r.store.add('ex:x', RDF, 'ex:A');
r.materialize();
if (!r.entails('ex:x', RDF, 'ex:B')) {
  console.error('FAIL — RL reasoner did not entail ex:x rdf:type ex:B');
  process.exit(1);
}

console.log(`OK — public API verified: ${Object.keys(p).length} exports, RL smoke entailment passed`);
