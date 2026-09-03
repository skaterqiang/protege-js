'use strict';

// ---------------------------------------------------------------------------
// TurtleParser — a compact RDF/Turtle parser covering the OWL 2 RL-relevant
// subset of the W3C Turtle spec (https://www.w3.org/TR/turtle/).
// Supports: @prefix / @base / PREFIX / BASE, triples with `a`, predicate-object
// lists, object lists, blank nodes [], collections (), literals with
// ^^datatype or @lang, numbers, booleans, and comments (#...).
// Emits raw triples to a TripleStore; mapping to OWL axioms is done elsewhere.
// ---------------------------------------------------------------------------

const { TripleStore } = require('../inference/TripleStore');

const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

const P = Object.freeze({
  type: RDF_NS + 'type',
  first: RDF_NS + 'first',
  rest: RDF_NS + 'rest',
  nil: RDF_NS + 'nil'
});

const XSD_INTEGER = XSD_NS + 'integer';
const XSD_DECIMAL = XSD_NS + 'decimal';
const XSD_DOUBLE = XSD_NS + 'double';
const XSD_BOOLEAN = XSD_NS + 'boolean';

class TurtleParser {
  constructor() {
    this.store = new TripleStore();
    this.prefixes = new Map([
      ['rdf', RDF_NS],
      ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
      ['owl', 'http://www.w3.org/2002/07/owl#'],
      ['xsd', XSD_NS]
    ]);
    this.base = '';
    this._blankCounter = 0;
  }

  _newBlank() { return '_:b' + (++this._blankCounter); }

  /** Parse Turtle text. Returns the TripleStore. */
  parse(text) {
    const tokens = this._tokenize(text);
    this._pos = 0;
    this._tokens = tokens;
    while (this._pos < tokens.length) {
      this._statement();
    }
    return this.store;
  }

  // ---- tokenizer -----------------------------------------------------------

  _tokenize(text) {
    const out = [];
    let i = 0;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      // whitespace / comments
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '#') { while (i < n && text[i] !== '\n') i++; continue; }
      // punctuation
      if (';,.[]()'.includes(ch)) { out.push({ t: ch, v: ch }); i++; continue; }
      if (ch === '^' && text[i + 1] === '^') { out.push({ t: '^^', v: '^^' }); i += 2; continue; }
      // string literal (single/double, possibly long)
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const long = text.substr(i, 3) === quote.repeat(3);
        const endQuote = long ? quote.repeat(3) : quote;
        let j = i + (long ? 3 : 1);
        let value = '';
        while (j < n) {
          if (text.substr(j, endQuote.length) === endQuote) break;
          if (text[j] === '\\' && j + 1 < n) {
            const esc = text[j + 1];
            const map = { n: '\n', t: '\t', r: '\r', '"': '"', "'": "'", '\\': '\\' };
            if (esc === 'u' && j + 5 < n) {
              value += String.fromCharCode(parseInt(text.substr(j + 2, 4), 16));
              j += 6; continue;
            }
            value += map[esc] !== undefined ? map[esc] : esc;
            j += 2;
            continue;
          }
          value += text[j];
          j++;
        }
        j += endQuote.length;
        out.push({ t: 'STRING', v: value });
        i = j;
        continue;
      }
      // IRI_REF <...>
      if (ch === '<') {
        const j = text.indexOf('>', i);
        if (j < 0) throw new Error('Unterminated IRI');
        out.push({ t: 'IRI', v: text.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
      // Blank node label  _:name
      if (ch === '_' && text[i + 1] === ':') {
        let j = i + 2;
        while (j < n && /[A-Za-z0-9_-]/.test(text[j])) j++;
        out.push({ t: 'BNODE', v: '_:' + text.slice(i + 2, j) });
        i = j;
        continue;
      }
      // @word keyword (@prefix, @base) or lang tag
      if (ch === '@') {
        let j = i + 1;
        while (j < n && /[A-Za-z0-9_-]/.test(text[j])) j++;
        out.push({ t: 'AT', v: text.slice(i + 1, j) });
        i = j;
        continue;
      }
      // keyword PREFIX / BASE
      if (text.startsWith('PREFIX', i) && /\s/.test(text[i + 6] || ' ')) {
        out.push({ t: 'PREFIX_KW', v: 'PREFIX' }); i += 6; continue;
      }
      if (text.startsWith('BASE', i) && /\s/.test(text[i + 4] || ' ')) {
        out.push({ t: 'BASE_KW', v: 'BASE' }); i += 4; continue;
      }
      // number
      if (/[0-9+-]/.test(ch) && /[0-9]/.test(text[i + 1] || '') || /[0-9]/.test(ch)) {
        let j = i;
        if (/[+-]/.test(text[j])) j++;
        let hasDot = false, hasE = false;
        while (j < n) {
          const c = text[j];
          if (/[0-9]/.test(c)) { j++; continue; }
          if (c === '.' && !hasDot && !hasE && /[0-9]/.test(text[j + 1] || '')) { hasDot = true; j++; continue; }
          if ((c === 'e' || c === 'E') && !hasE) {
            hasE = true; j++;
            if (/[+-]/.test(text[j])) j++;
            continue;
          }
          break;
        }
        const num = text.slice(i, j);
        out.push({ t: 'NUMBER', v: num, hasDot, hasE });
        i = j;
        continue;
      }
      // boolean
      if (text.startsWith('true', i) && !/\w/.test(text[i + 4] || '')) {
        out.push({ t: 'BOOLEAN', v: 'true' }); i += 4; continue;
      }
      if (text.startsWith('false', i) && !/\w/.test(text[i + 5] || '')) {
        out.push({ t: 'BOOLEAN', v: 'false' }); i += 5; continue;
      }
      // keyword `a`
      if (ch === 'a' && !/[A-Za-z0-9_]/.test(text[i + 1] || '')) {
        out.push({ t: 'A', v: 'a' }); i++; continue;
      }
      // prefixed name prefix:local  or  plain prefix:
      let j = i;
      while (j < n && /[A-Za-z0-9_-]/.test(text[j])) j++;
      if (text[j] === ':') {
        const prefix = text.slice(i, j);
        let k = j + 1;
        while (k < n && /[A-Za-z0-9_\-.]/.test(text[k])) k++;
        const local = text.slice(j + 1, k);
        out.push({ t: 'PNAME', v: prefix + ':' + local });
        i = k;
        continue;
      }
      // bare name (treat as prefixed name without colon -> error unless prefix known)
      // fallthrough: treat as anonymous token
      throw new Error('Unexpected char at ' + i + ': ' + text.slice(i, i + 20));
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

  // ---- grammar -------------------------------------------------------------

  _statement() {
    const tok = this._peek();
    if (!tok) return;
    if (tok.t === 'AT') {
      this._next();
      if (tok.v === 'prefix') {
        const pn = this._expect('PNAME'); // e.g. rdf:
        const iri = this._expect('IRI');
        this.prefixes.set(pn.v.slice(0, -1), iri.v);
      } else if (tok.v === 'base') {
        const iri = this._expect('IRI');
        this.base = iri.v;
      }
      if (this._peek() && this._peek().t === '.') this._next();
      return;
    }
    if (tok.t === 'PREFIX_KW') {
      this._next();
      const pn = this._expect('PNAME');
      const iri = this._expect('IRI');
      this.prefixes.set(pn.v.slice(0, -1), iri.v);
      return;
    }
    if (tok.t === 'BASE_KW') {
      this._next();
      const iri = this._expect('IRI');
      this.base = iri.v;
      return;
    }
    this._triples();
  }

  _triples() {
    const subject = this._subject();
    this._predicateObjectList(subject);
    this._expect('.');
  }

  _subject() {
    const tok = this._peek();
    if (tok.t === 'IRI' || tok.t === 'PNAME') return this._iriToken(this._next());
    if (tok.t === 'BNODE') { this._next(); return tok.v; }
    if (tok.t === '[') return this._blankNode();
    if (tok.t === '(') return this._collection();
    throw new Error('Unexpected subject: ' + JSON.stringify(tok));
  }

  _iriToken(tok) {
    if (tok.t === 'IRI') return this._resolveIRI(tok.v);
    if (tok.t === 'PNAME') {
      const idx = tok.v.indexOf(':');
      const prefix = tok.v.slice(0, idx);
      const local = tok.v.slice(idx + 1);
      if (!this.prefixes.has(prefix)) throw new Error('Unknown prefix: ' + prefix);
      return this.prefixes.get(prefix) + local;
    }
    throw new Error('Not an IRI token: ' + JSON.stringify(tok));
  }

  _resolveIRI(rel) {
    if (/^https?:/i.test(rel) || /^urn:/i.test(rel)) return rel;
    if (this.base) {
      if (rel.startsWith('#')) return this.base + rel;
      if (rel.startsWith('/')) {
        const m = /^(https?:\/\/[^/]+)/.exec(this.base);
        return m ? m[1] + rel : rel;
      }
      const base = this.base.endsWith('/') ? this.base : this.base + '/';
      return base + rel;
    }
    return rel;
  }

  _predicateObjectList(subject) {
    while (true) {
      const tok = this._peek();
      if (!tok || tok.t === '.') return;
      // predicate
      let predicate;
      if (tok.t === 'A') { this._next(); predicate = P.type; }
      else if (tok.t === 'IRI' || tok.t === 'PNAME') predicate = this._iriToken(this._next());
      else throw new Error('Expected predicate, got ' + JSON.stringify(tok));
      // object list
      this._objectList(subject, predicate);
      // ; or .
      const sep = this._peek();
      if (sep && sep.t === ';') { this._next(); continue; }
      return;
    }
  }

  _objectList(subject, predicate) {
    while (true) {
      const obj = this._object();
      if (obj !== undefined && obj !== null) {
        this.store.add(subject, predicate, obj);
      }
      const tok = this._peek();
      if (tok && tok.t === ',') { this._next(); continue; }
      return;
    }
  }

  _object() {
    const tok = this._peek();
    if (tok.t === 'IRI' || tok.t === 'PNAME') return this._iriToken(this._next());
    if (tok.t === 'BNODE') { this._next(); return tok.v; }
    if (tok.t === 'STRING') {
      this._next();
      let lit = '"' + tok.v.replace(/"/g, '\\"') + '"';
      const next = this._peek();
      if (next && next.t === '^^') {
        this._next();
        const dt = this._iriToken(this._next());
        lit += '^^<' + dt + '>';
      } else if (next && next.t === 'AT') {
        this._next();
        lit += '@' + next.v;
      }
      return lit;
    }
    if (tok.t === 'NUMBER') {
      this._next();
      const dt = tok.hasE ? XSD_DOUBLE : tok.hasDot ? XSD_DECIMAL : XSD_INTEGER;
      return `"${tok.v}"^^<${dt}>`;
    }
    if (tok.t === 'BOOLEAN') {
      this._next();
      return `"${tok.v}"^^<${XSD_BOOLEAN}>`;
    }
    if (tok.t === '[') return this._blankNode();
    if (tok.t === '(') return this._collection();
    throw new Error('Unexpected object: ' + JSON.stringify(tok));
  }

  _blankNode() {
    this._expect('[');
    const head = this._newBlank();
    const tok = this._peek();
    if (tok && tok.t !== ']') {
      this._predicateObjectList(head);
    }
    this._expect(']');
    return head;
  }

  _collection() {
    this._expect('(');
    const items = [];
    while (this._peek() && this._peek().t !== ')') {
      items.push(this._object());
    }
    this._expect(')');
    if (items.length === 0) return P.nil;
    // build rdf:first/rest chain
    let head = null;
    let prev = null;
    for (const item of items) {
      const node = this._newBlank();
      if (!head) head = node;
      this.store.add(node, P.first, item);
      if (prev) this.store.add(prev, P.rest, node);
      prev = node;
    }
    this.store.add(prev, P.rest, P.nil);
    return head;
  }
}

/** Convenience: parse Turtle text, return TripleStore. */
function parseTurtle(text) {
  return new TurtleParser().parse(text);
}

module.exports = { TurtleParser, parseTurtle };
