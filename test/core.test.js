'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { IRI } = require('../src/model/IRI');
const { OWLClass, OWLObjectProperty, OWLNamedIndividual, OWL } = require('../src/model/OWLEntity');
const { OWLSubClassOfAxiom, OWLDeclarationAxiom } = require('../src/model/OWLAxiom');
const { OWLOntology, OWLOntologyID } = require('../src/model/OWLOntology');
const { OWLModelManager } = require('../src/model/OWLModelManager');
const { AssertedClassHierarchyProvider } = require('../src/model/hierarchy/HierarchyProvider');
const { OntologyLoader } = require('../src/io/OntologyLoader');

test('IRI fragment and namespace', () => {
  const iri = IRI.create('http://example.org/ont#Person');
  assert.strictEqual(iri.getFragment(), 'Person');
  assert.strictEqual(iri.getNamespace(), 'http://example.org/ont#');
  assert.strictEqual(iri.getShortForm(), 'Person');
});

test('OWLEntity equality by IRI and type', () => {
  const a = new OWLClass('http://example.org#A');
  const b = new OWLClass('http://example.org#A');
  const c = new OWLObjectProperty('http://example.org#A');
  assert.ok(a.equals(b));
  assert.ok(!a.equals(c));
});

test('OWLOntology stores axioms and indexes signature', () => {
  const ont = new OWLOntology(new OWLOntologyID('http://example.org/ont'));
  const person = new OWLClass('http://example.org/ont#Person');
  const agent = new OWLClass('http://example.org/ont#Agent');
  ont.addAxiom(new OWLDeclarationAxiom(person));
  ont.addAxiom(new OWLDeclarationAxiom(agent));
  ont.addAxiom(new OWLSubClassOfAxiom(person, agent));
  assert.strictEqual(ont.getAxiomCount(), 3);
  assert.strictEqual(ont.getClassesInSignature().length, 2);
  assert.strictEqual(ont.getSubClassAxiomsForSubClass(person).length, 1);
});

test('OWLModelManager fires active ontology change events', () => {
  const mm = new OWLModelManager();
  const events = [];
  mm.addListener(e => events.push(e.getType()));
  const ont = mm.createOntology('http://example.org/ont');
  assert.strictEqual(mm.getActiveOntology(), ont);
  assert.ok(events.includes('ACTIVE_ONTOLOGY_CHANGED'));
});

test('AssertedClassHierarchyProvider builds tree rooted at owl:Thing', () => {
  const ont = new OWLOntology(new OWLOntologyID('http://example.org/ont'));
  const thing = OWL.THING;
  const agent = new OWLClass('http://example.org/ont#Agent');
  const person = new OWLClass('http://example.org/ont#Person');
  ont.addAxiom(new OWLDeclarationAxiom(agent));
  ont.addAxiom(new OWLDeclarationAxiom(person));
  ont.addAxiom(new OWLSubClassOfAxiom(person, agent));

  const hp = new AssertedClassHierarchyProvider(ont);
  hp.rebuild();
  const roots = hp.getRoots();
  assert.strictEqual(roots.length, 1);
  assert.ok(roots[0].equals(thing));
  const thingChildren = hp.getChildren(thing);
  assert.strictEqual(thingChildren.length, 1);
  assert.ok(thingChildren[0].equals(agent));
  const agentChildren = hp.getChildren(agent);
  assert.ok(agentChildren.some(c => c.equals(person)));

  const tree = hp.toTree();
  assert.strictEqual(tree[0].name, 'Thing');
  assert.strictEqual(tree[0].children[0].name, 'Agent');
  assert.strictEqual(tree[0].children[0].children[0].name, 'Person');
});

test('OntologyLoader parses RDF/XML into ontology with classes and subclasses', () => {
  const xml = `<?xml version="1.0"?>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
           xmlns:owl="http://www.w3.org/2002/07/owl#"
           xml:base="http://example.org/ont">
    <owl:Ontology rdf:about="http://example.org/ont"/>
    <owl:Class rdf:about="http://example.org/ont#Agent">
      <rdfs:label>Agent</rdfs:label>
    </owl:Class>
    <owl:Class rdf:about="http://example.org/ont#Person">
      <rdfs:subClassOf rdf:resource="http://example.org/ont#Agent"/>
      <rdfs:label>Person</rdfs:label>
    </owl:Class>
    <owl:ObjectProperty rdf:about="http://example.org/ont#knows">
      <rdfs:domain rdf:resource="http://example.org/ont#Person"/>
      <rdfs:range rdf:resource="http://example.org/ont#Person"/>
    </owl:ObjectProperty>
    <owl:NamedIndividual rdf:about="http://example.org/ont#alice">
      <rdf:type rdf:resource="http://example.org/ont#Person"/>
    </owl:NamedIndividual>
  </rdf:RDF>`;
  const loader = new OntologyLoader();
  const ont = loader.loadFromString(xml);
  assert.strictEqual(ont.getOntologyID().ontologyIRI, 'http://example.org/ont');
  const classes = ont.getClassesInSignature().map(c => c.getShortForm()).sort();
  assert.deepStrictEqual(classes, ['Agent', 'Person']);
  assert.strictEqual(ont.getObjectPropertiesInSignature().length, 1);
  const inds = ont.getIndividualsInSignature().map(i => i.getShortForm());
  assert.deepStrictEqual(inds, ['alice']);

  const hp = new AssertedClassHierarchyProvider(ont);
  hp.rebuild();
  const tree = hp.toTree();
  assert.strictEqual(tree[0].children[0].name, 'Agent');
  assert.strictEqual(tree[0].children[0].children[0].name, 'Person');
});
