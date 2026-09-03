'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const T = RDF + 'type';
const SA = 'http://www.w3.org/2002/07/owl#sameAs';
const DF = 'http://www.w3.org/2002/07/owl#differentFrom';

test('dt-type1: built-in datatypes are typed rdfs:Datatype', () => {
  const r = new OWL2RLReasoner();
  r.store.add('ex:a', 'ex:p', 'ex:b');
  r.materialize();
  assert.ok(r.entails(XSD + 'string', T, RDFS + 'Datatype'));
  assert.ok(r.entails(XSD + 'boolean', T, RDFS + 'Datatype'));
  assert.ok(r.entails(XSD + 'integer', T, RDFS + 'Datatype'));
});

test('dt-type2: typed literal belongs to its datatype', () => {
  const r = new OWL2RLReasoner();
  const lit = `"5"^^<${XSD}integer>`;
  r.store.add('ex:a', 'ex:p', lit);
  r.materialize();
  assert.ok(r.entails(lit, T, XSD + 'integer'));
});

test('dt-type2: untyped literal belongs to rdfs:Literal', () => {
  const r = new OWL2RLReasoner();
  const lit = '"hello"';
  r.store.add('ex:a', 'ex:p', lit);
  r.materialize();
  assert.ok(r.entails(lit, T, RDFS + 'Literal'));
});

test('dt-eq: identical typed literals are sameAs', () => {
  const r = new OWL2RLReasoner();
  const lit = `"5"^^<${XSD}integer>`;
  r.store.add('ex:a', 'ex:p', lit);
  r.materialize();
  assert.ok(r.entails(lit, SA, lit));
});

test('dt-diff: distinct typed literals of the same datatype are differentFrom', () => {
  const r = new OWL2RLReasoner();
  const a = `"5"^^<${XSD}integer>`;
  const b = `"7"^^<${XSD}integer>`;
  r.store.add('ex:x', 'ex:p', a);
  r.store.add('ex:y', 'ex:q', b);
  r.materialize();
  assert.ok(r.entails(a, DF, b));
  assert.ok(r.entails(b, DF, a));
});

test('dt-not-type: ill-typed nonNegativeInteger is inconsistent', () => {
  const r = new OWL2RLReasoner();
  const bad = `"-3"^^<${XSD}nonNegativeInteger>`;
  r.store.add('ex:a', 'ex:p', bad);
  r.materialize();
  assert.ok(r.inconsistencies.some(c => c.rule === 'dt-not-type'));
});

test('dt-not-type: well-typed integer is consistent', () => {
  const r = new OWL2RLReasoner();
  const ok = `"42"^^<${XSD}integer>`;
  r.store.add('ex:a', 'ex:p', ok);
  r.materialize();
  assert.ok(!r.inconsistencies.some(c => c.rule === 'dt-not-type'));
});
