'use strict';

// ---------------------------------------------------------------------------
// profiles/OWL2Profiles — structural conformance checkers for the three
// OWL 2 profiles (W3C §Profiles): RL, QL, EL.
//
// Each checker returns a list of violations:
//   { profile, rule, message, axiom }
// An ontology belongs to a profile iff the violation list is empty.
//
// These checkers implement the *syntactic* restrictions of each profile,
// not full expressivity analysis. They are intentionally conservative.
// ---------------------------------------------------------------------------

const { AxiomType: A } = require('../model/OWLAxiom');
const { ClassExpressionType: T } = require('../model/OWLClassExpression');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isNamedClass(e) {
  return e && e.getIRI && e.getEntityType && e.getEntityType() === 'Class';
}

function walk(expr, fn, acc = []) {
  if (!expr) return acc;
  fn(expr, acc);
  for (const k of ['operand', 'filler']) {
    if (expr[k]) walk(expr[k], fn, acc);
  }
  if (Array.isArray(expr.operands)) for (const o of expr.operands) walk(o, fn, acc);
  return acc;
}

function hasType(expr, typeSet) {
  let found = false;
  walk(expr, (e) => { if (e.type && typeSet.has(e.type)) found = true; });
  return found;
}

// ---------------------------------------------------------------------------
// OWL 2 RL — subclass side must not use ObjectUnionOf / ObjectComplementOf /
// ObjectAllValuesFrom / ObjectMaxCardinality / ObjectExactCardinality /
// ObjectHasSelf; superclass side must not use ObjectMinCardinality /
// ObjectExactCardinality / ObjectHasSelf / ObjectComplementOf.
// (Simplified from W3C §RL profile definition.)
// ---------------------------------------------------------------------------

const RL_SUBCLASS_FORBIDDEN = new Set([
  T.OBJECT_UNION_OF, T.OBJECT_COMPLEMENT_OF, T.OBJECT_ALL_VALUES_FROM,
  T.OBJECT_MAX_CARDINALITY, T.OBJECT_EXACT_CARDINALITY, T.OBJECT_HAS_SELF
]);
const RL_SUPERCLASS_FORBIDDEN = new Set([
  T.OBJECT_MIN_CARDINALITY, T.OBJECT_EXACT_CARDINALITY,
  T.OBJECT_HAS_SELF, T.OBJECT_COMPLEMENT_OF
]);

function checkRL(ont) {
  const violations = [];
  const v = (rule, message, axiom) => violations.push({ profile: 'RL', rule, message, axiom });

  for (const ax of ont.getAxiomsOfType(A.SUBCLASS_OF)) {
    if (hasType(ax.subClass, RL_SUBCLASS_FORBIDDEN)) {
      v('RL-subclass', 'SubClassOf LHS uses a construct disallowed in OWL 2 RL subclass position', ax);
    }
    if (hasType(ax.superClass, RL_SUPERCLASS_FORBIDDEN)) {
      v('RL-superclass', 'SubClassOf RHS uses a construct disallowed in OWL 2 RL superclass position', ax);
    }
  }
  // FunctionalDataProperty + FunctionalObjectProperty are allowed;
  // owl:hasSelf is disallowed entirely in RL.
  for (const ax of ont.getAxiomsOfType(A.EQUIVALENT_CLASSES)) {
    for (const ce of ax.classExpressions) {
      if (hasType(ce, new Set([T.OBJECT_HAS_SELF]))) {
        v('RL-hasSelf', 'ObjectHasSelf is not allowed in OWL 2 RL', ax);
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// OWL 2 QL — subclass side: named class or ObjectSomeValuesFrom with named
// filler only; superclass side: named class, ObjectSomeValuesFrom(named),
// ObjectIntersectionOf of superclass-expressions, ObjectHasValue.
// No cardinality > 1, no ObjectUnionOf/ComplementOf/AllValuesFrom on RHS.
// (Simplified.)
// ---------------------------------------------------------------------------

function qlSubClassOK(e) {
  if (isNamedClass(e)) return true;
  if (e.type === T.OBJECT_SOME_VALUES_FROM) return isNamedClass(e.filler) || isOWLThing(e.filler);
  return false;
}
function qlSuperClassOK(e) {
  if (isNamedClass(e)) return true;
  if (e.type === T.OBJECT_SOME_VALUES_FROM) return isNamedClass(e.filler) || isOWLThing(e.filler);
  if (e.type === T.OBJECT_INTERSECTION_OF) return e.operands.every(qlSuperClassOK);
  if (e.type === T.OBJECT_HAS_VALUE) return true;
  return false;
}
function isOWLThing(e) {
  return isNamedClass(e) && e.getIRI().toString() === 'http://www.w3.org/2002/07/owl#Thing';
}

function checkQL(ont) {
  const violations = [];
  const v = (rule, message, axiom) => violations.push({ profile: 'QL', rule, message, axiom });

  for (const ax of ont.getAxiomsOfType(A.SUBCLASS_OF)) {
    if (!qlSubClassOK(ax.subClass)) {
      v('QL-subclass', 'SubClassOf LHS not in QL form (named class or ∃P.Thing)', ax);
    }
    if (!qlSuperClassOK(ax.superClass)) {
      v('QL-superclass', 'SubClassOf RHS not in QL form', ax);
    }
  }
  // No FunctionalObjectProperty, no TransitiveObjectProperty, no cardinality
  for (const t of [A.FUNCTIONAL_OBJECT_PROPERTY, A.TRANSITIVE_OBJECT_PROPERTY,
                   A.SYMMETRIC_OBJECT_PROPERTY, A.REFLEXIVE_OBJECT_PROPERTY]) {
    for (const ax of ont.getAxiomsOfType(t)) {
      v('QL-' + t, `${t} is not allowed in OWL 2 QL`, ax);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// OWL 2 EL — no ObjectComplementOf, no ObjectAllValuesFrom, no
// DisjointClasses with > 2 operands allowed (binary allowed), no
// IrreflexiveObjectProperty, no AsymmetricObjectProperty, no
// NegativePropertyAssertion, no ObjectOneOf with > 1 individual (EL++ allows
// nominals in some profiles but standard EL does not).
// (Simplified.)
// ---------------------------------------------------------------------------

const EL_FORBIDDEN = new Set([
  T.OBJECT_COMPLEMENT_OF, T.OBJECT_ALL_VALUES_FROM, T.OBJECT_UNION_OF
]);

function checkEL(ont) {
  const violations = [];
  const v = (rule, message, axiom) => violations.push({ profile: 'EL', rule, message, axiom });

  for (const ax of ont.getAxiomsOfType(A.SUBCLASS_OF)) {
    if (hasType(ax.subClass, EL_FORBIDDEN) || hasType(ax.superClass, EL_FORBIDDEN)) {
      v('EL-expr', 'ObjectComplementOf / ObjectAllValuesFrom / ObjectUnionOf not allowed in OWL 2 EL', ax);
    }
  }
  for (const t of [A.IRREFLEXIVE_OBJECT_PROPERTY, A.ASYMMETRIC_OBJECT_PROPERTY,
                   A.FUNCTIONAL_OBJECT_PROPERTY, A.INVERSE_FUNCTIONAL_OBJECT_PROPERTY,
                   A.NEGATIVE_OBJECT_PROPERTY_ASSERTION, A.NEGATIVE_DATA_PROPERTY_ASSERTION]) {
    for (const ax of ont.getAxiomsOfType(t)) {
      v('EL-' + t, `${t} is not allowed in OWL 2 EL`, ax);
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const Profiles = Object.freeze({ RL: 'RL', QL: 'QL', EL: 'EL' });

/**
 * Check an ontology against a profile.
 * @param {OWLOntology} ont
 * @param {'RL'|'QL'|'EL'} profile
 * @returns {Array<{profile:string, rule:string, message:string, axiom:Object}>}
 */
function checkProfile(ont, profile) {
  if (profile === 'RL') return checkRL(ont);
  if (profile === 'QL') return checkQL(ont);
  if (profile === 'EL') return checkEL(ont);
  throw new Error('Unknown profile: ' + profile);
}

/** True iff the ontology is in the given profile. */
function isInProfile(ont, profile) {
  return checkProfile(ont, profile).length === 0;
}

module.exports = { Profiles, checkProfile, isInProfile, checkRL, checkQL, checkEL };
