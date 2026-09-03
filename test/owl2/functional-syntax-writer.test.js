'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { writeFunctionalSyntax } = require('../../src/io/FunctionalSyntaxWriter');
const { FunctionalSyntaxParser } = require('../../src/io/FunctionalSyntaxParser');
const { OWLOntology, OWLOntologyID } = require('../../src/model/OWLOntology');
const { OWLClass, OWLObjectProperty, OWLNamedIndividual } = require('../../src/model/OWLEntity');
const {
  OWLDeclarationAxiom, OWLSubClassOfAxiom, OWLClassAssertionAxiom,
  OWLObjectPropertyAssertionAxiom
} = require('../../src/model/OWLAxiom');
const { OWLObjectSomeValuesFrom } = require('../../src/model/OWLClassExpression');
const { IRI } = require('../../src/model/IRI');

const EX = 'http://ex.org/';

test('write declarations + subClassOf, round-trip parse', () => {
  const ont = new OWLOntology(new OWLOntologyID(IRI.create(EX)));
  ont.addAxiom(new OWLDeclarationAxiom(new OWLClass(EX + 'A')));
  ont.addAxiom(new OWLDeclarationAxiom(new OWLClass(EX + 'B')));
  ont.addAxiom(new OWLSubClassOfAxiom(new OWLClass(EX + 'A'), new OWLClass(EX + 'B')));

  const text = writeFunctionalSyntax(ont);
  assert.match(text, /Ontology\(/);
  assert.match(text, /Declaration\(Class\(<http:\/\/ex\.org\/A>\)\)/);
  assert.match(text, /SubClassOf\(<http:\/\/ex\.org\/A> <http:\/\/ex\.org\/B>\)/);

  // Round-trip
  const parsed = new FunctionalSyntaxParser().parse(text, EX);
  assert.equal(parsed.getAxiomsOfType('SubClassOf').length, 1);
  assert.equal(parsed.getAxiomsOfType('Declaration').length, 2);
});

test('write nested class expression (someValuesFrom)', () => {
  const ont = new OWLOntology(new OWLOntologyID(IRI.create(EX)));
  const p = new OWLObjectProperty(EX + 'p');
  const filler = new OWLClass(EX + 'B');
  const ce = new OWLObjectSomeValuesFrom(p, filler);
  ont.addAxiom(new OWLSubClassOfAxiom(new OWLClass(EX + 'A'), ce));

  const text = writeFunctionalSyntax(ont);
  assert.match(text, /ObjectSomeValuesFrom\(<http:\/\/ex\.org\/p> <http:\/\/ex\.org\/B>\)/);
});

test('write class assertion + property assertion', () => {
  const ont = new OWLOntology(new OWLOntologyID(IRI.create(EX)));
  const i = new OWLNamedIndividual(EX + 'i');
  const j = new OWLNamedIndividual(EX + 'j');
  const p = new OWLObjectProperty(EX + 'p');
  ont.addAxiom(new OWLClassAssertionAxiom(i, new OWLClass(EX + 'C')));
  ont.addAxiom(new OWLObjectPropertyAssertionAxiom(i, p, j));

  const text = writeFunctionalSyntax(ont);
  assert.match(text, /ClassAssertion\(<http:\/\/ex\.org\/C> <http:\/\/ex\.org\/i>\)/);
  assert.match(text, /ObjectPropertyAssertion\(<http:\/\/ex\.org\/p> <http:\/\/ex\.org\/i> <http:\/\/ex\.org\/j>\)/);
});

test('write ontology header with imports', () => {
  const ont = new OWLOntology(new OWLOntologyID(IRI.create(EX)));
  ont.imports.push('http://other.org/ont');
  const text = writeFunctionalSyntax(ont);
  assert.match(text, /Import\(<http:\/\/other\.org\/ont>\)/);
});
