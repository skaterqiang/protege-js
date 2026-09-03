'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ManchesterSyntaxParser } = require('../../src/io/ManchesterSyntaxParser');

const EX = 'http://ex.org/';
const parser = () => new ManchesterSyntaxParser({ prefixes: { ex: EX } });

test('Class frame: SubClassOf + DisjointWith', () => {
  const ont = parser().parse(`
Class: ex:Person
    SubClassOf: ex:Animal
    DisjointWith: ex:Robot
  `);
  assert.equal(ont.getAxiomsOfType('Declaration').length, 1);
  assert.equal(ont.getAxiomsOfType('SubClassOf').length, 1);
  assert.equal(ont.getAxiomsOfType('DisjointClasses').length, 1);
});

test('Class frame: some restriction', () => {
  const ont = parser().parse(`
Class: ex:Parent
    SubClassOf: ex:hasChild some ex:Person
  `);
  const subs = ont.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  assert.equal(subs[0].superClass.type, 'ObjectSomeValuesFrom');
});

test('Class frame: and / or / not', () => {
  const ont = parser().parse(`
Class: ex:A
    SubClassOf: ex:B and ex:C
    EquivalentTo: ex:D or ex:E
    DisjointWith: not ex:F
  `);
  assert.equal(ont.getAxiomsOfType('SubClassOf')[0].superClass.type, 'ObjectIntersectionOf');
  assert.equal(ont.getAxiomsOfType('EquivalentClasses')[0].classExpressions[1].type, 'ObjectUnionOf');
  assert.equal(ont.getAxiomsOfType('DisjointClasses')[0].classExpressions[1].type, 'ObjectComplementOf');
});

test('ObjectProperty frame: domain/range/characteristics/inverseOf', () => {
  const ont = parser().parse(`
ObjectProperty: ex:hasParent
    Domain: ex:Person
    Range: ex:Person
    Characteristics: Transitive, Functional
    InverseOf: ex:hasChild
  `);
  assert.equal(ont.getAxiomsOfType('ObjectPropertyDomain').length, 1);
  assert.equal(ont.getAxiomsOfType('ObjectPropertyRange').length, 1);
  assert.equal(ont.getAxiomsOfType('TransitiveObjectProperty').length, 1);
  assert.equal(ont.getAxiomsOfType('FunctionalObjectProperty').length, 1);
  assert.equal(ont.getAxiomsOfType('InverseObjectProperties').length, 1);
});

test('Individual frame: Types + Facts + SameAs', () => {
  const ont = parser().parse(`
Individual: ex:alice
    Types: ex:Person
    Facts: ex:hasParent ex:bob
    SameAs: ex:alicia
  `);
  assert.equal(ont.getAxiomsOfType('ClassAssertion').length, 1);
  assert.equal(ont.getAxiomsOfType('ObjectPropertyAssertion').length, 1);
  assert.equal(ont.getAxiomsOfType('SameIndividual').length, 1);
});

test('Class frame: oneOf enumeration', () => {
  const ont = parser().parse(`
Class: ex:Color
    EquivalentTo: {ex:red, ex:green, ex:blue}
  `);
  const eq = ont.getAxiomsOfType('EquivalentClasses')[0];
  assert.equal(eq.classExpressions[1].type, 'ObjectOneOf');
  assert.equal(eq.classExpressions[1].operands.length, 3);
});

test('Class frame: cardinality', () => {
  const ont = parser().parse(`
Class: ex:Parent
    SubClassOf: ex:hasChild min 2
  `);
  const sup = ont.getAxiomsOfType('SubClassOf')[0].superClass;
  assert.equal(sup.type, 'ObjectMinCardinality');
  assert.equal(sup.cardinality, 2);
});

test('Prefix declarations', () => {
  const p = new ManchesterSyntaxParser();
  const ont = p.parse(`
Prefix: ex: <http://custom.org/>
Class: ex:Widget
    SubClassOf: ex:Thing
  `);
  const sub = ont.getAxiomsOfType('SubClassOf')[0];
  assert.equal(sub.subClass.getIRI().toString(), 'http://custom.org/Widget');
});
