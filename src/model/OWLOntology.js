'use strict';

const { AxiomType } = require('./OWLAxiom');
const { EntityType } = require('./OWLEntity');

// ---------------------------------------------------------------------------
// OWLOntology — mirrors org.semanticweb.owlapi.model.OWLOntology
// An in-memory set of axioms plus an ontology IRI / version IRI.
// ---------------------------------------------------------------------------

class OWLOntologyID {
  constructor(ontologyIRI = null, versionIRI = null) {
    this.ontologyIRI = ontologyIRI;
    this.versionIRI = versionIRI;
  }
  isAnonymous() { return !this.ontologyIRI; }
  toString() {
    if (this.isAnonymous()) return 'OntologyID(Anonymous)';
    return `OntologyID(<${this.ontologyIRI}>${this.versionIRI ? ' version <' + this.versionIRI + '>' : ''})`;
  }
}

class OWLOntology {
  constructor(id = new OWLOntologyID()) {
    this.id = id;
    this._axioms = new Set();
    this._ontologyAnnotations = []; // OWLAnnotationAssertion on the ontology itself
    this.format = null; // e.g. 'RDF/XML', 'Turtle'
    // Ontology header (W3C OWL 2 §3.1): imports closure + version compatibility
    this.imports = [];
    this.priorVersion = [];
    this.backwardCompatibleWith = [];
    this.incompatibleWith = [];
    // Prefix fidelity: prefix -> namespace map captured at parse time so
    // writers can re-emit the original abbreviations.
    this.prefixes = {};
  }

  /** Record a prefix mapping (e.g. 'ex' -> 'http://ex.org/'). */
  addPrefix(prefix, namespace) { this.prefixes[prefix] = namespace; }

  /** Get the recorded prefix map. */
  getPrefixes() { return Object.assign({}, this.prefixes); }

  getOntologyID() { return this.id; }

  isAnonymous() { return this.id.isAnonymous(); }

  getAxiomCount() { return this._axioms.size; }

  getAxioms() { return [...this._axioms]; }

  addAxiom(axiom) {
    this._axioms.add(axiom);
    return true;
  }

  removeAxiom(axiom) {
    return this._axioms.delete(axiom);
  }

  getAxiomsOfType(type) {
    return this.getAxioms().filter(a => a.getAxiomType() === type);
  }

  // --- entity indexes --------------------------------------------------------

  getClassesInSignature() { return this._entitiesOf(EntityType.CLASS); }
  getObjectPropertiesInSignature() { return this._entitiesOf(EntityType.OBJECT_PROPERTY); }
  getDataPropertiesInSignature() { return this._entitiesOf(EntityType.DATA_PROPERTY); }
  getIndividualsInSignature() { return this._entitiesOf(EntityType.NAMED_INDIVIDUAL); }
  getAnnotationPropertiesInSignature() { return this._entitiesOf(EntityType.ANNOTATION_PROPERTY); }

  _entitiesOf(entityType) {
    const byIri = new Map();
    for (const ax of this._axioms) {
      for (const e of ax.entities()) {
        if (e.getEntityType && e.getEntityType() === entityType) {
          byIri.set(e.getIRI().toString(), e);
        }
      }
    }
    return [...byIri.values()];
  }

  // --- subclass indexes (asserted) ------------------------------------------

  getSubClassAxiomsForSubClass(cls) {
    return this.getAxiomsOfType(AxiomType.SUBCLASS_OF)
      .filter(a => a.subClass && a.subClass.equals && a.subClass.equals(cls));
  }

  getSubClassAxiomsForSuperClass(cls) {
    return this.getAxiomsOfType(AxiomType.SUBCLASS_OF)
      .filter(a => a.superClass && a.superClass.equals && a.superClass.equals(cls));
  }

  // --- annotations -----------------------------------------------------------

  addOntologyAnnotation(annotationAssertion) {
    this._ontologyAnnotations.push(annotationAssertion);
  }

  getOntologyAnnotations() { return this._ontologyAnnotations.slice(); }

  getAnnotationsForSubject(iriString) {
    return this.getAxiomsOfType(AxiomType.ANNOTATION_ASSERTION)
      .filter(a => a.subject && a.subject.toString() === iriString);
  }

  /** rdfs:label (or other annotation property) literal values for an entity. */
  getAnnotationValues(entity, propertyIRI) {
    return this.getAnnotationsForSubject(entity.getIRI().toString())
      .filter(a => a.property.getIRI().toString() === propertyIRI)
      .map(a => a.value);
  }
}

module.exports = { OWLOntology, OWLOntologyID };
