'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { GlobalRestrictionsValidator } = require('../../src/validation/GlobalRestrictionsValidator');
const { OWLOntology, OWLOntologyID } = require('../../src/model/OWLOntology');
const { OWLClass, OWLObjectProperty, OWLNamedIndividual } = require('../../src/model/OWLEntity');
const {
  OWLSubPropertyChainOfAxiom, OWLFunctionalObjectPropertyAxiom,
  OWLIrreflexiveObjectPropertyAxiom, OWLClassAssertionAxiom,
  OWLSubClassOfAxiom
} = require('../../src/model/OWLAxiom');
const { OWLObjectHasSelf, OWLObjectCardinalityRestriction, ClassExpressionType } = require('../../src/model/OWLClassExpression');
const { IRI } = require('../../src/model/IRI');

const EX = 'http://ex.org/';
const ont0 = () => new OWLOntology(new OWLOntologyID(IRI.create(EX)));

test('valid ontology has no violations', () => {
  const ont = ont0();
  ont.addAxiom(new OWLSubClassOfAxiom(new OWLClass(EX + 'A'), new OWLClass(EX + 'B')));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.equal(v.length, 0);
});

test('functional property that is super of chain → violation', () => {
  const ont = ont0();
  const p = new OWLObjectProperty(EX + 'p');
  const q = new OWLObjectProperty(EX + 'q');
  const r = new OWLObjectProperty(EX + 'r');
  ont.addAxiom(new OWLSubPropertyChainOfAxiom([q, r], p));
  ont.addAxiom(new OWLFunctionalObjectPropertyAxiom(p));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.ok(v.some(x => x.rule === 'simple-property'));
});

test('irreflexive property that is super of chain → violation', () => {
  const ont = ont0();
  const p = new OWLObjectProperty(EX + 'p');
  const q = new OWLObjectProperty(EX + 'q');
  const r = new OWLObjectProperty(EX + 'r');
  ont.addAxiom(new OWLSubPropertyChainOfAxiom([q, r], p));
  ont.addAxiom(new OWLIrreflexiveObjectPropertyAxiom(p));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.ok(v.some(x => x.rule === 'simple-property'));
});

test('chain containing itself → regularity violation', () => {
  const ont = ont0();
  const p = new OWLObjectProperty(EX + 'p');
  ont.addAxiom(new OWLSubPropertyChainOfAxiom([p, p], p));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.ok(v.some(x => x.rule === 'regularity'));
});

test('instance of owl:Nothing → violation', () => {
  const ont = ont0();
  const i = new OWLNamedIndividual(EX + 'i');
  const nothing = new OWLClass('http://www.w3.org/2002/07/owl#Nothing');
  ont.addAxiom(new OWLClassAssertionAxiom(i, nothing));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.ok(v.some(x => x.rule === 'owl:Nothing-instance'));
});

test('hasSelf on non-simple property → violation', () => {
  const ont = ont0();
  const p = new OWLObjectProperty(EX + 'p');
  const q = new OWLObjectProperty(EX + 'q');
  const r = new OWLObjectProperty(EX + 'r');
  ont.addAxiom(new OWLSubPropertyChainOfAxiom([q, r], p));
  ont.addAxiom(new OWLSubClassOfAxiom(
    new OWLClass(EX + 'A'), new OWLObjectHasSelf(p)));
  const v = new GlobalRestrictionsValidator().validate(ont);
  assert.ok(v.some(x => x.rule === 'simple-property'));
});
