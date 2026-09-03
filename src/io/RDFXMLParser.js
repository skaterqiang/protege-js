'use strict';

const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual,
  OWLAnnotationProperty
} = require('../model/OWLEntity');
const {
  OWLDeclarationAxiom, OWLSubClassOfAxiom, OWLEquivalentClassesAxiom,
  OWLSubObjectPropertyOfAxiom, OWLSubDataPropertyOfAxiom,
  OWLObjectPropertyDomainAxiom, OWLObjectPropertyRangeAxiom,
  OWLDataPropertyDomainAxiom, OWLClassAssertionAxiom,
  OWLObjectPropertyAssertionAxiom, OWLDataPropertyAssertionAxiom,
  OWLAnnotationAssertionAxiom,
  OWLDisjointClassesAxiom, OWLInverseObjectPropertiesAxiom,
  OWLSameIndividualAxiom, OWLDifferentIndividualsAxiom,
  OWLFunctionalObjectPropertyAxiom, OWLInverseFunctionalObjectPropertyAxiom,
  OWLTransitiveObjectPropertyAxiom, OWLSymmetricObjectPropertyAxiom,
  OWLAsymmetricObjectPropertyAxiom, OWLReflexiveObjectPropertyAxiom,
  OWLIrreflexiveObjectPropertyAxiom, OWLFunctionalDataPropertyAxiom
} = require('../model/OWLAxiom');
const { OWLLiteral } = require('../model/OWLLiteral');

// ---------------------------------------------------------------------------
// io/RDFXMLParser — mirrors the RDF/XML document handler role of OWLAPI's
// parsers as wrapped by org.protege.editor.owl.model.io.OntologyLoader.
//
// A lightweight, dependency-free RDF/XML reader: extracts typed nodes,
// rdf:about / rdf:ID identity, owl:subClassOf / subPropertyOf / domain /
// range / type triples, and rdfs:label / annotation literals.
// ---------------------------------------------------------------------------

const NS = Object.freeze({
  RDF: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  RDFS: 'http://www.w3.org/2000/01/rdf-schema#',
  OWL: 'http://www.w3.org/2002/07/owl#',
  XSD: 'http://www.w3.org/2001/XMLSchema#'
});

function expandIRI(token, base, prefixes) {
  if (!token) return null;
  if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('urn:')) {
    return token;
  }
  const idx = token.indexOf(':');
  if (idx > 0) {
    const ns = prefixes[token.slice(0, idx)];
    if (ns) return ns + token.slice(idx + 1);
  }
  return base ? base + token : token;
}

/** Parse RDF/XML text into an OWLOntology. */
function parseRDFXML(xmlText, ontologyIRI = null) {
  const prefixes = { rdf: NS.RDF, rdfs: NS.RDFS, owl: NS.OWL, xsd: NS.XSD };

  // Collect namespace declarations.
  const nsRe = /xmlns:([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = nsRe.exec(xmlText)) !== null) {
    prefixes[m[1]] = m[2];
  }
  const baseMatch = /xml:base\s*=\s*"([^"]+)"/.exec(xmlText);
  const base = baseMatch ? baseMatch[1] : null;

  const ontIRI = ontologyIRI
    || (/<owl:Ontology[^>]*rdf:about="([^"]+)"/.exec(xmlText) || [])[1]
    || null;
  const ont = new OWLOntology(new OWLOntologyID(ontIRI));
  ont.format = 'RDF/XML';

  // --- element scanning (flat, order-independent) --------------------------
  // We use a simple element splitter: match top-level typed blocks, plus the
  // generic rdf:Description style where the entity type comes from rdf:type.
  const classBlocks = matchBlocks(xmlText, 'owl:Class');
  const objPropBlocks = matchBlocks(xmlText, 'owl:ObjectProperty');
  const dataPropBlocks = matchBlocks(xmlText, 'owl:DatatypeProperty');
  const individualBlocks = matchBlocks(xmlText, 'owl:NamedIndividual');

  const descBlocks = matchDescriptionBlocks(xmlText);
  for (const b of descBlocks) {
    // Punning: a single Description may carry MULTIPLE entity types
    // (e.g. both owl:Class and owl:ObjectProperty). Register the block in
    // EVERY matching category instead of breaking after the first.
    for (const t of b.types) {
      if (t === NS.OWL + 'Class' || t === NS.RDFS + 'Class') { classBlocks.push(b); continue; }
      if (t === NS.OWL + 'ObjectProperty') { objPropBlocks.push(b); continue; }
      if (t === NS.OWL + 'DatatypeProperty') { dataPropBlocks.push(b); continue; }
      if (t === NS.OWL + 'NamedIndividual') { individualBlocks.push(b); continue; }
    }
  }

  for (const b of classBlocks) {
    const iri = entityIRIFromTag(b.tag, base, prefixes);
    if (!iri) continue;
    const cls = new OWLClass(iri);
    ont.addAxiom(new OWLDeclarationAxiom(cls));
    parseClassBody(cls, b.body, ont, base, prefixes);
  }

  for (const b of objPropBlocks) {
    const iri = entityIRIFromTag(b.tag, base, prefixes);
    if (!iri) continue;
    const p = new OWLObjectProperty(iri);
    ont.addAxiom(new OWLDeclarationAxiom(p));
    parsePropertyBody(p, b.body, ont, base, prefixes, true);
    applyCharacteristics(p, b.body, ont, base, prefixes, true);
  }

  for (const b of dataPropBlocks) {
    const iri = entityIRIFromTag(b.tag, base, prefixes);
    if (!iri) continue;
    const p = new OWLDataProperty(iri);
    ont.addAxiom(new OWLDeclarationAxiom(p));
    parsePropertyBody(p, b.body, ont, base, prefixes, false);
    applyCharacteristics(p, b.body, ont, base, prefixes, false);
  }

  for (const b of individualBlocks) {
    const iri = entityIRIFromTag(b.tag, base, prefixes);
    if (!iri) continue;
    const ind = new OWLNamedIndividual(iri);
    ont.addAxiom(new OWLDeclarationAxiom(ind));
    parseIndividualBody(ind, b.body, ont, base, prefixes);
  }

  return ont;
}

// --- helpers ---------------------------------------------------------------

function matchBlocks(xml, tagName) {
  const blocks = [];
  // Self-closing: <owl:Class rdf:about="..."/>
  const selfRe = new RegExp(`<${tagName}([^>]*)/>`, 'g');
  let m;
  while ((m = selfRe.exec(xml)) !== null) {
    blocks.push({ tag: m[1], body: '' });
  }
  // Paired: <owl:Class rdf:about="..."> ... </owl:Class>
  const pairRe = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)</${tagName}>`, 'g');
  while ((m = pairRe.exec(xml)) !== null) {
    blocks.push({ tag: m[1], body: m[2] });
  }
  return blocks;
}

/**
 * Also support the generic `rdf:Description` style where the entity type is
 * given by an inner `<rdf:type rdf:resource="...#Class"/>` triple. Returns
 * blocks in the same {tag, body} shape but with a derived `type` field.
 */
function matchDescriptionBlocks(xml) {
  const blocks = [];
  const pairRe = /<rdf:Description([^>]*)>([\s\S]*?)<\/rdf:Description>/g;
  let m;
  while ((m = pairRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    // Collect ALL rdf:type values (an individual may have several types).
    const types = [];
    const tRe = /<rdf:type[^>]*rdf:resource="([^"]+)"/g;
    let tm;
    while ((tm = tRe.exec(body)) !== null) types.push(tm[1]);
    if (!types.length) continue;
    blocks.push({ tag: attrs, body, types });
  }
  return blocks;
}

function entityIRIFromTag(tagAttrs, base, prefixes) {
  const about = /rdf:about="([^"]+)"/.exec(tagAttrs);
  if (about) return expandIRI(about[1], base, prefixes);
  const id = /rdf:ID="([^"]+)"/.exec(tagAttrs);
  if (id) return base ? base + '#' + id[1] : '#' + id[1];
  return null;
}

function resourcesOf(body, tagName) {
  const out = [];
  const re = new RegExp(`<${tagName}[^>]*rdf:resource="([^"]+)"`, 'g');
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1]);
  return out;
}

function literalsOf(body, tagName) {
  const out = [];
  const re = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'g');
  let m;
  while ((m = re.exec(body)) !== null) out.push(m[1].trim());
  return out;
}

function parseClassBody(cls, body, ont, base, prefixes) {
  for (const r of resourcesOf(body, 'rdfs:subClassOf')) {
    const supIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLDeclarationAxiom(new OWLClass(supIRI)));
    ont.addAxiom(new OWLSubClassOfAxiom(cls, new OWLClass(supIRI)));
  }
  for (const r of resourcesOf(body, 'owl:equivalentClass')) {
    const eqIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLDeclarationAxiom(new OWLClass(eqIRI)));
    ont.addAxiom(new OWLEquivalentClassesAxiom([cls, new OWLClass(eqIRI)]));
  }
  for (const r of resourcesOf(body, 'owl:disjointWith')) {
    const dIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLDeclarationAxiom(new OWLClass(dIRI)));
    ont.addAxiom(new OWLDisjointClassesAxiom([cls, new OWLClass(dIRI)]));
  }
  addLabels(cls.getIRI().toString(), body, ont);
}

function parsePropertyBody(prop, body, ont, base, prefixes, isObject) {
  const subTag = 'rdfs:subPropertyOf';
  const subType = isObject ? OWLSubObjectPropertyOfAxiom : OWLSubDataPropertyOfAxiom;
  const mk = isObject ? (i) => new OWLObjectProperty(i) : (i) => new OWLDataProperty(i);
  for (const r of resourcesOf(body, subTag)) {
    const supIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLDeclarationAxiom(mk(supIRI)));
    ont.addAxiom(new subType(prop, mk(supIRI)));
  }
  for (const r of resourcesOf(body, 'rdfs:domain')) {
    const dIRI = expandIRI(r, base, prefixes);
    const dCls = new OWLClass(dIRI);
    ont.addAxiom(new OWLDeclarationAxiom(dCls));
    ont.addAxiom(isObject
      ? new OWLObjectPropertyDomainAxiom(prop, dCls)
      : new OWLDataPropertyDomainAxiom(prop, dCls));
  }
  for (const r of resourcesOf(body, 'rdfs:range')) {
    const rIRI = expandIRI(r, base, prefixes);
    const rCls = new OWLClass(rIRI);
    ont.addAxiom(new OWLDeclarationAxiom(rCls));
    if (isObject) ont.addAxiom(new OWLObjectPropertyRangeAxiom(prop, rCls));
  }
  if (isObject) {
    for (const r of resourcesOf(body, 'owl:inverseOf')) {
      const invIRI = expandIRI(r, base, prefixes);
      const invProp = new OWLObjectProperty(invIRI);
      ont.addAxiom(new OWLDeclarationAxiom(invProp));
      ont.addAxiom(new OWLInverseObjectPropertiesAxiom(prop, invProp));
    }
  }
  addLabels(prop.getIRI().toString(), body, ont);
}

// Property characteristics expressed as rdf:type of the property node.
const CHARACTERISTIC_TYPES = {
  [NS.OWL + 'FunctionalProperty']: (p, ont, isObject) => {
    ont.addAxiom(isObject
      ? new OWLFunctionalObjectPropertyAxiom(p)
      : new OWLFunctionalDataPropertyAxiom(p));
  },
  [NS.OWL + 'InverseFunctionalProperty']: (p, ont) => {
    ont.addAxiom(new OWLInverseFunctionalObjectPropertyAxiom(p));
  },
  [NS.OWL + 'TransitiveProperty']: (p, ont) => {
    ont.addAxiom(new OWLTransitiveObjectPropertyAxiom(p));
  },
  [NS.OWL + 'SymmetricProperty']: (p, ont) => {
    ont.addAxiom(new OWLSymmetricObjectPropertyAxiom(p));
  },
  [NS.OWL + 'AsymmetricProperty']: (p, ont) => {
    ont.addAxiom(new OWLAsymmetricObjectPropertyAxiom(p));
  },
  [NS.OWL + 'ReflexiveProperty']: (p, ont) => {
    ont.addAxiom(new OWLReflexiveObjectPropertyAxiom(p));
  },
  [NS.OWL + 'IrreflexiveProperty']: (p, ont) => {
    ont.addAxiom(new OWLIrreflexiveObjectPropertyAxiom(p));
  }
};

function applyCharacteristics(prop, body, ont, base, prefixes, isObject) {
  for (const r of resourcesOf(body, 'rdf:type')) {
    const tIRI = expandIRI(r, base, prefixes);
    const fn = CHARACTERISTIC_TYPES[tIRI];
    if (fn) fn(prop, ont, isObject);
  }
}

function parseIndividualBody(ind, body, ont, base, prefixes) {
  for (const r of resourcesOf(body, 'rdf:type')) {
    const tIRI = expandIRI(r, base, prefixes);
    if (tIRI === NS.OWL + 'NamedIndividual') continue;
    const tCls = new OWLClass(tIRI);
    ont.addAxiom(new OWLDeclarationAxiom(tCls));
    ont.addAxiom(new OWLClassAssertionAxiom(ind, tCls));
  }
  for (const r of resourcesOf(body, 'owl:sameAs')) {
    const oIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLSameIndividualAxiom([ind, new OWLNamedIndividual(oIRI)]));
  }
  for (const r of resourcesOf(body, 'owl:differentFrom')) {
    const oIRI = expandIRI(r, base, prefixes);
    ont.addAxiom(new OWLDifferentIndividualsAxiom([ind, new OWLNamedIndividual(oIRI)]));
  }
  addLabels(ind.getIRI().toString(), body, ont);
}

function addLabels(subjectIRI, body, ont) {
  for (const text of literalsOf(body, 'rdfs:label')) {
    ont.addAxiom(new OWLAnnotationAssertionAxiom(
      subjectIRI,
      new OWLAnnotationProperty(NS.RDFS + 'label'),
      new OWLLiteral(text)
    ));
  }
  for (const text of literalsOf(body, 'rdfs:comment')) {
    ont.addAxiom(new OWLAnnotationAssertionAxiom(
      subjectIRI,
      new OWLAnnotationProperty(NS.RDFS + 'comment'),
      new OWLLiteral(text)
    ));
  }
}

module.exports = { parseRDFXML, NS };
