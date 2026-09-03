'use strict';

// ---------------------------------------------------------------------------
// SWRL — Semantic Web Rule Language (https://www.w3.org/Submission/SWRL/).
// A SWRL rule has the form:  antecedent ⇒ consequent, where both sides are
// conjunctions of atoms. Supported atoms:
//   ClassAtom(classExpr, i-var)
//   ObjectPropertyAtom(prop, i-var, i-var)
//   DataPropertyAtom(prop, i-var, d-var)
//   SameAsAtom(i-var, i-var)   DifferentFromAtom(i-var, i-var)
//   BuiltInAtom(builtin, args...)   DataRangeAtom(d-var, dataRange)
// Variables start with ?  (e.g. ?x). IRIs/prefixed names identify entities.
// ---------------------------------------------------------------------------

const { OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual } = require('../model/OWLEntity');
const { IRI } = require('../model/IRI');
const CE = require('../model/OWLClassExpression');

const AtomType = Object.freeze({
  CLASS: 'ClassAtom',
  OBJECT_PROPERTY: 'ObjectPropertyAtom',
  DATA_PROPERTY: 'DataPropertyAtom',
  SAME_AS: 'SameAsAtom',
  DIFFERENT_FROM: 'DifferentFromAtom',
  BUILTIN: 'BuiltInAtom',
  DATA_RANGE: 'DataRangeAtom'
});

class SWRLVariable {
  constructor(iri) {
    this.iri = iri instanceof IRI ? iri : IRI.create(iri);
  }
  toString() { return '?' + this.iri.getShortForm(); }
}

class SWRLClassAtom {
  constructor(classExpression, arg) {
    this.type = AtomType.CLASS;
    this.classExpression = classExpression;
    this.arg = arg; // SWRLVariable or OWLNamedIndividual
  }
  toString() { return `${this.classExpression}(${this.arg})`; }
}

class SWRLObjectPropertyAtom {
  constructor(property, arg1, arg2) {
    this.type = AtomType.OBJECT_PROPERTY;
    this.property = property;
    this.arg1 = arg1;
    this.arg2 = arg2;
  }
  toString() { return `${this.property}(${this.arg1}, ${this.arg2})`; }
}

class SWRLDataPropertyAtom {
  constructor(property, arg1, arg2) {
    this.type = AtomType.DATA_PROPERTY;
    this.property = property;
    this.arg1 = arg1;
    this.arg2 = arg2;
  }
  toString() { return `${this.property}(${this.arg1}, ${this.arg2})`; }
}

class SWRLSameAsAtom {
  constructor(arg1, arg2) {
    this.type = AtomType.SAME_AS;
    this.arg1 = arg1;
    this.arg2 = arg2;
  }
  toString() { return `sameAs(${this.arg1}, ${this.arg2})`; }
}

class SWRLDifferentFromAtom {
  constructor(arg1, arg2) {
    this.type = AtomType.DIFFERENT_FROM;
    this.arg1 = arg1;
    this.arg2 = arg2;
  }
  toString() { return `differentFrom(${this.arg1}, ${this.arg2})`; }
}

class SWRLBuiltInAtom {
  constructor(builtinIRI, args) {
    this.type = AtomType.BUILTIN;
    this.builtin = builtinIRI instanceof IRI ? builtinIRI : IRI.create(builtinIRI);
    this.args = args.slice();
  }
  toString() { return `${this.builtin.getShortForm()}(${this.args.join(', ')})`; }
}

class SWRLDataRangeAtom {
  constructor(dataRange, arg) {
    this.type = AtomType.DATA_RANGE;
    this.dataRange = dataRange;
    this.arg = arg;
  }
  toString() { return `${this.dataRange}(${this.arg})`; }
}

class SWRLRule {
  constructor(body, head, iri = null, annotations = []) {
    this.body = body.slice();   // antecedent atoms
    this.head = head.slice();   // consequent atoms
    this.iri = iri;
    this.annotations = annotations;
  }
  toString() {
    return `${this.body.join(' ^ ')} -> ${this.head.join(' ^ ')}`;
  }
}

// Built-in namespace from the SWRL submission
const SWRLB_NS = 'http://www.w3.org/2003/11/swrlb#';

const SWRL_BUILTINS = [
  // Comparison
  'equal', 'notEqual', 'lessThan', 'lessThanOrEqual', 'greaterThan', 'greaterThanOrEqual',
  // Math
  'add', 'subtract', 'multiply', 'divide', 'integerDivide', 'mod',
  'pow', 'abs', 'ceiling', 'floor', 'round', 'roundHalfToEven',
  'sin', 'cos', 'tan', 'sqrt',
  // String core
  'stringConcat', 'substring', 'stringLength', 'normalizeSpace', 'upperCase', 'lowerCase',
  'contains', 'startsWith', 'endsWith', 'matches', 'replace',
  // String long-tail
  'stringEqualIgnoreCase', 'translate', 'substringBefore', 'substringAfter',
  // Date / time
  'yearMonthDuration', 'dayTimeDuration', 'dateTime', 'date', 'time',
  // anyURI
  'anyURI', 'resolveURI',
  // List operations
  'listConcat', 'listIntersection', 'listSubtraction', 'member', 'length',
  'first', 'rest', 'sublist', 'empty',
  // Boolean
  'booleanNot'
].map(n => SWRLB_NS + n);

module.exports = {
  AtomType,
  SWRLVariable,
  SWRLClassAtom,
  SWRLObjectPropertyAtom,
  SWRLDataPropertyAtom,
  SWRLSameAsAtom,
  SWRLDifferentFromAtom,
  SWRLBuiltInAtom,
  SWRLDataRangeAtom,
  SWRLRule,
  SWRLB_NS,
  SWRL_BUILTINS
};
