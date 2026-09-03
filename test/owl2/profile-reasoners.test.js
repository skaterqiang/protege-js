'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { OWL2QLReasoner, OWL2ELReasoner } = require('../../src/inference/OWL2ProfileReasoners');
const { TripleStore } = require('../../src/inference/TripleStore');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const EX = 'http://ex.org/';

function store(...triples) {
  const s = new TripleStore();
  for (const [a, b, c] of triples) s.add(a, b, c);
  return s;
}

// --- QL ---

test('QL: subclass inheritance (cax-sco)', () => {
  const s = store(
    [EX + 'A', RDFS + 'subClassOf', EX + 'B'],
    [EX + 'x', RDF + 'type', EX + 'A']
  );
  const r = new OWL2QLReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'x', RDF + 'type', EX + 'B'));
});

test('QL: domain typing (prp-dom)', () => {
  const s = store(
    [EX + 'hasParent', RDFS + 'domain', EX + 'Person'],
    [EX + 'alice', EX + 'hasParent', EX + 'bob']
  );
  const r = new OWL2QLReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'alice', RDF + 'type', EX + 'Person'));
});

test('QL: subPropertyOf propagation (prp-spo1)', () => {
  const s = store(
    [EX + 'hasFather', RDFS + 'subPropertyOf', EX + 'hasParent'],
    [EX + 'alice', EX + 'hasFather', EX + 'bob']
  );
  const r = new OWL2QLReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'alice', EX + 'hasParent', EX + 'bob'));
});

test('QL: inverseOf (prp-inv1)', () => {
  const s = store(
    [EX + 'hasParent', 'http://www.w3.org/2002/07/owl#inverseOf', EX + 'hasChild'],
    [EX + 'alice', EX + 'hasParent', EX + 'bob']
  );
  const r = new OWL2QLReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'bob', EX + 'hasChild', EX + 'alice'));
});

// --- EL ---

test('EL: intersection membership (cls-int1/cls-int2)', () => {
  // A ⊑ B ⊓ C, x : A  →  x : B, x : C  (via cls-int2 from equivalent/subclass)
  const s = store(
    [EX + 'A', RDFS + 'subClassOf', EX + 'B'],
    [EX + 'x', RDF + 'type', EX + 'A']
  );
  const r = new OWL2ELReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'x', RDF + 'type', EX + 'B'));
});

test('EL: transitivity (prp-trp)', () => {
  const OWL = 'http://www.w3.org/2002/07/owl#';
  const s = store(
    [EX + 'hasAncestor', RDF + 'type', OWL + 'TransitiveProperty'],
    [EX + 'a', EX + 'hasAncestor', EX + 'b'],
    [EX + 'b', EX + 'hasAncestor', EX + 'c']
  );
  const r = new OWL2ELReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'a', EX + 'hasAncestor', EX + 'c'));
});

test('EL: property chain (prp-spo2)', () => {
  const OWL = 'http://www.w3.org/2002/07/owl#';
  // hasParent ∘ hasParent ⊑ hasGrandparent  via rdf:List chain
  const s = new TripleStore();
  s.add(EX + 'hasGrandparent', OWL + 'propertyChainAxiom', '_:c1');
  s.add('_:c1', RDF + 'first', EX + 'hasParent');
  s.add('_:c1', RDF + 'rest', '_:c2');
  s.add('_:c2', RDF + 'first', EX + 'hasParent');
  s.add('_:c2', RDF + 'rest', RDF + 'nil');
  s.add(EX + 'a', EX + 'hasParent', EX + 'b');
  s.add(EX + 'b', EX + 'hasParent', EX + 'c');
  const r = new OWL2ELReasoner(s);
  r.materialize();
  assert.ok(r.entails(EX + 'a', EX + 'hasGrandparent', EX + 'c'));
});

test('QL excludes equality rules (no sameAs reflexive blowup)', () => {
  const s = store([EX + 'x', RDF + 'type', EX + 'A']);
  const r = new OWL2QLReasoner(s);
  r.materialize();
  // eq-ref would add x sameAs x; QL does not include it.
  assert.ok(!r.entails(EX + 'x', 'http://www.w3.org/2002/07/owl#sameAs', EX + 'x'));
});
