'use strict';

// ---------------------------------------------------------------------------
// io/SWRLParser — parse Protégé-style SWRL text rules into SWRLRule objects.
// Syntax:  Antecedent ^ Antecedent ... -> Consequent ^ Consequent ...
// Atoms:
//   Class(?x)            → SWRLClassAtom
//   prop(?x, ?y)         → ObjectPropertyAtom or DataPropertyAtom (resolved)
//   sameAs(?x, ?y)       → SWRLSameAsAtom
//   differentFrom(?x,?y) → SWRLDifferentFromAtom
//   builtin(?x, "lit")   → SWRLBuiltInAtom (swrlb namespace)
// Variables: ?name.  Individuals/IRIs: prefixed name or <iri> or bare token.
// ---------------------------------------------------------------------------

const {
  SWRLRule, SWRLVariable, SWRLClassAtom, SWRLObjectPropertyAtom,
  SWRLDataPropertyAtom, SWRLSameAsAtom, SWRLDifferentFromAtom,
  SWRLBuiltInAtom, SWRLB_NS
} = require('../model/SWRL');
const {
  OWLClass, OWLObjectProperty, OWLDataProperty, OWLNamedIndividual
} = require('../model/OWLEntity');
const { OWLLiteral } = require('../model/OWLLiteral');
const { IRI } = require('../model/IRI');

const DEFAULT_PREFIXES = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  swrlb: SWRLB_NS
};

class SWRLParser {
  /**
   * @param {Object} [opts]
   * @param {Object<string,string>} [opts.prefixes] extra prefix map
   * @param {(iri:string)=>('class'|'objectProperty'|'dataProperty'|'individual'|null)} [opts.resolve]
   *   Resolve an entity IRI to its kind so that prop(?x,?y) can be typed.
   */
  constructor(opts = {}) {
    this.prefixes = Object.assign({}, DEFAULT_PREFIXES, opts.prefixes || {});
    this.resolve = opts.resolve || (() => null);
  }

  expandIRI(token) {
    if (token.startsWith('<') && token.endsWith('>')) return token.slice(1, -1);
    if (token.startsWith('http://') || token.startsWith('https://') || token.startsWith('urn:')) return token;
    const idx = token.indexOf(':');
    if (idx > 0) {
      const ns = this.prefixes[token.slice(0, idx)];
      if (ns) return ns + token.slice(idx + 1);
    }
    return token;
  }

  /**
   * Parse a single SWRL rule string.
   * @param {string} text
   * @returns {SWRLRule}
   */
  parse(text) {
    const ruleText = text.trim();
    const arrow = ruleText.indexOf('->');
    if (arrow < 0) throw new Error('SWRL rule missing "->": ' + ruleText);
    const bodyText = ruleText.slice(0, arrow).trim();
    const headText = ruleText.slice(arrow + 2).trim();
    const body = this._parseAtomList(bodyText);
    const head = this._parseAtomList(headText);
    return new SWRLRule(body, head);
  }

  /** Parse several rules separated by newlines or '. ' boundaries. */
  parseAll(text) {
    const rules = [];
    // Split on newlines that contain '->'
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#') || t.startsWith('//')) continue;
      if (!t.includes('->')) continue;
      rules.push(this.parse(t));
    }
    return rules;
  }

  _parseAtomList(text) {
    const atoms = [];
    // Split on '^' at top level (not inside parens/strings)
    let depth = 0, inStr = false, cur = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') inStr = !inStr;
      if (!inStr && ch === '(') depth++;
      if (!inStr && ch === ')') depth--;
      if (!inStr && depth === 0 && ch === '^') {
        atoms.push(this._atom(cur.trim()));
        cur = '';
        continue;
      }
      cur += ch;
    }
    if (cur.trim()) atoms.push(this._atom(cur.trim()));
    return atoms;
  }

  _atom(text) {
    const m = /^([\w:<][\w:.\-<>/]*)\(([^)]*)\)$/.exec(text.trim());
    if (!m) throw new Error('Malformed SWRL atom: ' + text);
    const name = m[1];
    const args = m[2].split(',').map(s => s.trim()).filter(Boolean).map(a => this._arg(a));

    const iri = this.expandIRI(name);
    if (iri === 'http://www.w3.org/2002/07/owl#sameAs' || name === 'sameAs') {
      return new SWRLSameAsAtom(args[0], args[1]);
    }
    if (iri === 'http://www.w3.org/2002/07/owl#differentFrom' || name === 'differentFrom') {
      return new SWRLDifferentFromAtom(args[0], args[1]);
    }
    if (name.startsWith('swrlb:') || this.prefixes.swrlb && iri.startsWith(SWRLB_NS)) {
      return new SWRLBuiltInAtom(IRI.create(iri), args);
    }
    const kind = this.resolve(iri);
    if (kind === 'class' || (!kind && args.length === 1)) {
      return new SWRLClassAtom(new OWLClass(iri), args[0]);
    }
    if (kind === 'dataProperty') {
      return new SWRLDataPropertyAtom(new OWLDataProperty(iri), args[0], args[1]);
    }
    // default: object property
    return new SWRLObjectPropertyAtom(new OWLObjectProperty(iri), args[0], args[1]);
  }

  _arg(token) {
    if (token.startsWith('?')) return new SWRLVariable(IRI.create('urn:swrl:var:' + token.slice(1)));
    // Literal "..."  or "..."^^dt
    if (token.startsWith('"')) {
      const m = /^"((?:[^"\\]|\\.)*)"(?:\^\^(.+))?$/.exec(token);
      const lex = m ? m[1] : token.slice(1, -1);
      let dt = null;
      if (m && m[2]) {
        const { OWLDatatype } = require('../model/OWLEntity');
        dt = new OWLDatatype(this.expandIRI(m[2]));
      }
      return new OWLLiteral(lex, dt);
    }
    return new OWLNamedIndividual(this.expandIRI(token));
  }
}

module.exports = { SWRLParser };
