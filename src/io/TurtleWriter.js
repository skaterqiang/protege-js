'use strict';

// ---------------------------------------------------------------------------
// io/TurtleWriter — serialize an OWLOntology to Turtle (W3C Mapping to RDF
// Graphs, forward direction). Round-trip capable with TurtleParser +
// RDFGraphToOntology.
// ---------------------------------------------------------------------------

const { ClassExpressionType: T } = require('../model/OWLClassExpression');
const { AxiomType: A } = require('../model/OWLAxiom');

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

function iri(x) {
  const s = x && x.getIRI ? x.getIRI().toString() : String(x);
  return `<${s}>`;
}

function lit(l) {
  const v = (l.lexicalValue !== undefined ? l.lexicalValue : l.getLiteral()).replace(/"/g, '\\"');
  const dt = l.datatype ? (l.datatype.getIRI ? l.datatype.getIRI().toString() : l.datatype) : null;
  const lang = l.lang || null;
  if (lang) return `"${v}"@${lang}`;
  if (dt && dt !== XSD + 'string') return `"${v}"^^<${dt}>`;
  return `"${v}"`;
}

class TurtleWriter {
  constructor(ont) {
    this.ont = ont;
    this.lines = [];
    this.bn = 0; // blank node counter
  }

  write() {
    const o = this.ont;
    const id = o.getOntologyID();
    const oIRI = id && id.ontologyIRI ? (id.ontologyIRI.toString ? id.ontologyIRI.toString() : String(id.ontologyIRI)) : null;

    this.lines.push('@prefix rdf:  <' + RDF + '> .');
    this.lines.push('@prefix rdfs: <' + RDFS + '> .');
    this.lines.push('@prefix owl:  <' + OWL + '> .');
    this.lines.push('@prefix xsd:  <' + XSD + '> .');
    this.lines.push('');

    // Ontology header
    if (oIRI) {
      const header = [`<${oIRI}> a owl:Ontology`];
      for (const imp of (o.imports || [])) {
        const s = imp && imp.toString ? imp.toString() : String(imp);
        header.push(`  ; owl:imports <${s}>`);
      }
      if (id.versionIRI) {
        header.push(`  ; owl:versionIRI <${id.versionIRI}>`);
      }
      for (const ann of (o.getOntologyAnnotations() || [])) {
        header.push(`  ; ${this._annProp(ann.property)} ${this._annVal(ann.value)}`);
      }
      this.lines.push(header.join('\n') + ' .');
      this.lines.push('');
    }

    // Axioms
    for (const ax of o.getAxioms()) {
      this._axiom(ax);
    }
    return this.lines.join('\n') + '\n';
  }

  _annProp(p) { return iri(p); }
  _annVal(v) {
    if (v && v.lexicalValue !== undefined) return lit(v);
    if (v && v.getIRI) return iri(v);
    return iri(v);
  }

  _emit(s, p, o) {
    this.lines.push(`${s} ${p} ${o} .`);
  }

  _bnode() { return `_:b${this.bn++}`; }

  // --- class expression → RDF node (returns node string, emits triples) -----

  _ce(e) {
    if (!e) return '<' + OWL + 'Thing>';
    if (e.getIRI) return iri(e); // named class
    switch (e.type) {
      case T.OBJECT_INTERSECTION_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Class');
        this._emit(b, 'owl:intersectionOf', this._rdfList(e.operands.map(x => this._ce(x))));
        return b;
      }
      case T.OBJECT_UNION_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Class');
        this._emit(b, 'owl:unionOf', this._rdfList(e.operands.map(x => this._ce(x))));
        return b;
      }
      case T.OBJECT_COMPLEMENT_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Class');
        this._emit(b, 'owl:complementOf', this._ce(e.operand));
        return b;
      }
      case T.OBJECT_ONE_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Class');
        this._emit(b, 'owl:oneOf', this._rdfList(e.operands.map(x => iri(x))));
        return b;
      }
      case T.OBJECT_SOME_VALUES_FROM: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:someValuesFrom', this._ce(e.filler));
        return b;
      }
      case T.OBJECT_ALL_VALUES_FROM: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:allValuesFrom', this._ce(e.filler));
        return b;
      }
      case T.OBJECT_HAS_VALUE: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:hasValue', iri(e.value));
        return b;
      }
      case T.OBJECT_HAS_SELF: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:hasSelf', '"true"^^xsd:boolean');
        return b;
      }
      case T.OBJECT_MIN_CARDINALITY: case T.OBJECT_MIN_QUALIFIED_CARDINALITY: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        const pred = e.type === T.OBJECT_MIN_QUALIFIED_CARDINALITY ? 'owl:minQualifiedCardinality' : 'owl:minCardinality';
        this._emit(b, pred, `"${e.cardinality}"^^xsd:nonNegativeInteger`);
        if (e.filler) this._emit(b, 'owl:onClass', this._ce(e.filler));
        return b;
      }
      case T.OBJECT_MAX_CARDINALITY: case T.OBJECT_MAX_QUALIFIED_CARDINALITY: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        const pred = e.type === T.OBJECT_MAX_QUALIFIED_CARDINALITY ? 'owl:maxQualifiedCardinality' : 'owl:maxCardinality';
        this._emit(b, pred, `"${e.cardinality}"^^xsd:nonNegativeInteger`);
        if (e.filler) this._emit(b, 'owl:onClass', this._ce(e.filler));
        return b;
      }
      case T.OBJECT_EXACT_CARDINALITY: case T.OBJECT_EXACT_QUALIFIED_CARDINALITY: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        const pred = e.type === T.OBJECT_EXACT_QUALIFIED_CARDINALITY ? 'owl:qualifiedCardinality' : 'owl:cardinality';
        this._emit(b, pred, `"${e.cardinality}"^^xsd:nonNegativeInteger`);
        if (e.filler) this._emit(b, 'owl:onClass', this._ce(e.filler));
        return b;
      }
      case T.DATA_SOME_VALUES_FROM: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:someValuesFrom', this._dr(e.filler));
        return b;
      }
      case T.DATA_ALL_VALUES_FROM: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:allValuesFrom', this._dr(e.filler));
        return b;
      }
      case T.DATA_HAS_VALUE: {
        const b = this._bnode();
        this._emit(b, 'a', 'owl:Restriction');
        this._emit(b, 'owl:onProperty', iri(e.property));
        this._emit(b, 'owl:hasValue', lit(e.value));
        return b;
      }
      default:
        return iri(e);
    }
  }

  _dr(dr) {
    if (!dr) return 'rdfs:Literal';
    if (dr.getIRI) return iri(dr);
    switch (dr.type) {
      case T.DATA_INTERSECTION_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'rdfs:Datatype');
        this._emit(b, 'owl:intersectionOf', this._rdfList(dr.operands.map(x => this._dr(x))));
        return b;
      }
      case T.DATA_UNION_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'rdfs:Datatype');
        this._emit(b, 'owl:unionOf', this._rdfList(dr.operands.map(x => this._dr(x))));
        return b;
      }
      case T.DATA_COMPLEMENT_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'rdfs:Datatype');
        this._emit(b, 'owl:datatypeComplementOf', this._dr(dr.operand));
        return b;
      }
      case T.DATA_ONE_OF: {
        const b = this._bnode();
        this._emit(b, 'a', 'rdfs:Datatype');
        this._emit(b, 'owl:oneOf', this._rdfList(dr.operands.map(x => lit(x))));
        return b;
      }
      case T.DATATYPE_RESTRICTION: {
        const b = this._bnode();
        this._emit(b, 'a', 'rdfs:Datatype');
        this._emit(b, 'owl:onDatatype', iri(dr.datatype));
        const facetNodes = dr.facetRestrictions.map(f => {
          const fb = this._bnode();
          this._emit(fb, iri(f.facet), lit(f.value));
          return fb;
        });
        this._emit(b, 'owl:withRestrictions', this._rdfList(facetNodes));
        return b;
      }
      default:
        return iri(dr);
    }
  }

  _rdfList(items) {
    if (items.length === 0) return 'rdf:nil';
    const head = this._bnode();
    let prev = head;
    for (let i = 0; i < items.length; i++) {
      this._emit(prev, 'rdf:first', items[i]);
      const next = (i === items.length - 1) ? 'rdf:nil' : this._bnode();
      this._emit(prev, 'rdf:rest', next);
      prev = next;
    }
    return head;
  }

  // --- axioms ----------------------------------------------------------------

  _axiom(ax) {
    switch (ax.getAxiomType()) {
      case A.DECLARATION: {
        const e = ax.entity;
        const typeMap = {
          OWLClass: 'owl:Class',
          OWLObjectProperty: 'owl:ObjectProperty',
          OWLDataProperty: 'owl:DatatypeProperty',
          OWLNamedIndividual: 'owl:NamedIndividual',
          OWLAnnotationProperty: 'owl:AnnotationProperty',
          OWLDatatype: 'rdfs:Datatype'
        };
        const t = typeMap[e.constructor.name] || 'owl:Thing';
        this._emit(iri(e), 'a', t);
        break;
      }
      case A.SUBCLASS_OF:
        this._emit(this._ce(ax.subClass), 'rdfs:subClassOf', this._ce(ax.superClass));
        break;
      case A.EQUIVALENT_CLASSES: {
        const ces = ax.classExpressions;
        for (let i = 0; i < ces.length - 1; i++) {
          this._emit(this._ce(ces[i]), 'owl:equivalentClass', this._ce(ces[i + 1]));
        }
        break;
      }
      case A.DISJOINT_CLASSES: {
        const ces = ax.classExpressions;
        for (let i = 0; i < ces.length; i++) {
          for (let j = i + 1; j < ces.length; j++) {
            this._emit(this._ce(ces[i]), 'owl:disjointWith', this._ce(ces[j]));
          }
        }
        break;
      }
      case A.DISJOINT_UNION: {
        this._emit(this._ce(ax.owlClass), 'owl:disjointUnionOf', this._rdfList(ax.classExpressions.map(x => this._ce(x))));
        break;
      }
      case A.SUB_OBJECT_PROPERTY_OF:
        this._emit(iri(ax.subProperty), 'rdfs:subPropertyOf', iri(ax.superProperty));
        break;
      case A.SUB_DATA_PROPERTY_OF:
        this._emit(iri(ax.subProperty), 'rdfs:subPropertyOf', iri(ax.superProperty));
        break;
      case A.SUB_PROPERTY_CHAIN_OF: {
        this._emit(iri(ax.superProperty), 'owl:propertyChainAxiom', this._rdfList(ax.propertyChain.map(p => iri(p))));
        break;
      }
      case A.INVERSE_OBJECT_PROPERTIES:
        this._emit(iri(ax.property1), 'owl:inverseOf', iri(ax.property2));
        break;
      case A.OBJECT_PROPERTY_DOMAIN:
        this._emit(iri(ax.property), 'rdfs:domain', this._ce(ax.domain));
        break;
      case A.OBJECT_PROPERTY_RANGE:
        this._emit(iri(ax.property), 'rdfs:range', this._ce(ax.range));
        break;
      case A.DATA_PROPERTY_DOMAIN:
        this._emit(iri(ax.property), 'rdfs:domain', this._ce(ax.domain));
        break;
      case A.DATA_PROPERTY_RANGE:
        this._emit(iri(ax.property), 'rdfs:range', this._dr(ax.range));
        break;
      case A.FUNCTIONAL_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:FunctionalProperty');
        break;
      case A.INVERSE_FUNCTIONAL_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:InverseFunctionalProperty');
        break;
      case A.TRANSITIVE_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:TransitiveProperty');
        break;
      case A.SYMMETRIC_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:SymmetricProperty');
        break;
      case A.ASYMMETRIC_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:AsymmetricProperty');
        break;
      case A.REFLEXIVE_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:ReflexiveProperty');
        break;
      case A.IRREFLEXIVE_OBJECT_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:IrreflexiveProperty');
        break;
      case A.FUNCTIONAL_DATA_PROPERTY:
        this._emit(iri(ax.property), 'a', 'owl:FunctionalProperty');
        break;
      case A.CLASS_ASSERTION:
        this._emit(iri(ax.individual), 'a', this._ce(ax.classExpression));
        break;
      case A.OBJECT_PROPERTY_ASSERTION:
        this._emit(iri(ax.subject), iri(ax.property), iri(ax.object));
        break;
      case A.DATA_PROPERTY_ASSERTION:
        this._emit(iri(ax.subject), iri(ax.property), lit(ax.literal));
        break;
      case A.SAME_INDIVIDUAL: {
        const inds = ax.individuals;
        for (let i = 0; i < inds.length - 1; i++) {
          this._emit(iri(inds[i]), 'owl:sameAs', iri(inds[i + 1]));
        }
        break;
      }
      case A.DIFFERENT_INDIVIDUALS: {
        const inds = ax.individuals;
        for (let i = 0; i < inds.length; i++) {
          for (let j = i + 1; j < inds.length; j++) {
            this._emit(iri(inds[i]), 'owl:differentFrom', iri(inds[j]));
          }
        }
        break;
      }
      case A.HAS_KEY:
        this._emit(this._ce(ax.classExpression), 'owl:hasKey', this._rdfList(ax.properties.map(p => iri(p))));
        break;
      case A.ANNOTATION_ASSERTION: {
        const v = ax.value && ax.value.lexicalValue !== undefined ? lit(ax.value) : iri(ax.value);
        this._emit(iri(ax.subject), iri(ax.property), v);
        break;
      }
      default:
        break;
    }
  }
}

/**
 * Serialize an OWLOntology to Turtle.
 * @param {OWLOntology} ont
 * @returns {string} Turtle text
 */
function writeTurtle(ont) {
  return new TurtleWriter(ont).write();
}

module.exports = { writeTurtle, TurtleWriter };
