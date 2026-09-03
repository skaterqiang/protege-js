'use strict';

const { IRI } = require('./IRI');

// ---------------------------------------------------------------------------
// OWLEntity — mirrors org.semanticweb.owlapi.model.OWLEntity hierarchy
// OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual,
// OWLDatatype, OWLAnnotationProperty
// ---------------------------------------------------------------------------

const EntityType = Object.freeze({
  CLASS: 'Class',
  OBJECT_PROPERTY: 'ObjectProperty',
  DATA_PROPERTY: 'DataProperty',
  NAMED_INDIVIDUAL: 'NamedIndividual',
  DATATYPE: 'Datatype',
  ANNOTATION_PROPERTY: 'AnnotationProperty'
});

class OWLEntity {
  constructor(iri, entityType) {
    this.iri = iri instanceof IRI ? iri : IRI.create(iri);
    this.entityType = entityType;
  }

  getIRI() {
    return this.iri;
  }

  getEntityType() {
    return this.entityType;
  }

  getShortForm() {
    return this.iri.getShortForm();
  }

  isOWLClass() { return this.entityType === EntityType.CLASS; }
  isOWLObjectProperty() { return this.entityType === EntityType.OBJECT_PROPERTY; }
  isOWLDataProperty() { return this.entityType === EntityType.DATA_PROPERTY; }
  isOWLNamedIndividual() { return this.entityType === EntityType.NAMED_INDIVIDUAL; }
  isOWLDatatype() { return this.entityType === EntityType.DATATYPE; }
  isOWLAnnotationProperty() { return this.entityType === EntityType.ANNOTATION_PROPERTY; }

  equals(other) {
    return other instanceof OWLEntity
      && other.entityType === this.entityType
      && other.iri.equals(this.iri);
  }

  toString() {
    return `${this.entityType}(<${this.iri}>)`;
  }
}

class OWLClass extends OWLEntity {
  constructor(iri) { super(iri, EntityType.CLASS); }
}

class OWLObjectProperty extends OWLEntity {
  constructor(iri) { super(iri, EntityType.OBJECT_PROPERTY); }
}

class OWLDataProperty extends OWLEntity {
  constructor(iri) { super(iri, EntityType.DATA_PROPERTY); }
}

class OWLNamedIndividual extends OWLEntity {
  constructor(iri) { super(iri, EntityType.NAMED_INDIVIDUAL); }
}

class OWLDatatype extends OWLEntity {
  constructor(iri) { super(iri, EntityType.DATATYPE); }
}

class OWLAnnotationProperty extends OWLEntity {
  constructor(iri) { super(iri, EntityType.ANNOTATION_PROPERTY); }
}

// ---------------------------------------------------------------------------
// OWLAnonymousIndividual — mirrors org.semanticweb.owlapi.model.OWLAnonymousIndividual
// An individual identified only by a blank node id (Turtle _:b0), not by an IRI.
// ---------------------------------------------------------------------------

class OWLAnonymousIndividual {
  constructor(nodeId) {
    if (!nodeId) throw new Error('OWLAnonymousIndividual requires a nodeId');
    this.nodeId = String(nodeId);
  }

  getNodeId() { return this.nodeId; }

  isAnonymous() { return true; }
  isNamed() { return false; }
  isOWLNamedIndividual() { return false; }
  isOWLAnonymousIndividual() { return true; }

  getEntityType() { return EntityType.NAMED_INDIVIDUAL; } // treated as individual in indexes

  equals(other) {
    return other instanceof OWLAnonymousIndividual && other.nodeId === this.nodeId;
  }

  getShortForm() { return this.nodeId; }

  toString() { return `_:${this.nodeId.replace(/^_:/, '')}`; }
}

/** Well-known entities. */
const OWL = Object.freeze({
  THING: new OWLClass('http://www.w3.org/2002/07/owl#Thing'),
  NOTHING: new OWLClass('http://www.w3.org/2002/07/owl#Nothing'),
  TOP_OBJECT_PROPERTY: new OWLObjectProperty('http://www.w3.org/2002/07/owl#topObjectProperty'),
  BOTTOM_OBJECT_PROPERTY: new OWLObjectProperty('http://www.w3.org/2002/07/owl#bottomObjectProperty'),
  TOP_DATA_PROPERTY: new OWLDataProperty('http://www.w3.org/2002/07/owl#topDataProperty'),
  BOTTOM_DATA_PROPERTY: new OWLDataProperty('http://www.w3.org/2002/07/owl#bottomDataProperty')
});

/** Entity factory — mirrors OWLDataFactory entity getters. */
class OWLEntityFactory {
  getOWLClass(iri) { return new OWLClass(iri); }
  getOWLObjectProperty(iri) { return new OWLObjectProperty(iri); }
  getOWLDataProperty(iri) { return new OWLDataProperty(iri); }
  getOWLNamedIndividual(iri) { return new OWLNamedIndividual(iri); }
  getOWLDatatype(iri) { return new OWLDatatype(iri); }
  getOWLAnnotationProperty(iri) { return new OWLAnnotationProperty(iri); }
  getOWLAnonymousIndividual(nodeId) { return new OWLAnonymousIndividual(nodeId); }
}

module.exports = {
  EntityType,
  OWLEntity,
  OWLClass,
  OWLObjectProperty,
  OWLDataProperty,
  OWLNamedIndividual,
  OWLAnonymousIndividual,
  OWLDatatype,
  OWLAnnotationProperty,
  OWL,
  OWLEntityFactory
};
