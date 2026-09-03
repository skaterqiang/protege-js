'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { TripleStore } = require('../../src/inference/TripleStore');
const {
  SWRLRule, SWRLClassAtom, SWRLObjectPropertyAtom, SWRLDataPropertyAtom,
  SWRLBuiltInAtom, SWRLVariable, AtomType
} = require('../../src/model/SWRL');
const { SWRLReasoner, SWRLBuiltins } = require('../../src/inference/SWRLReasoner');
const { OWLClass, OWLObjectProperty, OWLDataProperty } = require('../../src/model/OWLEntity');
const { IRI } = require('../../src/model/IRI');
const { NS } = require('../../src/inference/rdf');

const ex = (s) => 'http://example.org/' + s;
const cls = (s) => new OWLClass(IRI.create(ex(s)));
const op = (s) => new OWLObjectProperty(IRI.create(ex(s)));
const dp = (s) => new OWLDataProperty(IRI.create(ex(s)));
const v = (n) => new SWRLVariable(IRI.create('urn:swrl:var:' + n));

test('SWRL model: rule creation', () => {
  const rule = new SWRLRule(
    [new SWRLClassAtom(cls('Person'), v('x'))],
    [new SWRLClassAtom(cls('Human'), v('x'))]
  );
  assert.strictEqual(rule.body.length, 1);
  assert.strictEqual(rule.head.length, 1);
  assert.match(rule.toString(), /->/);
});

test('SWRL: chain inference (uncle rule)', () => {
  const S = new TripleStore();
  S.add(ex('a'), NS.RDF + 'type', ex('Person'));
  S.add(ex('a'), ex('hasParent'), ex('b'));
  S.add(ex('b'), ex('hasBrother'), ex('c'));
  const rule = new SWRLRule(
    [
      new SWRLClassAtom(cls('Person'), v('x')),
      new SWRLObjectPropertyAtom(op('hasParent'), v('x'), v('y')),
      new SWRLObjectPropertyAtom(op('hasBrother'), v('y'), v('z'))
    ],
    [new SWRLObjectPropertyAtom(op('hasUncle'), v('x'), v('z'))]
  );
  const r = new SWRLReasoner(S);
  const added = r.run([rule]);
  assert.strictEqual(added, 1);
  assert.strictEqual(S.match(ex('a'), ex('hasUncle'), ex('c')).length, 1);
});

test('SWRL: builtin greaterThanOrEqual', () => {
  const S = new TripleStore();
  S.add(ex('p1'), ex('age'), '"30"^^<' + NS.XSD + 'integer>');
  const rule = new SWRLRule(
    [
      new SWRLDataPropertyAtom(dp('age'), v('p'), v('age')),
      new SWRLBuiltInAtom(IRI.create('http://www.w3.org/2003/11/swrlb#greaterThanOrEqual'), [
        v('age'),
        { lexicalValue: '18', datatype: { iri: IRI.create(NS.XSD + 'integer') } }
      ])
    ],
    [new SWRLClassAtom(cls('Adult'), v('p'))]
  );
  const r = new SWRLReasoner(S);
  const added = r.run([rule]);
  assert.strictEqual(added, 1);
  assert.strictEqual(S.match(ex('p1'), NS.RDF + 'type', ex('Adult')).length, 1);
});

test('SWRL: builtin add assigns new var', () => {
  const S = new TripleStore();
  S.add(ex('x'), ex('val'), '"5"^^<' + NS.XSD + 'integer>');
  const rule = new SWRLRule(
    [
      new SWRLDataPropertyAtom(dp('val'), v('s'), v('v')),
      new SWRLBuiltInAtom(IRI.create('http://www.w3.org/2003/11/swrlb#add'), [
        v('result'), v('v'),
        { lexicalValue: '3', datatype: { iri: IRI.create(NS.XSD + 'integer') } }
      ])
    ],
    [new SWRLDataPropertyAtom(dp('computed'), v('s'), v('result'))]
  );
  const r = new SWRLReasoner(S);
  r.run([rule]);
  const triples = S.match(ex('x'), ex('computed'), null);
  assert.strictEqual(triples.length, 1);
  assert.match(triples[0][2], /8/);
});

test('SWRL: builtins library', () => {
  assert.strictEqual(SWRLBuiltins.call('equal', [5, 5]), true);
  assert.strictEqual(SWRLBuiltins.call('lessThan', [3, 7]), true);
  assert.strictEqual(SWRLBuiltins.call('add', [2, 3]), 5);
  assert.strictEqual(SWRLBuiltins.call('multiply', [4, 5]), 20);
  assert.strictEqual(SWRLBuiltins.call('upperCase', ['abc']), 'ABC');
  assert.strictEqual(SWRLBuiltins.call('stringLength', ['hello']), 5);
  assert.strictEqual(SWRLBuiltins.call('contains', ['hello world', 'world']), true);
});

test('SWRL: fixpoint — multi-hop transitive-like rule', () => {
  const S = new TripleStore();
  S.add(ex('a'), ex('p'), ex('b'));
  S.add(ex('b'), ex('p'), ex('c'));
  S.add(ex('c'), ex('p'), ex('d'));
  const rule = new SWRLRule(
    [
      new SWRLObjectPropertyAtom(op('p'), v('x'), v('y')),
      new SWRLObjectPropertyAtom(op('p'), v('y'), v('z'))
    ],
    [new SWRLObjectPropertyAtom(op('p2'), v('x'), v('z'))]
  );
  const r = new SWRLReasoner(S);
  r.run([rule]);
  assert.strictEqual(S.match(ex('a'), ex('p2'), ex('c')).length, 1);
  assert.strictEqual(S.match(ex('b'), ex('p2'), ex('d')).length, 1);
});

test('SWRL: class membership propagation', () => {
  const S = new TripleStore();
  S.add(ex('s1'), NS.RDF + 'type', ex('Student'));
  const rule = new SWRLRule(
    [new SWRLClassAtom(cls('Student'), v('x'))],
    [new SWRLClassAtom(cls('Person'), v('x'))]
  );
  const r = new SWRLReasoner(S);
  r.run([rule]);
  assert.strictEqual(S.match(ex('s1'), NS.RDF + 'type', ex('Person')).length, 1);
});

test('SWRL: AtomType enum has 7 values', () => {
  assert.strictEqual(Object.keys(AtomType).length, 7);
});
