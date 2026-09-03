'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { TripleStore } = require('../../src/inference/TripleStore');
const { OWL2RLReasoner } = require('../../src/inference/OWL2RLReasoner');
const { ReasonerQueries } = require('../../src/inference/ReasonerQueries');
const { NS } = require('../../src/inference/rdf');

const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL;
const EX = 'http://ex.org/';

function build() {
  const s = new TripleStore();
  s.add(EX + 'A', RDF + 'type', OWL + 'Class');
  s.add(EX + 'B', RDF + 'type', OWL + 'Class');
  s.add(EX + 'C', RDF + 'type', OWL + 'Class');
  s.add(EX + 'A', RDFS + 'subClassOf', EX + 'B');
  s.add(EX + 'B', RDFS + 'subClassOf', EX + 'C');
  s.add(EX + 'i', RDF + 'type', EX + 'A');
  const r = new OWL2RLReasoner(s);
  r.materialize();
  return new ReasonerQueries(r);
}

test('getSuperClasses transitive via RL materialization', () => {
  const q = build();
  const sups = q.getSuperClasses(EX + 'A');
  assert.ok(sups.includes(EX + 'B'));
  assert.ok(sups.includes(EX + 'C')); // transitive inferred by cax-sco / scm-sco
});

test('getInstances inferred through subclass chain', () => {
  const q = build();
  assert.ok(q.getInstances(EX + 'A').includes(EX + 'i'));
  assert.ok(q.getInstances(EX + 'B').includes(EX + 'i'));
  assert.ok(q.getInstances(EX + 'C').includes(EX + 'i'));
});

test('getTypes returns named classes only', () => {
  const q = build();
  const types = q.getTypes(EX + 'i');
  assert.ok(types.includes(EX + 'A'));
  assert.ok(!types.includes(OWL + 'NamedIndividual'));
});

test('isSubClassOf', () => {
  const q = build();
  assert.equal(q.isSubClassOf(EX + 'A', EX + 'B'), true);
  assert.equal(q.isSubClassOf(EX + 'A', EX + 'C'), true);
  assert.equal(q.isSubClassOf(EX + 'C', EX + 'A'), false);
});

test('isSatisfiable', () => {
  const q = build();
  assert.equal(q.isSatisfiable(EX + 'A'), true);
});
