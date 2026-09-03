'use strict';

// ---------------------------------------------------------------------------
// FunctionalSyntaxParser — parses the OWL 2 Functional-Style syntax.
// Handles the full axiom set: Declaration, SubClassOf, EquivalentClasses,
// DisjointClasses, DisjointUnion, SubObjectPropertyOf, SubObjectPropertyChain,
// EquivalentObjectProperties, DisjointObjectProperties, ObjectPropertyDomain,
// ObjectPropertyRange, InverseObjectProperties, Functional/InverseFunctional/
// Reflexive/Irreflexive/Symmetric/Asymmetric/Transitive ObjectProperty,
// SubDataPropertyOf, EquivalentDataProperties, DisjointDataProperties,
// DataPropertyDomain, DataPropertyRange, FunctionalDataProperty,
// DatatypeDefinition, HasKey, SameIndividual, DifferentIndividuals,
// ClassAssertion, ObjectPropertyAssertion, NegativeObjectPropertyAssertion,
// DataPropertyAssertion, NegativeDataPropertyAssertion,
// AnnotationAssertion, SubAnnotationPropertyOf, AnnotationPropertyDomain/Range,
// plus all class expressions (Object*/Data*) and data ranges.
// ---------------------------------------------------------------------------

const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const { OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual, OWLDatatype, OWLAnnotationProperty } = require('../model/OWLEntity');
const { IRI } = require('../model/IRI');
const { OWLLiteral } = require('../model/OWLLiteral');
const CE = require('../model/OWLClassExpression');
const AX = require('../model/OWLAxiom');

const KNOWN_PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#'
};

class FunctionalSyntaxParser {
  constructor() {
    this.prefixes = { ...KNOWN_PREFIXES };
  }

  /** Parse functional-syntax text, return OWLOntology. */
  parse(text, ontologyIRI = 'http://example.org/ontology') {
    const tokens = this._tokenize(text);
    this._pos = 0;
    this._tokens = tokens;
    const onto = new OWLOntology(new OWLOntologyID(IRI.create(ontologyIRI)));
    // Optionally: handle Prefix(...) declarations and Ontology(...) wrapper.
    while (this._pos < tokens.length) {
      this._statement(onto);
    }
    return onto;
  }

  _tokenize(text) {
    const out = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '#') { while (i < n && text[i] !== '\n') i++; continue; }
      if (ch === '(') { out.push({ t: '(' }); i++; continue; }
      if (ch === ')') { out.push({ t: ')' }); i++; continue; }
      if (ch === '"') {
        let j = i + 1;
        let v = '';
        while (j < n && text[j] !== '"') {
          if (text[j] === '\\' && j + 1 < n) { v += text[j + 1]; j += 2; }
          else { v += text[j]; j++; }
        }
        out.push({ t: 'STRING', v });
        i = j + 1;
        continue;
      }
      if (ch === '<') {
        const j = text.indexOf('>', i);
        out.push({ t: 'IRI', v: text.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      if (ch === '@') {
        let j = i + 1;
        while (j < n && /[A-Za-z-]/.test(text[j])) j++;
        out.push({ t: 'LANG', v: text.slice(i + 1, j) });
        i = j;
        continue;
      }
      if (ch === '^' && text[i + 1] === '^') { out.push({ t: '^^' }); i += 2; continue; }
      if (ch === '=') { out.push({ t: '=' }); i++; continue; }
      // number
      if (/[0-9+-]/.test(ch)) {
        let j = i + 1;
        while (j < n && /[0-9.eE+-]/.test(text[j])) j++;
        out.push({ t: 'NUMBER', v: text.slice(i, j) });
        i = j;
        continue;
      }
      // name (identifier or prefixed)
      let j = i;
      while (j < n && /[A-Za-z0-9_:\-.]/.test(text[j])) j++;
      if (j > i) { out.push({ t: 'NAME', v: text.slice(i, j) }); i = j; continue; }
      throw new Error('Unexpected char: ' + ch + ' at ' + i);
    }
    return out;
  }

  _peek() { return this._tokens[this._pos]; }
  _next() { return this._tokens[this._pos++]; }
  _expect(t) {
    const tok = this._next();
    if (!tok || tok.t !== t) throw new Error(`Expected ${t}, got ${tok && tok.t}`);
    return tok;
  }

  _iriFrom(tok) {
    if (tok.t === 'IRI') return IRI.create(tok.v);
    if (tok.t === 'NAME') {
      const s = tok.v;
      const idx = s.indexOf(':');
      if (idx > 0) {
        const prefix = s.slice(0, idx);
        const local = s.slice(idx + 1);
        if (this.prefixes[prefix]) return IRI.create(this.prefixes[prefix] + local);
      }
      return IRI.create(s);
    }
    throw new Error('Expected IRI, got ' + JSON.stringify(tok));
  }

  _statement(onto) {
    const tok = this._peek();
    if (tok.t === 'NAME' && tok.v === 'Prefix') {
      this._next(); this._expect('(');
      const pn = this._expect('NAME');
      this._expect('='); // may not tokenize — handle below
      const iriTok = this._expect('IRI');
      const pfx = pn.v.replace(/:$/, '');
      this.prefixes[pfx] = iriTok.v;
      if (onto && onto.addPrefix) onto.addPrefix(pfx, iriTok.v); // prefix fidelity (L5)
      this._expect(')');
      return;
    }
    if (tok.t === 'NAME' && tok.v === 'Ontology') {
      // Ontology( [iri] [versionIRI] Import(...)* Annotation(...)* axiom* )
      this._next(); this._expect('(');
      // Optional ontology IRI
      if (this._peek().t === 'IRI' || (this._peek().t === 'NAME' && this._tokens[this._pos + 1] && this._tokens[this._pos + 1].t !== '(')) {
        onto.id.ontologyIRI = this._iriFrom(this._next());
        // Optional version IRI
        if (this._peek() && this._peek().t === 'IRI') {
          onto.id.versionIRI = this._iriFrom(this._next());
        }
      }
      while (this._peek() && this._peek().t !== ')') {
        const t = this._peek();
        if (t.t === 'NAME' && t.v === 'Import') {
          this._next(); this._expect('(');
          onto.imports.push(this._iriFrom(this._next()));
          this._expect(')');
          continue;
        }
        if (t.t === 'NAME' && t.v === 'Annotation') {
          // Ontology-level annotation
          this._next(); this._expect('(');
          const propTok = this._next();
          const prop = this._iriFrom(propTok);
          const valTok = this._next();
          let value;
          if (valTok.t === 'STRING') {
            const { OWLLiteral } = require('../model/OWLLiteral');
            value = new OWLLiteral(valTok.v);
            if (this._peek() && this._peek().t === '^^') {
              this._next();
              const { OWLDatatype } = require('../model/OWLEntity');
              value.datatype = new OWLDatatype(this._iriFrom(this._next()));
            }
          } else {
            value = this._iriFrom(valTok);
          }
          const { OWLAnnotationAssertionAxiom } = require('../model/OWLAxiom');
          const { OWLAnnotationProperty } = require('../model/OWLEntity');
          onto.addOntologyAnnotation(new OWLAnnotationAssertionAxiom(
            onto.id.ontologyIRI, new OWLAnnotationProperty(prop), value));
          this._expect(')');
          continue;
        }
        this._axiom(onto);
      }
      this._expect(')');
      return;
    }
    this._axiom(onto);
  }

  _axiom(onto) {
    const name = this._expect('NAME').v;
    this._expect('(');
    const args = [];
    while (this._peek() && this._peek().t !== ')') {
      args.push(this._term());
    }
    this._expect(')');
    this._dispatch(onto, name, args);
  }

  _term() {
    const tok = this._peek();
    if (tok.t === '(') {
      this._next();
      const head = this._expect('NAME').v;
      const items = [];
      while (this._peek() && this._peek().t !== ')') items.push(this._term());
      this._expect(')');
      return { kind: 'expr', name: head, items };
    }
    // NAME followed by '(' — e.g. Class(ex:Person) inside Declaration
    if (tok.t === 'NAME' && this._tokens[this._pos + 1] && this._tokens[this._pos + 1].t === '(') {
      const head = this._next().v;
      this._expect('(');
      const items = [];
      while (this._peek() && this._peek().t !== ')') items.push(this._term());
      this._expect(')');
      return { kind: 'expr', name: head, items };
    }
    if (tok.t === 'STRING') {
      this._next();
      let lit = { lex: tok.v, dt: null, lang: null };
      const next = this._peek();
      if (next && next.t === '^^') {
        this._next();
        const dtTok = this._next();
        lit.dt = this._iriFrom(dtTok).toString();
      } else if (next && next.t === 'LANG') {
        this._next();
        lit.lang = next.v;
      }
      return { kind: 'literal', value: lit };
    }
    if (tok.t === 'NUMBER') {
      this._next();
      return { kind: 'number', value: tok.v };
    }
    // IRI or name
    return { kind: 'iri', value: this._iriFrom(this._next()) };
  }

  _dispatch(onto, name, args) {
    const P = (tok) => {
      if (tok.kind === 'iri') {
        const iri = tok.value;
        // heuristic: ObjectProperty if name in prop position; we let caller wrap.
        return iri;
      }
      return tok;
    };

    const entity = (tok, kind) => {
      const iri = tok.kind === 'iri' ? tok.value : (() => { throw new Error('expected iri'); })();
      switch (kind) {
        case 'class': return new OWLClass(iri);
        case 'op': return new OWLObjectProperty(iri);
        case 'dp': return new OWLDataProperty(iri);
        case 'ni': return new OWLNamedIndividual(iri);
        case 'dt': return new OWLDatatype(iri);
        case 'ap': return new OWLAnnotationProperty(iri);
        default: throw new Error('unknown entity kind ' + kind);
      }
    };

    const literal = (tok) => {
      if (tok.kind !== 'literal' && tok.kind !== 'number') throw new Error('expected literal');
      if (tok.kind === 'number') {
        const v = tok.value;
        const dt = /^-?\d+$/.test(v) ? 'http://www.w3.org/2001/XMLSchema#integer'
          : /^-?\d+\.\d+$/.test(v) ? 'http://www.w3.org/2001/XMLSchema#decimal'
          : 'http://www.w3.org/2001/XMLSchema#double';
        return new OWLLiteral(v, new OWLDatatype(IRI.create(dt)));
      }
      return new OWLLiteral(tok.value.lex, tok.value.dt ? new OWLDatatype(IRI.create(tok.value.dt)) : null, tok.value.lang);
    };

    const classExpr = (tok) => {
      if (tok.kind === 'iri') return new OWLClass(tok.value);
      const n = tok.name;
      const it = tok.items;
      switch (n) {
        case 'ObjectIntersectionOf': return new CE.OWLObjectIntersectionOf(it.map(classExpr));
        case 'ObjectUnionOf': return new CE.OWLObjectUnionOf(it.map(classExpr));
        case 'ObjectComplementOf': return new CE.OWLObjectComplementOf(classExpr(it[0]));
        case 'ObjectSomeValuesFrom': return new CE.OWLObjectSomeValuesFrom(entity(it[0], 'op'), classExpr(it[1]));
        case 'ObjectAllValuesFrom': return new CE.OWLObjectAllValuesFrom(entity(it[0], 'op'), classExpr(it[1]));
        case 'ObjectHasValue': return new CE.OWLObjectHasValue(entity(it[0], 'op'), entity(it[1], 'ni'));
        case 'ObjectOneOf': return new CE.OWLObjectOneOf(it.map(i => entity(i, 'ni')));
        case 'ObjectHasSelf': return new CE.OWLObjectHasSelf(entity(it[0], 'op'));
        case 'ObjectMinCardinality': return new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_MIN_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'op'), it[2] ? classExpr(it[2]) : null);
        case 'ObjectMaxCardinality': return new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_MAX_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'op'), it[2] ? classExpr(it[2]) : null);
        case 'ObjectExactCardinality': return new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_EXACT_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'op'), it[2] ? classExpr(it[2]) : null);
        case 'DataSomeValuesFrom': return new CE.OWLDataSomeValuesFrom(entity(it[0], 'dp'), dataRange(it[1]));
        case 'DataAllValuesFrom': return new CE.OWLDataAllValuesFrom(entity(it[0], 'dp'), dataRange(it[1]));
        case 'DataHasValue': return new CE.OWLDataHasValue(entity(it[0], 'dp'), literal(it[1]));
        case 'DataMinCardinality': return new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_MIN_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'dp'), it[2] ? dataRange(it[2]) : null);
        case 'DataMaxCardinality': return new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_MAX_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'dp'), it[2] ? dataRange(it[2]) : null);
        case 'DataExactCardinality': return new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_EXACT_CARDINALITY, parseInt(it[0].value, 10), entity(it[1], 'dp'), it[2] ? dataRange(it[2]) : null);
        default: throw new Error('Unknown class expression: ' + n);
      }
    };

    const dataRange = (tok) => {
      if (tok.kind === 'iri') return new OWLDatatype(tok.value);
      const n = tok.name;
      const it = tok.items;
      switch (n) {
        case 'DataIntersectionOf': return new CE.OWLDataIntersectionOf(it.map(dataRange));
        case 'DataUnionOf': return new CE.OWLDataUnionOf(it.map(dataRange));
        case 'DataComplementOf': return new CE.OWLDataComplementOf(dataRange(it[0]));
        case 'DataOneOf': return new CE.OWLDataOneOf(it.map(literal));
        case 'DatatypeRestriction': {
          const dt = new OWLDatatype(tok.items[0].value);
          const facets = it.slice(1).map(f => ({ facet: f.items ? f.items[0].value : f.value, value: literal(f.items ? f.items[1] : f) }));
          return new CE.OWLDatatypeRestriction(dt, facets);
        }
        default: throw new Error('Unknown data range: ' + n);
      }
    };

    const add = (ax) => onto.addAxiom(ax);

    switch (name) {
      case 'Declaration': {
        const entTok = args[0];
        if (entTok.kind === 'expr') {
          const kind = entTok.name;
          const iriTok = entTok.items[0];
          const map = { Class: 'class', ObjectProperty: 'op', DataProperty: 'dp', NamedIndividual: 'ni', Datatype: 'dt', AnnotationProperty: 'ap' };
          if (map[kind]) add(new AX.OWLDeclarationAxiom(entity(iriTok, map[kind])));
        }
        return;
      }
      case 'SubClassOf': add(new AX.OWLSubClassOfAxiom(classExpr(args[0]), classExpr(args[1]))); return;
      case 'EquivalentClasses': add(new AX.OWLEquivalentClassesAxiom(args.map(classExpr))); return;
      case 'DisjointClasses': add(new AX.OWLDisjointClassesAxiom(args.map(classExpr))); return;
      case 'DisjointUnion': add(new AX.OWLDisjointUnionAxiom(entity(args[0], 'class'), args.slice(1).map(classExpr))); return;
      case 'SubObjectPropertyOf': {
        if (args[0] && args[0].kind === 'expr' && args[0].name === 'ObjectPropertyChain') {
          const chain = args[0].items.map(t => entity(t, 'op'));
          add(new AX.OWLSubPropertyChainOfAxiom(chain, entity(args[args.length - 1], 'op')));
        } else {
          add(new AX.OWLSubObjectPropertyOfAxiom(entity(args[0], 'op'), entity(args[1], 'op')));
        }
        return;
      }
      case 'SubObjectPropertyChain': {
        const chain = args[0].kind === 'expr' && args[0].name === 'ObjectPropertyChain'
          ? args[0].items.map(t => entity(t, 'op'))
          : args.slice(0, -1).map(t => entity(t, 'op'));
        add(new AX.OWLSubPropertyChainOfAxiom(chain, entity(args[args.length - 1], 'op')));
        return;
      }
      case 'EquivalentObjectProperties': add(new AX.OWLEquivalentObjectPropertiesAxiom(args.map(t => entity(t, 'op')))); return;
      case 'DisjointObjectProperties': add(new AX.OWLDisjointObjectPropertiesAxiom(args.map(t => entity(t, 'op')))); return;
      case 'ObjectPropertyDomain': add(new AX.OWLObjectPropertyDomainAxiom(entity(args[0], 'op'), classExpr(args[1]))); return;
      case 'ObjectPropertyRange': add(new AX.OWLObjectPropertyRangeAxiom(entity(args[0], 'op'), classExpr(args[1]))); return;
      case 'InverseObjectProperties': add(new AX.OWLInverseObjectPropertiesAxiom(entity(args[0], 'op'), entity(args[1], 'op'))); return;
      case 'FunctionalObjectProperty': add(new AX.OWLFunctionalObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'InverseFunctionalObjectProperty': add(new AX.OWLInverseFunctionalObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'ReflexiveObjectProperty': add(new AX.OWLReflexiveObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'IrreflexiveObjectProperty': add(new AX.OWLIrreflexiveObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'SymmetricObjectProperty': add(new AX.OWLSymmetricObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'AsymmetricObjectProperty': add(new AX.OWLAsymmetricObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'TransitiveObjectProperty': add(new AX.OWLTransitiveObjectPropertyAxiom(entity(args[0], 'op'))); return;
      case 'SubDataPropertyOf': add(new AX.OWLSubDataPropertyOfAxiom(entity(args[0], 'dp'), entity(args[1], 'dp'))); return;
      case 'EquivalentDataProperties': add(new AX.OWLEquivalentDataPropertiesAxiom(args.map(t => entity(t, 'dp')))); return;
      case 'DisjointDataProperties': add(new AX.OWLDisjointDataPropertiesAxiom(args.map(t => entity(t, 'dp')))); return;
      case 'DataPropertyDomain': add(new AX.OWLDataPropertyDomainAxiom(entity(args[0], 'dp'), classExpr(args[1]))); return;
      case 'DataPropertyRange': add(new AX.OWLDataPropertyRangeAxiom(entity(args[0], 'dp'), dataRange(args[1]))); return;
      case 'FunctionalDataProperty': add(new AX.OWLFunctionalDataPropertyAxiom(entity(args[0], 'dp'))); return;
      case 'DatatypeDefinition': add(new AX.OWLDatatypeDefinitionAxiom(entity(args[0], 'dt'), dataRange(args[1]))); return;
      case 'HasKey': add(new AX.OWLHasKeyAxiom(classExpr(args[0]), args.slice(1).map(t => entity(t, 'op')))); return;
      case 'SameIndividual': add(new AX.OWLSameIndividualAxiom(args.map(t => entity(t, 'ni')))); return;
      case 'DifferentIndividuals': add(new AX.OWLDifferentIndividualsAxiom(args.map(t => entity(t, 'ni')))); return;
      case 'ClassAssertion': add(new AX.OWLClassAssertionAxiom(entity(args[1], 'ni'), classExpr(args[0]))); return;
      case 'ObjectPropertyAssertion': add(new AX.OWLObjectPropertyAssertionAxiom(entity(args[1], 'ni'), entity(args[0], 'op'), entity(args[2], 'ni'))); return;
      case 'NegativeObjectPropertyAssertion': add(new AX.OWLNegativeObjectPropertyAssertionAxiom(entity(args[1], 'ni'), entity(args[0], 'op'), entity(args[2], 'ni'))); return;
      case 'DataPropertyAssertion': add(new AX.OWLDataPropertyAssertionAxiom(entity(args[1], 'ni'), entity(args[0], 'dp'), literal(args[2]))); return;
      case 'NegativeDataPropertyAssertion': add(new AX.OWLNegativeDataPropertyAssertionAxiom(entity(args[1], 'ni'), entity(args[0], 'dp'), literal(args[2]))); return;
      case 'AnnotationAssertion': {
        const prop = entity(args[0], 'ap');
        const subj = args[1].kind === 'iri' ? args[1].value : null;
        const val = args[2].kind === 'iri' ? args[2].value : literal(args[2]);
        add(new AX.OWLAnnotationAssertionAxiom(subj, prop, val));
        return;
      }
      case 'SubAnnotationPropertyOf': add(new AX.OWLSubAnnotationPropertyOfAxiom(entity(args[0], 'ap'), entity(args[1], 'ap'))); return;
      case 'AnnotationPropertyDomain': add(new AX.OWLAnnotationPropertyDomainAxiom(entity(args[0], 'ap'), args[1].value)); return;
      case 'AnnotationPropertyRange': add(new AX.OWLAnnotationPropertyRangeAxiom(entity(args[0], 'ap'), args[1].value)); return;
      default:
        throw new Error('Unsupported axiom: ' + name);
    }
  }
}

module.exports = { FunctionalSyntaxParser };
