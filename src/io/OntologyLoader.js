'use strict';

const fs = require('fs');
const path = require('path');
const { parseRDFXML } = require('./RDFXMLParser');
const { FunctionalSyntaxParser } = require('./FunctionalSyntaxParser');
const { TurtleParser } = require('./TurtleParser');
const { triplesToOntology } = require('./RDFGraphToOntology');
const { OWLOntology, OWLOntologyID } = require('../model/OWLOntology');
const { IRI } = require('../model/IRI');

// ---------------------------------------------------------------------------
// io/OntologyLoader — mirrors org.protege.editor.owl.model.io.OntologyLoader
// Supports RDF/XML (.owl/.rdf/.xml), OWL Functional Syntax (.ofn/.func/.owl),
// Turtle (.ttl/.n3). Can follow owl:imports transitively with cycle guard.
// ---------------------------------------------------------------------------

class OntologyLoader {
  /**
   * Detect format from file extension or content sniff.
   * @returns {'RDFXML'|'Functional'|'Turtle'}
   */
  detectFormat(filePath, text) {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.ttl' || ext === '.n3') return 'Turtle';
    if (ext === '.ofn' || ext === '.func' || ext === '.omn') return 'Functional';
    const head = (text || '').slice(0, 512).trim();
    if (head.startsWith('<')) return 'RDFXML';
    if (/^(Prefix|Ontology|Declaration|SubClassOf|Class)\s*\(/.test(head)) return 'Functional';
    if (/@prefix|@base|^PREFIX\s/i.test(head)) return 'Turtle';
    return 'RDFXML';
  }

  /**
   * Load an ontology from a local file path.
   * @param {string} filePath
   * @returns {OWLOntology}
   */
  loadFromFile(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');
    const fmt = this.detectFormat(filePath, text);
    let ont;
    if (fmt === 'Turtle') {
      const store = new TurtleParser().parse(text);
      ont = triplesToOntology(store, {});
    } else if (fmt === 'Functional') {
      ont = new FunctionalSyntaxParser().parse(text);
    } else {
      ont = parseRDFXML(text);
    }
    ont.format = fmt;
    ont.source = path.resolve(filePath);
    return ont;
  }

  /**
   * Load from a string. Format is auto-detected unless given.
   */
  loadFromString(text, ontologyIRI = null, format = null) {
    const fmt = format || this.detectFormat(null, text);
    if (fmt === 'Turtle') {
      const store = new TurtleParser().parse(text);
      return triplesToOntology(store, { ontologyIRI });
    }
    if (fmt === 'Functional') {
      return new FunctionalSyntaxParser().parse(text, ontologyIRI || undefined);
    }
    return parseRDFXML(text, ontologyIRI);
  }

  /**
   * Load an ontology and follow its owl:imports transitively (H6).
   * Imported ontologies are merged into a single result ontology. A `visited`
   * set prevents infinite recursion on cyclic imports.
   *
   * Import resolution strategy: if the import IRI looks like a relative or
   * absolute local path (file exists), load it; otherwise skip silently
   * (network imports are out of scope for a local library).
   *
   * @param {string} filePath
   * @param {(iri:string, fromFile:string)=>string|null} [resolveImport]
   *   Map an import IRI to a local file path, or null to skip. Default: treat
   *   import IRI as a path relative to the importing file.
   * @returns {OWLOntology} merged ontology (imports' axioms included)
   */
  loadWithImports(filePath, resolveImport = null) {
    const visited = new Set();
    const merged = new OWLOntology(new OWLOntologyID());
    const resolver = resolveImport || ((iri, fromFile) => {
      if (fs.existsSync(iri)) return iri;
      const rel = path.resolve(path.dirname(fromFile), iri);
      if (fs.existsSync(rel)) return rel;
      return null;
    });
    const walk = (fp) => {
      const abs = path.resolve(fp);
      if (visited.has(abs)) return;
      visited.add(abs);
      let ont;
      try {
        ont = this.loadFromFile(abs);
      } catch {
        return;
      }
      if (!merged.getOntologyID().ontologyIRI && ont.getOntologyID().ontologyIRI) {
        merged.id.ontologyIRI = ont.getOntologyID().ontologyIRI;
        merged.id.versionIRI = ont.getOntologyID().versionIRI;
      }
      for (const ax of ont.getAxioms()) merged.addAxiom(ax);
      for (const ann of ont.getOntologyAnnotations()) merged.addOntologyAnnotation(ann);
      for (const imp of ont.imports || []) {
        const impStr = imp && imp.toString ? imp.toString() : String(imp);
        merged.imports.push(impStr);
        const target = resolver(impStr, abs);
        if (target) walk(target);
      }
    };
    walk(filePath);
    merged.format = 'merged(' + (this.detectFormat(filePath, '')) + ')';
    return merged;
  }
}

module.exports = { OntologyLoader };

