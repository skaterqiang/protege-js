'use strict';

// ---------------------------------------------------------------------------
// OWLLiteral — mirrors org.semanticweb.owlapi.model.OWLLiteral
// ---------------------------------------------------------------------------

class OWLLiteral {
  constructor(lexicalValue, datatype = null, lang = null) {
    this.lexicalValue = String(lexicalValue);
    this.datatype = datatype; // OWLDatatype | null
    this.lang = lang;         // language tag | null
  }
  getLiteral() { return this.lexicalValue; }
  getLang() { return this.lang; }
  getDatatype() { return this.datatype; }
  toString() {
    let s = `"${this.lexicalValue}"`;
    if (this.lang) s += `@${this.lang}`;
    else if (this.datatype) s += `^^<${this.datatype.getIRI()}>`;
    return s;
  }
  equals(other) {
    return other instanceof OWLLiteral
      && other.lexicalValue === this.lexicalValue
      && other.lang === this.lang
      && String(other.datatype) === String(this.datatype);
  }
}

module.exports = { OWLLiteral };
