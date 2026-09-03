'use strict';

// Shared RDF/OWL namespace constants and small literal helpers used by rules.

const NS = Object.freeze({
  RDF: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  RDFS: 'http://www.w3.org/2000/01/rdf-schema#',
  OWL: 'http://www.w3.org/2002/07/owl#',
  XSD: 'http://www.w3.org/2001/XMLSchema#'
});

const P = Object.freeze({
  type: NS.RDF + 'type',
  subClassOf: NS.RDFS + 'subClassOf',
  subPropertyOf: NS.RDFS + 'subPropertyOf',
  domain: NS.RDFS + 'domain',
  range: NS.RDFS + 'range',
  sameAs: NS.OWL + 'sameAs',
  differentFrom: NS.OWL + 'differentFrom',
  equivalentClass: NS.OWL + 'equivalentClass',
  equivalentProperty: NS.OWL + 'equivalentProperty',
  disjointWith: NS.OWL + 'disjointWith',
  propertyDisjointWith: NS.OWL + 'propertyDisjointWith',
  inverseOf: NS.OWL + 'inverseOf',
  propertyChainAxiom: NS.OWL + 'propertyChainAxiom',
  hasKey: NS.OWL + 'hasKey',
  intersectionOf: NS.OWL + 'intersectionOf',
  unionOf: NS.OWL + 'unionOf',
  complementOf: NS.OWL + 'complementOf',
  someValuesFrom: NS.OWL + 'someValuesFrom',
  allValuesFrom: NS.OWL + 'allValuesFrom',
  hasValue: NS.OWL + 'hasValue',
  onProperty: NS.OWL + 'onProperty',
  onClass: NS.OWL + 'onClass',
  maxCardinality: NS.OWL + 'maxCardinality',
  maxQualifiedCardinality: NS.OWL + 'maxQualifiedCardinality',
  oneOf: NS.OWL + 'oneOf',
  members: NS.OWL + 'members',
  distinctMembers: NS.OWL + 'distinctMembers',
  sourceIndividual: NS.OWL + 'sourceIndividual',
  assertionProperty: NS.OWL + 'assertionProperty',
  targetIndividual: NS.OWL + 'targetIndividual',
  targetValue: NS.OWL + 'targetValue'
});

const C = Object.freeze({
  Class: NS.OWL + 'Class',
  Thing: NS.OWL + 'Thing',
  Nothing: NS.OWL + 'Nothing',
  ObjectProperty: NS.OWL + 'ObjectProperty',
  DatatypeProperty: NS.OWL + 'DatatypeProperty',
  AnnotationProperty: NS.OWL + 'AnnotationProperty',
  FunctionalProperty: NS.OWL + 'FunctionalProperty',
  InverseFunctionalProperty: NS.OWL + 'InverseFunctionalProperty',
  IrreflexiveProperty: NS.OWL + 'IrreflexiveProperty',
  SymmetricProperty: NS.OWL + 'SymmetricProperty',
  AsymmetricProperty: NS.OWL + 'AsymmetricProperty',
  TransitiveProperty: NS.OWL + 'TransitiveProperty',
  AllDifferent: NS.OWL + 'AllDifferent',
  AllDisjointClasses: NS.OWL + 'AllDisjointClasses',
  AllDisjointProperties: NS.OWL + 'AllDisjointProperties',
  Datatype: NS.RDFS + 'Datatype'
});

/** Is this object term a typed literal "lex"^^<dt> ? */
function isLiteral(o) {
  return typeof o === 'string' && o.startsWith('"');
}

/** Parse "lex"^^<dt> or "lex"@lang -> {lex, dt, lang}. */
function parseLiteral(o) {
  if (!isLiteral(o)) return null;
  const m = /^"((?:[^"\\]|\\.)*)"(?:\^\^<([^>]+)>|@([A-Za-z-]+))?$/.exec(o);
  if (!m) return { lex: o.slice(1, -1), dt: null, lang: null };
  return { lex: m[1], dt: m[2] || null, lang: m[3] || null };
}

/** Canonical typed literal string. */
function literal(lex, dt) {
  return `"${lex}"^^<${dt}>`;
}

module.exports = { NS, P, C, isLiteral, parseLiteral, literal };
