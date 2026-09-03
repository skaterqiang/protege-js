'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const T = RDF + 'type';
const SA = OWL + 'sameAs';
const ZERO = `"0"^^<${XSD}nonNegativeInteger>`;
const ONE = `"1"^^<${XSD}nonNegativeInteger>`;

test('cls-thing: owl:Thing is a class', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', 'ex:p', 'ex:b');
  r.materialize();
  assert.ok(r.entails(OWL + 'Thing', T, OWL + 'Class'));
});

test('cls-nothing1: owl:Nothing is a class', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', 'ex:p', 'ex:b');
  r.materialize();
  assert.ok(r.entails(OWL + 'Nothing', T, OWL + 'Class'));
});

test('cls-nothing2: instance of owl:Nothing is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:x', T, OWL + 'Nothing');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cls-nothing2'));
});

test('cls-int1: intersection member-of-all implies intersection', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'intersectionOf', '_:i1');
  r.store.add('_:i1', RDF + 'first', 'ex:A');
  r.store.add('_:i1', RDF + 'rest', '_:i2');
  r.store.add('_:i2', RDF + 'first', 'ex:B');
  r.store.add('_:i2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:x', T, 'ex:A');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:C'));
});

test('cls-int2: intersection instance belongs to each operand', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'intersectionOf', '_:i1');
  r.store.add('_:i1', RDF + 'first', 'ex:A');
  r.store.add('_:i1', RDF + 'rest', '_:i2');
  r.store.add('_:i2', RDF + 'first', 'ex:B');
  r.store.add('_:i2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:x', T, 'ex:C');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:A'));
  assert.ok(r.entails('ex:x', T, 'ex:B'));
});

test('cls-uni: member of any union operand belongs to the union', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'unionOf', '_:u1');
  r.store.add('_:u1', RDF + 'first', 'ex:A');
  r.store.add('_:u1', RDF + 'rest', '_:u2');
  r.store.add('_:u2', RDF + 'first', 'ex:B');
  r.store.add('_:u2', RDF + 'rest', RDF + 'nil');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.entails('ex:x', T, 'ex:C'));
});

test('cls-com: instance of a class and its complement is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:A', OWL + 'complementOf', 'ex:B');
  r.store.add('ex:x', T, 'ex:A');
  r.store.add('ex:x', T, 'ex:B');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cls-com'));
});

test('cls-svf1: someValuesFrom — a filler typed y classifies the subject', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'someValuesFrom', 'ex:Y');
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', 'ex:p', 'ex:v');
  r.store.add('ex:v', T, 'ex:Y');
  r.materialize();
  assert.ok(r.entails('ex:u', T, 'ex:X'));
});

test('cls-svf2: someValuesFrom owl:Thing — any p-edge classifies the subject', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'someValuesFrom', OWL + 'Thing');
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', 'ex:p', 'ex:v');
  r.materialize();
  assert.ok(r.entails('ex:u', T, 'ex:X'));
});

test('cls-avf: allValuesFrom forces p-fillers of X into Y', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'allValuesFrom', 'ex:Y');
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:v');
  r.materialize();
  assert.ok(r.entails('ex:v', T, 'ex:Y'));
});

test('cls-hv1: hasValue — every X has p = y', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'hasValue', 'ex:y');
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', T, 'ex:X');
  r.materialize();
  assert.ok(r.entails('ex:u', 'ex:p', 'ex:y'));
});

test('cls-hv2: hasValue — a p-edge to y classifies the subject as X', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'hasValue', 'ex:y');
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.entails('ex:u', T, 'ex:X'));
});

test('cls-maxc1: maxCardinality 0 with a p-edge is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxCardinality', ZERO);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:v');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cls-maxc1'));
});

test('cls-maxc2: maxCardinality 1 merges two fillers', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxCardinality', ONE);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:y1');
  r.store.add('ex:u', 'ex:p', 'ex:y2');
  r.materialize();
  assert.ok(r.entails('ex:y1', SA, 'ex:y2'));
});

test('cls-maxqc1: maxQualifiedCardinality 0 with a typed filler is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxQualifiedCardinality', ZERO);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:X', OWL + 'onClass', 'ex:C');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:y');
  r.store.add('ex:y', T, 'ex:C');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cls-maxqc1'));
});

test('cls-maxqc2: maxQualifiedCardinality 0 on Thing with any p-edge is inconsistent', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxQualifiedCardinality', ZERO);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:X', OWL + 'onClass', OWL + 'Thing');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:y');
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'cls-maxqc2'));
});

test('cls-maxqc3: maxQualifiedCardinality 1 merges two C-typed fillers', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxQualifiedCardinality', ONE);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:X', OWL + 'onClass', 'ex:C');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:y1');
  r.store.add('ex:u', 'ex:p', 'ex:y2');
  r.store.add('ex:y1', T, 'ex:C');
  r.store.add('ex:y2', T, 'ex:C');
  r.materialize();
  assert.ok(r.entails('ex:y1', SA, 'ex:y2'));
});

test('cls-maxqc4: maxQualifiedCardinality 1 on Thing merges any two fillers', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:X', OWL + 'maxQualifiedCardinality', ONE);
  r.store.add('ex:X', OWL + 'onProperty', 'ex:p');
  r.store.add('ex:X', OWL + 'onClass', OWL + 'Thing');
  r.store.add('ex:u', T, 'ex:X');
  r.store.add('ex:u', 'ex:p', 'ex:y1');
  r.store.add('ex:u', 'ex:p', 'ex:y2');
  r.materialize();
  assert.ok(r.entails('ex:y1', SA, 'ex:y2'));
});

test('cls-oo: oneOf enumerates class membership', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:C', OWL + 'oneOf', '_:o1');
  r.store.add('_:o1', RDF + 'first', 'ex:a');
  r.store.add('_:o1', RDF + 'rest', '_:o2');
  r.store.add('_:o2', RDF + 'first', 'ex:b');
  r.store.add('_:o2', RDF + 'rest', RDF + 'nil');
  r.materialize();
  assert.ok(r.entails('ex:a', T, 'ex:C'));
  assert.ok(r.entails('ex:b', T, 'ex:C'));
});
