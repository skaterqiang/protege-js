'use strict';

// ---------------------------------------------------------------------------
// OWLAxiom — mirrors org.semanticweb.owlapi.model.OWLAxiom
// Subset: declaration, subClassOf, subObjectPropertyOf, subDataPropertyOf,
// classAssertion, propertyAssertion, annotationAssertion, equivalentClasses,
// disjointClasses, domain, range.
// ---------------------------------------------------------------------------

const AxiomType = Object.freeze({
  // 1. Declaration
  DECLARATION: 'Declaration',
  // 2-3. Class axioms
  SUBCLASS_OF: 'SubClassOf',
  EQUIVALENT_CLASSES: 'EquivalentClasses',
  DISJOINT_CLASSES: 'DisjointClasses',
  DISJOINT_UNION: 'DisjointUnion',
  // 4-8. Object property axioms
  SUB_OBJECT_PROPERTY_OF: 'SubObjectPropertyOf',
  SUB_PROPERTY_CHAIN_OF: 'SubObjectPropertyChainOf',
  EQUIVALENT_OBJECT_PROPERTIES: 'EquivalentObjectProperties',
  DISJOINT_OBJECT_PROPERTIES: 'DisjointObjectProperties',
  OBJECT_PROPERTY_DOMAIN: 'ObjectPropertyDomain',
  OBJECT_PROPERTY_RANGE: 'ObjectPropertyRange',
  INVERSE_OBJECT_PROPERTIES: 'InverseObjectProperties',
  // 9. Functional object property
  FUNCTIONAL_OBJECT_PROPERTY: 'FunctionalObjectProperty',
  INVERSE_FUNCTIONAL_OBJECT_PROPERTY: 'InverseFunctionalObjectProperty',
  REFLEXIVE_OBJECT_PROPERTY: 'ReflexiveObjectProperty',
  IRREFLEXIVE_OBJECT_PROPERTY: 'IrreflexiveObjectProperty',
  SYMMETRIC_OBJECT_PROPERTY: 'SymmetricObjectProperty',
  ASYMMETRIC_OBJECT_PROPERTY: 'AsymmetricObjectProperty',
  TRANSITIVE_OBJECT_PROPERTY: 'TransitiveObjectProperty',
  // Data property axioms
  SUB_DATA_PROPERTY_OF: 'SubDataPropertyOf',
  EQUIVALENT_DATA_PROPERTIES: 'EquivalentDataProperties',
  DISJOINT_DATA_PROPERTIES: 'DisjointDataProperties',
  DATA_PROPERTY_DOMAIN: 'DataPropertyDomain',
  DATA_PROPERTY_RANGE: 'DataPropertyRange',
  FUNCTIONAL_DATA_PROPERTY: 'FunctionalDataProperty',
  // Datatype definition
  DATATYPE_DEFINITION: 'DatatypeDefinition',
  // Has key
  HAS_KEY: 'HasKey',
  // Assertions
  SAME_INDIVIDUAL: 'SameIndividual',
  DIFFERENT_INDIVIDUALS: 'DifferentIndividuals',
  CLASS_ASSERTION: 'ClassAssertion',
  OBJECT_PROPERTY_ASSERTION: 'ObjectPropertyAssertion',
  NEGATIVE_OBJECT_PROPERTY_ASSERTION: 'NegativeObjectPropertyAssertion',
  DATA_PROPERTY_ASSERTION: 'DataPropertyAssertion',
  NEGATIVE_DATA_PROPERTY_ASSERTION: 'NegativeDataPropertyAssertion',
  // Annotation axioms
  ANNOTATION_ASSERTION: 'AnnotationAssertion',
  SUB_ANNOTATION_PROPERTY_OF: 'SubAnnotationPropertyOf',
  ANNOTATION_PROPERTY_DOMAIN: 'AnnotationPropertyDomain',
  ANNOTATION_PROPERTY_RANGE: 'AnnotationPropertyRange'
});

class OWLAxiom {
  constructor(axiomType, annotations = []) {
    this.axiomType = axiomType;
    this.annotations = annotations; // OWLAnnotation[]
  }

  getAxiomType() { return this.axiomType; }
  getAnnotations() { return this.annotations.slice(); }

  entities() {
    // Overridden by subclasses to return the OWLEntity[] involved.
    return [];
  }

  equals(other) {
    return other instanceof OWLAxiom && other.toString() === this.toString();
  }

  toString() {
    return `${this.axiomType}(${this._bodyString()})`;
  }

  _bodyString() { return ''; }
}

class OWLDeclarationAxiom extends OWLAxiom {
  constructor(entity, annotations) {
    super(AxiomType.DECLARATION, annotations);
    this.entity = entity;
  }
  entities() { return [this.entity]; }
  _bodyString() { return this.entity.toString(); }
}

class OWLSubClassOfAxiom extends OWLAxiom {
  constructor(subClass, superClass, annotations) {
    super(AxiomType.SUBCLASS_OF, annotations);
    this.subClass = subClass;       // OWLClassExpression
    this.superClass = superClass;   // OWLClassExpression
  }
  entities() { return [...exprEntities(this.subClass), ...exprEntities(this.superClass)]; }
  _bodyString() { return `${exprString(this.subClass)} ${exprString(this.superClass)}`; }
}

class OWLEquivalentClassesAxiom extends OWLAxiom {
  constructor(classExpressions, annotations) {
    super(AxiomType.EQUIVALENT_CLASSES, annotations);
    this.classExpressions = classExpressions.slice();
  }
  entities() { return this.classExpressions.flatMap(exprEntities); }
  _bodyString() { return this.classExpressions.map(exprString).join(' '); }
}

class OWLDisjointClassesAxiom extends OWLAxiom {
  constructor(classExpressions, annotations) {
    super(AxiomType.DISJOINT_CLASSES, annotations);
    this.classExpressions = classExpressions.slice();
  }
  entities() { return this.classExpressions.flatMap(exprEntities); }
  _bodyString() { return this.classExpressions.map(exprString).join(' '); }
}

class OWLSubObjectPropertyOfAxiom extends OWLAxiom {
  constructor(subProperty, superProperty, annotations) {
    super(AxiomType.SUB_OBJECT_PROPERTY_OF, annotations);
    this.subProperty = subProperty;
    this.superProperty = superProperty;
  }
  entities() { return [this.subProperty, this.superProperty]; }
  _bodyString() { return `${this.subProperty} ${this.superProperty}`; }
}

class OWLSubDataPropertyOfAxiom extends OWLAxiom {
  constructor(subProperty, superProperty, annotations) {
    super(AxiomType.SUB_DATA_PROPERTY_OF, annotations);
    this.subProperty = subProperty;
    this.superProperty = superProperty;
  }
  entities() { return [this.subProperty, this.superProperty]; }
  _bodyString() { return `${this.subProperty} ${this.superProperty}`; }
}

class OWLObjectPropertyDomainAxiom extends OWLAxiom {
  constructor(property, domain, annotations) {
    super(AxiomType.OBJECT_PROPERTY_DOMAIN, annotations);
    this.property = property;
    this.domain = domain;
  }
  entities() { return [this.property, ...exprEntities(this.domain)]; }
  _bodyString() { return `${this.property} ${exprString(this.domain)}`; }
}

class OWLObjectPropertyRangeAxiom extends OWLAxiom {
  constructor(property, range, annotations) {
    super(AxiomType.OBJECT_PROPERTY_RANGE, annotations);
    this.property = property;
    this.range = range;
  }
  entities() { return [this.property, ...exprEntities(this.range)]; }
  _bodyString() { return `${this.property} ${exprString(this.range)}`; }
}

class OWLDataPropertyDomainAxiom extends OWLAxiom {
  constructor(property, domain, annotations) {
    super(AxiomType.DATA_PROPERTY_DOMAIN, annotations);
    this.property = property;
    this.domain = domain;
  }
  entities() { return [this.property, ...exprEntities(this.domain)]; }
  _bodyString() { return `${this.property} ${exprString(this.domain)}`; }
}

class OWLClassAssertionAxiom extends OWLAxiom {
  constructor(individual, classExpression, annotations) {
    super(AxiomType.CLASS_ASSERTION, annotations);
    this.individual = individual;
    this.classExpression = classExpression;
  }
  entities() { return [this.individual, ...exprEntities(this.classExpression)]; }
  _bodyString() { return `${exprString(this.classExpression)}(${this.individual.getShortForm()})`; }
}

class OWLObjectPropertyAssertionAxiom extends OWLAxiom {
  constructor(subject, property, object, annotations) {
    super(AxiomType.OBJECT_PROPERTY_ASSERTION, annotations);
    this.subject = subject;
    this.property = property;
    this.object = object;
  }
  entities() { return [this.subject, this.property, this.object]; }
  _bodyString() { return `${this.property}(${this.subject.getShortForm()}, ${this.object.getShortForm()})`; }
}

class OWLDataPropertyAssertionAxiom extends OWLAxiom {
  constructor(subject, property, literal, annotations) {
    super(AxiomType.DATA_PROPERTY_ASSERTION, annotations);
    this.subject = subject;
    this.property = property;
    this.literal = literal; // OWLLiteral
  }
  entities() { return [this.subject, this.property]; }
  _bodyString() { return `${this.property}(${this.subject.getShortForm()}, ${this.literal})`; }
}

class OWLAnnotationAssertionAxiom extends OWLAxiom {
  constructor(subject, property, value, annotations) {
    super(AxiomType.ANNOTATION_ASSERTION, annotations);
    this.subject = subject;     // IRI
    this.property = property;   // OWLAnnotationProperty
    this.value = value;         // OWLAnnotationValue (IRI | OWLLiteral)
  }
  entities() { return [this.property]; }
  _bodyString() { return `${this.property}(${this.subject}, ${this.value})`; }
}

// ---- New axiom classes (OWL 2 structural spec coverage) ---------------------

class OWLDisjointUnionAxiom extends OWLAxiom {
  constructor(owlClass, classExpressions, annotations) {
    super(AxiomType.DISJOINT_UNION, annotations);
    this.owlClass = owlClass;
    this.classExpressions = classExpressions.slice();
  }
  entities() { return [this.owlClass, ...this.classExpressions.flatMap(exprEntities)]; }
  _bodyString() { return `${this.owlClass.getShortForm()} = union(${this.classExpressions.map(exprString).join(', ')})`; }
}

class OWLSubPropertyChainOfAxiom extends OWLAxiom {
  constructor(propertyChain, superProperty, annotations) {
    super(AxiomType.SUB_PROPERTY_CHAIN_OF, annotations);
    this.propertyChain = propertyChain.slice();
    this.superProperty = superProperty;
  }
  entities() { return [...this.propertyChain, this.superProperty]; }
  _bodyString() { return `${this.propertyChain.map(String).join(' ∘ ')} → ${this.superProperty}`; }
}

class OWLEquivalentObjectPropertiesAxiom extends OWLAxiom {
  constructor(properties, annotations) {
    super(AxiomType.EQUIVALENT_OBJECT_PROPERTIES, annotations);
    this.properties = properties.slice();
  }
  entities() { return this.properties; }
  _bodyString() { return this.properties.map(String).join(' ≡ '); }
}

class OWLDisjointObjectPropertiesAxiom extends OWLAxiom {
  constructor(properties, annotations) {
    super(AxiomType.DISJOINT_OBJECT_PROPERTIES, annotations);
    this.properties = properties.slice();
  }
  entities() { return this.properties; }
  _bodyString() { return this.properties.map(String).join(' ≠ '); }
}

class OWLEquivalentDataPropertiesAxiom extends OWLAxiom {
  constructor(properties, annotations) {
    super(AxiomType.EQUIVALENT_DATA_PROPERTIES, annotations);
    this.properties = properties.slice();
  }
  entities() { return this.properties; }
  _bodyString() { return this.properties.map(String).join(' ≡ '); }
}

class OWLDisjointDataPropertiesAxiom extends OWLAxiom {
  constructor(properties, annotations) {
    super(AxiomType.DISJOINT_DATA_PROPERTIES, annotations);
    this.properties = properties.slice();
  }
  entities() { return this.properties; }
  _bodyString() { return this.properties.map(String).join(' ≠ '); }
}

class OWLDataPropertyRangeAxiom extends OWLAxiom {
  constructor(property, range, annotations) {
    super(AxiomType.DATA_PROPERTY_RANGE, annotations);
    this.property = property;
    this.range = range; // OWLDataRange
  }
  entities() { return [this.property]; }
  _bodyString() { return `${this.property} ${exprString(this.range)}`; }
}

class OWLDatatypeDefinitionAxiom extends OWLAxiom {
  constructor(datatype, dataRange, annotations) {
    super(AxiomType.DATATYPE_DEFINITION, annotations);
    this.datatype = datatype;   // OWLDatatype
    this.dataRange = dataRange; // OWLDataRange
  }
  entities() { return [this.datatype]; }
  _bodyString() { return `${this.datatype.getShortForm()} := ${exprString(this.dataRange)}`; }
}

class OWLHasKeyAxiom extends OWLAxiom {
  constructor(classExpression, propertyExpressions, annotations) {
    super(AxiomType.HAS_KEY, annotations);
    this.classExpression = classExpression;
    this.propertyExpressions = propertyExpressions.slice();
  }
  entities() { return [...exprEntities(this.classExpression), ...this.propertyExpressions]; }
  _bodyString() { return `${exprString(this.classExpression)} hasKey (${this.propertyExpressions.map(String).join(', ')})`; }
}

class OWLSameIndividualAxiom extends OWLAxiom {
  constructor(individuals, annotations) {
    super(AxiomType.SAME_INDIVIDUAL, annotations);
    this.individuals = individuals.slice();
  }
  entities() { return this.individuals; }
  _bodyString() { return this.individuals.map(i => i.getShortForm()).join(' = '); }
}

class OWLDifferentIndividualsAxiom extends OWLAxiom {
  constructor(individuals, annotations) {
    super(AxiomType.DIFFERENT_INDIVIDUALS, annotations);
    this.individuals = individuals.slice();
  }
  entities() { return this.individuals; }
  _bodyString() { return this.individuals.map(i => i.getShortForm()).join(' ≠ '); }
}

class OWLNegativeObjectPropertyAssertionAxiom extends OWLAxiom {
  constructor(subject, property, object, annotations) {
    super(AxiomType.NEGATIVE_OBJECT_PROPERTY_ASSERTION, annotations);
    this.subject = subject;
    this.property = property;
    this.object = object;
  }
  entities() { return [this.subject, this.property, this.object]; }
  _bodyString() { return `NOT ${this.property}(${this.subject.getShortForm()}, ${this.object.getShortForm()})`; }
}

class OWLNegativeDataPropertyAssertionAxiom extends OWLAxiom {
  constructor(subject, property, literal, annotations) {
    super(AxiomType.NEGATIVE_DATA_PROPERTY_ASSERTION, annotations);
    this.subject = subject;
    this.property = property;
    this.literal = literal;
  }
  entities() { return [this.subject, this.property]; }
  _bodyString() { return `NOT ${this.property}(${this.subject.getShortForm()}, ${this.literal})`; }
}

class OWLSubAnnotationPropertyOfAxiom extends OWLAxiom {
  constructor(subProperty, superProperty, annotations) {
    super(AxiomType.SUB_ANNOTATION_PROPERTY_OF, annotations);
    this.subProperty = subProperty;
    this.superProperty = superProperty;
  }
  entities() { return [this.subProperty, this.superProperty]; }
  _bodyString() { return `${this.subProperty} ⊑ ${this.superProperty}`; }
}

class OWLAnnotationPropertyDomainAxiom extends OWLAxiom {
  constructor(property, domain, annotations) {
    super(AxiomType.ANNOTATION_PROPERTY_DOMAIN, annotations);
    this.property = property;
    this.domain = domain; // IRI
  }
  entities() { return [this.property]; }
  _bodyString() { return `${this.property} domain ${this.domain}`; }
}

class OWLAnnotationPropertyRangeAxiom extends OWLAxiom {
  constructor(property, range, annotations) {
    super(AxiomType.ANNOTATION_PROPERTY_RANGE, annotations);
    this.property = property;
    this.range = range; // IRI
  }
  entities() { return [this.property]; }
  _bodyString() { return `${this.property} range ${this.range}`; }
}

// Property-characteristic axioms (single property)
class OWLFunctionalObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.FUNCTIONAL_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Functional(${this.property})`; }
}
class OWLInverseFunctionalObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.INVERSE_FUNCTIONAL_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `InverseFunctional(${this.property})`; }
}
class OWLReflexiveObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.REFLEXIVE_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Reflexive(${this.property})`; }
}
class OWLIrreflexiveObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.IRREFLEXIVE_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Irreflexive(${this.property})`; }
}
class OWLSymmetricObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.SYMMETRIC_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Symmetric(${this.property})`; }
}
class OWLAsymmetricObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.ASYMMETRIC_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Asymmetric(${this.property})`; }
}
class OWLTransitiveObjectPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.TRANSITIVE_OBJECT_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Transitive(${this.property})`; }
}
class OWLFunctionalDataPropertyAxiom extends OWLAxiom {
  constructor(property, annotations) {
    super(AxiomType.FUNCTIONAL_DATA_PROPERTY, annotations);
    this.property = property;
  }
  entities() { return [this.property]; }
  _bodyString() { return `Functional(${this.property})`; }
}
class OWLInverseObjectPropertiesAxiom extends OWLAxiom {
  constructor(property1, property2, annotations) {
    super(AxiomType.INVERSE_OBJECT_PROPERTIES, annotations);
    this.property1 = property1;
    this.property2 = property2;
  }
  entities() { return [this.property1, this.property2]; }
  _bodyString() { return `${this.property1} ≡ ${this.property2}⁻`; }
}

// --- class expression helpers (expressions are plain objects) --------------

function exprEntities(expr) {
  if (!expr) return [];
  if (expr.getEntityType) return [expr]; // a named entity
  if (Array.isArray(expr.operands)) return expr.operands.flatMap(exprEntities);
  const out = [];
  if (expr.filler) out.push(...exprEntities(expr.filler));
  if (expr.property && expr.property.getEntityType) out.push(expr.property);
  return out;
}

function exprString(expr) {
  if (!expr) return '?';
  if (expr.getShortForm) return expr.getShortForm();
  return expr.toString ? expr.toString() : String(expr);
}

module.exports = {
  AxiomType,
  OWLAxiom,
  OWLDeclarationAxiom,
  OWLSubClassOfAxiom,
  OWLEquivalentClassesAxiom,
  OWLDisjointClassesAxiom,
  OWLDisjointUnionAxiom,
  OWLSubObjectPropertyOfAxiom,
  OWLSubPropertyChainOfAxiom,
  OWLEquivalentObjectPropertiesAxiom,
  OWLDisjointObjectPropertiesAxiom,
  OWLSubDataPropertyOfAxiom,
  OWLEquivalentDataPropertiesAxiom,
  OWLDisjointDataPropertiesAxiom,
  OWLObjectPropertyDomainAxiom,
  OWLObjectPropertyRangeAxiom,
  OWLDataPropertyDomainAxiom,
  OWLDataPropertyRangeAxiom,
  OWLDatatypeDefinitionAxiom,
  OWLHasKeyAxiom,
  OWLSameIndividualAxiom,
  OWLDifferentIndividualsAxiom,
  OWLClassAssertionAxiom,
  OWLObjectPropertyAssertionAxiom,
  OWLNegativeObjectPropertyAssertionAxiom,
  OWLDataPropertyAssertionAxiom,
  OWLNegativeDataPropertyAssertionAxiom,
  OWLAnnotationAssertionAxiom,
  OWLSubAnnotationPropertyOfAxiom,
  OWLAnnotationPropertyDomainAxiom,
  OWLAnnotationPropertyRangeAxiom,
  OWLFunctionalObjectPropertyAxiom,
  OWLInverseFunctionalObjectPropertyAxiom,
  OWLReflexiveObjectPropertyAxiom,
  OWLIrreflexiveObjectPropertyAxiom,
  OWLSymmetricObjectPropertyAxiom,
  OWLAsymmetricObjectPropertyAxiom,
  OWLTransitiveObjectPropertyAxiom,
  OWLFunctionalDataPropertyAxiom,
  OWLInverseObjectPropertiesAxiom
};
