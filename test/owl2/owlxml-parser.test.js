'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { OWLXMLParser } = require('../../src/io/OWLXMLParser');

const EX = 'http://ex.org/';

function parse(body) {
  const xml = `<?xml version="1.0"?>
<Ontology ontologyIRI="${EX}test" xmlns="http://www.w3.org/2002/07/owl#">
  <Prefix name="ex" IRI="${EX}"/>
  ${body}
</Ontology>`;
  return new OWLXMLParser().parse(xml);
}

test('Declaration of Class', () => {
  const ont = parse('<Declaration><Class IRI="ex:Person"/></Declaration>');
  assert.equal(ont.getAxiomsOfType('Declaration').length, 1);
  assert.equal(ont.getAxiomsOfType('Declaration')[0].entity.getIRI().toString(), EX + 'Person');
});

test('SubClassOf two classes', () => {
  const ont = parse(`
<SubClassOf>
  <Class IRI="ex:Child"/>
  <Class IRI="ex:Person"/>
</SubClassOf>`);
  const subs = ont.getAxiomsOfType('SubClassOf');
  assert.equal(subs.length, 1);
  assert.equal(subs[0].subClass.getIRI().toString(), EX + 'Child');
  assert.equal(subs[0].superClass.getIRI().toString(), EX + 'Person');
});

test('ObjectSomeValuesFrom', () => {
  const ont = parse(`
<SubClassOf>
  <Class IRI="ex:Parent"/>
  <ObjectSomeValuesFrom>
    <ObjectProperty IRI="ex:hasChild"/>
    <Class IRI="ex:Person"/>
  </ObjectSomeValuesFrom>
</SubClassOf>`);
  const sup = ont.getAxiomsOfType('SubClassOf')[0].superClass;
  assert.equal(sup.type, 'ObjectSomeValuesFrom');
});

test('ObjectIntersectionOf', () => {
  const ont = parse(`
<EquivalentClasses>
  <Class IRI="ex:A"/>
  <ObjectIntersectionOf>
    <Class IRI="ex:B"/>
    <Class IRI="ex:C"/>
  </ObjectIntersectionOf>
</EquivalentClasses>`);
  const eq = ont.getAxiomsOfType('EquivalentClasses')[0];
  assert.equal(eq.classExpressions[1].type, 'ObjectIntersectionOf');
  assert.equal(eq.classExpressions[1].operands.length, 2);
});

test('ClassAssertion + ObjectPropertyAssertion', () => {
  const ont = parse(`
<ClassAssertion>
  <Class IRI="ex:Person"/>
  <NamedIndividual IRI="ex:alice"/>
</ClassAssertion>
<ObjectPropertyAssertion>
  <ObjectProperty IRI="ex:hasParent"/>
  <NamedIndividual IRI="ex:alice"/>
  <NamedIndividual IRI="ex:bob"/>
</ObjectPropertyAssertion>`);
  assert.equal(ont.getAxiomsOfType('ClassAssertion').length, 1);
  assert.equal(ont.getAxiomsOfType('ObjectPropertyAssertion').length, 1);
});

test('FunctionalObjectProperty', () => {
  const ont = parse('<FunctionalObjectProperty><ObjectProperty IRI="ex:hasSSN"/></FunctionalObjectProperty>');
  assert.equal(ont.getAxiomsOfType('FunctionalObjectProperty').length, 1);
});

test('DataPropertyAssertion with typed literal', () => {
  const ont = parse(`
<DataPropertyAssertion>
  <DataProperty IRI="ex:age"/>
  <NamedIndividual IRI="ex:alice"/>
  <Literal datatypeIRI="xsd:integer">30</Literal>
</DataPropertyAssertion>`);
  const a = ont.getAxiomsOfType('DataPropertyAssertion')[0];
  assert.equal(a.literal.lexicalValue, '30');
});

test('Ontology IRI captured', () => {
  const ont = parse('<Declaration><Class IRI="ex:X"/></Declaration>');
  assert.equal(ont.getOntologyID().ontologyIRI.toString(), EX + 'test');
});

test('ObjectMinCardinality', () => {
  const ont = parse(`
<SubClassOf>
  <Class IRI="ex:Parent"/>
  <ObjectMinCardinality cardinality="2">
    <ObjectProperty IRI="ex:hasChild"/>
    <Class IRI="ex:Person"/>
  </ObjectMinCardinality>
</SubClassOf>`);
  const sup = ont.getAxiomsOfType('SubClassOf')[0].superClass;
  assert.equal(sup.type, 'ObjectMinQualifiedCardinality');
  assert.equal(sup.cardinality, 2);
});
