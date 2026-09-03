'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const CE = require('../../src/model/OWLClassExpression');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual, OWLDatatype
} = require('../../src/model/OWLEntity');
const { IRI } = require('../../src/model/IRI');
const { OWLLiteral } = require('../../src/model/OWLLiteral');

const ex = (s) => IRI.create('http://example.org/' + s);
const cls = (s) => new OWLClass(ex(s));
const op = (s) => new OWLObjectProperty(ex(s));
const dp = (s) => new OWLDataProperty(ex(s));
const ni = (s) => new OWLNamedIndividual(ex(s));
const dt = (s) => new OWLDatatype(ex(s));

test('OWLObjectHasSelf', () => {
  const e = new CE.OWLObjectHasSelf(op('likes'));
  assert.strictEqual(e.type, CE.ClassExpressionType.OBJECT_HAS_SELF);
  assert.match(e.toString(), /Self/);
});

test('OWLDataSomeValuesFrom', () => {
  const e = new CE.OWLDataSomeValuesFrom(dp('age'), dt('integer'));
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_SOME_VALUES_FROM);
});

test('OWLDataAllValuesFrom', () => {
  const e = new CE.OWLDataAllValuesFrom(dp('age'), dt('integer'));
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_ALL_VALUES_FROM);
});

test('OWLDataHasValue', () => {
  const lit = new OWLLiteral('30', dt('integer'));
  const e = new CE.OWLDataHasValue(dp('age'), lit);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_HAS_VALUE);
});

test('OWLDataMinCardinality', () => {
  const e = new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_MIN_CARDINALITY, 1, dp('age'), null);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_MIN_CARDINALITY);
  assert.strictEqual(e.cardinality, 1);
});

test('OWLDataMaxCardinality', () => {
  const e = new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_MAX_CARDINALITY, 5, dp('email'), null);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_MAX_CARDINALITY);
  assert.strictEqual(e.cardinality, 5);
});

test('OWLDataExactCardinality', () => {
  const e = new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_EXACT_CARDINALITY, 2, dp('phone'), dt('string'));
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_EXACT_CARDINALITY);
});

test('OWLDataIntersectionOf', () => {
  const e = new CE.OWLDataIntersectionOf([dt('integer'), dt('nonNegativeInteger')]);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_INTERSECTION_OF);
});

test('OWLDataUnionOf', () => {
  const e = new CE.OWLDataUnionOf([dt('string'), dt('integer')]);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_UNION_OF);
});

test('OWLDataComplementOf', () => {
  const e = new CE.OWLDataComplementOf(dt('string'));
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_COMPLEMENT_OF);
});

test('OWLDataOneOf', () => {
  const lits = [new OWLLiteral('a', dt('string')), new OWLLiteral('b', dt('string'))];
  const e = new CE.OWLDataOneOf(lits);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATA_ONE_OF);
  assert.strictEqual(e.operands.length, 2);
});

test('OWLDatatypeRestriction with facets', () => {
  const e = new CE.OWLDatatypeRestriction(dt('integer'), [
    { facet: ex('minInclusive'), value: new OWLLiteral('0', dt('integer')) },
    { facet: ex('maxInclusive'), value: new OWLLiteral('120', dt('integer')) }
  ]);
  assert.strictEqual(e.type, CE.ClassExpressionType.DATATYPE_RESTRICTION);
  assert.strictEqual(e.facetRestrictions.length, 2);
});

test('OWLObjectMinCardinality qualified', () => {
  const e = new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_MIN_CARDINALITY, 2, op('hasChild'), cls('Person'));
  assert.strictEqual(e.type, CE.ClassExpressionType.OBJECT_MIN_CARDINALITY);
  assert.strictEqual(e.cardinality, 2);
  assert.ok(e.filler);
});

test('ClassExpressionType has 26 entries', () => {
  const keys = Object.keys(CE.ClassExpressionType);
  assert.strictEqual(keys.length, 26);
});
