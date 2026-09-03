'use strict';

// ---------------------------------------------------------------------------
// TripleStore — an in-memory RDF triple store with simple pattern matching.
// Triples are [subject, predicate, object] string arrays. Literals are kept
// in a canonical lexical form like  "value"^^<datatype>  or  "value"@lang .
// Blank nodes (anonymous class expressions) use _:bN identifiers.
// ---------------------------------------------------------------------------

const SEP = String.fromCharCode(1); // field separator safe for IRIs/literals

class TripleStore {
  constructor() {
    this._triples = new Set();       // canonical key s+SEP+p+SEP+o
    this._byPredicate = new Map();   // p -> Set(tripleKey)
  }

  static key(s, p, o) { return s + SEP + p + SEP + o; }

  add(s, p, o) {
    const k = TripleStore.key(String(s), String(p), String(o));
    if (this._triples.has(k)) return false;
    this._triples.add(k);
    if (!this._byPredicate.has(p)) this._byPredicate.set(p, new Set());
    this._byPredicate.get(p).add(k);
    return true;
  }

  has(s, p, o) {
    return this._triples.has(TripleStore.key(String(s), String(p), String(o)));
  }

  size() { return this._triples.size; }

  /** All triples as [s,p,o] arrays. */
  all() {
    return [...this._triples].map(k => k.split(SEP));
  }

  /** Match a pattern; null fields are wildcards. Returns array of [s,p,o]. */
  match(s = null, p = null, o = null) {
    let candidates;
    if (p !== null) {
      if (!this._byPredicate.has(p)) return [];
      candidates = [...this._byPredicate.get(p)].map(k => k.split(SEP));
    } else {
      candidates = this.all();
    }
    return candidates.filter(([ts, tp, to]) =>
      (s === null || ts === s) && (o === null || to === o));
  }

  /** Distinct objects for a given subject+predicate. */
  objects(s, p) {
    return this.match(s, p, null).map(t => t[2]);
  }

  /** Distinct subjects for a given predicate+object. */
  subjects(p, o) {
    return this.match(null, p, o).map(t => t[0]);
  }

  /** Resolve an RDF list head to its element array (rdf:first/rdf:rest chain). */
  listElements(head) {
    const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
    const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
    const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
    const out = [];
    let cur = head;
    const seen = new Set();
    while (cur && cur !== RDF_NIL && !seen.has(cur)) {
      seen.add(cur);
      const first = this.objects(cur, RDF_FIRST)[0];
      if (first === undefined) break;
      out.push(first);
      cur = this.objects(cur, RDF_REST)[0];
    }
    return out;
  }
}

module.exports = { TripleStore };
