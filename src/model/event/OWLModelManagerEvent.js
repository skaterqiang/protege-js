'use strict';

// ---------------------------------------------------------------------------
// event — mirrors org.protege.editor.owl.model.event
// ---------------------------------------------------------------------------

const EventType = Object.freeze({
  ACTIVE_ONTOLOGY_CHANGED: 'ACTIVE_ONTOLOGY_CHANGED',
  ONTOLOGY_LOADED: 'ONTOLOGY_LOADED',
  ONTOLOGY_RELOADED: 'ONTOLOGY_RELOADED',
  ONTOLOGY_SAVED: 'ONTOLOGY_SAVED',
  ONTOLOGY_CREATED: 'ONTOLOGY_CREATED',
  ONTOLOGY_VISIBILITY_CHANGED: 'ONTOLOGY_VISIBILITY_CHANGED',
  REASONER_CHANGED: 'REASONER_CHANGED',
  ABOUT_TO_CLASSIFY: 'ABOUT_TO_CLASSIFY',
  ONTOLOGY_CLASSIFIED: 'ONTOLOGY_CLASSIFIED',
  ENTITY_RENDERER_CHANGED: 'ENTITY_RENDERER_CHANGED',
  ENTITY_RENDERING_CHANGED: 'ENTITY_RENDERING_CHANGED',
  WORKSPACE_LOADED: 'WORKSPACE_LOADED',
  ENTITY_SELECTION_CHANGED: 'ENTITY_SELECTION_CHANGED'
});

class OWLModelManagerChangeEvent {
  constructor(type, payload = null) {
    this.type = type;
    this.payload = payload;
  }
  getType() { return this.type; }
  getPayload() { return this.payload; }
  isType(t) { return this.type === t; }
}

module.exports = { EventType, OWLModelManagerChangeEvent };
