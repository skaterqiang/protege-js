'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const T = RDF + 'type';
const SA = OWL + 'sameAs';
const DF = OWL + 'differentFrom';

test('eq-ref: every subject/object is sameAs itself', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', 'ex:p', 'ex:b');
  r.materialize();
  assert.ok(r.entails('ex:a', SA, 'ex:a'));
  assert.ok(r.entails('ex:b', SA, 'ex:b'));
  assert.ok(r.entails('ex:p', SA, 'ex:p'));
});

test('eq-sym: sameAs is symmetric', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', SA, 'ex:b');
  r.materialize();
  assert.ok(r.entails('ex:b', SA, 'ex:a'));
});

test('eq-trans: sameAs is transitive', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', SA, 'ex:b');
  r.store.add('ex:b', SA, 'ex:c');
  r.materialize();
  assert.ok(r.entails('ex:a', SA, 'ex:c'));
});

test('eq-rep-s: replace subject by equal subject', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', SA, 'ex:b');
  r.store.add('ex:a', 'ex:p', 'ex:x');
  r.materialize();
  assert.ok(r.entails('ex:b', 'ex:p', 'ex:x'));
});

test('eq-rep-p: replace predicate by equal predicate', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:p', SA, 'ex:q');
  r.store.add('ex:a', 'ex:p', 'ex:x');
  r.materialize();
  assert.ok(r.entails('ex:a', 'ex:q', 'ex:x'));
});

test('eq-rep-o: replace object by equal object', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:x', SA, 'ex:y');
  r.store.add('ex:a', 'ex:p', 'ex:x');
  r.materialize();
  assert.ok(r.entails('ex:a', 'ex:p', 'ex:y'));
});

test('eq-diff1: sameAs + differentFrom -> inconsistency', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', SA, 'ex:b');
  r.store.add('ex:a', DF, 'ex:b');
  r.materialize();
  assert.ok(!r.isConsistent());
  assert.ok(r.inconsistencies.some(c => c.rule === 'eq-diff1'));
});

test('eq-diff2: AllDifferent members pairwise distinct (inconsistency when same)', () => {
  const r = new OWL2RLReasoner();
  // AllDifferent x with members (a b), and a sameAs b
  r.store.add('ex:ad', T, OWL + 'AllDifferent');
  r.store.add('ex:ad', OWL + 'members', '_:l1');
  r.store.add('_:l1', RDF + 'first', 'ex:a');
  r.store.add('_:l1', RDF + 'rest', '_:l2');
  r.store.add('_:l2', RDF + 'first', 'ex:b');
  r.store.add('_:l2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:a', SA, 'ex:b');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'eq-diff2'));
});

test('eq-diff3: AllDifferent distinctMembers inconsistency when same', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:ad', T, OWL + 'AllDifferent');
  r.store.add('ex:ad', OWL + 'distinctMembers', '_:l1');
  r.store.add('_:l1', RDF + 'first', 'ex:a');
  r.store.add('_:l1', RDF + 'rest', '_:l2');
  r.store.add('_:l2', RDF + 'first', 'ex:b');
  r.store.add('_:l2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:a', SA, 'ex:b');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'eq-diff3'));
});
