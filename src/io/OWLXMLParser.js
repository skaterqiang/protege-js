'use strict';

// ---------------------------------------------------------------------------
// io/OWLXMLParser — parse OWL 2 XML Serialization (OWL/XML).
// Spec: https://www.w3.org/TR/owl2-xml-serialization/
//
//   <Ontology ontologyIRI="..." xmlns="http://www.w3.org/2002/07/owl#">
//     <Prefix name="ex" IRI="http://ex.org/"/>
//     <Declaration><Class IRI="..."/></Declaration>
//     <SubClassOf><Class IRI="A"/><Class IRI="B"/></SubClassOf>
//     <SubClassOf>
//       <Class IRI="A"/>
//       <ObjectSomeValuesFrom>
//         <ObjectProperty IRI="p"/>
//         <Class IRI="B"/>
//       </ObjectSomeValuesFrom>
//     </SubClassOf>
//   </Ontology>
// ---------------------------------------------------------------------------

const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual,
  OWLAnnotationProperty, OWLDatatype, OWLAnonymousIndividual
} = require('../model/OWLEntity');
const AX = require('../model/OWLAxiom');
const CE = require('../model/OWLClassExpression');
const { OWLLiteral } = require('../model/OWLLiteral');
const { IRI } = require('../model/IRI');

const XSD = 'http://www.w3.org/2001/XMLSchema#';

// --- Minimal XML tokenizer (no deps) -----------------------------------------

function tokenizeXML(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) {
        const end = s.indexOf('-->', i);
        i = end < 0 ? s.length : end + 3;
        continue;
      }
      if (s.startsWith('<?', i)) {
        const end = s.indexOf('?>', i);
        i = end < 0 ? s.length : end + 2;
        continue;
      }
      if (s.startsWith('<![CDATA[', i)) {
        const end = s.indexOf(']]>', i);
        const text = end < 0 ? s.slice(i + 9) : s.slice(i + 9, end);
        toks.push({ t: 'text', v: text });
        i = end < 0 ? s.length : end + 3;
        continue;
      }
      const end = s.indexOf('>', i);
      if (end < 0) break;
      const inner = s.slice(i + 1, end);
      if (inner.startsWith('/')) {
        toks.push({ t: 'close', v: inner.slice(1).trim() });
      } else if (inner.endsWith('/')) {
        toks.push(parseOpen(inner.slice(0, -1).trim(), true));
      } else {
        toks.push(parseOpen(inner, false));
      }
      i = end + 1;
    } else {
      const end = s.indexOf('<', i);
      const text = end < 0 ? s.slice(i) : s.slice(i, end);
      if (text.trim()) toks.push({ t: 'text', v: text });
      i = end < 0 ? s.length : end;
    }
  }
  return toks;
}

function parseOpen(inner, selfClose) {
  const sp = inner.search(/[\s]/);
  const name = sp < 0 ? inner : inner.slice(0, sp);
  const attrs = {};
  if (sp >= 0) {
    const re = /([\w:.-]+)\s*=\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(inner)) !== null) attrs[m[1]] = m[2];
  }
  return { t: 'open', v: name, attrs, selfClose };
}

// Build a DOM-ish tree
function buildTree(toks) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  for (const tok of toks) {
    const top = stack[stack.length - 1];
    if (tok.t === 'open') {
      const node = { name: tok.v, attrs: tok.attrs, children: [], text: '' };
      top.children.push(node);
      if (!tok.selfClose) stack.push(node);
    } else if (tok.t === 'close') {
      stack.pop();
    } else if (tok.t === 'text') {
      top.text += tok.v;
    }
  }
  return root;
}

// --- Parser -------------------------------------------------------------------

class OWLXMLParser {
  constructor(opts = {}) {
    this.prefixes = Object.assign({
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: XSD
    }, opts.prefixes || {});
    this.base = opts.base || 'http://example.org/';
  }

  resolveIRI(v) {
    if (!v) return null;
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('urn:')) return v;
    const idx = v.indexOf(':');
    if (idx > 0) {
      const ns = this.prefixes[v.slice(0, idx)];
      if (ns) return ns + v.slice(idx + 1);
    }
    return this.base + v;
  }

  iriOf(node) {
    return this.resolveIRI(node.attrs.IRI || node.attrs.abbreviatedIRI || node.attrs.nodeID);
  }

  parse(text, ontologyIRI = null) {
    const tree = buildTree(tokenizeXML(text));
    const ontoNode = tree.children.find(c => c.name === 'Ontology');
    if (!ontoNode) throw new Error('OWL/XML: no <Ontology> root element');

    // Collect Prefix declarations (also record on the ontology for fidelity)
    for (const ch of ontoNode.children) {
      if (ch.name === 'Prefix') {
        this.prefixes[ch.attrs.name] = ch.attrs.IRI;
      }
    }

    const oIRI = ontologyIRI || ontoNode.attrs.ontologyIRI || null;
    const ont = new OWLOntology(new OWLOntologyID(oIRI ? IRI.create(oIRI) : null));
    ont.format = 'OWL/XML';
    for (const [pfx, ns] of Object.entries(this.prefixes)) ont.addPrefix(pfx, ns);

    for (const ch of ontoNode.children) {
      if (ch.name === 'Prefix' || ch.name === 'Import' || ch.name === 'Annotation') {
        if (ch.name === 'Import') {
          ont.imports.push(ch.children.length ? ch.children[0].text.trim() : (ch.text || '').trim());
        }
        continue;
      }
      const ax = this._axiom(ch);
      if (ax) ont.addAxiom(ax);
    }
    return ont;
  }

  // --- axioms ---------------------------------------------------------------

  _axiom(node) {
    const kids = node.children;
    switch (node.name) {
      case 'Declaration': {
        const e = this._entity(kids[0]);
        return new AX.OWLDeclarationAxiom(e);
      }
      case 'SubClassOf':
        return new AX.OWLSubClassOfAxiom(this._ce(kids[0]), this._ce(kids[1]));
      case 'EquivalentClasses':
        return new AX.OWLEquivalentClassesAxiom(kids.map(k => this._ce(k)));
      case 'DisjointClasses':
        return new AX.OWLDisjointClassesAxiom(kids.map(k => this._ce(k)));
      case 'DisjointUnion':
        return new AX.OWLDisjointUnionAxiom(this._ce(kids[0]), kids.slice(1).map(k => this._ce(k)));
      case 'SubObjectPropertyOf':
        return new AX.OWLSubObjectPropertyOfAxiom(this._ope(kids[0]), this._ope(kids[1]));
      case 'EquivalentObjectProperties':
        return new AX.OWLEquivalentObjectPropertiesAxiom(kids.map(k => this._ope(k)));
      case 'DisjointObjectProperties':
        return new AX.OWLDisjointObjectPropertiesAxiom(kids.map(k => this._ope(k)));
      case 'InverseObjectProperties':
        return new AX.OWLInverseObjectPropertiesAxiom(this._ope(kids[0]), this._ope(kids[1]));
      case 'ObjectPropertyDomain':
        return new AX.OWLObjectPropertyDomainAxiom(this._ope(kids[0]), this._ce(kids[1]));
      case 'ObjectPropertyRange':
        return new AX.OWLObjectPropertyRangeAxiom(this._ope(kids[0]), this._ce(kids[1]));
      case 'FunctionalObjectProperty':
        return new AX.OWLFunctionalObjectPropertyAxiom(this._ope(kids[0]));
      case 'InverseFunctionalObjectProperty':
        return new AX.OWLInverseFunctionalObjectPropertyAxiom(this._ope(kids[0]));
      case 'ReflexiveObjectProperty':
        return new AX.OWLReflexiveObjectPropertyAxiom(this._ope(kids[0]));
      case 'IrreflexiveObjectProperty':
        return new AX.OWLIrreflexiveObjectPropertyAxiom(this._ope(kids[0]));
      case 'SymmetricObjectProperty':
        return new AX.OWLSymmetricObjectPropertyAxiom(this._ope(kids[0]));
      case 'AsymmetricObjectProperty':
        return new AX.OWLAsymmetricObjectPropertyAxiom(this._ope(kids[0]));
      case 'TransitiveObjectProperty':
        return new AX.OWLTransitiveObjectPropertyAxiom(this._ope(kids[0]));
      case 'SubDataPropertyOf':
        return new AX.OWLSubDataPropertyOfAxiom(this._dpe(kids[0]), this._dpe(kids[1]));
      case 'EquivalentDataProperties':
        return new AX.OWLEquivalentDataPropertiesAxiom(kids.map(k => this._dpe(k)));
      case 'DisjointDataProperties':
        return new AX.OWLDisjointDataPropertiesAxiom(kids.map(k => this._dpe(k)));
      case 'DataPropertyDomain':
        return new AX.OWLDataPropertyDomainAxiom(this._dpe(kids[0]), this._ce(kids[1]));
      case 'DataPropertyRange':
        return new AX.OWLDataPropertyRangeAxiom(this._dpe(kids[0]), this._dr(kids[1]));
      case 'FunctionalDataProperty':
        return new AX.OWLFunctionalDataPropertyAxiom(this._dpe(kids[0]));
      case 'ClassAssertion':
        return new AX.OWLClassAssertionAxiom(this._ind(kids[1]), this._ce(kids[0]));
      case 'ObjectPropertyAssertion':
        return new AX.OWLObjectPropertyAssertionAxiom(this._ind(kids[1]), this._ope(kids[0]), this._ind(kids[2]));
      case 'NegativeObjectPropertyAssertion':
        return new AX.OWLNegativeObjectPropertyAssertionAxiom(this._ind(kids[1]), this._ope(kids[0]), this._ind(kids[2]));
      case 'DataPropertyAssertion':
        return new AX.OWLDataPropertyAssertionAxiom(this._ind(kids[1]), this._dpe(kids[0]), this._lit(kids[2]));
      case 'NegativeDataPropertyAssertion':
        return new AX.OWLNegativeDataPropertyAssertionAxiom(this._ind(kids[1]), this._dpe(kids[0]), this._lit(kids[2]));
      case 'SameIndividual':
        return new AX.OWLSameIndividualAxiom(kids.map(k => this._ind(k)));
      case 'DifferentIndividuals':
        return new AX.OWLDifferentIndividualsAxiom(kids.map(k => this._ind(k)));
      case 'HasKey':
        return new AX.OWLHasKeyAxiom(this._ce(kids[0]), kids.slice(1).map(k => k.name === 'DataProperty' ? this._dpe(k) : this._ope(k)));
      case 'SubAnnotationPropertyOf':
        return new AX.OWLSubAnnotationPropertyOfAxiom(
          new OWLAnnotationProperty(this.iriOf(kids[0])), new OWLAnnotationProperty(this.iriOf(kids[1])));
      case 'AnnotationAssertion':
        return new AX.OWLAnnotationAssertionAxiom(
          new OWLAnnotationProperty(this.iriOf(kids[0])),
          this.iriOf(kids[1]),
          kids[2].name === 'Literal' ? this._lit(kids[2]) : this.iriOf(kids[2]));
      default:
        return null;
    }
  }

  _entity(node) {
    const iri = this.iriOf(node);
    switch (node.name) {
      case 'Class': return new OWLClass(iri);
      case 'ObjectProperty': return new OWLObjectProperty(iri);
      case 'DataProperty': return new OWLDataProperty(iri);
      case 'NamedIndividual': return new OWLNamedIndividual(iri);
      case 'AnnotationProperty': return new OWLAnnotationProperty(iri);
      case 'Datatype': return new OWLDatatype(iri);
      default: return new OWLClass(iri);
    }
  }

  // --- class expressions ------------------------------------------------------

  _ce(node) {
    const kids = node.children;
    switch (node.name) {
      case 'Class': return new OWLClass(this.iriOf(node));
      case 'ObjectIntersectionOf': return new CE.OWLObjectIntersectionOf(kids.map(k => this._ce(k)));
      case 'ObjectUnionOf': return new CE.OWLObjectUnionOf(kids.map(k => this._ce(k)));
      case 'ObjectComplementOf': return new CE.OWLObjectComplementOf(this._ce(kids[0]));
      case 'ObjectOneOf': return new CE.OWLObjectOneOf(kids.map(k => this._ind(k)));
      case 'ObjectSomeValuesFrom': return new CE.OWLObjectSomeValuesFrom(this._ope(kids[0]), this._ce(kids[1]));
      case 'ObjectAllValuesFrom': return new CE.OWLObjectAllValuesFrom(this._ope(kids[0]), this._ce(kids[1]));
      case 'ObjectHasValue': return new CE.OWLObjectHasValue(this._ope(kids[0]), this._ind(kids[1]));
      case 'ObjectHasSelf': return new CE.OWLObjectHasSelf(this._ope(kids[0]));
      case 'ObjectMinCardinality': {
        const n = parseInt(node.attrs.cardinality, 10);
        const T = CE.ClassExpressionType;
        const filler = kids[1] ? this._ce(kids[1]) : null;
        return new CE.OWLObjectCardinalityRestriction(
          filler ? T.OBJECT_MIN_QUALIFIED_CARDINALITY : T.OBJECT_MIN_CARDINALITY,
          n, this._ope(kids[0]), filler);
      }
      case 'ObjectMaxCardinality': {
        const n = parseInt(node.attrs.cardinality, 10);
        const T = CE.ClassExpressionType;
        const filler = kids[1] ? this._ce(kids[1]) : null;
        return new CE.OWLObjectCardinalityRestriction(
          filler ? T.OBJECT_MAX_QUALIFIED_CARDINALITY : T.OBJECT_MAX_CARDINALITY,
          n, this._ope(kids[0]), filler);
      }
      case 'ObjectExactCardinality': {
        const n = parseInt(node.attrs.cardinality, 10);
        const T = CE.ClassExpressionType;
        const filler = kids[1] ? this._ce(kids[1]) : null;
        return new CE.OWLObjectCardinalityRestriction(
          filler ? T.OBJECT_EXACT_QUALIFIED_CARDINALITY : T.OBJECT_EXACT_CARDINALITY,
          n, this._ope(kids[0]), filler);
      }
      case 'DataSomeValuesFrom': return new CE.OWLDataSomeValuesFrom(this._dpe(kids[0]), this._dr(kids[1]));
      case 'DataAllValuesFrom': return new CE.OWLDataAllValuesFrom(this._dpe(kids[0]), this._dr(kids[1]));
      case 'DataHasValue': return new CE.OWLDataHasValue(this._dpe(kids[0]), this._lit(kids[1]));
      default:
        // Fallback: treat as class
        return new OWLClass(this.iriOf(node));
    }
  }

  _ope(node) {
    if (node.name === 'InverseObjectProperty') {
      // No OWLObjectInverseOf model class yet — unwrap to the base property.
      return this._ope(node.children[0]);
    }
    return new OWLObjectProperty(this.iriOf(node));
  }

  _dpe(node) {
    return new OWLDataProperty(this.iriOf(node));
  }

  _dr(node) {
    switch (node.name) {
      case 'Datatype': return new OWLDatatype(this.iriOf(node));
      case 'DatatypeRestriction': {
        const dt = new OWLDatatype(this.iriOf(node.children[0]));
        const facets = node.children.slice(1).map(f => ({
          facet: IRI.create(this.iriOf(f)),
          value: this._lit(f.children[0])
        }));
        return new CE.OWLDatatypeRestriction(dt, facets);
      }
      case 'DataIntersectionOf': return new CE.OWLDataIntersectionOf(node.children.map(k => this._dr(k)));
      case 'DataUnionOf': return new CE.OWLDataUnionOf(node.children.map(k => this._dr(k)));
      case 'DataComplementOf': return new CE.OWLDataComplementOf(this._dr(node.children[0]));
      case 'DataOneOf': return new CE.OWLDataOneOf(node.children.map(k => this._lit(k)));
      default: return new OWLDatatype(this.iriOf(node));
    }
  }

  _ind(node) {
    if (node.name === 'AnonymousIndividual') {
      return new OWLAnonymousIndividual(node.attrs.nodeID || ('_:' + Math.random().toString(36).slice(2)));
    }
    return new OWLNamedIndividual(this.iriOf(node));
  }

  _lit(node) {
    const dt = node.attrs.datatypeIRI ? new OWLDatatype(this.resolveIRI(node.attrs.datatypeIRI)) : null;
    const lang = node.attrs['xml:lang'] || null;
    return new OWLLiteral(node.text.trim(), dt, lang);
  }
}

module.exports = { OWLXMLParser };
