'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { parseRDFXML } = require('../../src/io/RDFXMLParser');
const { AxiomType } = require('../../src/model/OWLAxiom');

const wrap = (body) => `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:ex="http://example.org/">
${body}
</rdf:RDF>`;

test('RDFXML: owl:disjointWith → DisjointClasses', () => {
  const xml = wrap(`
    <owl:Class rdf:about="http://example.org/Cat">
      <owl:disjointWith rdf:resource="http://example.org/Dog"/>
    </owl:Class>
  `);
  const o = parseRDFXML(xml);
  const disjoint = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.DISJOINT_CLASSES);
  assert.ok(disjoint.length >= 1);
});

test('RDFXML: owl:inverseOf', () => {
  const xml = wrap(`
    <owl:ObjectProperty rdf:about="http://example.org/hasParent">
      <owl:inverseOf rdf:resource="http://example.org/hasChild"/>
    </owl:ObjectProperty>
  `);
  const o = parseRDFXML(xml);
  const inv = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.INVERSE_OBJECT_PROPERTIES);
  assert.ok(inv.length >= 1);
});

test('RDFXML: owl:sameAs between individuals', () => {
  const xml = wrap(`
    <owl:NamedIndividual rdf:about="http://example.org/alice">
      <owl:sameAs rdf:resource="http://example.org/alicia"/>
    </owl:NamedIndividual>
  `);
  const o = parseRDFXML(xml);
  const sa = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.SAME_INDIVIDUAL);
  assert.ok(sa.length >= 1);
});

test('RDFXML: owl:differentFrom between individuals', () => {
  const xml = wrap(`
    <owl:NamedIndividual rdf:about="http://example.org/alice">
      <owl:differentFrom rdf:resource="http://example.org/bob"/>
    </owl:NamedIndividual>
  `);
  const o = parseRDFXML(xml);
  const d = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.DIFFERENT_INDIVIDUALS);
  assert.ok(d.length >= 1);
});

test('RDFXML: TransitiveProperty characteristic', () => {
  const xml = wrap(`
    <owl:ObjectProperty rdf:about="http://example.org/hasAncestor">
      <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#TransitiveProperty"/>
    </owl:ObjectProperty>
  `);
  const o = parseRDFXML(xml);
  const t = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.TRANSITIVE_OBJECT_PROPERTY);
  assert.ok(t.length >= 1);
});

test('RDFXML: FunctionalProperty on object property', () => {
  const xml = wrap(`
    <owl:ObjectProperty rdf:about="http://example.org/hasMother">
      <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#FunctionalProperty"/>
    </owl:ObjectProperty>
  `);
  const o = parseRDFXML(xml);
  const t = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.FUNCTIONAL_OBJECT_PROPERTY);
  assert.ok(t.length >= 1);
});

test('RDFXML: SymmetricProperty', () => {
  const xml = wrap(`
    <owl:ObjectProperty rdf:about="http://example.org/knows">
      <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#SymmetricProperty"/>
    </owl:ObjectProperty>
  `);
  const o = parseRDFXML(xml);
  const t = o.getAxioms().filter(a => a.getAxiomType() === AxiomType.SYMMETRIC_OBJECT_PROPERTY);
  assert.ok(t.length >= 1);
});
