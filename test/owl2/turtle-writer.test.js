'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { writeTurtle } = require('../../src/io/TurtleWriter');
const { TurtleParser } = require('../../src/io/TurtleParser');
const { triplesToOntology } = require('../../src/io/RDFGraphToOntology');
const { OWLOntology, OWLOntologyID } = require('../../src/model/OWLOntology');
const { OWLClass, OWLObjectProperty, OWLNamedIndividual } = require('../../src/model/OWLEntity');
const AX = require('../../src/model/OWLAxiom');
const CE = require('../../src/model/OWLClassExpression');
const { IRI } = require('../../src/model/IRI');

const EX = 'http://ex.org/';
const c = (n) => new OWLClass(EX + n);
const p = (n) => new OWLObjectProperty(EX + n);
const ind = (n) => new OWLNamedIndividual(EX + n);

function ontWith(...axioms) {
  const ont = new OWLOntology(new OWLOntologyID(IRI.create(EX + 'ont')));
  for (const a of axioms) ont.addAxiom(a);
  return ont;
}

function roundTrip(ont) {
  const turtle = writeTurtle(ont);
  const store = new TurtleParser().parse(turtle);
  return { turtle, back: triplesToOntology(store, { ontologyIRI: EX + 'ont' }) };
}

test('SubClassOf round-trip', () => {
  const ont = ontWith(
    new AX.OWLDeclarationAxiom(c('A')),
    new AX.OWLDeclarationAxiom(c('B')),
    new AX.OWLSubClassOfAxiom(c('A'), c('B'))
  );
  const { back } = roundTrip(ont);
  const subs = back.getAxiomsOfType('SubClassOf');
  assert.ok(subs.length >= 1);
  assert.equal(subs[0].subClass.getIRI().toString(), EX + 'A');
});

test('SomeValuesFrom restriction round-trip', () => {
  const ont = ontWith(
    new AX.OWLDeclarationAxiom(c('Parent')),
    new AX.OWLDeclarationAxiom(c('Person')),
    new AX.OWLDeclarationAxiom(p('hasChild')),
    new AX.OWLSubClassOfAxiom(c('Parent'), new CE.OWLObjectSomeValuesFrom(p('hasChild'), c('Person')))
  );
  const { back } = roundTrip(ont);
  const subs = back.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  assert.equal(subs[0].superClass.type, 'ObjectSomeValuesFrom');
});

test('ObjectProperty characteristics round-trip', () => {
  const ont = ontWith(
    new AX.OWLDeclarationAxiom(p('hasAncestor')),
    new AX.OWLTransitiveObjectPropertyAxiom(p('hasAncestor'))
  );
  const { back } = roundTrip(ont);
  assert.ok(back.getAxiomsOfType('TransitiveObjectProperty').length >= 1);
});

test('ClassAssertion round-trip', () => {
  const ont = ontWith(
    new AX.OWLDeclarationAxiom(c('Person')),
    new AX.OWLDeclarationAxiom(ind('alice')),
    new AX.OWLClassAssertionAxiom(ind('alice'), c('Person'))
  );
  const { back } = roundTrip(ont);
  const cas = back.getAxiomsOfType('ClassAssertion');
  assert.ok(cas.length >= 1);
  assert.equal(cas[0].individual.getIRI().toString(), EX + 'alice');
});

test('Turtle output contains prefixes and header', () => {
  const ont = ontWith(new AX.OWLDeclarationAxiom(c('Widget')));
  const turtle = writeTurtle(ont);
  assert.ok(turtle.includes('@prefix owl:'));
  assert.ok(turtle.includes('owl:Ontology'));
  assert.ok(turtle.includes('owl:Class'));
});
