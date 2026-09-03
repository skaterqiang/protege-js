'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const T = RDF + 'type';
const SA = OWL + 'sameAs';

test('prp-ap: built-in annotation properties are typed', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', 'ex:p', 'ex:b'); // seed
  r.materialize();
  assert.ok(r.entails(RDFS + 'label', T, OWL + 'AnnotationProperty'));
  assert.ok(r.entails(RDFS + 'comment', T, OWL + 'AnnotationProperty'));
  assert.ok(r.entails(OWL + 'versionInfo', T, OWL + 'AnnotationProperty'));
});

test('prp-dom: domain restriction types the subject', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', RDFS + 'domain', 'ex:C');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:C'));
});

test('prp-rng: range restriction types the object', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', RDFS + 'range', 'ex:D');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:y', T, 'ex:D'));
});

test('prp-fp: functional property merges objects via sameAs', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'FunctionalProperty');
  r.store.add('ex:x', 'ex:p', 'ex:y1');
  r.store.add('ex:x', 'ex:p', 'ex:y2');
  r.materialize();
  assert.ok(r.entails('ex:y1', SA, 'ex:y2'));
});

test('prp-ifp: inverse functional property merges subjects', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'InverseFunctionalProperty');
  r.store.add('ex:x1', 'ex:p', 'ex:y');
  r.store.add('ex:x2', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:x1', SA, 'ex:x2'));
});

test('prp-irp: irreflexive property self-loop is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'IrreflexiveProperty');
  r.store.add('ex:x', 'ex:p', 'ex:x');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-irp'));
});

test('prp-symp: symmetric property derives reverse edge', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'SymmetricProperty');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:y', 'ex:p', 'ex:x'));
});

test('prp-asyp: asymmetric property with reverse edge is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'AsymmetricProperty');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.store.add('ex:y', 'ex:p', 'ex:x');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-asyp'));
});

test('prp-trp: transitive property derives closure edge', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'TransitiveProperty');
  r.store.add('ex:a', 'ex:p', 'ex:b');
  r.store.add('ex:b', 'ex:p', 'ex:c');
  r.materialize();
  assert.ok(r.entails('ex:a', 'ex:p', 'ex:c'));
});

test('prp-spo1: subproperty edges propagate to superproperty', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', RDFS + 'subPropertyOf', 'ex:q');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:x', 'ex:q', 'ex:y'));
});

test('prp-spo2: property chain derives the composed edge', () => {
  const r = new OWL2RLReasoner();
  // chain (p1 p2) -> q
  r.store.add('ex:q', OWL + 'propertyChainAxiom', '_:c1');
  r.store.add('_:c1', RDF + 'first', 'ex:p1');
  r.store.add('_:c1', RDF + 'rest', '_:c2');
  r.store.add('_:c2', RDF + 'first', 'ex:p2');
  r.store.add('_:c2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:a', 'ex:p1', 'ex:b');
  r.store.add('ex:b', 'ex:p2', 'ex:c');
  r.materialize();
  assert.ok(r.entails('ex:a', 'ex:q', 'ex:c'));
});

test('prp-eqp1: equivalent property forward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', OWL + 'equivalentProperty', 'ex:q');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:x', 'ex:q', 'ex:y'));
});

test('prp-eqp2: equivalent property backward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', OWL + 'equivalentProperty', 'ex:q');
  r.store.add('ex:x', 'ex:q', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:x', 'ex:p', 'ex:y'));
});

test('prp-pdw: property-disjoint violation is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', OWL + 'propertyDisjointWith', 'ex:q');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.store.add('ex:x', 'ex:q', 'ex:y');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-pdw'));
});

test('prp-adp: AllDisjointProperties violation is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:ad', T, OWL + 'AllDisjointProperties');
  r.store.add('ex:ad', OWL + 'members', '_:m1');
  r.store.add('_:m1', RDF + 'first', 'ex:p');
  r.store.add('_:m1', RDF + 'rest', '_:m2');
  r.store.add('_:m2', RDF + 'first', 'ex:q');
  r.store.add('_:m2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.store.add('ex:x', 'ex:q', 'ex:y');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-adp'));
});

test('prp-inv1: inverse property forward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', OWL + 'inverseOf', 'ex:q');
  r.store.add('ex:x', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:y', 'ex:q', 'ex:x'));
});

test('prp-inv2: inverse property backward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', OWL + 'inverseOf', 'ex:q');
  r.store.add('ex:x', 'ex:q', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:y', 'ex:p', 'ex:x'));
});

test('prp-key: hasKey merges matching subjects via sameAs', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:Person', OWL + 'hasKey', '_:k1');
  r.store.add('_:k1', RDF + 'first', 'ex:ssn');
  r.store.add('_:k1', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:a', T, 'ex:Person');
  r.store.add('ex:b', T, 'ex:Person');
  r.store.add('ex:a', 'ex:ssn', 'ex:s1');
  r.store.add('ex:b', 'ex:ssn', 'ex:s1');
  r.materialize();
  assert.ok(r.entails('ex:a', SA, 'ex:b'));
});

test('prp-npa1: negative property assertion violation is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:na', OWL + 'sourceIndividual', 'ex:i1');
  r.store.add('ex:na', OWL + 'assertionProperty', 'ex:p');
  r.store.add('ex:na', OWL + 'targetIndividual', 'ex:i2');
  r.store.add('ex:i1', 'ex:p', 'ex:i2');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-npa1'));
});

test('prp-npa2: negative data assertion violation is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:na', OWL + 'sourceIndividual', 'ex:i');
  r.store.add('ex:na', OWL + 'assertionProperty', 'ex:p');
  r.store.add('ex:na', OWL + 'targetValue', '"v"^^<http://www.w3.org/2001/XMLSchema#string>');
  r.store.add('ex:i', 'ex:p', '"v"^^<http://www.w3.org/2001/XMLSchema#string>');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'prp-npa2'));
});
