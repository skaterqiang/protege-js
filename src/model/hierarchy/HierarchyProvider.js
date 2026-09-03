'use strict';

const { AxiomType } = require('../OWLAxiom');
const { OWL, OWLClass, OWLObjectProperty, OWLDataProperty } = require('../OWLEntity');
const { isNamedClass } = require('../OWLClassExpression');

// ---------------------------------------------------------------------------
// hierarchy — mirrors org.protege.editor.owl.model.hierarchy
// AssertedClassHierarchyProvider: builds a tree from SubClassOf axioms.
// ---------------------------------------------------------------------------

class OWLObjectHierarchyProvider {
  constructor(ontology) {
    this._ontology = ontology;
    this._roots = new Set();
    this._parents = new Map(); // child iri -> Set<parent iri>
    this._children = new Map(); // parent iri -> Set<child iri>
    this._nodes = new Map();    // iri -> entity
    this._listeners = new Set();
  }

  setOntology(ontology) {
    this._ontology = ontology;
    this.rebuild();
  }

  addListener(l) { this._listeners.add(l); }
  removeListener(l) { this._listeners.delete(l); }
  _fireChanged() { for (const l of this._listeners) l(); }

  rebuild() {
    this._roots.clear();
    this._parents.clear();
    this._children.clear();
    this._nodes.clear();
    this._build();
    this._fireChanged();
  }

  /** @abstract */
  _build() { throw new Error('override _build'); }

  _addNode(entity) {
    this._nodes.set(entity.getIRI().toString(), entity);
  }

  _addEdge(parent, child) {
    if (parent.equals(child)) return; // ignore self-loops
    this._addNode(parent);
    this._addNode(child);
    const pKey = parent.getIRI().toString();
    const cKey = child.getIRI().toString();
    if (!this._children.has(pKey)) this._children.set(pKey, new Set());
    this._children.get(pKey).add(cKey);
    if (!this._parents.has(cKey)) this._parents.set(cKey, new Set());
    this._parents.get(cKey).add(pKey);
  }

  getRoots() {
    return [...this._roots].map(k => this._nodes.get(k)).filter(Boolean);
  }

  getChildren(entity) {
    const keys = this._children.get(entity.getIRI().toString());
    if (!keys) return [];
    return [...keys].map(k => this._nodes.get(k)).filter(Boolean);
  }

  getParents(entity) {
    const keys = this._parents.get(entity.getIRI().toString());
    if (!keys) return [];
    return [...keys].map(k => this._nodes.get(k)).filter(Boolean);
  }

  getDescendants(entity) {
    const seen = new Set();
    const stack = [entity];
    const out = [];
    while (stack.length) {
      const cur = stack.pop();
      const key = cur.getIRI().toString();
      if (seen.has(key)) continue;
      seen.add(key);
      if (cur !== entity) out.push(cur);
      stack.push(...this.getChildren(cur));
    }
    return out;
  }

  getAncestors(entity) {
    const seen = new Set();
    const stack = [entity];
    const out = [];
    while (stack.length) {
      const cur = stack.pop();
      const key = cur.getIRI().toString();
      if (seen.has(key)) continue;
      seen.add(key);
      if (cur !== entity) out.push(cur);
      stack.push(...this.getParents(cur));
    }
    return out;
  }

  contains(entity) {
    return this._nodes.has(entity.getIRI().toString());
  }

  /** Tree as plain nested objects, for JSON serialization to the UI. */
  toTree() {
    const build = (entity, visited) => {
      const key = entity.getIRI().toString();
      const node = { iri: key, name: entity.getShortForm(), children: [] };
      if (visited.has(key)) return node; // cycle guard
      visited.add(key);
      for (const child of this.getChildren(entity)) {
        node.children.push(build(child, new Set(visited)));
      }
      node.children.sort((a, b) => a.name.localeCompare(b.name));
      return node;
    };
    return this.getRoots()
      .map(r => build(r, new Set()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

// ---------------------------------------------------------------------------
// AssertedClassHierarchyProvider — roots at owl:Thing.
// ---------------------------------------------------------------------------

class AssertedClassHierarchyProvider extends OWLObjectHierarchyProvider {
  _build() {
    const thing = OWL.THING;
    this._addNode(thing);
    this._roots.add(thing.getIRI().toString());

    if (!this._ontology) return;
    const classes = this._ontology.getClassesInSignature();
    const withParent = new Set();

    for (const ax of this._ontology.getAxiomsOfType(AxiomType.SUBCLASS_OF)) {
      const sub = ax.subClass;
      const sup = ax.superClass;
      if (isNamedClass(sub) && isNamedClass(sup)) {
        this._addEdge(sup, sub);
        withParent.add(sub.getIRI().toString());
      }
    }

    // Classes with no asserted superclass hang directly under owl:Thing.
    for (const cls of classes) {
      const key = cls.getIRI().toString();
      if (!withParent.has(key) && !thing.equals(cls)) {
        this._addEdge(thing, cls);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// AbstractOWLPropertyHierarchyProvider — shared by object/data properties.
// ---------------------------------------------------------------------------

class OWLPropertyHierarchyProvider extends OWLObjectHierarchyProvider {
  constructor(ontology, rootEntity, subAxiomType) {
    super(ontology);
    this._rootEntity = rootEntity;
    this._subAxiomType = subAxiomType;
  }

  _build() {
    const root = this._rootEntity;
    this._addNode(root);
    this._roots.add(root.getIRI().toString());

    if (!this._ontology) return;
    const props = this._subAxiomType === AxiomType.SUB_OBJECT_PROPERTY_OF
      ? this._ontology.getObjectPropertiesInSignature()
      : this._ontology.getDataPropertiesInSignature();
    const withParent = new Set();

    for (const ax of this._ontology.getAxiomsOfType(this._subAxiomType)) {
      this._addEdge(ax.superProperty, ax.subProperty);
      withParent.add(ax.subProperty.getIRI().toString());
    }

    for (const p of props) {
      const key = p.getIRI().toString();
      if (!withParent.has(key) && !root.equals(p)) {
        this._addEdge(root, p);
      }
    }
  }
}

class OWLObjectPropertyHierarchyProvider extends OWLPropertyHierarchyProvider {
  constructor(ontology) {
    super(ontology, OWL.TOP_OBJECT_PROPERTY, AxiomType.SUB_OBJECT_PROPERTY_OF);
  }
}

class OWLDataPropertyHierarchyProvider extends OWLPropertyHierarchyProvider {
  constructor(ontology) {
    super(ontology, OWL.TOP_DATA_PROPERTY, AxiomType.SUB_DATA_PROPERTY_OF);
  }
}

module.exports = {
  OWLObjectHierarchyProvider,
  AssertedClassHierarchyProvider,
  OWLObjectPropertyHierarchyProvider,
  OWLDataPropertyHierarchyProvider
};
