'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const T = RDF + 'type';

test('cax-sco: subclass membership propagates to superclass', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', RDFS + 'subClassOf', 'ex:B');
  r.store.add('ex:x', T, 'ex:A');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:B'));
});

test('cax-eqc1: equivalent class forward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', OWL + 'equivalentClass', 'ex:B');
  r.store.add('ex:x', T, 'ex:A');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:B'));
});

test('cax-eqc2: equivalent class backward direction', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', OWL + 'equivalentClass', 'ex:B');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:A'));
});

test('cax-dw: disjoint classes sharing an instance is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', OWL + 'disjointWith', 'ex:B');
  r.store.add('ex:x', T, 'ex:A');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cax-dw'));
});

test('cax-adc: AllDisjointClasses sharing an instance is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:ad', T, OWL + 'AllDisjointClasses');
  r.store.add('ex:ad', OWL + 'members', '_:m1');
  r.store.add('_:m1', RDF + 'first', 'ex:A');
  r.store.add('_:m1', RDF + 'rest', '_:m2');
  r.store.add('_:m2', RDF + 'first', 'ex:B');
  r.store.add('_:m2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:x', T, 'ex:A');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cax-adc'));
});
