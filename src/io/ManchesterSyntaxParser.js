'use strict';

// ---------------------------------------------------------------------------
// io/ManchesterSyntaxParser — parse OWL 2 Manchester Syntax (frame-style).
// Mirrors the syntax used by Protégé's "Manchester Syntax" rendering:
//
//   Class: ex:Person
//       SubClassOf: ex:Animal
//       SubClassOf: ex:hasParent some ex:Person
//       EquivalentTo: ex:Human
//       DisjointWith: ex:Robot
//       DisjointUnionOf: ex:Child, ex:Adult
//
//   ObjectProperty: ex:hasParent
//       Domain: ex:Person
//       Range: ex:Person
//       Characteristics: Transitive, Functional
//       InverseOf: ex:hasChild
//       SubPropertyOf: ex:hasAncestor
//
//   Individual: ex:alice
//       Types: ex:Person
//       Facts: ex:hasParent ex:bob
//       SameAs: ex:alicia
//
// Class expressions use: and / or / not / some / only / value / Self /
// min n / max n / exactly n / {ind1, ind2}
// ---------------------------------------------------------------------------

const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual, OWLDatatype
} = require('../model/OWLEntity');
const AX = require('../model/OWLAxiom');
const CE = require('../model/OWLClassExpression');
const { OWLLiteral } = require('../model/OWLLiteral');
const { IRI } = require('../model/IRI');

const XSD = 'http://www.w3.org/2001/XMLSchema#';

const DEFAULT_PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: XSD
};

class ManchesterSyntaxParser {
  constructor(opts = {}) {
    this.prefixes = Object.assign({}, DEFAULT_PREFIXES, opts.prefixes || {});
    this.base = opts.base || 'http://example.org/';
  }

  expandIRI(token) {
    if (token.startsWith('<') && token.endsWith('>')) return token.slice(1, -1);
    if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('urn:')) return token;
    const idx = token.indexOf(':');
    if (idx > 0) {
      const ns = this.prefixes[token.slice(0, idx)];
      if (ns) return ns + token.slice(idx + 1);
    }
    return this.base + token;
  }

  /**
   * Parse Manchester Syntax text into an OWLOntology.
   * @param {string} text
   * @returns {OWLOntology}
   */
  parse(text, ontologyIRI = null) {
    const ont = new OWLOntology(new OWLOntologyID(ontologyIRI ? IRI.create(ontologyIRI) : null));
    ont.format = 'Manchester';

    // Parse Prefix: lines first
    const lines = text.split(/\r?\n/);
    const contentLines = [];
    for (const line of lines) {
      const m = /^Prefix:\s*([\w-]*):?\s*<([^>]+)>/.exec(line.trim());
      if (m) {
        this.prefixes[m[1] || ''] = m[2];
        ont.addPrefix(m[1] || '', m[2]); // prefix fidelity (L5)
        continue;
      }
      contentLines.push(line);
    }

    // Split into frames by "Class:" / "ObjectProperty:" / "DataProperty:" /
    // "Individual:" / "Datatype:" / "AnnotationProperty:" headers
    let frame = null;
    for (const raw of contentLines) {
      const line = raw;
      if (!line.trim()) continue;
      const fm = /^(Class|ObjectProperty|DataProperty|Individual|Datatype|AnnotationProperty):\s*(\S+)/.exec(line);
      if (fm && !/^\s/.test(line)) {
        frame = { kind: fm[1], iri: this.expandIRI(fm[2]) };
        this._declareFrame(ont, frame);
        continue;
      }
      if (frame) {
        this._frameLine(ont, frame, line.trim());
      }
    }
    return ont;
  }

  _declareFrame(ont, frame) {
    const mk = {
      Class: (i) => new OWLClass(i),
      ObjectProperty: (i) => new OWLObjectProperty(i),
      DataProperty: (i) => new OWLDataProperty(i),
      Individual: (i) => new OWLNamedIndividual(i),
      Datatype: (i) => new OWLDatatype(i),
      AnnotationProperty: (i) => new (require('../model/OWLEntity').OWLAnnotationProperty)(i)
    }[frame.kind];
    if (mk) ont.addAxiom(new AX.OWLDeclarationAxiom(mk(frame.iri)));
  }

  _frameLine(ont, frame, line) {
    // Split on the FIRST colon only — values may contain prefixed IRIs (ex:Foo)
    const ci = line.indexOf(':');
    const keyword = (ci >= 0 ? line.slice(0, ci) : line).trim();
    const body = (ci >= 0 ? line.slice(ci + 1) : '').trim();
    if (!body) return;
    const items = splitTopLevel(body, ',');

    switch (frame.kind) {
      case 'Class': {
        const cls = new OWLClass(frame.iri);
        if (keyword === 'SubClassOf') {
          for (const it of items) ont.addAxiom(new AX.OWLSubClassOfAxiom(cls, this._classExpr(it)));
        } else if (keyword === 'EquivalentTo') {
          // Keep {a,b,c} enumeration as ONE item
          for (const it of items) ont.addAxiom(new AX.OWLEquivalentClassesAxiom([cls, this._classExpr(it)]));
        } else if (keyword === 'DisjointWith') {
          for (const it of items) ont.addAxiom(new AX.OWLDisjointClassesAxiom([cls, this._classExpr(it)]));
        } else if (keyword === 'DisjointUnionOf') {
          ont.addAxiom(new AX.OWLDisjointUnionAxiom(cls, items.map(i => this._classExpr(i))));
        } else if (keyword === 'HasKey') {
          const props = items.map(i => new OWLObjectProperty(this.expandIRI(i.trim())));
          ont.addAxiom(new AX.OWLHasKeyAxiom(cls, props));
        }
        break;
      }
      case 'ObjectProperty': {
        const p = new OWLObjectProperty(frame.iri);
        if (keyword === 'SubPropertyOf') {
          for (const it of items) ont.addAxiom(new AX.OWLSubObjectPropertyOfAxiom(p, new OWLObjectProperty(this.expandIRI(it))));
        } else if (keyword === 'Domain') {
          for (const it of items) ont.addAxiom(new AX.OWLObjectPropertyDomainAxiom(p, this._classExpr(it)));
        } else if (keyword === 'Range') {
          for (const it of items) ont.addAxiom(new AX.OWLObjectPropertyRangeAxiom(p, this._classExpr(it)));
        } else if (keyword === 'InverseOf') {
          for (const it of items) ont.addAxiom(new AX.OWLInverseObjectPropertiesAxiom(p, new OWLObjectProperty(this.expandIRI(it))));
        } else if (keyword === 'Characteristics') {
          for (const c of items) {
            const cc = c.trim();
            const map = {
              Functional: AX.OWLFunctionalObjectPropertyAxiom,
              InverseFunctional: AX.OWLInverseFunctionalObjectPropertyAxiom,
              Transitive: AX.OWLTransitiveObjectPropertyAxiom,
              Symmetric: AX.OWLSymmetricObjectPropertyAxiom,
              Asymmetric: AX.OWLAsymmetricObjectPropertyAxiom,
              Reflexive: AX.OWLReflexiveObjectPropertyAxiom,
              Irreflexive: AX.OWLIrreflexiveObjectPropertyAxiom
            };
            if (map[cc]) ont.addAxiom(new map[cc](p));
          }
        } else if (keyword === 'SubPropertyChain') {
          const chain = body.split(/\s*o\s*/).map(s => new OWLObjectProperty(this.expandIRI(s.trim())));
          ont.addAxiom(new AX.OWLSubPropertyChainOfAxiom(chain, p));
        }
        break;
      }
      case 'DataProperty': {
        const p = new OWLDataProperty(frame.iri);
        if (keyword === 'SubPropertyOf') {
          for (const it of items) ont.addAxiom(new AX.OWLSubDataPropertyOfAxiom(p, new OWLDataProperty(this.expandIRI(it))));
        } else if (keyword === 'Domain') {
          for (const it of items) ont.addAxiom(new AX.OWLDataPropertyDomainAxiom(p, this._classExpr(it)));
        } else if (keyword === 'Range') {
          for (const it of items) ont.addAxiom(new AX.OWLDataPropertyRangeAxiom(p, new OWLDatatype(this.expandIRI(it))));
        } else if (keyword === 'Characteristics') {
          if (items.some(c => c.trim() === 'Functional')) {
            ont.addAxiom(new AX.OWLFunctionalDataPropertyAxiom(p));
          }
        }
        break;
      }
      case 'Individual': {
        const ind = new OWLNamedIndividual(frame.iri);
        if (keyword === 'Types') {
          for (const it of items) ont.addAxiom(new AX.OWLClassAssertionAxiom(ind, this._classExpr(it)));
        } else if (keyword === 'SameAs') {
          for (const it of items) ont.addAxiom(new AX.OWLSameIndividualAxiom([ind, new OWLNamedIndividual(this.expandIRI(it))]));
        } else if (keyword === 'DifferentFrom') {
          for (const it of items) ont.addAxiom(new AX.OWLDifferentIndividualsAxiom([ind, new OWLNamedIndividual(this.expandIRI(it))]));
        } else if (keyword === 'Facts') {
          // "Facts: p target, q target2"
          for (const it of items) {
            const m = /^(\S+)\s+(\S+)$/.exec(it.trim());
            if (!m) continue;
            const pIRI = this.expandIRI(m[1]);
            const tgt = m[2];
            if (tgt.startsWith('"')) {
              ont.addAxiom(new AX.OWLDataPropertyAssertionAxiom(
                ind, new OWLDataProperty(pIRI), this._literal(tgt)));
            } else {
              ont.addAxiom(new AX.OWLObjectPropertyAssertionAxiom(
                ind, new OWLObjectProperty(pIRI), new OWLNamedIndividual(this.expandIRI(tgt))));
            }
          }
        }
        break;
      }
    }
  }

  // --- class expression (Manchester infix) ----------------------------------

  _classExpr(text) {
    const tokens = this._tokenizeExpr(text);
    this._toks = tokens;
    this._pos = 0;
    const e = this._orExpr();
    return e;
  }

  _tokenizeExpr(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '(' || ch === ')' || ch === '{' || ch === '}' || ch === ',') { out.push(ch); i++; continue; }
      if (ch === '"') {
        let j = i + 1, v = '';
        while (j < s.length && s[j] !== '"') { v += s[j]; j++; }
        out.push({ lit: v });
        i = j + 1;
        continue;
      }
      let j = i;
      while (j < s.length && /[^\s(),{}]/.test(s[j])) j++;
      out.push(s.slice(i, j));
      i = j;
    }
    return out;
  }

  _peekT() { return this._toks[this._pos]; }
  _nextT() { return this._toks[this._pos++]; }

  _orExpr() {
    let e = this._andExpr();
    while (this._peekT() === 'or') {
      this._nextT();
      const rhs = this._andExpr();
      e = new CE.OWLObjectUnionOf(flatten(e, T => T.OBJECT_UNION_OF).concat(flatten(rhs, T => T.OBJECT_UNION_OF)));
    }
    return e;
  }

  _andExpr() {
    let e = this._unaryExpr();
    while (this._peekT() === 'and') {
      this._nextT();
      const rhs = this._unaryExpr();
      e = new CE.OWLObjectIntersectionOf(flatten(e, T => T.OBJECT_INTERSECTION_OF).concat(flatten(rhs, T => T.OBJECT_INTERSECTION_OF)));
    }
    return e;
  }

  _unaryExpr() {
    if (this._peekT() === 'not') {
      this._nextT();
      return new CE.OWLObjectComplementOf(this._unaryExpr());
    }
    return this._restrictionExpr();
  }

  _restrictionExpr() {
    const t = this._peekT();
    // Property-based restriction:  <prop> (some|only|value|Self|min|max|exactly) ...
    if (typeof t === 'string' && t !== '(' && t !== '{') {
      const next = this._toks[this._pos + 1];
      if (typeof next === 'string' && /^(some|only|value|Self|min|max|exactly)$/.test(next)) {
        const propTok = this._nextT();
        const propIRI = this.expandIRI(propTok);
        const kw = this._nextT();
        const prop = new OWLObjectProperty(propIRI);
        if (kw === 'some') return new CE.OWLObjectSomeValuesFrom(prop, this._unaryExpr());
        if (kw === 'only') return new CE.OWLObjectAllValuesFrom(prop, this._unaryExpr());
        if (kw === 'value') {
          const indTok = this._nextT();
          return new CE.OWLObjectHasValue(prop, new OWLNamedIndividual(this.expandIRI(typeof indTok === 'object' ? indTok.lit : indTok)));
        }
        if (kw === 'Self') return new CE.OWLObjectHasSelf(prop);
        if (kw === 'min' || kw === 'max' || kw === 'exactly') {
          const n = parseInt(this._nextT(), 10);
          // Optional filler — only consume if next token is NOT a frame keyword
          // or a closing bracket/comma. In Manchester, `min 2 ex:Foo` has filler;
          // `min 2` alone is unqualified.
          let filler = null;
          const nt = this._peekT();
          if (nt !== undefined && nt !== ')' && nt !== ',' && nt !== 'and' && nt !== 'or') {
            filler = this._unaryExpr();
          }
          const T = CE.ClassExpressionType;
          const type = kw === 'min' ? (filler ? T.OBJECT_MIN_QUALIFIED_CARDINALITY : T.OBJECT_MIN_CARDINALITY)
            : kw === 'max' ? (filler ? T.OBJECT_MAX_QUALIFIED_CARDINALITY : T.OBJECT_MAX_CARDINALITY)
            : (filler ? T.OBJECT_EXACT_QUALIFIED_CARDINALITY : T.OBJECT_EXACT_CARDINALITY);
          return new CE.OWLObjectCardinalityRestriction(type, n, prop, filler);
        }
      }
    }
    return this._primary();
  }

  _primary() {
    const t = this._peekT();
    if (t === '(') {
      this._nextT();
      const e = this._orExpr();
      if (this._peekT() === ')') this._nextT();
      return e;
    }
    if (t === '{') {
      this._nextT();
      const inds = [];
      while (this._peekT() !== '}' && this._peekT() !== undefined) {
        const tok = this._nextT();
        if (tok === ',') continue;
        inds.push(new OWLNamedIndividual(this.expandIRI(typeof tok === 'object' ? tok.lit : tok)));
      }
      if (this._peekT() === '}') this._nextT();
      return new CE.OWLObjectOneOf(inds);
    }
    const tok = this._nextT();
    if (typeof tok === 'object' && tok.lit !== undefined) {
      return new OWLLiteral(tok.lit);
    }
    return new OWLClass(this.expandIRI(tok));
  }

  _restOfPrimary() {
    // Re-assemble remaining primary tokens until a natural stop (and/or/','/')')
    const parts = [];
    let depth = 0;
    while (this._pos < this._toks.length) {
      const t = this._peekT();
      if (t === '(') depth++;
      if (t === ')') { if (depth === 0) break; depth--; }
      if (depth === 0 && (t === 'and' || t === 'or' || t === ',')) break;
      parts.push(this._nextT());
    }
    // Parse collected tokens as a class expression by re-tokenizing
    return this._classExprFromTokens(parts);
  }

  _classExprFromTokens(tokens) {
    const savedToks = this._toks, savedPos = this._pos;
    this._toks = tokens; this._pos = 0;
    const e = this._orExpr();
    this._toks = savedToks; this._pos = savedPos;
    return e;
  }

  _literal(token) {
    const m = /^"((?:[^"\\]|\\.)*)"(?:\^\^(.+))?$/.exec(token.trim());
    if (!m) return new OWLLiteral(token.replace(/^"|"$/g, ''));
    let dt = null;
    if (m[2]) dt = new OWLDatatype(this.expandIRI(m[2]));
    return new OWLLiteral(m[1], dt);
  }
}

function flatten(expr, typeFn) {
  const T = require('../model/OWLClassExpression').ClassExpressionType;
  if (expr && expr.type && (expr.type === T.OBJECT_UNION_OF || expr.type === T.OBJECT_INTERSECTION_OF)) {
    return expr.operands;
  }
  return [expr];
}

function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '{') depth++;
    if (ch === ')' || ch === '}') depth--;
    if (ch === sep && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

module.exports = { ManchesterSyntaxParser };
