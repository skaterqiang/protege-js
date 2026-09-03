'use strict';

// ---------------------------------------------------------------------------
// io/FunctionalSyntaxWriter — serialize an OWLOntology to OWL 2 Functional
// Syntax (W3C §9). Round-trip capable counterpart to FunctionalSyntaxParser.
// ---------------------------------------------------------------------------

const { ClassExpressionType: T } = require('../model/OWLClassExpression');
const { AxiomType: A } = require('../model/OWLAxiom');

function iriOf(x) {
  const s = x && x.getIRI ? x.getIRI().toString() : String(x);
  return `<${s}>`;
}

function classExpr(e) {
  if (!e) return '';
  if (e.getIRI) return iriOf(e); // OWLClass / entity
  switch (e.type) {
    case T.OBJECT_INTERSECTION_OF:
      return `ObjectIntersectionOf(${e.operands.map(classExpr).join(' ')})`;
    case T.OBJECT_UNION_OF:
      return `ObjectUnionOf(${e.operands.map(classExpr).join(' ')})`;
    case T.OBJECT_COMPLEMENT_OF:
      return `ObjectComplementOf(${classExpr(e.operand)})`;
    case T.OBJECT_SOME_VALUES_FROM:
      return `ObjectSomeValuesFrom(${iriOf(e.property)} ${classExpr(e.filler)})`;
    case T.OBJECT_ALL_VALUES_FROM:
      return `ObjectAllValuesFrom(${iriOf(e.property)} ${classExpr(e.filler)})`;
    case T.OBJECT_HAS_VALUE:
      return `ObjectHasValue(${iriOf(e.property)} ${iriOf(e.value)})`;
    case T.OBJECT_ONE_OF:
      return `ObjectOneOf(${e.operands.map(iriOf).join(' ')})`;
    case T.OBJECT_HAS_SELF:
      return `ObjectHasSelf(${iriOf(e.property)})`;
    case T.OBJECT_MIN_CARDINALITY:
      return `ObjectMinCardinality(${e.cardinality} ${iriOf(e.property)})`;
    case T.OBJECT_MAX_CARDINALITY:
      return `ObjectMaxCardinality(${e.cardinality} ${iriOf(e.property)})`;
    case T.OBJECT_EXACT_CARDINALITY:
      return `ObjectExactCardinality(${e.cardinality} ${iriOf(e.property)})`;
    case T.OBJECT_MIN_QUALIFIED_CARDINALITY:
      return `ObjectMinCardinality(${e.cardinality} ${iriOf(e.property)} ${classExpr(e.filler)})`;
    case T.OBJECT_MAX_QUALIFIED_CARDINALITY:
      return `ObjectMaxCardinality(${e.cardinality} ${iriOf(e.property)} ${classExpr(e.filler)})`;
    case T.OBJECT_EXACT_QUALIFIED_CARDINALITY:
      return `ObjectExactCardinality(${e.cardinality} ${iriOf(e.property)} ${classExpr(e.filler)})`;
    case T.DATA_SOME_VALUES_FROM:
      return `DataSomeValuesFrom(${iriOf(e.property)} ${dataRange(e.filler)})`;
    case T.DATA_ALL_VALUES_FROM:
      return `DataAllValuesFrom(${iriOf(e.property)} ${dataRange(e.filler)})`;
    case T.DATA_HAS_VALUE:
      return `DataHasValue(${iriOf(e.property)} ${literal(e.value)})`;
    case T.DATA_MIN_CARDINALITY:
      return `DataMinCardinality(${e.cardinality} ${iriOf(e.property)})`;
    case T.DATA_MAX_CARDINALITY:
      return `DataMaxCardinality(${e.cardinality} ${iriOf(e.property)})`;
    case T.DATA_EXACT_CARDINALITY:
      return `DataExactCardinality(${e.cardinality} ${iriOf(e.property)})`;
    default:
      return iriOf(e);
  }
}

function dataRange(dr) {
  if (!dr) return '';
  if (dr.getIRI) return iriOf(dr); // OWLDatatype
  switch (dr.type) {
    case T.DATA_INTERSECTION_OF:
      return `DataIntersectionOf(${dr.operands.map(dataRange).join(' ')})`;
    case T.DATA_UNION_OF:
      return `DataUnionOf(${dr.operands.map(dataRange).join(' ')})`;
    case T.DATA_COMPLEMENT_OF:
      return `DataComplementOf(${dataRange(dr.operand)})`;
    case T.DATA_ONE_OF:
      return `DataOneOf(${dr.operands.map(literal).join(' ')})`;
    case T.DATATYPE_RESTRICTION: {
      const frs = dr.facetRestrictions.map(f => `${iriOf(f.facet)} ${literal(f.value)}`).join(' ');
      return `DatatypeRestriction(${iriOf(dr.datatype)} ${frs})`;
    }
    default:
      return iriOf(dr);
  }
}

function literal(l) {
  let s = `"${l.lexicalValue}"`;
  if (l.lang) s += `@${l.lang}`;
  else if (l.datatype) s += `^^${iriOf(l.datatype)}`;
  return s;
}

function ind(i) {
  return i.isAnonymous && i.isAnonymous() ? i.toString() : iriOf(i);
}

function axiom(ax) {
  const t = ax.getAxiomType();
  switch (t) {
    case A.DECLARATION: {
      const e = ax.entity;
      const kind = e.isOWLClass() ? 'Class'
        : e.isOWLObjectProperty() ? 'ObjectProperty'
        : e.isOWLDataProperty() ? 'DataProperty'
        : e.isOWLAnnotationProperty() ? 'AnnotationProperty'
        : 'NamedIndividual';
      return `Declaration(${kind}(${iriOf(e)}))`;
    }
    case A.SUBCLASS_OF: return `SubClassOf(${classExpr(ax.subClass)} ${classExpr(ax.superClass)})`;
    case A.EQUIVALENT_CLASSES: return `EquivalentClasses(${ax.classExpressions.map(classExpr).join(' ')})`;
    case A.DISJOINT_CLASSES: return `DisjointClasses(${ax.classExpressions.map(classExpr).join(' ')})`;
    case A.DISJOINT_UNION: return `DisjointUnion(${classExpr(ax.owlClass)} ${ax.classExpressions.map(classExpr).join(' ')})`;
    case A.SUB_OBJECT_PROPERTY_OF: return `SubObjectPropertyOf(${iriOf(ax.subProperty)} ${iriOf(ax.superProperty)})`;
    case A.SUB_DATA_PROPERTY_OF: return `SubDataPropertyOf(${iriOf(ax.subProperty)} ${iriOf(ax.superProperty)})`;
    case A.EQUIVALENT_OBJECT_PROPERTIES: return `EquivalentObjectProperties(${ax.properties.map(iriOf).join(' ')})`;
    case A.DISJOINT_OBJECT_PROPERTIES: return `DisjointObjectProperties(${ax.properties.map(iriOf).join(' ')})`;
    case A.EQUIVALENT_DATA_PROPERTIES: return `EquivalentDataProperties(${ax.properties.map(iriOf).join(' ')})`;
    case A.DISJOINT_DATA_PROPERTIES: return `DisjointDataProperties(${ax.properties.map(iriOf).join(' ')})`;
    case A.INVERSE_OBJECT_PROPERTIES: return `InverseObjectProperties(${iriOf(ax.property1)} ${iriOf(ax.property2)})`;
    case A.OBJECT_PROPERTY_DOMAIN: return `ObjectPropertyDomain(${iriOf(ax.property)} ${classExpr(ax.domain)})`;
    case A.OBJECT_PROPERTY_RANGE: return `ObjectPropertyRange(${iriOf(ax.property)} ${classExpr(ax.range)})`;
    case A.DATA_PROPERTY_DOMAIN: return `DataPropertyDomain(${iriOf(ax.property)} ${classExpr(ax.domain)})`;
    case A.DATA_PROPERTY_RANGE: return `DataPropertyRange(${iriOf(ax.property)} ${dataRange(ax.range)})`;
    case A.FUNCTIONAL_OBJECT_PROPERTY: return `FunctionalObjectProperty(${iriOf(ax.property)})`;
    case A.INVERSE_FUNCTIONAL_OBJECT_PROPERTY: return `InverseFunctionalObjectProperty(${iriOf(ax.property)})`;
    case A.TRANSITIVE_OBJECT_PROPERTY: return `TransitiveObjectProperty(${iriOf(ax.property)})`;
    case A.SYMMETRIC_OBJECT_PROPERTY: return `SymmetricObjectProperty(${iriOf(ax.property)})`;
    case A.ASYMMETRIC_OBJECT_PROPERTY: return `AsymmetricObjectProperty(${iriOf(ax.property)})`;
    case A.REFLEXIVE_OBJECT_PROPERTY: return `ReflexiveObjectProperty(${iriOf(ax.property)})`;
    case A.IRREFLEXIVE_OBJECT_PROPERTY: return `IrreflexiveObjectProperty(${iriOf(ax.property)})`;
    case A.FUNCTIONAL_DATA_PROPERTY: return `FunctionalDataProperty(${iriOf(ax.property)})`;
    case A.SUB_PROPERTY_CHAIN_OF: return `SubObjectPropertyOf(ObjectPropertyChain(${ax.propertyChain.map(iriOf).join(' ')}) ${iriOf(ax.superProperty)})`;
    case A.CLASS_ASSERTION: return `ClassAssertion(${classExpr(ax.classExpression)} ${ind(ax.individual)})`;
    case A.OBJECT_PROPERTY_ASSERTION: return `ObjectPropertyAssertion(${iriOf(ax.property)} ${ind(ax.subject)} ${ind(ax.object)})`;
    case A.DATA_PROPERTY_ASSERTION: return `DataPropertyAssertion(${iriOf(ax.property)} ${ind(ax.subject)} ${literal(ax.literal)})`;
    case A.NEGATIVE_OBJECT_PROPERTY_ASSERTION: return `NegativeObjectPropertyAssertion(${iriOf(ax.property)} ${ind(ax.subject)} ${ind(ax.object)})`;
    case A.NEGATIVE_DATA_PROPERTY_ASSERTION: return `NegativeDataPropertyAssertion(${iriOf(ax.property)} ${ind(ax.subject)} ${literal(ax.literal)})`;
    case A.SAME_INDIVIDUAL: return `SameIndividual(${ax.individuals.map(ind).join(' ')})`;
    case A.DIFFERENT_INDIVIDUALS: return `DifferentIndividuals(${ax.individuals.map(ind).join(' ')})`;
    case A.HAS_KEY: return `HasKey(${classExpr(ax.classExpression)} (${ax.propertyExpressions.map(iriOf).join(' ')}))`;
    case A.ANNOTATION_ASSERTION: {
      const v = ax.value && ax.value.lexicalValue !== undefined ? literal(ax.value) : iriOf(ax.value);
      return `AnnotationAssertion(${iriOf(ax.property)} ${ax.subject ? iriOf(ax.subject) : ''} ${v})`;
    }
    case A.DATATYPE_DEFINITION: return `DatatypeDefinition(${iriOf(ax.datatype)} ${dataRange(ax.dataRange)})`;
    case A.SUB_ANNOTATION_PROPERTY_OF: return `SubAnnotationPropertyOf(${iriOf(ax.subProperty)} ${iriOf(ax.superProperty)})`;
    case A.ANNOTATION_PROPERTY_DOMAIN: return `AnnotationPropertyDomain(${iriOf(ax.property)} ${iriOf(ax.domain)})`;
    case A.ANNOTATION_PROPERTY_RANGE: return `AnnotationPropertyRange(${iriOf(ax.property)} ${iriOf(ax.range)})`;
    default: return null;
  }
}

/**
 * Serialize an OWLOntology to OWL 2 Functional Syntax.
 * @param {OWLOntology} ont
 * @returns {string}
 */
function writeFunctionalSyntax(ont) {
  const lines = [];
  const id = ont.getOntologyID();
  const head = [];
  if (id.ontologyIRI) {
    head.push(iriOf(id.ontologyIRI));
    if (id.versionIRI) head.push(iriOf(id.versionIRI));
  }
  for (const imp of ont.imports || []) {
    head.push(`Import(${iriOf(imp)})`);
  }
  for (const ann of ont.getOntologyAnnotations()) {
    const v = ann.value && ann.value.lexicalValue !== undefined ? literal(ann.value) : iriOf(ann.value);
    head.push(`Annotation(${iriOf(ann.property)} ${v})`);
  }
  const axioms = ont.getAxioms().map(axiom).filter(Boolean);
  lines.push(`Ontology(${head.join(' ')}`);
  for (const a of axioms) lines.push('  ' + a);
  lines.push(')');
  return lines.join('\n');
}

module.exports = { writeFunctionalSyntax, classExpr, dataRange, literal };
