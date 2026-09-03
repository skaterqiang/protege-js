'use strict';

// ---------------------------------------------------------------------------
// inference/rules/owl2ql — OWL 2 QL rule subset.
// QL is designed for query answering over large ABoxes; it supports a
// restricted TBox (subClassOf with limited superclass forms, subPropertyOf,
// domain/range). The sound+complete rule subset excludes equality (sameAs),
// functional properties, and complex class expressions on the superclass side.
// ---------------------------------------------------------------------------

// Rule IDs from owl2rl.js that are sound for QL.
// QL deliberately EXCLUDES: eq-* (equality), prp-fp/prp-ifp (functionality),
// cax-dw (disjointness-driven inconsistency is fine to keep for consistency
// checking but not needed for query answering), cls-* complex forms.
const QL_RULE_IDS = [
  // Class hierarchy
  'cls-svf1', 'cls-svf2',      // someValuesFrom
  'cls-avf',                   // allValuesFrom (kept: sound, cheap)
  'cax-sco',                   // subclass inheritance of membership
  'cax-eqc1', 'cax-eqc2',      // equivalentClass membership propagation
  // Property hierarchy
  'prp-spo1',                  // subPropertyOf propagation
  'prp-dom', 'prp-rng',        // domain / range typing
  'prp-inv1', 'prp-inv2',      // inverseOf
  'prp-eqp1', 'prp-eqp2',      // equivalentProperty
  'cax-adc'                    // differentIndividuals via pairwise differentFrom
];

module.exports = { QL_RULE_IDS };
