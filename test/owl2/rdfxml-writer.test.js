'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { writeRDFXML } = require('../../src/io/RDFXMLWriter');
const { OWLOntology, OWLOntologyID } = require('../../src/model/OWLOntology');
const { OWLClass, OWLObjectProperty, OWLNamedIndividual } = require('../../src/model/OWLEntity');
const AX = require('../../src/model/OWLAxiom');
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

test('Declaration serialized', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLDeclarationAxiom(c('Person'))));
  assert.ok(xml.includes('<owl:Class rdf:about="http://ex.org/Person"/>'));
});

test('SubClassOf named classes', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLSubClassOfAxiom(c('A'), c('B'))));
  assert.ok(xml.includes('rdfs:subClassOf'));
  assert.ok(xml.includes('rdf:resource="http://ex.org/B"'));
});

test('Ontology header with IRI', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLDeclarationAxiom(c('X'))));
  assert.ok(xml.includes('owl:Ontology rdf:about="http://ex.org/ont"'));
});

test('ClassAssertion', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLClassAssertionAxiom(ind('alice'), c('Person'))));
  assert.ok(xml.includes('owl:NamedIndividual rdf:about="http://ex.org/alice"'));
  assert.ok(xml.includes('rdf:type rdf:resource="http://ex.org/Person"'));
});

test('TransitiveObjectProperty', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLTransitiveObjectPropertyAxiom(p('hasAncestor'))));
  assert.ok(xml.includes('TransitiveProperty'));
});

test('XML is well-formed-ish (balanced root)', () => {
  const xml = writeRDFXML(ontWith(new AX.OWLDeclarationAxiom(c('Y'))));
  assert.ok(xml.startsWith('<?xml version="1.0"?>'));
  assert.ok(xml.includes('<rdf:RDF'));
  assert.ok(xml.trim().endsWith('</rdf:RDF>'));
});
