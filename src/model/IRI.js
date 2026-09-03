'use strict';

// ---------------------------------------------------------------------------
// IRI — mirrors org.semanticweb.owlapi.model.IRI
// ---------------------------------------------------------------------------

class IRI {
  constructor(iriString) {
    if (!iriString || typeof iriString !== 'string') {
      throw new Error('IRI requires a non-empty string');
    }
    this._iri = iriString;
  }

  static create(iriString) {
    return new IRI(iriString);
  }

  toString() {
    return this._iri;
  }

  /** Fragment after the last '#' or '/'. */
  getFragment() {
    const h = this._iri.lastIndexOf('#');
    if (h >= 0 && h < this._iri.length - 1) return this._iri.slice(h + 1);
    const s = this._iri.lastIndexOf('/');
    if (s >= 0 && s < this._iri.length - 1) return this._iri.slice(s + 1);
    return null;
  }

  /** Everything before the fragment separator. */
  getNamespace() {
    const h = this._iri.lastIndexOf('#');
    if (h >= 0) return this._iri.slice(0, h + 1);
    const s = this._iri.lastIndexOf('/');
    if (s >= 0) return this._iri.slice(0, s + 1);
    return this._iri;
  }

  getShortForm() {
    return this.getFragment() || this._iri;
  }

  equals(other) {
    return other instanceof IRI && other._iri === this._iri;
  }

  hashCode() {
    return IRI._hash(this._iri);
  }

  static _hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
  }
}

module.exports = { IRI };
