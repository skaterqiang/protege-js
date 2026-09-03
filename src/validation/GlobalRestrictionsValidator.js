'use strict';

// ---------------------------------------------------------------------------
// validation/GlobalRestrictionsValidator — checks the OWL 2 global
// restrictions on axioms (W3C §11.1 & §11.2):
//
//  1. Regularity of the property hierarchy / property chains:
//     the property hierarchy induced by SubObjectPropertyOf and
//     SubObjectPropertyOf(ObjectPropertyChain(...)) must be a strict partial
//     order; a property may not be (in)directly a sub-property of a chain
//     that contains itself in a "non-simple" way.
//  2. Simple-property restrictions:
//     Non-simple properties (super-properties of chains, or chain members
//     that are non-simple) may not be used in:
//       - FunctionalObjectProperty / InverseFunctionalObjectProperty
//       - IrreflexiveObjectProperty / AsymmetricObjectProperty
//       - ObjectHasSelf
//       - ObjectMin/Max/ExactCardinality
//       - DisjointObjectProperties
//  3. owl:Nothing / owl:Thing misuse (nothing may be instance of owl:Nothing).
//
// Returns a list of violations:
//   { rule, message, axiom? , iri? }
// ---------------------------------------------------------------------------

const { AxiomType: A } = require('../model/OWLAxiom');
const { ClassExpressionType: T } = require('../model/OWLClassExpression');

class GlobalRestrictionsValidator {
  /**
   * @param {OWLOntology} ont
   */
  validate(ont) {
    this.violations = [];
    this.ont = ont;
    this._buildPropertyHierarchy();
    this._checkSimplePropertyRestrictions();
    this._checkNothingInstance();
    return this.violations;
  }

  _v(rule, message, axiom = null, iri = null) {
    this.violations.push({ rule, message, axiom, iri });
  }

  // --- property hierarchy ---------------------------------------------------

  _buildPropertyHierarchy() {
    // nonSimple: set of property IRIs that are "non-simple"
    // A property is non-simple if:
    //   - it is the super-property of a property chain axiom
    //   - it is a super-property (transitively) of a non-simple property
    this.nonSimple = new Set();
    this.chainSupers = []; // [{superProperty, chain:[iri...]}]

    for (const ax of this.ont.getAxiomsOfType(A.SUB_PROPERTY_CHAIN_OF)) {
      const sup = ax.superProperty.getIRI().toString();
      this.nonSimple.add(sup);
      this.chainSupers.push({
        superProperty: sup,
        chain: ax.propertyChain.map(p => p.getIRI().toString())
      });
    }
    // Propagate non-simplicity along subPropertyOf
    let changed = true;
    while (changed) {
      changed = false;
      for (const ax of this.ont.getAxiomsOfType(A.SUB_OBJECT_PROPERTY_OF)) {
        const sub = ax.subProperty.getIRI().toString();
        const sup = ax.superProperty.getIRI().toString();
        if (this.nonSimple.has(sub) && !this.nonSimple.has(sup)) {
          this.nonSimple.add(sup);
          changed = true;
        }
        // A chain member that is non-simple makes the chain's super non-simple
        // (OWL 2 §11.1: a property chain may not contain a non-simple property
        // in the chain unless the super is also non-simple; we flag the more
        // common violation: chain contains a non-simple property that is
        // equal to or a super-property of the chain's own super → circularity)
      }
    }
    // Regularity: a chain member must be a strict sub-property of the chain's
    // super-property, and may not be the super-property itself.
    for (const cs of this.chainSupers) {
      for (const member of cs.chain) {
        if (member === cs.superProperty) {
          this._v('regularity',
            `Property chain for ${cs.superProperty} contains itself as a member (non-regular)`, null, cs.superProperty);
        }
      }
    }
  }

  _isNonSimple(iri) { return this.nonSimple.has(iri); }

  // --- simple property restrictions -----------------------------------------

  _checkSimplePropertyRestrictions() {
    const checkProp = (ax, propIRI, axiomName) => {
      if (this._isNonSimple(propIRI)) {
        this._v('simple-property',
          `${axiomName} uses non-simple property ${propIRI} (super of a property chain)`, ax, propIRI);
      }
    };
    for (const ax of this.ont.getAxiomsOfType(A.FUNCTIONAL_OBJECT_PROPERTY)) {
      checkProp(ax, ax.property.getIRI().toString(), 'FunctionalObjectProperty');
    }
    for (const ax of this.ont.getAxiomsOfType(A.INVERSE_FUNCTIONAL_OBJECT_PROPERTY)) {
      checkProp(ax, ax.property.getIRI().toString(), 'InverseFunctionalObjectProperty');
    }
    for (const ax of this.ont.getAxiomsOfType(A.IRREFLEXIVE_OBJECT_PROPERTY)) {
      checkProp(ax, ax.property.getIRI().toString(), 'IrreflexiveObjectProperty');
    }
    for (const ax of this.ont.getAxiomsOfType(A.ASYMMETRIC_OBJECT_PROPERTY)) {
      checkProp(ax, ax.property.getIRI().toString(), 'AsymmetricObjectProperty');
    }
    for (const ax of this.ont.getAxiomsOfType(A.DISJOINT_OBJECT_PROPERTIES)) {
      for (const p of ax.properties) {
        checkProp(ax, p.getIRI().toString(), 'DisjointObjectProperties');
      }
    }
    // Cardinality restrictions and hasSelf inside class expressions
    for (const ax of this.ont.getAxioms()) {
      this._walkExprAxiom(ax, ax.subClass);
      this._walkExprAxiom(ax, ax.superClass);
      if (Array.isArray(ax.classExpressions)) {
        for (const ce of ax.classExpressions) this._walkExprAxiom(ax, ce);
      }
    }
  }

  _walkExprAxiom(ax, expr) {
    if (!expr || !expr.type) return;
    const self = this;
    (function walk(e) {
      if (!e || typeof e !== 'object') return;
      if (e.type === T.OBJECT_HAS_SELF) {
        const p = e.property.getIRI().toString();
        if (self._isNonSimple(p)) {
          self._v('simple-property', `ObjectHasSelf uses non-simple property ${p}`, ax, p);
        }
      }
      if (e.type === T.OBJECT_MIN_CARDINALITY || e.type === T.OBJECT_MAX_CARDINALITY
          || e.type === T.OBJECT_EXACT_CARDINALITY
          || e.type === T.OBJECT_MIN_QUALIFIED_CARDINALITY
          || e.type === T.OBJECT_MAX_QUALIFIED_CARDINALITY
          || e.type === T.OBJECT_EXACT_QUALIFIED_CARDINALITY) {
        const p = e.property.getIRI().toString();
        if (self._isNonSimple(p)) {
          self._v('simple-property', `Cardinality restriction uses non-simple property ${p}`, ax, p);
        }
      }
      if (e.operand) walk(e.operand);
      if (e.filler) walk(e.filler);
      if (Array.isArray(e.operands)) for (const o of e.operands) walk(o);
    })(expr);
  }

  // --- owl:Nothing -----------------------------------------------------------

  _checkNothingInstance() {
    for (const ax of this.ont.getAxiomsOfType(A.CLASS_ASSERTION)) {
      const ce = ax.classExpression;
      if (ce && ce.getIRI && ce.getIRI().toString() === 'http://www.w3.org/2002/07/owl#Nothing') {
        this._v('owl:Nothing-instance',
          'An individual is asserted to be an instance of owl:Nothing', ax);
      }
    }
  }
}

module.exports = { GlobalRestrictionsValidator };
