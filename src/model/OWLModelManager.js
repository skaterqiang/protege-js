'use strict';

const { OWLOntology, OWLOntologyID } = require('./OWLOntology');
const { EventType, OWLModelManagerChangeEvent } = require('./event/OWLModelManagerEvent');

// ---------------------------------------------------------------------------
// OWLModelManager — mirrors org.protege.editor.owl.model.OWLModelManager /
// OWLModelManagerImpl. Holds a set of ontologies, the active ontology,
// fires change events, and exposes hierarchy providers.
// ---------------------------------------------------------------------------

class OWLModelManager {
  constructor() {
    this._ontologies = new Map(); // key: ontology id string
    this._activeOntology = null;
    this._listeners = new Set();
    this._hierarchyProviders = new Map(); // EntityType -> provider
  }

  // --- ontology registry -----------------------------------------------------

  addOntology(ontology) {
    const key = ontology.getOntologyID().toString();
    this._ontologies.set(key, ontology);
    this._fire(EventType.ONTOLOGY_CREATED, ontology);
    if (!this._activeOntology) {
      this.setActiveOntology(ontology);
    }
    return ontology;
  }

  createOntology(ontologyIRI = null) {
    const ont = new OWLOntology(new OWLOntologyID(ontologyIRI));
    return this.addOntology(ont);
  }

  removeOntology(ontology) {
    const key = ontology.getOntologyID().toString();
    const removed = this._ontologies.delete(key);
    if (removed && this._activeOntology === ontology) {
      this._activeOntology = this.getOntologies()[0] || null;
      this._fire(EventType.ACTIVE_ONTOLOGY_CHANGED, this._activeOntology);
    }
    return removed;
  }

  getOntologies() { return [...this._ontologies.values()]; }

  setActiveOntology(ontology) {
    if (this._activeOntology !== ontology) {
      this._activeOntology = ontology;
      this._fire(EventType.ACTIVE_ONTOLOGY_CHANGED, ontology);
    }
  }

  getActiveOntology() { return this._activeOntology; }

  // --- change events ---------------------------------------------------------

  addListener(listener) {
    this._listeners.add(listener);
  }

  removeListener(listener) {
    this._listeners.delete(listener);
  }

  _fire(type, payload) {
    const event = new OWLModelManagerChangeEvent(type, payload);
    for (const l of this._listeners) {
      try { l(event); } catch (e) { console.error('OWLModelManager listener error:', e); }
    }
  }

  fireEvent(type, payload) {
    this._fire(type, payload);
  }

  // --- hierarchy providers ---------------------------------------------------

  setOWLClassHierarchyProvider(provider) {
    this._hierarchyProviders.set('CLASS', provider);
  }

  getOWLClassHierarchyProvider() {
    return this._hierarchyProviders.get('CLASS') || null;
  }

  setOWLObjectPropertyHierarchyProvider(provider) {
    this._hierarchyProviders.set('OBJECT_PROPERTY', provider);
  }

  getOWLObjectPropertyHierarchyProvider() {
    return this._hierarchyProviders.get('OBJECT_PROPERTY') || null;
  }

  setOWLDataPropertyHierarchyProvider(provider) {
    this._hierarchyProviders.set('DATA_PROPERTY', provider);
  }

  getOWLDataPropertyHierarchyProvider() {
    return this._hierarchyProviders.get('DATA_PROPERTY') || null;
  }
}

module.exports = { OWLModelManager };
