'use strict';

// ---------------------------------------------------------------------------
// io/RDFGraphToOntology — convert a TripleStore (raw RDF triples) into a
// structured OWLOntology. This is the W3C "Mapping to RDF Graphs" inverse.
//
// Handles:
//   - Named classes / properties / individuals (owl:Class, owl:ObjectProperty,
//     owl:DatatypeProperty, owl:NamedIndividual)
//   - Anonymous class expressions encoded as RDF blank nodes:
//       owl:Restriction (someValuesFrom / allValuesFrom / hasValue / hasSelf /
//                        min/max/exact cardinality, qualified + unqualified)
//       owl:intersectionOf / owl:unionOf / owl:complementOf / owl:oneOf
//   - Data ranges: owl:onDatatype + owl:withRestrictions (facet lists),
//                  owl:intersectionOf / unionOf / complementOf / oneOf
//   - Class axioms: rdfs:subClassOf, owl:equivalentClass, owl:disjointWith,
//                   owl:disjointUnionOf, owl:hasKey
//   - Property axioms: rdfs:subPropertyOf, owl:inverseOf, rdfs:domain,
//                      rdfs:range, owl:propertyChainAxiom
//   - Property characteristics via rdf:type (Functional/InverseFunctional/
//     Transitive/Symmetric/Asymmetric/Reflexive/Irreflexive)
//   - Assertions: rdf:type, owl:sameAs, owl:differentFrom,
//     owl:NegativePropertyAssertion (reified)
//   - N-ary constructs: owl:AllDisjointClasses / owl:AllDifferent /
//     owl:AllDisjointProperties (owl:members / owl:distinctMembers)
//   - Axiom annotations via owl:Axiom reification (owl:annotatedSource /
//     annotatedProperty / annotatedTarget)
//   - Ontology header: owl:Ontology with owl:imports, owl:versionIRI,
//     owl:priorVersion, owl:backwardCompatibleWith, owl:incompatibleWith,
//     plus arbitrary annotation properties on the ontology node itself
// ---------------------------------------------------------------------------

const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual,
  OWLAnonymousIndividual, OWLDatatype, OWLAnnotationProperty
} = require('../model/OWLEntity');
const CE = require('../model/OWLClassExpression');
const AX = require('../model/OWLAxiom');
const { OWLLiteral } = require('../model/OWLLiteral');
const { IRI } = require('../model/IRI');
const { NS, parseLiteral } = require('../inference/rdf');

const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL, XSD = NS.XSD;

// Facet IRI → name
const FACET_NAMES = Object.freeze({
  [XSD + 'minInclusive']: 'minInclusive',
  [XSD + 'maxInclusive']: 'maxInclusive',
  [XSD + 'minExclusive']: 'minExclusive',
  [XSD + 'maxExclusive']: 'maxExclusive',
  [XSD + 'length']: 'length',
  [XSD + 'minLength']: 'minLength',
  [XSD + 'maxLength']: 'maxLength',
  [XSD + 'pattern']: 'pattern',
  [XSD + 'totalDigits']: 'totalDigits',
  [XSD + 'fractionDigits']: 'fractionDigits',
  [XSD + 'whiteSpace']: 'whiteSpace'
});

const BUILTIN_ANNOTATION_PROPERTIES = new Set([
  RDFS + 'label', RDFS + 'comment', RDFS + 'seeAlso', RDFS + 'isDefinedBy',
  OWL + 'versionInfo', OWL + 'deprecated', OWL + 'priorVersion',
  OWL + 'backwardCompatibleWith', OWL + 'incompatibleWith'
]);

const CHARACTERISTIC_RDF_TYPES = {
  [OWL + 'FunctionalProperty']: 'FUNCTIONAL',
  [OWL + 'InverseFunctionalProperty']: 'INVERSE_FUNCTIONAL',
  [OWL + 'TransitiveProperty']: 'TRANSITIVE',
  [OWL + 'SymmetricProperty']: 'SYMMETRIC',
  [OWL + 'AsymmetricProperty']: 'ASYMMETRIC',
  [OWL + 'ReflexiveProperty']: 'REFLEXIVE',
  [OWL + 'IrreflexiveProperty']: 'IRREFLEXIVE'
};

/**
 * Convert a TripleStore into an OWLOntology.
 * @param {TripleStore} store
 * @param {{ontologyIRI?: string}} [opts]
 * @returns {OWLOntology}
 */
function triplesToOntology(store, opts = {}) {
  const ont = new OWLOntology(new OWLOntologyID(opts.ontologyIRI || null));
  const ctx = { store, ont, ceCache: new Map(), drCache: new Map(), indCache: new Map() };

  parseOntologyHeader(ctx);
  const namedClasses = parseEntities(ctx);
  parseClassAxioms(ctx, namedClasses);
  parsePropertyAxioms(ctx);
  parseIndividualAxioms(ctx);
  parseNAryConstructs(ctx);
  parseNegativeAssertions(ctx);
  parseAnnotations(ctx);
  return ont;
}

// ---------------------------------------------------------------------------
// Ontology header
// ---------------------------------------------------------------------------

function parseOntologyHeader(ctx) {
  const { store, ont } = ctx;
  for (const [s] of store.match(null, RDF + 'type', OWL + 'Ontology')) {
    if (isAnon(s)) continue;
    if (!ont.getOntologyID().ontologyIRI) ont.id.ontologyIRI = s;
    ont.headerSubject = s;
    const v = store.objects(s, OWL + 'versionIRI')[0];
    if (v) ont.id.versionIRI = v;
    ont.imports = store.objects(s, OWL + 'imports').slice();
    ont.priorVersion = store.objects(s, OWL + 'priorVersion').slice();
    ont.backwardCompatibleWith = store.objects(s, OWL + 'backwardCompatibleWith').slice();
    ont.incompatibleWith = store.objects(s, OWL + 'incompatibleWith').slice();
    // Ontology-level annotations: any non-structural predicate on the ontology node
    for (const [_, p, o] of store.match(s, null, null)) {
      if (p.startsWith(RDF) || p.startsWith(OWL + 'imports') || p.startsWith(OWL + 'versionIRI')
          || p.startsWith(OWL + 'priorVersion') || p.startsWith(OWL + 'backwardCompatibleWith')
          || p.startsWith(OWL + 'incompatibleWith')) continue;
      if (BUILTIN_ANNOTATION_PROPERTIES.has(p)) {
        const val = literalFromEncoding(o) || IRI.create(o);
        ont.addOntologyAnnotation(new AX.OWLAnnotationAssertionAxiom(
          s, new OWLAnnotationProperty(p), val));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entity declarations
// ---------------------------------------------------------------------------

function parseEntities(ctx) {
  const { store, ont } = ctx;
  const namedClasses = new Set();

  const declare = (iri, mk) => {
    if (isAnon(iri)) return null;
    ont.addAxiom(new AX.OWLDeclarationAxiom(mk(iri)));
    return iri;
  };

  for (const [s] of store.match(null, RDF + 'type', OWL + 'Class')) {
    if (declare(s, (i) => new OWLClass(i))) namedClasses.add(s);
  }
  for (const [s] of store.match(null, RDF + 'type', RDFS + 'Class')) {
    if (declare(s, (i) => new OWLClass(i))) namedClasses.add(s);
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'ObjectProperty')) {
    declare(s, (i) => new OWLObjectProperty(i));
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'DatatypeProperty')) {
    declare(s, (i) => new OWLDataProperty(i));
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'AnnotationProperty')) {
    declare(s, (i) => new OWLAnnotationProperty(i));
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'NamedIndividual')) {
    declare(s, (i) => new OWLNamedIndividual(i));
  }
  for (const [s] of store.match(null, RDF + 'type', RDFS + 'Datatype')) {
    declare(s, (i) => new OWLDatatype(i));
  }
  return namedClasses;
}

// ---------------------------------------------------------------------------
// Class axioms (subClassOf / equivalentClass / disjointWith / disjointUnionOf
// / hasKey). Each super/equivalent side may be a named class or a blank node
// encoding a class expression.
// ---------------------------------------------------------------------------

function parseClassAxioms(ctx, namedClasses) {
  const { store, ont } = ctx;

  const clsOf = (node) => classExpression(ctx, node);

  for (const c of namedClasses) {
    const cls = new OWLClass(c);
    for (const sup of store.objects(c, RDFS + 'subClassOf')) {
      const ce = clsOf(sup);
      if (ce) ont.addAxiom(new AX.OWLSubClassOfAxiom(cls, ce));
    }
    for (const eq of store.objects(c, OWL + 'equivalentClass')) {
      const ce = clsOf(eq);
      if (ce) ont.addAxiom(new AX.OWLEquivalentClassesAxiom([cls, ce]));
    }
    for (const d of store.objects(c, OWL + 'disjointWith')) {
      const ce = clsOf(d);
      if (ce) ont.addAxiom(new AX.OWLDisjointClassesAxiom([cls, ce]));
    }
    for (const du of store.objects(c, OWL + 'disjointUnionOf')) {
      const members = listNodes(store, du).map(clsOf).filter(Boolean);
      if (members.length >= 2) {
        ont.addAxiom(new AX.OWLDisjointUnionAxiom(cls, members));
      }
    }
    for (const k of store.objects(c, OWL + 'hasKey')) {
      const props = listNodes(store, k).map(n => {
        if (store.match(n, RDF + 'type', OWL + 'ObjectProperty').length) {
          return new OWLObjectProperty(n);
        }
        return new OWLDataProperty(n);
      });
      if (props.length) ont.addAxiom(new AX.OWLHasKeyAxiom(cls, props));
    }
  }
}

// ---------------------------------------------------------------------------
// Property axioms + characteristics
// ---------------------------------------------------------------------------

function parsePropertyAxioms(ctx) {
  const { store, ont } = ctx;

  for (const [s] of store.match(null, RDF + 'type', OWL + 'ObjectProperty')) {
    if (isAnon(s)) continue;
    const p = new OWLObjectProperty(s);
    for (const sup of store.objects(s, RDFS + 'subPropertyOf')) {
      ont.addAxiom(new AX.OWLSubObjectPropertyOfAxiom(p, new OWLObjectProperty(sup)));
    }
    for (const inv of store.objects(s, OWL + 'inverseOf')) {
      ont.addAxiom(new AX.OWLInverseObjectPropertiesAxiom(p, new OWLObjectProperty(inv)));
    }
    for (const d of store.objects(s, RDFS + 'domain')) {
      const ce = classExpression(ctx, d);
      if (ce) ont.addAxiom(new AX.OWLObjectPropertyDomainAxiom(p, ce));
    }
    for (const r of store.objects(s, RDFS + 'range')) {
      const ce = classExpression(ctx, r);
      if (ce) ont.addAxiom(new AX.OWLObjectPropertyRangeAxiom(p, ce));
    }
    for (const ch of store.objects(s, OWL + 'propertyChainAxiom')) {
      const chain = listNodes(store, ch).map(n => new OWLObjectProperty(n));
      if (chain.length >= 2) {
        ont.addAxiom(new AX.OWLSubPropertyChainOfAxiom(chain, p));
      }
    }
    applyCharacteristics(ctx, s, p, true);
  }

  for (const [s] of store.match(null, RDF + 'type', OWL + 'DatatypeProperty')) {
    if (isAnon(s)) continue;
    const p = new OWLDataProperty(s);
    for (const sup of store.objects(s, RDFS + 'subPropertyOf')) {
      ont.addAxiom(new AX.OWLSubDataPropertyOfAxiom(p, new OWLDataProperty(sup)));
    }
    for (const d of store.objects(s, RDFS + 'domain')) {
      const ce = classExpression(ctx, d);
      if (ce) ont.addAxiom(new AX.OWLDataPropertyDomainAxiom(p, ce));
    }
    for (const r of store.objects(s, RDFS + 'range')) {
      const dr = dataRange(ctx, r);
      if (dr) ont.addAxiom(new AX.OWLDataPropertyRangeAxiom(p, dr));
    }
    applyCharacteristics(ctx, s, p, false);
  }
}

function applyCharacteristics(ctx, propIRI, prop, isObject) {
  const { store, ont } = ctx;
  for (const t of store.objects(propIRI, RDF + 'type')) {
    const kind = CHARACTERISTIC_RDF_TYPES[t];
    if (!kind) continue;
    if (kind === 'FUNCTIONAL') {
      ont.addAxiom(isObject
        ? new AX.OWLFunctionalObjectPropertyAxiom(prop)
        : new AX.OWLFunctionalDataPropertyAxiom(prop));
    } else if (isObject) {
      const map = {
        INVERSE_FUNCTIONAL: AX.OWLInverseFunctionalObjectPropertyAxiom,
        TRANSITIVE: AX.OWLTransitiveObjectPropertyAxiom,
        SYMMETRIC: AX.OWLSymmetricObjectPropertyAxiom,
        ASYMMETRIC: AX.OWLAsymmetricObjectPropertyAxiom,
        REFLEXIVE: AX.OWLReflexiveObjectPropertyAxiom,
        IRREFLEXIVE: AX.OWLIrreflexiveObjectPropertyAxiom
      };
      if (map[kind]) ont.addAxiom(new map[kind](prop));
    }
  }
}

// ---------------------------------------------------------------------------
// Individuals
// ---------------------------------------------------------------------------

function parseIndividualAxioms(ctx) {
  const { store, ont } = ctx;
  // owl:NamedIndividual declarations + type assertions
  for (const [s] of store.match(null, RDF + 'type', OWL + 'NamedIndividual')) {
    const ind = individualOf(ctx, s);
    for (const t of store.objects(s, RDF + 'type')) {
      if (t === OWL + 'NamedIndividual') continue;
      const ce = classExpression(ctx, t);
      if (ce) ont.addAxiom(new AX.OWLClassAssertionAxiom(ind, ce));
    }
    for (const o of store.objects(s, OWL + 'sameAs')) {
      ont.addAxiom(new AX.OWLSameIndividualAxiom([ind, individualOf(ctx, o)]));
    }
    for (const o of store.objects(s, OWL + 'differentFrom')) {
      ont.addAxiom(new AX.OWLDifferentIndividualsAxiom([ind, individualOf(ctx, o)]));
    }
    // Property assertions: any non-structural triple
    for (const [_, p, o] of store.match(s, null, null)) {
      if (p.startsWith(RDF) || p.startsWith(OWL + 'sameAs') || p.startsWith(OWL + 'differentFrom')) continue;
      if (BUILTIN_ANNOTATION_PROPERTIES.has(p)) continue;
      // Object property?
      if (store.match(p, RDF + 'type', OWL + 'ObjectProperty').length) {
        ont.addAxiom(new AX.OWLObjectPropertyAssertionAxiom(ind, new OWLObjectProperty(p), individualOf(ctx, o)));
      } else if (store.match(p, RDF + 'type', OWL + 'DatatypeProperty').length) {
        const lit = literalFromEncoding(o);
        if (lit) ont.addAxiom(new AX.OWLDataPropertyAssertionAxiom(ind, new OWLDataProperty(p), lit));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// N-ary constructs (AllDisjointClasses / AllDifferent / AllDisjointProperties)
// ---------------------------------------------------------------------------

function parseNAryConstructs(ctx) {
  const { store, ont } = ctx;

  for (const [s] of store.match(null, RDF + 'type', OWL + 'AllDisjointClasses')) {
    const members = store.objects(s, OWL + 'members')[0];
    if (!members) continue;
    const ces = listNodes(store, members).map(n => classExpression(ctx, n)).filter(Boolean);
    if (ces.length >= 2) ont.addAxiom(new AX.OWLDisjointClassesAxiom(ces));
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'AllDifferent')) {
    const members = store.objects(s, OWL + 'distinctMembers')[0]
      || store.objects(s, OWL + 'members')[0];
    if (!members) continue;
    const inds = listNodes(store, members).map(n => individualOf(ctx, n));
    if (inds.length >= 2) ont.addAxiom(new AX.OWLDifferentIndividualsAxiom(inds));
  }
  for (const [s] of store.match(null, RDF + 'type', OWL + 'AllDisjointProperties')) {
    const members = store.objects(s, OWL + 'members')[0];
    if (!members) continue;
    const nodes = listNodes(store, members);
    const objProps = nodes.filter(n => store.match(n, RDF + 'type', OWL + 'ObjectProperty').length);
    const dataProps = nodes.filter(n => store.match(n, RDF + 'type', OWL + 'DatatypeProperty').length);
    if (objProps.length >= 2) {
      ont.addAxiom(new AX.OWLDisjointObjectPropertiesAxiom(objProps.map(n => new OWLObjectProperty(n))));
    }
    if (dataProps.length >= 2) {
      ont.addAxiom(new AX.OWLDisjointDataPropertiesAxiom(dataProps.map(n => new OWLDataProperty(n))));
    }
  }
  // Equivalent classes / properties (n-ary via owl:equivalentClass / owl:equivalentProperty pairs)
  // Handled by binary axioms above; multi-node equivalentClasses constructs go through
  // owl:equivalentClass between named classes.
}

// ---------------------------------------------------------------------------
// Negative property assertions (owl:NegativePropertyAssertion reification)
// ---------------------------------------------------------------------------

function parseNegativeAssertions(ctx) {
  const { store, ont } = ctx;
  for (const [s] of store.match(null, RDF + 'type', OWL + 'NegativePropertyAssertion')) {
    const src = store.objects(s, OWL + 'sourceIndividual')[0];
    const prop = store.objects(s, OWL + 'assertionProperty')[0];
    if (!src || !prop) continue;
    const tgtInd = store.objects(s, OWL + 'targetIndividual')[0];
    const tgtVal = store.objects(s, OWL + 'targetValue')[0];
    const subj = individualOf(ctx, src);
    if (tgtInd) {
      ont.addAxiom(new AX.OWLNegativeObjectPropertyAssertionAxiom(
        subj, new OWLObjectProperty(prop), individualOf(ctx, tgtInd)));
    } else if (tgtVal) {
      const lit = literalFromEncoding(tgtVal);
      if (lit) {
        ont.addAxiom(new AX.OWLNegativeDataPropertyAssertionAxiom(
          subj, new OWLDataProperty(prop), lit));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Annotations on entities + axiom annotations (owl:Axiom reification)
// ---------------------------------------------------------------------------

function parseAnnotations(ctx) {
  const { store, ont } = ctx;

  // Entity-level annotations: any triple (s, p, o) where p is an AnnotationProperty
  const annProps = new Set(BUILTIN_ANNOTATION_PROPERTIES);
  for (const [s] of store.match(null, RDF + 'type', OWL + 'AnnotationProperty')) {
    if (!isAnon(s)) annProps.add(s);
  }
  for (const p of annProps) {
    for (const [s, , o] of store.match(null, p, null)) {
      // Skip ontology header (already collected as ontology annotations)
      if (ont.headerSubject === s) continue;
      const val = literalFromEncoding(o) || IRI.create(o);
      ont.addAxiom(new AX.OWLAnnotationAssertionAxiom(
        s, new OWLAnnotationProperty(p), val));
    }
  }

  // Axiom annotations via owl:Axiom reification
  for (const [s] of store.match(null, RDF + 'type', OWL + 'Axiom')) {
    const src = store.objects(s, OWL + 'annotatedSource')[0];
    const prop = store.objects(s, OWL + 'annotatedProperty')[0];
    const tgt = store.objects(s, OWL + 'annotatedTarget')[0];
    if (!src || !prop || tgt === undefined) continue;
    // Reconstruct the annotated axiom
    const ax = reconstructAxiom(ctx, src, prop, tgt);
    if (!ax) continue;
    // Collect the reified node's other properties as annotations on that axiom
    for (const [_, p, o] of store.match(s, null, null)) {
      if (p === RDF + 'type' || p === OWL + 'annotatedSource'
          || p === OWL + 'annotatedProperty' || p === OWL + 'annotatedTarget') continue;
      if (BUILTIN_ANNOTATION_PROPERTIES.has(p) || annProps.has(p)) {
        const val = literalFromEncoding(o) || IRI.create(o);
        ax.annotations.push({
          property: new OWLAnnotationProperty(p),
          value: val
        });
      }
    }
    ont.addAxiom(ax);
  }
}

function reconstructAxiom(ctx, src, prop, tgt) {
  const { store } = ctx;
  // SubClassOf
  if (prop === RDFS + 'subClassOf') {
    const sub = classExpression(ctx, src);
    const sup = classExpression(ctx, tgt);
    return sub && sup ? new AX.OWLSubClassOfAxiom(sub, sup) : null;
  }
  // ClassAssertion
  if (prop === RDF + 'type') {
    const ind = individualOf(ctx, src);
    const ce = classExpression(ctx, tgt);
    return ce ? new AX.OWLClassAssertionAxiom(ind, ce) : null;
  }
  // SubObjectPropertyOf
  if (prop === RDFS + 'subPropertyOf') {
    if (store.match(src, RDF + 'type', OWL + 'ObjectProperty').length
        || store.match(tgt, RDF + 'type', OWL + 'ObjectProperty').length) {
      return new AX.OWLSubObjectPropertyOfAxiom(new OWLObjectProperty(src), new OWLObjectProperty(tgt));
    }
    return new AX.OWLSubDataPropertyOfAxiom(new OWLDataProperty(src), new OWLDataProperty(tgt));
  }
  // ObjectPropertyAssertion
  if (store.match(prop, RDF + 'type', OWL + 'ObjectProperty').length) {
    return new AX.OWLObjectPropertyAssertionAxiom(
      individualOf(ctx, src), new OWLObjectProperty(prop), individualOf(ctx, tgt));
  }
  if (store.match(prop, RDF + 'type', OWL + 'DatatypeProperty').length) {
    const lit = literalFromEncoding(tgt);
    if (lit) {
      return new AX.OWLDataPropertyAssertionAxiom(
        individualOf(ctx, src), new OWLDataProperty(prop), lit);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Class expression reconstruction from blank nodes
// ---------------------------------------------------------------------------

function classExpression(ctx, node) {
  if (node === null || node === undefined) return null;
  if (typeof node !== 'string') return null;

  // Named class IRI
  if (!isAnon(node) && !isLiteralEncoding(node)) {
    return new OWLClass(node);
  }
  if (isLiteralEncoding(node)) return null;

  // Blank node — look up its defining shape
  const { store, ceCache } = ctx;
  if (ceCache.has(node)) return ceCache.get(node);

  const mark = (ce) => { ceCache.set(node, ce); return ce; };

  // owl:Restriction
  if (store.match(node, RDF + 'type', OWL + 'Restriction').length
      || store.objects(node, OWL + 'onProperty').length) {
    const onProp = store.objects(node, OWL + 'onProperty')[0];
    if (!onProp) return mark(null);
    const isObjProp = store.match(onProp, RDF + 'type', OWL + 'ObjectProperty').length > 0
      || store.match(onProp, RDF + 'type', OWL + 'DatatypeProperty').length === 0;
    const prop = isObjProp ? new OWLObjectProperty(onProp) : new OWLDataProperty(onProp);

    const some = store.objects(node, OWL + 'someValuesFrom')[0];
    if (some) {
      return mark(isObjProp
        ? new CE.OWLObjectSomeValuesFrom(prop, classExpression(ctx, some))
        : new CE.OWLDataSomeValuesFrom(prop, dataRange(ctx, some)));
    }
    const all = store.objects(node, OWL + 'allValuesFrom')[0];
    if (all) {
      return mark(isObjProp
        ? new CE.OWLObjectAllValuesFrom(prop, classExpression(ctx, all))
        : new CE.OWLDataAllValuesFrom(prop, dataRange(ctx, all)));
    }
    const hasV = store.objects(node, OWL + 'hasValue')[0];
    if (hasV !== undefined) {
      if (isObjProp) {
        return mark(new CE.OWLObjectHasValue(prop, individualOf(ctx, hasV)));
      }
      const lit = literalFromEncoding(hasV);
      if (lit) return mark(new CE.OWLDataHasValue(prop, lit));
    }
    const hasSelf = store.objects(node, OWL + 'hasSelf')[0];
    if (hasSelf && isObjProp) {
      const v = literalFromEncoding(hasSelf);
      if (v && (v.lexicalValue === 'true' || v.lexicalValue === '1')) {
        return mark(new CE.OWLObjectHasSelf(prop));
      }
    }
    // Cardinalities
    const minQ = store.objects(node, OWL + 'minQualifiedCardinality')[0];
    const maxQ = store.objects(node, OWL + 'maxQualifiedCardinality')[0];
    const exactQ = store.objects(node, OWL + 'qualifiedCardinality')[0];
    const min = store.objects(node, OWL + 'minCardinality')[0];
    const max = store.objects(node, OWL + 'maxCardinality')[0];
    const exact = store.objects(node, OWL + 'cardinality')[0];
    const onCls = store.objects(node, OWL + 'onClass')[0];
    const onDR = store.objects(node, OWL + 'onDataRange')[0];

    const numeric = (enc) => {
      const lit = literalFromEncoding(enc);
      return lit ? parseInt(lit.lexicalValue, 10) : null;
    };

    const mkCard = (qualOrPlain, nEnc, fillerNode, isDataSide) => {
      // qualOrPlain: 'min' | 'max' | 'exact'
      const n = numeric(nEnc);
      if (n === null) return null;
      const filler = fillerNode
        ? (isDataSide ? dataRange(ctx, fillerNode) : classExpression(ctx, fillerNode))
        : null;
      const T = CE.ClassExpressionType;
      const suffix = qualOrPlain === 'min' ? 'MIN_CARDINALITY'
        : qualOrPlain === 'max' ? 'MAX_CARDINALITY' : 'EXACT_CARDINALITY';
      const qualSuffix = filler ? 'QUALIFIED_CARDINALITY' : null;
      let type;
      if (isDataSide) {
        type = filler
          ? T['DATA_' + qualOrPlain.toUpperCase() + '_CARDINALITY']
          : T['DATA_' + suffix];
        return new CE.OWLDataCardinalityRestriction(type, n, prop, filler);
      }
      type = filler
        ? T['OBJECT_' + qualOrPlain.toUpperCase() + '_QUALIFIED_CARDINALITY']
        : T['OBJECT_' + suffix];
      return new CE.OWLObjectCardinalityRestriction(type, n, prop, filler);
    };

    if (minQ) return mark(isObjProp ? mkCard('min', minQ, onCls, false) : mkCard('min', minQ, onDR, true));
    if (maxQ) return mark(isObjProp ? mkCard('max', maxQ, onCls, false) : mkCard('max', maxQ, onDR, true));
    if (exactQ) return mark(isObjProp ? mkCard('exact', exactQ, onCls, false) : mkCard('exact', exactQ, onDR, true));
    if (min) return mark(isObjProp ? mkCard('min', min, null, false) : mkCard('min', min, null, true));
    if (max) return mark(isObjProp ? mkCard('max', max, null, false) : mkCard('max', max, null, true));
    if (exact) return mark(isObjProp ? mkCard('exact', exact, null, false) : mkCard('exact', exact, null, true));
    return mark(null);
  }

  // owl:intersectionOf
  const inter = store.objects(node, OWL + 'intersectionOf')[0];
  if (inter) {
    const ops = listNodes(store, inter).map(n => classExpression(ctx, n)).filter(Boolean);
    if (ops.length) return mark(new CE.OWLObjectIntersectionOf(ops));
  }
  // owl:unionOf
  const union = store.objects(node, OWL + 'unionOf')[0];
  if (union) {
    const ops = listNodes(store, union).map(n => classExpression(ctx, n)).filter(Boolean);
    if (ops.length) return mark(new CE.OWLObjectUnionOf(ops));
  }
  // owl:complementOf
  const compl = store.objects(node, OWL + 'complementOf')[0];
  if (compl) {
    const op = classExpression(ctx, compl);
    if (op) return mark(new CE.OWLObjectComplementOf(op));
  }
  // owl:oneOf (class)
  const oneOf = store.objects(node, OWL + 'oneOf')[0];
  if (oneOf) {
    const ops = listNodes(store, oneOf);
    // If elements are literals, this is a DataOneOf not class
    const anyLit = ops.some(o => isLiteralEncoding(o));
    if (!anyLit) {
      const inds = ops.map(n => individualOf(ctx, n));
      if (inds.length) return mark(new CE.OWLObjectOneOf(inds));
    }
  }
  return mark(null);
}

// ---------------------------------------------------------------------------
// Data range reconstruction from blank nodes
// ---------------------------------------------------------------------------

function dataRange(ctx, node) {
  if (node === null || node === undefined) return null;
  if (typeof node !== 'string') return null;
  if (!isAnon(node)) return new OWLDatatype(node);

  const { store, drCache } = ctx;
  if (drCache.has(node)) return drCache.get(node);
  const mark = (dr) => { drCache.set(node, dr); return dr; };

  // owl:onDatatype + owl:withRestrictions → DatatypeRestriction
  const onDt = store.objects(node, OWL + 'onDatatype')[0];
  if (onDt) {
    const dt = new OWLDatatype(onDt);
    const withR = store.objects(node, OWL + 'withRestrictions')[0];
    if (withR) {
      const frNodes = listNodes(store, withR);
      const frs = [];
      for (const fr of frNodes) {
        for (const [_, p, o] of store.match(fr, null, null)) {
          if (p === RDF + 'type') continue;
          const facetName = FACET_NAMES[p];
          const lit = literalFromEncoding(o);
          if (facetName && lit) frs.push({ facet: IRI.create(p), value: lit });
        }
      }
      if (frs.length) return mark(new CE.OWLDatatypeRestriction(dt, frs));
    }
    return mark(dt);
  }
  // Data intersectionOf / unionOf / complementOf / oneOf
  const inter = store.objects(node, OWL + 'intersectionOf')[0];
  if (inter) {
    const ops = listNodes(store, inter).map(n => dataRange(ctx, n)).filter(Boolean);
    if (ops.length) return mark(new CE.OWLDataIntersectionOf(ops));
  }
  const union = store.objects(node, OWL + 'unionOf')[0];
  if (union) {
    const ops = listNodes(store, union).map(n => dataRange(ctx, n)).filter(Boolean);
    if (ops.length) return mark(new CE.OWLDataUnionOf(ops));
  }
  const compl = store.objects(node, OWL + 'datatypeComplementOf')[0];
  if (compl) {
    const op = dataRange(ctx, compl);
    if (op) return mark(new CE.OWLDataComplementOf(op));
  }
  const oneOf = store.objects(node, OWL + 'oneOf')[0];
  if (oneOf) {
    const lits = listNodes(store, oneOf).map(literalFromEncoding).filter(Boolean);
    if (lits.length) return mark(new CE.OWLDataOneOf(lits));
  }
  return mark(null);
}

// ---------------------------------------------------------------------------
// Individual (named or anonymous)
// ---------------------------------------------------------------------------

function individualOf(ctx, node) {
  const { indCache } = ctx;
  if (indCache.has(node)) return indCache.get(node);
  const ind = isAnon(node)
    ? new OWLAnonymousIndividual(node)
    : new OWLNamedIndividual(node);
  indCache.set(node, ind);
  return ind;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAnon(node) {
  return typeof node === 'string' && node.startsWith('_:');
}

function isLiteralEncoding(node) {
  return typeof node === 'string' && node.startsWith('"');
}

function literalFromEncoding(encoded) {
  if (!isLiteralEncoding(encoded)) return null;
  try {
    const parsed = parseLiteral(encoded);
    if (!parsed) return null;
    const dt = parsed.dt ? new OWLDatatype(parsed.dt) : null;
    return new OWLLiteral(parsed.lex, dt, parsed.lang || null);
  } catch {
    return null;
  }
}

function listNodes(store, head) {
  if (!head) return [];
  return store.listElements(head);
}

module.exports = { triplesToOntology };
