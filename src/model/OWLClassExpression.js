'use strict';

const { OWLClass } = require('./OWLEntity');

// ---------------------------------------------------------------------------
// OWLClassExpression — mirrors org.semanticweb.owlapi.model.OWLClassExpression
// Named classes are OWLClass instances; anonymous expressions are objects
// created here: ObjectIntersectionOf / ObjectUnionOf / ObjectComplementOf /
// ObjectSomeValuesFrom / ObjectAllValuesFrom / ObjectHasValue /
// ObjectOneOf / ObjectExactCardinality / etc.
// ---------------------------------------------------------------------------

const ClassExpressionType = Object.freeze({
  OWL_CLASS: 'OWLClass',
  // Object-side
  OBJECT_INTERSECTION_OF: 'ObjectIntersectionOf',
  OBJECT_UNION_OF: 'ObjectUnionOf',
  OBJECT_COMPLEMENT_OF: 'ObjectComplementOf',
  OBJECT_SOME_VALUES_FROM: 'ObjectSomeValuesFrom',
  OBJECT_ALL_VALUES_FROM: 'ObjectAllValuesFrom',
  OBJECT_HAS_VALUE: 'ObjectHasValue',
  OBJECT_ONE_OF: 'ObjectOneOf',
  OBJECT_HAS_SELF: 'ObjectHasSelf',
  OBJECT_MIN_CARDINALITY: 'ObjectMinCardinality',
  OBJECT_MAX_CARDINALITY: 'ObjectMaxCardinality',
  OBJECT_EXACT_CARDINALITY: 'ObjectExactCardinality',
  OBJECT_MIN_QUALIFIED_CARDINALITY: 'ObjectMinQualifiedCardinality',
  OBJECT_MAX_QUALIFIED_CARDINALITY: 'ObjectMaxQualifiedCardinality',
  OBJECT_EXACT_QUALIFIED_CARDINALITY: 'ObjectExactQualifiedCardinality',
  // Data-side
  DATA_SOME_VALUES_FROM: 'DataSomeValuesFrom',
  DATA_ALL_VALUES_FROM: 'DataAllValuesFrom',
  DATA_HAS_VALUE: 'DataHasValue',
  DATA_MIN_CARDINALITY: 'DataMinCardinality',
  DATA_MAX_CARDINALITY: 'DataMaxCardinality',
  DATA_EXACT_CARDINALITY: 'DataExactCardinality',
  // Data ranges (not strictly class expressions but part of OWL2 syntax)
  DATA_INTERSECTION_OF: 'DataIntersectionOf',
  DATA_UNION_OF: 'DataUnionOf',
  DATA_COMPLEMENT_OF: 'DataComplementOf',
  DATA_ONE_OF: 'DataOneOf',
  DATATYPE_RESTRICTION: 'DatatypeRestriction'
});

class OWLObjectIntersectionOf {
  constructor(operands) {
    this.type = ClassExpressionType.OBJECT_INTERSECTION_OF;
    this.operands = operands.slice();
  }
  toString() { return `(${this.operands.map(String).join(' and ')})`; }
}

class OWLObjectUnionOf {
  constructor(operands) {
    this.type = ClassExpressionType.OBJECT_UNION_OF;
    this.operands = operands.slice();
  }
  toString() { return `(${this.operands.map(String).join(' or ')})`; }
}

class OWLObjectComplementOf {
  constructor(operand) {
    this.type = ClassExpressionType.OBJECT_COMPLEMENT_OF;
    this.operand = operand;
  }
  toString() { return `(not ${this.operand})`; }
}

class OWLObjectSomeValuesFrom {
  constructor(property, filler) {
    this.type = ClassExpressionType.OBJECT_SOME_VALUES_FROM;
    this.property = property;
    this.filler = filler;
  }
  toString() { return `(${this.property.getShortForm()} some ${this.filler})`; }
}

class OWLObjectAllValuesFrom {
  constructor(property, filler) {
    this.type = ClassExpressionType.OBJECT_ALL_VALUES_FROM;
    this.property = property;
    this.filler = filler;
  }
  toString() { return `(${this.property.getShortForm()} only ${this.filler})`; }
}

class OWLObjectHasValue {
  constructor(property, value) {
    this.type = ClassExpressionType.OBJECT_HAS_VALUE;
    this.property = property;
    this.value = value; // OWLNamedIndividual
  }
  toString() { return `(${this.property.getShortForm()} value ${this.value.getShortForm()})`; }
}

class OWLObjectOneOf {
  constructor(individuals) {
    this.type = ClassExpressionType.OBJECT_ONE_OF;
    this.operands = individuals.slice();
  }
  toString() { return `{${this.operands.map(i => i.getShortForm()).join(', ')}}`; }
}

class OWLObjectCardinalityRestriction {
  constructor(type, cardinality, property, filler) {
    this.type = type;
    this.cardinality = cardinality;
    this.property = property;
    this.filler = filler;
  }
  toString() {
    const op = this.type === ClassExpressionType.OBJECT_MIN_CARDINALITY
      || this.type === ClassExpressionType.OBJECT_MIN_QUALIFIED_CARDINALITY ? 'min'
      : this.type === ClassExpressionType.OBJECT_MAX_CARDINALITY
      || this.type === ClassExpressionType.OBJECT_MAX_QUALIFIED_CARDINALITY ? 'max' : 'exactly';
    return `(${this.property.getShortForm()} ${op} ${this.cardinality} ${this.filler || ''})`;
  }
}

class OWLObjectHasSelf {
  constructor(property) {
    this.type = ClassExpressionType.OBJECT_HAS_SELF;
    this.property = property;
  }
  toString() { return `(${this.property.getShortForm()} Self)`; }
}

// ---- Data-side class expressions -------------------------------------------

class OWLDataSomeValuesFrom {
  constructor(property, dataRange) {
    this.type = ClassExpressionType.DATA_SOME_VALUES_FROM;
    this.property = property;
    this.filler = dataRange;
  }
  toString() { return `(${this.property.getShortForm()} some ${this.filler})`; }
}

class OWLDataAllValuesFrom {
  constructor(property, dataRange) {
    this.type = ClassExpressionType.DATA_ALL_VALUES_FROM;
    this.property = property;
    this.filler = dataRange;
  }
  toString() { return `(${this.property.getShortForm()} only ${this.filler})`; }
}

class OWLDataHasValue {
  constructor(property, literal) {
    this.type = ClassExpressionType.DATA_HAS_VALUE;
    this.property = property;
    this.value = literal; // OWLLiteral
  }
  toString() { return `(${this.property.getShortForm()} value ${this.value})`; }
}

class OWLDataCardinalityRestriction {
  constructor(type, cardinality, property, dataRange) {
    this.type = type;
    this.cardinality = cardinality;
    this.property = property;
    this.filler = dataRange;
  }
  toString() {
    const op = this.type === ClassExpressionType.DATA_MIN_CARDINALITY ? 'min'
      : this.type === ClassExpressionType.DATA_MAX_CARDINALITY ? 'max' : 'exactly';
    return `(${this.property.getShortForm()} ${op} ${this.cardinality} ${this.filler || ''})`;
  }
}

// ---- Data ranges ------------------------------------------------------------

class OWLDataIntersectionOf {
  constructor(operands) {
    this.type = ClassExpressionType.DATA_INTERSECTION_OF;
    this.operands = operands.slice();
  }
  toString() { return `(${this.operands.map(String).join(' and ')})`; }
}

class OWLDataUnionOf {
  constructor(operands) {
    this.type = ClassExpressionType.DATA_UNION_OF;
    this.operands = operands.slice();
  }
  toString() { return `(${this.operands.map(String).join(' or ')})`; }
}

class OWLDataComplementOf {
  constructor(operand) {
    this.type = ClassExpressionType.DATA_COMPLEMENT_OF;
    this.operand = operand;
  }
  toString() { return `(not ${this.operand})`; }
}

class OWLDataOneOf {
  constructor(literals) {
    this.type = ClassExpressionType.DATA_ONE_OF;
    this.operands = literals.slice();
  }
  toString() { return `{${this.operands.join(', ')}}`; }
}

class OWLDatatypeRestriction {
  constructor(datatype, facetRestrictions) {
    this.type = ClassExpressionType.DATATYPE_RESTRICTION;
    this.datatype = datatype;             // OWLDatatype
    this.facetRestrictions = facetRestrictions.slice(); // [{facet: IRI, value: OWLLiteral}]
  }
  toString() {
    const fr = this.facetRestrictions.map(f => `${f.facet.getShortForm()} ${f.value}`).join(' ');
    return `${this.datatype.getShortForm()}[${fr}]`;
  }
}

function isNamedClass(expr) {
  return expr instanceof OWLClass;
}

module.exports = {
  ClassExpressionType,
  OWLObjectIntersectionOf,
  OWLObjectUnionOf,
  OWLObjectComplementOf,
  OWLObjectSomeValuesFrom,
  OWLObjectAllValuesFrom,
  OWLObjectHasValue,
  OWLObjectOneOf,
  OWLObjectHasSelf,
  OWLObjectCardinalityRestriction,
  OWLDataSomeValuesFrom,
  OWLDataAllValuesFrom,
  OWLDataHasValue,
  OWLDataCardinalityRestriction,
  OWLDataIntersectionOf,
  OWLDataUnionOf,
  OWLDataComplementOf,
  OWLDataOneOf,
  OWLDatatypeRestriction,
  isNamedClass
};
