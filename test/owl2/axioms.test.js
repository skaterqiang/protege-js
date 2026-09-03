'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const AX = require('../../src/model/OWLAxiom');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual,
  OWLDatatype, OWLAnnotationProperty
} = require('../../src/model/OWLEntity');
const { IRI } = require('../../src/model/IRI');
const { OWLLiteral } = require('../../src/model/OWLLiteral');

const ex = (s) => IRI.create('http://example.org/' + s);
const cls = (s) => new OWLClass(ex(s));
const op = (s) => new OWLObjectProperty(ex(s));
const dp = (s) => new OWLDataProperty(ex(s));
const ni = (s) => new OWLNamedIndividual(ex(s));
const ap = (s) => new OWLAnnotationProperty(ex(s));
const dt = (s) => new OWLDatatype(ex(s));

test('OWLDisjointUnionAxiom', () => {
  const ax = new AX.OWLDisjointUnionAxiom(cls('Color'), [cls('Red'), cls('Green'), cls('Blue')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DISJOINT_UNION);
  assert.strictEqual(ax.classExpressions.length, 3);
  assert.match(ax.toString(), /DisjointUnion|union/);
});

test('OWLSubPropertyChainOfAxiom', () => {
  const ax = new AX.OWLSubPropertyChainOfAxiom([op('hasParent'), op('hasBrother')], op('hasUncle'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.SUB_PROPERTY_CHAIN_OF);
  assert.strictEqual(ax.propertyChain.length, 2);
  assert.match(ax.toString(), /SubObjectPropertyChain|SubPropertyChain|→|∘/);
});

test('OWLEquivalentObjectPropertiesAxiom', () => {
  const ax = new AX.OWLEquivalentObjectPropertiesAxiom([op('hasFather'), op('hasDad')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.EQUIVALENT_OBJECT_PROPERTIES);
  assert.strictEqual(ax.properties.length, 2);
});

test('OWLDisjointObjectPropertiesAxiom', () => {
  const ax = new AX.OWLDisjointObjectPropertiesAxiom([op('hasParent'), op('hasChild')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DISJOINT_OBJECT_PROPERTIES);
  assert.strictEqual(ax.properties.length, 2);
});

test('OWLEquivalentDataPropertiesAxiom', () => {
  const ax = new AX.OWLEquivalentDataPropertiesAxiom([dp('age'), dp('years')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.EQUIVALENT_DATA_PROPERTIES);
  assert.strictEqual(ax.properties.length, 2);
});

test('OWLDisjointDataPropertiesAxiom', () => {
  const ax = new AX.OWLDisjointDataPropertiesAxiom([dp('name'), dp('ssn')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DISJOINT_DATA_PROPERTIES);
});

test('OWLDataPropertyRangeAxiom', () => {
  const ax = new AX.OWLDataPropertyRangeAxiom(dp('age'), dt('integer'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DATA_PROPERTY_RANGE);
  assert.strictEqual(ax.range.getIRI().toString(), ex('integer').toString());
});

test('OWLDatatypeDefinitionAxiom', () => {
  const ax = new AX.OWLDatatypeDefinitionAxiom(dt('Age'), dt('integer'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DATATYPE_DEFINITION);
});

test('OWLHasKeyAxiom', () => {
  const ax = new AX.OWLHasKeyAxiom(cls('Person'), [op('hasSSN'), dp('ssn')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.HAS_KEY);
  assert.strictEqual(ax.propertyExpressions.length, 2);
});

test('OWLSameIndividualAxiom', () => {
  const ax = new AX.OWLSameIndividualAxiom([ni('alice'), ni('alicia')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.SAME_INDIVIDUAL);
  assert.strictEqual(ax.individuals.length, 2);
});

test('OWLDifferentIndividualsAxiom', () => {
  const ax = new AX.OWLDifferentIndividualsAxiom([ni('alice'), ni('bob')]);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.DIFFERENT_INDIVIDUALS);
});

test('OWLNegativeObjectPropertyAssertionAxiom', () => {
  const ax = new AX.OWLNegativeObjectPropertyAssertionAxiom(ni('alice'), op('knows'), ni('bob'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.NEGATIVE_OBJECT_PROPERTY_ASSERTION);
});

test('OWLNegativeDataPropertyAssertionAxiom', () => {
  const lit = new OWLLiteral('30', dt('integer'));
  const ax = new AX.OWLNegativeDataPropertyAssertionAxiom(ni('alice'), dp('age'), lit);
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.NEGATIVE_DATA_PROPERTY_ASSERTION);
});

test('OWLSubAnnotationPropertyOfAxiom', () => {
  const ax = new AX.OWLSubAnnotationPropertyOfAxiom(ap('label'), ap('title'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.SUB_ANNOTATION_PROPERTY_OF);
});

test('OWLAnnotationPropertyDomainAxiom', () => {
  const ax = new AX.OWLAnnotationPropertyDomainAxiom(ap('label'), ex('Thing'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.ANNOTATION_PROPERTY_DOMAIN);
});

test('OWLAnnotationPropertyRangeAxiom', () => {
  const ax = new AX.OWLAnnotationPropertyRangeAxiom(ap('label'), ex('String'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.ANNOTATION_PROPERTY_RANGE);
});

test('OWLFunctionalObjectPropertyAxiom', () => {
  const ax = new AX.OWLFunctionalObjectPropertyAxiom(op('hasMother'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.FUNCTIONAL_OBJECT_PROPERTY);
});

test('OWLInverseFunctionalObjectPropertyAxiom', () => {
  const ax = new AX.OWLInverseFunctionalObjectPropertyAxiom(op('isMotherOf'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.INVERSE_FUNCTIONAL_OBJECT_PROPERTY);
});

test('OWLReflexiveObjectPropertyAxiom', () => {
  const ax = new AX.OWLReflexiveObjectPropertyAxiom(op('knows'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.REFLEXIVE_OBJECT_PROPERTY);
});

test('OWLIrreflexiveObjectPropertyAxiom', () => {
  const ax = new AX.OWLIrreflexiveObjectPropertyAxiom(op('isParentOf'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.IRREFLEXIVE_OBJECT_PROPERTY);
});

test('OWLSymmetricObjectPropertyAxiom', () => {
  const ax = new AX.OWLSymmetricObjectPropertyAxiom(op('isSiblingOf'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.SYMMETRIC_OBJECT_PROPERTY);
});

test('OWLAsymmetricObjectPropertyAxiom', () => {
  const ax = new AX.OWLAsymmetricObjectPropertyAxiom(op('isParentOf'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.ASYMMETRIC_OBJECT_PROPERTY);
});

test('OWLTransitiveObjectPropertyAxiom', () => {
  const ax = new AX.OWLTransitiveObjectPropertyAxiom(op('hasAncestor'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.TRANSITIVE_OBJECT_PROPERTY);
});

test('OWLFunctionalDataPropertyAxiom', () => {
  const ax = new AX.OWLFunctionalDataPropertyAxiom(dp('age'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.FUNCTIONAL_DATA_PROPERTY);
});

test('OWLInverseObjectPropertiesAxiom', () => {
  const ax = new AX.OWLInverseObjectPropertiesAxiom(op('hasParent'), op('hasChild'));
  assert.strictEqual(ax.getAxiomType(), AX.AxiomType.INVERSE_OBJECT_PROPERTIES);
});

test('AxiomType has 38 entries', () => {
  const keys = Object.keys(AX.AxiomType);
  assert.strictEqual(keys.length, 38);
});
