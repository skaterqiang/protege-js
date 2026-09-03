'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseRDFXML } = require('../../src/io/RDFXMLParser');

const EX = 'http://ex.org/';

test('Punning: Description typed as both Class and ObjectProperty', () => {
  const xml = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">
  <rdf:Description rdf:about="${EX}Thing">
    <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Class"/>
    <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#ObjectProperty"/>
  </rdf:Description>
</rdf:RDF>`;
  const ont = parseRDFXML(xml, EX + 'ont');
  const decls = ont.getAxiomsOfType('Declaration');
  const kinds = decls.map(d => d.entity.constructor.name).sort();
  assert.ok(kinds.includes('OWLClass'), 'should declare a class');
  assert.ok(kinds.includes('OWLObjectProperty'), 'should declare an object property');
});
