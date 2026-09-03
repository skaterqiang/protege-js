'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { FunctionalSyntaxParser } = require('../../src/io/FunctionalSyntaxParser');

const parse = (text) => new FunctionalSyntaxParser().parse(text);

test('Functional: Declaration Class', () => {
  const o = parse('Declaration(Class(<http://example.org/Person>))');
  assert.strictEqual(o.getAxiomCount(), 1);
  const ax = o.getAxioms()[0];
  assert.strictEqual(ax.getAxiomType(), 'Declaration');
});

test('Functional: SubClassOf', () => {
  const o = parse('SubClassOf(<http://example.org/Student> <http://example.org/Person>)');
  assert.strictEqual(o.getAxiomCount(), 1);
  assert.match(o.getAxioms()[0].toString(), /SubClassOf/);
});

test('Functional: EquivalentClasses', () => {
  const o = parse('EquivalentClasses(<http://example.org/Person> <http://example.org/Human>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: DisjointClasses', () => {
  const o = parse('DisjointClasses(<http://example.org/Cat> <http://example.org/Dog>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: DisjointUnion', () => {
  const o = parse('DisjointUnion(<http://example.org/Color> <http://example.org/R> <http://example.org/G>)');
  assert.strictEqual(o.getAxiomCount(), 1);
  assert.match(o.getAxioms()[0].toString(), /DisjointUnion/);
});

test('Functional: SubObjectPropertyChain', () => {
  const o = parse('SubObjectPropertyOf(ObjectPropertyChain(<http://example.org/hasParent> <http://example.org/hasBrother>) <http://example.org/hasUncle>)');
  assert.strictEqual(o.getAxiomCount(), 1);
  assert.match(o.getAxioms()[0].toString(), /Chain/);
});

test('Functional: TransitiveObjectProperty', () => {
  const o = parse('TransitiveObjectProperty(<http://example.org/hasAncestor>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: ClassAssertion', () => {
  const o = parse('ClassAssertion(<http://example.org/Person> <http://example.org/alice>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: ObjectPropertyAssertion', () => {
  const o = parse('ObjectPropertyAssertion(<http://example.org/knows> <http://example.org/a> <http://example.org/b>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: DataPropertyAssertion with typed literal', () => {
  const o = parse('Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>) DataPropertyAssertion(<http://example.org/age> <http://example.org/a> "30"^^xsd:integer)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: HasKey', () => {
  const o = parse('HasKey(<http://example.org/Person> <http://example.org/ssn>)');
  assert.strictEqual(o.getAxiomCount(), 1);
  assert.match(o.getAxioms()[0].toString(), /HasKey/);
});

test('Functional: SameIndividual / DifferentIndividuals', () => {
  const o = parse('SameIndividual(<http://example.org/a> <http://example.org/b>) DifferentIndividuals(<http://example.org/c> <http://example.org/d>)');
  assert.strictEqual(o.getAxiomCount(), 2);
});

test('Functional: Ontology wrapper', () => {
  const o = parse(`
    Ontology(<http://example.org/ont>
      Declaration(Class(<http://example.org/Person>))
      SubClassOf(<http://example.org/Student> <http://example.org/Person>)
    )
  `);
  assert.strictEqual(o.getAxiomCount(), 2);
});

test('Functional: class expressions', () => {
  const o = parse(`
    SubClassOf(<http://example.org/A> ObjectIntersectionOf(<http://example.org/B> <http://example.org/C>))
  `);
  assert.strictEqual(o.getAxiomCount(), 1);
  assert.match(o.getAxioms()[0].toString(), /and|Intersection|∩/);
});

test('Functional: DataSomeValuesFrom', () => {
  const o = parse(`
    SubClassOf(<http://example.org/Person> DataSomeValuesFrom(<http://example.org/age> <http://www.w3.org/2001/XMLSchema#integer>))
  `);
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: NegativeObjectPropertyAssertion', () => {
  const o = parse('NegativeObjectPropertyAssertion(<http://example.org/knows> <http://example.org/a> <http://example.org/b>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: AnnotationAssertion', () => {
  const o = parse('AnnotationAssertion(<http://www.w3.org/2000/01/rdf-schema#label> <http://example.org/Thing> "A thing")');
  assert.strictEqual(o.getAxiomCount(), 1);
});

test('Functional: DatatypeDefinition', () => {
  const o = parse('DatatypeDefinition(<http://example.org/Age> <http://www.w3.org/2001/XMLSchema#integer>)');
  assert.strictEqual(o.getAxiomCount(), 1);
});
