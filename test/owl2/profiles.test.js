'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkProfile, isInProfile } = require('../../src/profiles/OWL2Profiles');
const { OWLOntology, OWLOntologyID } = require('../../src/model/OWLOntology');
const { OWLClass, OWLObjectProperty } = require('../../src/model/OWLEntity');
const {
  OWLSubClassOfAxiom, OWLTransitiveObjectPropertyAxiom,
  OWLFunctionalObjectPropertyAxiom
} = require('../../src/model/OWLAxiom');
const {
  OWLObjectUnionOf, OWLObjectComplementOf, OWLObjectSomeValuesFrom
} = require('../../src/model/OWLClassExpression');
const { IRI } = require('../../src/model/IRI');

const EX = 'http://ex.org/';
const ont0 = () => new OWLOntology(new OWLOntologyID(IRI.create(EX)));

test('simple subclass is in all three profiles', () => {
  const ont = ont0();
  ont.addAxiom(new OWLSubClassOfAxiom(new OWLClass(EX + 'A'), new OWLClass(EX + 'B')));
  assert.equal(isInProfile(ont, 'RL'), true);
  assert.equal(isInProfile(ont, 'QL'), true);
  assert.equal(isInProfile(ont, 'EL'), true);
});

test('union in subclass LHS violates RL', () => {
  const ont = ont0();
  ont.addAxiom(new OWLSubClassOfAxiom(
    new OWLObjectUnionOf([new OWLClass(EX + 'A'), new OWLClass(EX + 'B')]),
    new OWLClass(EX + 'C')));
  const v = checkProfile(ont, 'RL');
  assert.ok(v.length >= 1);
  assert.equal(v[0].profile, 'RL');
});

test('complement violates EL', () => {
  const ont = ont0();
  ont.addAxiom(new OWLSubClassOfAxiom(
    new OWLObjectComplementOf(new OWLClass(EX + 'A')),
    new OWLClass(EX + 'B')));
  assert.equal(isInProfile(ont, 'EL'), false);
});

test('transitive property violates QL', () => {
  const ont = ont0();
  ont.addAxiom(new OWLTransitiveObjectPropertyAxiom(new OWLObjectProperty(EX + 'p')));
  assert.equal(isInProfile(ont, 'QL'), false);
  assert.equal(isInProfile(ont, 'RL'), true);
});

test('functional property violates EL', () => {
  const ont = ont0();
  ont.addAxiom(new OWLFunctionalObjectPropertyAxiom(new OWLObjectProperty(EX + 'p')));
  assert.equal(isInProfile(ont, 'EL'), false);
});

test('QL allows ∃P.Thing on LHS', () => {
  const ont = ont0();
  const thing = new OWLClass('http://www.w3.org/2002/07/owl#Thing');
  const svf = new OWLObjectSomeValuesFrom(new OWLObjectProperty(EX + 'p'), thing);
  ont.addAxiom(new OWLSubClassOfAxiom(svf, new OWLClass(EX + 'B')));
  assert.equal(isInProfile(ont, 'QL'), true);
});
