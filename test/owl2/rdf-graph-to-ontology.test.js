'use strict';

// Test RDFGraphToOntology — TripleStore → OWLOntology mapping (W3C Mapping to
// RDF Graphs inverse). Covers H5 (nested class expressions), H3 (hasKey),
// M5 (facet restrictions), L2/L3/L4 (n-ary constructs, negative assertions).

const test = require('node:test');
const assert = require('node:assert/strict');

const { TripleStore } = require('../../src/inference/TripleStore');
const { triplesToOntology } = require('../../src/io/RDFGraphToOntology');
const { NS } = require('../../src/inference/rdf');

const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL, XSD = NS.XSD;
const EX = 'http://ex.org/';

function store(...triples) {
  const s = new TripleStore();
  for (const t of triples) s.add(t[0], t[1], t[2]);
  return s;
}

test('named class + subClassOf named class', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'B', RDF + 'type', OWL + 'Class'],
    [EX + 'A', RDFS + 'subClassOf', EX + 'B']
  );
  const ont = triplesToOntology(s, { ontologyIRI: EX });
  const subs = ont.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  assert.equal(subs[0].subClass.getIRI().toString(), EX + 'A');
  assert.equal(subs[0].superClass.getIRI().toString(), EX + 'B');
});

test('owl:Restriction someValuesFrom nested blank node', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'B', RDF + 'type', OWL + 'Class'],
    [EX + 'p', RDF + 'type', OWL + 'ObjectProperty'],
    [EX + 'A', RDFS + 'subClassOf', '_:r0'],
    ['_:r0', RDF + 'type', OWL + 'Restriction'],
    ['_:r0', OWL + 'onProperty', EX + 'p'],
    ['_:r0', OWL + 'someValuesFrom', EX + 'B']
  );
  const ont = triplesToOntology(s);
  const subs = ont.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  const sup = subs[0].superClass;
  assert.equal(sup.type, 'ObjectSomeValuesFrom');
  assert.equal(sup.property.getIRI().toString(), EX + 'p');
  assert.equal(sup.filler.getIRI().toString(), EX + 'B');
});

test('owl:intersectionOf list', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'B', RDF + 'type', OWL + 'Class'],
    [EX + 'C', RDF + 'type', OWL + 'Class'],
    [EX + 'A', RDFS + 'subClassOf', '_:x'],
    ['_:x', OWL + 'intersectionOf', '_:l'],
    ['_:l', RDF + 'first', EX + 'B'],
    ['_:l', RDF + 'rest', '_:l2'],
    ['_:l2', RDF + 'first', EX + 'C'],
    ['_:l2', RDF + 'rest', RDF + 'nil']
  );
  const ont = triplesToOntology(s);
  const sup = ont.getAxiomsOfType('SubClassOf')[0].superClass;
  assert.equal(sup.type, 'ObjectIntersectionOf');
  assert.equal(sup.operands.length, 2);
});

test('owl:hasKey', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'k', RDF + 'type', OWL + 'ObjectProperty'],
    [EX + 'A', OWL + 'hasKey', '_:kl'],
    ['_:kl', RDF + 'first', EX + 'k'],
    ['_:kl', RDF + 'rest', RDF + 'nil']
  );
  const ont = triplesToOntology(s);
  const keys = ont.getAxiomsOfType('HasKey');
  assert.equal(keys.length, 1);
  assert.equal(keys[0].propertyExpressions.length, 1);
  assert.equal(keys[0].propertyExpressions[0].getIRI().toString(), EX + 'k');
});

test('owl:onDatatype + withRestrictions facet', () => {
  const s = store(
    [EX + 'age', RDF + 'type', OWL + 'DatatypeProperty'],
    [EX + 'age', RDFS + 'range', '_:dr'],
    ['_:dr', OWL + 'onDatatype', XSD + 'integer'],
    ['_:dr', OWL + 'withRestrictions', '_:wrl'],
    ['_:wrl', RDF + 'first', '_:fr'],
    ['_:wrl', RDF + 'rest', RDF + 'nil'],
    ['_:fr', XSD + 'minInclusive', '"0"^^<' + XSD + 'integer' + '>']
  );
  const ont = triplesToOntology(s);
  const ranges = ont.getAxiomsOfType('DataPropertyRange');
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].range.type, 'DatatypeRestriction');
  assert.equal(ranges[0].range.facetRestrictions.length, 1);
});

test('owl:AllDisjointClasses via owl:members', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'B', RDF + 'type', OWL + 'Class'],
    ['_:n', RDF + 'type', OWL + 'AllDisjointClasses'],
    ['_:n', OWL + 'members', '_:ml'],
    ['_:ml', RDF + 'first', EX + 'A'],
    ['_:ml', RDF + 'rest', '_:ml2'],
    ['_:ml2', RDF + 'first', EX + 'B'],
    ['_:ml2', RDF + 'rest', RDF + 'nil']
  );
  const ont = triplesToOntology(s);
  const disj = ont.getAxiomsOfType('DisjointClasses');
  assert.equal(disj.length, 1);
  assert.equal(disj[0].classExpressions.length, 2);
});

test('owl:NegativePropertyAssertion', () => {
  const s = store(
    [EX + 'i', RDF + 'type', OWL + 'NamedIndividual'],
    [EX + 'j', RDF + 'type', OWL + 'NamedIndividual'],
    [EX + 'p', RDF + 'type', OWL + 'ObjectProperty'],
    ['_:np', RDF + 'type', OWL + 'NegativePropertyAssertion'],
    ['_:np', OWL + 'sourceIndividual', EX + 'i'],
    ['_:np', OWL + 'assertionProperty', EX + 'p'],
    ['_:np', OWL + 'targetIndividual', EX + 'j']
  );
  const ont = triplesToOntology(s);
  const negs = ont.getAxiomsOfType('NegativeObjectPropertyAssertion');
  assert.equal(negs.length, 1);
});

test('ontology header imports + versionIRI', () => {
  const s = store(
    [EX, RDF + 'type', OWL + 'Ontology'],
    [EX, OWL + 'versionIRI', EX + 'v2'],
    [EX, OWL + 'imports', 'http://other.org/ont'],
    [EX + 'A', RDF + 'type', OWL + 'Class']
  );
  const ont = triplesToOntology(s, { ontologyIRI: EX });
  assert.equal(ont.getOntologyID().ontologyIRI, EX);
  assert.equal(ont.getOntologyID().versionIRI, EX + 'v2');
  assert.deepEqual(ont.imports, ['http://other.org/ont']);
});

test('anonymous individual via blank node', () => {
  const s = store(
    ['_:anon1', RDF + 'type', OWL + 'NamedIndividual'],
    ['_:anon1', RDF + 'type', EX + 'C']
  );
  const ont = triplesToOntology(s);
  const ca = ont.getAxiomsOfType('ClassAssertion');
  assert.equal(ca.length, 1);
  assert.equal(ca[0].individual.isAnonymous(), true);
});

test('axiom annotation via owl:Axiom reification', () => {
  const s = store(
    [EX + 'A', RDF + 'type', OWL + 'Class'],
    [EX + 'B', RDF + 'type', OWL + 'Class'],
    ['_:ax', RDF + 'type', OWL + 'Axiom'],
    ['_:ax', OWL + 'annotatedSource', EX + 'A'],
    ['_:ax', OWL + 'annotatedProperty', RDFS + 'subClassOf'],
    ['_:ax', OWL + 'annotatedTarget', EX + 'B'],
    ['_:ax', RDFS + 'comment', '"inferred by rule X"']
  );
  const ont = triplesToOntology(s);
  const subs = ont.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  const anns = subs[0].getAnnotations();
  assert.equal(anns.length, 1);
  assert.equal(anns[0].value.lexicalValue, 'inferred by rule X');
});
