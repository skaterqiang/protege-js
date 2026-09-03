'use strict';

// ---------------------------------------------------------------------------
// io/RDFXMLWriter — serialize an OWLOntology to RDF/XML.
// Compact writer covering the common axiom shapes; counterpart to
// RDFXMLParser. Produces rdf:RDF with owl:Class / owl:ObjectProperty
// elements and rdf:Description-based assertions.
// ---------------------------------------------------------------------------

const { ClassExpressionType: T } = require('../model/OWLClassExpression');
const { AxiomType: A } = require('../model/OWLAxiom');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function iriOf(x) {
  return x && x.getIRI ? x.getIRI().toString() : String(x);
}

function litXML(l) {
  const v = esc(l.lexicalValue !== undefined ? l.lexicalValue : l.getLiteral());
  const dt = l.datatype ? iriOf(l.datatype) : null;
  const lang = l.lang || null;
  if (lang) return ` xml:lang="${esc(lang)}">${v}`;
  if (dt && dt !== XSD + 'string') return ` rdf:datatype="${esc(dt)}">${v}`;
  return `>${v}`;
}

class RDFXMLWriter {
  constructor(ont) {
    this.ont = ont;
    this.out = [];
    this.bn = 0;
  }

  write() {
    const o = this.ont;
    const id = o.getOntologyID();
    const oIRI = id && id.ontologyIRI ? iriOf(id.ontologyIRI) : null;

    this.out.push('<?xml version="1.0"?>');
    this.out.push(`<rdf:RDF xmlns:rdf="${RDF}"`);
    this.out.push(`     xmlns:rdfs="${RDFS}"`);
    this.out.push(`     xmlns:owl="${OWL}"`);
    this.out.push(`     xmlns:xsd="${XSD}"${oIRI ? `\n     xml:base="${esc(oIRI)}"` : ''}>`);

    if (oIRI) {
      this.out.push(`  <owl:Ontology rdf:about="${esc(oIRI)}">`);
      for (const imp of (o.imports || [])) {
        this.out.push(`    <owl:imports rdf:resource="${esc(iriOf(imp))}"/>`);
      }
      this.out.push(`  </owl:Ontology>`);
    }

    for (const ax of o.getAxioms()) {
      this._axiom(ax);
    }

    this.out.push('</rdf:RDF>');
    return this.out.join('\n') + '\n';
  }

  _bnode() { return 'b' + (this.bn++); }

  // class expression → nested XML (returns string to embed)
  _ce(e, indent) {
    const pad = ' '.repeat(indent);
    if (!e) return '';
    if (e.getIRI) return `<rdf:Description rdf:about="${esc(iriOf(e))}"/>`;
    switch (e.type) {
      case T.OBJECT_SOME_VALUES_FROM:
        return `<owl:Restriction><owl:onProperty rdf:resource="${esc(iriOf(e.property))}"/><owl:someValuesFrom rdf:resource="${esc(iriOf(e.filler))}"/></owl:Restriction>`;
      case T.OBJECT_ALL_VALUES_FROM:
        return `<owl:Restriction><owl:onProperty rdf:resource="${esc(iriOf(e.property))}"/><owl:allValuesFrom rdf:resource="${esc(iriOf(e.filler))}"/></owl:Restriction>`;
      case T.OBJECT_HAS_VALUE:
        return `<owl:Restriction><owl:onProperty rdf:resource="${esc(iriOf(e.property))}"/><owl:hasValue rdf:resource="${esc(iriOf(e.value))}"/></owl:Restriction>`;
      case T.OBJECT_INTERSECTION_OF: {
        const items = e.operands.map(x => `<rdf:Description rdf:about="${esc(iriOf(x))}"/>`).join('');
        return `<owl:Class><owl:intersectionOf rdf:parseType="Collection">${items}</owl:intersectionOf></owl:Class>`;
      }
      default:
        return `<rdf:Description rdf:about="${esc(iriOf(e))}"/>`;
    }
  }

  _axiom(ax) {
    switch (ax.getAxiomType()) {
      case A.DECLARATION: {
        const e = ax.entity;
        const tagMap = {
          OWLClass: 'owl:Class',
          OWLObjectProperty: 'owl:ObjectProperty',
          OWLDataProperty: 'owl:DatatypeProperty',
          OWLNamedIndividual: 'owl:NamedIndividual',
          OWLAnnotationProperty: 'owl:AnnotationProperty',
          OWLDatatype: 'rdfs:Datatype'
        };
        const tag = tagMap[e.constructor.name];
        if (tag) this.out.push(`  <${tag} rdf:about="${esc(iriOf(e))}"/>`);
        break;
      }
      case A.SUBCLASS_OF: {
        const sub = ax.subClass, sup = ax.superClass;
        if (sub.getIRI) {
          if (sup.getIRI) {
            this.out.push(`  <owl:Class rdf:about="${esc(iriOf(sub))}"><rdfs:subClassOf rdf:resource="${esc(iriOf(sup))}"/></owl:Class>`);
          } else {
            this.out.push(`  <owl:Class rdf:about="${esc(iriOf(sub))}"><rdfs:subClassOf>${this._ce(sup, 4)}</rdfs:subClassOf></owl:Class>`);
          }
        }
        break;
      }
      case A.EQUIVALENT_CLASSES: {
        const ces = ax.classExpressions;
        for (let i = 0; i < ces.length - 1; i++) {
          if (ces[i].getIRI && ces[i + 1].getIRI) {
            this.out.push(`  <owl:Class rdf:about="${esc(iriOf(ces[i]))}"><owl:equivalentClass rdf:resource="${esc(iriOf(ces[i + 1]))}"/></owl:Class>`);
          }
        }
        break;
      }
      case A.DISJOINT_CLASSES: {
        const ces = ax.classExpressions;
        for (let i = 0; i < ces.length; i++) {
          for (let j = i + 1; j < ces.length; j++) {
            if (ces[i].getIRI && ces[j].getIRI) {
              this.out.push(`  <owl:Class rdf:about="${esc(iriOf(ces[i]))}"><owl:disjointWith rdf:resource="${esc(iriOf(ces[j]))}"/></owl:Class>`);
            }
          }
        }
        break;
      }
      case A.OBJECT_PROPERTY_DOMAIN:
        if (ax.domain.getIRI) this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.property))}"><rdfs:domain rdf:resource="${esc(iriOf(ax.domain))}"/></owl:ObjectProperty>`);
        break;
      case A.OBJECT_PROPERTY_RANGE:
        if (ax.range.getIRI) this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.property))}"><rdfs:range rdf:resource="${esc(iriOf(ax.range))}"/></owl:ObjectProperty>`);
        break;
      case A.SUB_OBJECT_PROPERTY_OF:
        this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.subProperty))}"><rdfs:subPropertyOf rdf:resource="${esc(iriOf(ax.superProperty))}"/></owl:ObjectProperty>`);
        break;
      case A.INVERSE_OBJECT_PROPERTIES:
        this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.property1))}"><owl:inverseOf rdf:resource="${esc(iriOf(ax.property2))}"/></owl:ObjectProperty>`);
        break;
      case A.FUNCTIONAL_OBJECT_PROPERTY:
        this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.property))}"><rdf:type rdf:resource="${OWL}FunctionalProperty"/></owl:ObjectProperty>`);
        break;
      case A.TRANSITIVE_OBJECT_PROPERTY:
        this.out.push(`  <owl:ObjectProperty rdf:about="${esc(iriOf(ax.property))}"><rdf:type rdf:resource="${OWL}TransitiveProperty"/></owl:ObjectProperty>`);
        break;
      case A.CLASS_ASSERTION:
        this.out.push(`  <owl:NamedIndividual rdf:about="${esc(iriOf(ax.individual))}"><rdf:type rdf:resource="${esc(iriOf(ax.classExpression))}"/></owl:NamedIndividual>`);
        break;
      case A.OBJECT_PROPERTY_ASSERTION: {
        // Use rdf:Description with property element
        this.out.push(`  <rdf:Description rdf:about="${esc(iriOf(ax.subject))}"><ns0:${localName(iriOf(ax.property))} xmlns:ns0="${namespaceOf(iriOf(ax.property))}" rdf:resource="${esc(iriOf(ax.object))}"/></rdf:Description>`);
        break;
      }
      case A.SAME_INDIVIDUAL: {
        const inds = ax.individuals;
        for (let i = 0; i < inds.length - 1; i++) {
          this.out.push(`  <rdf:Description rdf:about="${esc(iriOf(inds[i]))}"><owl:sameAs rdf:resource="${esc(iriOf(inds[i + 1]))}"/></rdf:Description>`);
        }
        break;
      }
      default:
        break;
    }
  }
}

function localName(iri) {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i >= 0 ? iri.slice(i + 1) : iri;
}
function namespaceOf(iri) {
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i >= 0 ? iri.slice(0, i + 1) : iri;
}

/**
 * Serialize an OWLOntology to RDF/XML.
 * @param {OWLOntology} ont
 * @returns {string}
 */
function writeRDFXML(ont) {
  return new RDFXMLWriter(ont).write();
}

module.exports = { writeRDFXML, RDFXMLWriter };
