'use strict';

// ---------------------------------------------------------------------------
// inference/ReasonerQueries — high-level query API over a materialized
// OWL2RLReasoner. Mirrors the OWLReasoner query methods of the OWL API:
// getSubClasses / getSuperClasses / getInstances / getTypes / isSubClassOf /
// isSatisfiable / getEquivalentClasses.
// ---------------------------------------------------------------------------

const { NS } = require('./rdf');
const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL;

class ReasonerQueries {
  /**
   * @param {OWL2RLReasoner} reasoner  already materialized (call .materialize() first)
   */
  constructor(reasoner) {
    this.reasoner = reasoner;
    this.store = reasoner.store;
  }

  /** Direct + indirect subclasses of `clsIRI`. */
  getSubClasses(clsIRI, { direct = false } = {}) {
    const subs = this.store.subjects(RDFS + 'subClassOf', clsIRI);
    if (direct) return subs;
    return subs;
  }

  /** Direct + indirect superclasses of `clsIRI`. */
  getSuperClasses(clsIRI, { direct = false } = {}) {
    return this.store.objects(clsIRI, RDFS + 'subClassOf');
  }

  /** All instances (individuals) of `clsIRI`. */
  getInstances(clsIRI) {
    return this.store.subjects(RDF + 'type', clsIRI)
      .filter(s => !String(s).startsWith('_:'));
  }

  /** All classes that `individualIRI` is an instance of. */
  getTypes(individualIRI) {
    return this.store.objects(individualIRI, RDF + 'type')
      .filter(t => t !== OWL + 'NamedIndividual' && t !== OWL + 'Class'
        && t !== OWL + 'ObjectProperty' && t !== OWL + 'DatatypeProperty'
        && t !== OWL + 'AnnotationProperty');
  }

  /** True iff sub ⊑ super (asserted or inferred). */
  isSubClassOf(subIRI, superIRI) {
    return this.store.has(subIRI, RDFS + 'subClassOf', superIRI);
  }

  /** True iff sub ⊑ super along subPropertyOf. */
  isSubPropertyOf(subIRI, superIRI) {
    return this.store.has(subIRI, RDFS + 'subPropertyOf', superIRI);
  }

  /** Equivalent classes of clsIRI (owl:equivalentClass both directions). */
  getEquivalentClasses(clsIRI) {
    const fwd = this.store.objects(clsIRI, OWL + 'equivalentClass');
    const bwd = this.store.subjects(OWL + 'equivalentClass', clsIRI);
    return [...new Set([...fwd, ...bwd])];
  }

  /** Disjoint classes of clsIRI. */
  getDisjointClasses(clsIRI) {
    const fwd = this.store.objects(clsIRI, OWL + 'disjointWith');
    const bwd = this.store.subjects(OWL + 'disjointWith', clsIRI);
    return [...new Set([...fwd, ...bwd])];
  }

  /** Same individuals (owl:sameAs both directions). */
  getSameIndividuals(indIRI) {
    const fwd = this.store.objects(indIRI, OWL + 'sameAs');
    const bwd = this.store.subjects(OWL + 'sameAs', indIRI);
    return [...new Set([...fwd, ...bwd])];
  }

  /**
   * A class is unsatisfiable iff it is subclass of owl:Nothing.
   * True = satisfiable (no proof of emptiness under OWA).
   */
  isSatisfiable(clsIRI) {
    return !this.store.has(clsIRI, RDFS + 'subClassOf', OWL + 'Nothing');
  }

  /** Object property values for an individual. */
  getObjectPropertyValues(indIRI, propIRI) {
    return this.store.objects(indIRI, propIRI);
  }

  /** Data property values for an individual. */
  getDataPropertyValues(indIRI, propIRI) {
    return this.store.objects(indIRI, propIRI);
  }

  /** Named roots: classes that are not a subclass of any named class except owl:Thing. */
  getTopClasses() {
    const allClasses = new Set();
    for (const [s] of this.store.match(null, RDF + 'type', OWL + 'Class')) {
      if (!String(s).startsWith('_:')) allClasses.add(s);
    }
    const hasSuper = new Set();
    for (const [s, , o] of this.store.match(null, RDFS + 'subClassOf', null)) {
      if (!String(o).startsWith('_:') && o !== OWL + 'Thing') hasSuper.add(s);
    }
    return [...allClasses].filter(c => !hasSuper.has(c));
  }
}

module.exports = { ReasonerQueries };
