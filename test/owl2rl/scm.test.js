'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const T = RDF + 'type';
const SC = RDFS + 'subClassOf';
const SP = RDFS + 'subPropertyOf';
const EC = OWL + 'equivalentClass';
const EP = OWL + 'equivalentProperty';

test('scm-cls: class is subclass of itself and of owl:Thing; Nothing subclass of it', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', T, OWL + 'Class');
  r.materialize();
  assert.ok(r.entails('ex:C', SC, 'ex:C'));
  assert.ok(r.entails('ex:C', EC, 'ex:C'));
  assert.ok(r.entails('ex:C', SC, OWL + 'Thing'));
  assert.ok(r.entails(OWL + 'Nothing', SC, 'ex:C'));
});

test('scm-sco: subClassOf is transitive', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', SC, 'ex:B');
  r.store.add('ex:B', SC, 'ex:C');
  r.materialize();
  assert.ok(r.entails('ex:A', SC, 'ex:C'));
});

test('scm-eqc1: equivalentClass yields subClassOf both ways', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', EC, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:A', SC, 'ex:B'));
  assert.ok(r.entails('ex:B', SC, 'ex:A'));
});

test('scm-eqc2: mutual subClassOf yields equivalentClass', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', SC, 'ex:B');
  r.store.add('ex:B', SC, 'ex:A');
  r.materialize();
  assert.ok(r.entails('ex:A', EC, 'ex:B'));
});

test('scm-op: object property is sub/equivalent property of itself', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'ObjectProperty');
  r.materialize();
  assert.ok(r.entails('ex:p', SP, 'ex:p'));
  assert.ok(r.entails('ex:p', EP, 'ex:p'));
});

test('scm-dp: datatype property is sub/equivalent property of itself', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', T, OWL + 'DatatypeProperty');
  r.materialize();
  assert.ok(r.entails('ex:p', SP, 'ex:p'));
  assert.ok(r.entails('ex:p', EP, 'ex:p'));
});

test('scm-spo: subPropertyOf is transitive', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p1', SP, 'ex:p2');
  r.store.add('ex:p2', SP, 'ex:p3');
  r.materialize();
  assert.ok(r.entails('ex:p1', SP, 'ex:p3'));
});

test('scm-eqp1: equivalentProperty yields subPropertyOf both ways', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', EP, 'ex:q');
  r.materialize();
  assert.ok(r.entails('ex:p', SP, 'ex:q'));
  assert.ok(r.entails('ex:q', SP, 'ex:p'));
});

test('scm-eqp2: mutual subPropertyOf yields equivalentProperty', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', SP, 'ex:q');
  r.store.add('ex:q', SP, 'ex:p');
  r.materialize();
  assert.ok(r.entails('ex:p', EP, 'ex:q'));
});

test('scm-dom1: domain widens along subClassOf', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', RDFS + 'domain', 'ex:A');
  r.store.add('ex:A', SC, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:p', RDFS + 'domain', 'ex:B'));
});

test('scm-dom2: domain narrows to subproperty', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p2', RDFS + 'domain', 'ex:C');
  r.store.add('ex:p1', SP, 'ex:p2');
  r.materialize();
  assert.ok(r.entails('ex:p1', RDFS + 'domain', 'ex:C'));
});

test('scm-rng1: range widens along subClassOf', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', RDFS + 'range', 'ex:A');
  r.store.add('ex:A', SC, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:p', RDFS + 'range', 'ex:B'));
});

test('scm-rng2: range narrows to subproperty', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p2', RDFS + 'range', 'ex:C');
  r.store.add('ex:p1', SP, 'ex:p2');
  r.materialize();
  assert.ok(r.entails('ex:p1', RDFS + 'range', 'ex:C'));
});

test('scm-hv: hasValue restriction subsumption via subPropertyOf', () => {
  const r = new OWL2RLReasoner();
  // c1: p1 hasValue i ; c2: p2 hasValue i ; p1 subPropertyOf p2  =>  c1 subClassOf c2
  r.store.add('ex:c1', OWL + 'hasValue', 'ex:i');
  r.store.add('ex:c1', OWL + 'onProperty', 'ex:p1');
  r.store.add('ex:c2', OWL + 'hasValue', 'ex:i');
  r.store.add('ex:c2', OWL + 'onProperty', 'ex:p2');
  r.store.add('ex:p1', SP, 'ex:p2');
  r.materialize();
  assert.ok(r.entails('ex:c1', SC, 'ex:c2'));
});

test('scm-svf1: someValuesFrom subsumption via filler subClassOf', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:c1', OWL + 'someValuesFrom', 'ex:y1');
  r.store.add('ex:c1', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:c2', OWL + 'someValuesFrom', 'ex:y2');
  r.store.add('ex:c2', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:y1', SC, 'ex:y2');
  r.materialize();
  assert.ok(r.entails('ex:c1', SC, 'ex:c2'));
});

test('scm-svf2: someValuesFrom subsumption via subPropertyOf', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:c1', OWL + 'someValuesFrom', 'ex:y');
  r.store.add('ex:c1', OWL + 'onProperty', 'ex:p1');
  r.store.add('ex:c2', OWL + 'someValuesFrom', 'ex:y');
  r.store.add('ex:c2', OWL + 'onProperty', 'ex:p2');
  r.store.add('ex:p1', SP, 'ex:p2');
  r.materialize();
  assert.ok(r.entails('ex:c1', SC, 'ex:c2'));
});

test('scm-avf1: allValuesFrom subsumption via filler subClassOf', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:c1', OWL + 'allValuesFrom', 'ex:y1');
  r.store.add('ex:c1', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:c2', OWL + 'allValuesFrom', 'ex:y2');
  r.store.add('ex:c2', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:y1', SC, 'ex:y2');
  r.materialize();
  assert.ok(r.entails('ex:c1', SC, 'ex:c2'));
});

test('scm-avf2: allValuesFrom subsumption via subPropertyOf (reversed)', () => {
  const r = new OWL2RLReasoner();
  // T(c1, owl:allValuesFrom, y), T(c1, owl:onProperty, p1),
  // T(c2, owl:allValuesFrom, y), T(c2, owl:onProperty, p2), T(p1, rdfs:subPropertyOf, p2)
  // => T(c2, rdfs:subClassOf, c1)
  r.store.add('ex:c1', OWL + 'allValuesFrom', 'ex:y');
  r.store.add('ex:c1', OWL + 'onProperty', 'ex:p1');
  r.store.add('ex:c2', OWL + 'allValuesFrom', 'ex:y');
  r.store.add('ex:c2', OWL + 'onProperty', 'ex:p2');
  r.store.add('ex:p1', SP, 'ex:p2');
  r.materialize();
  assert.ok(r.entails('ex:c2', SC, 'ex:c1'));
});

test('scm-int: intersection is subclass of each operand', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'intersectionOf', '_:i1');
  r.store.add('_:i1', RDF + 'first', 'ex:A');
  r.store.add('_:i1', RDF + 'rest', '_:i2');
  r.store.add('_:i2', RDF + 'first', 'ex:B');
  r.store.add('_:i2', RDF + 'rest', RDF + 'nil');
  r.materialize();
  assert.ok(r.entails('ex:C', SC, 'ex:A'));
  assert.ok(r.entails('ex:C', SC, 'ex:B'));
});

test('scm-uni: each union operand is subclass of the union', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'unionOf', '_:u1');
  r.store.add('_:u1', RDF + 'first', 'ex:A');
  r.store.add('_:u1', RDF + 'rest', '_:u2');
  r.store.add('_:u2', RDF + 'first', 'ex:B');
  r.store.add('_:u2', RDF + 'rest', RDF + 'nil');
  r.materialize();
  assert.ok(r.entails('ex:A', SC, 'ex:C'));
  assert.ok(r.entails('ex:B', SC, 'ex:C'));
});
