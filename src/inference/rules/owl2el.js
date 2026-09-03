'use strict';

// ---------------------------------------------------------------------------
// inference/rules/owl2el — OWL 2 EL rule subset.
// EL is designed for large TBoxes (classification in polynomial time). It
// supports existential restrictions (someValuesFrom), intersection, nominals
// are excluded. EL excludes: disjunction (unionOf), complement, allValuesFrom
// propagation is NOT sound for classification, inverseOf, cardinality.
// The rule subset below is sound for EL classification.
// ---------------------------------------------------------------------------

// Rule IDs from owl2rl.js that are sound for EL.
// EL KEEPS: someValuesFrom, intersection, subClassOf, subPropertyOf chains,
// domain/range (existential form), transitivity (via chains).
// EL DROPS: cls-avf (allValuesFrom), cls-int1 is kept (intersection), union
// handling, complement, equality-heavy rules are partially kept for nominals
// but sameAs reasoning is excluded in the minimal EL profile.
const EL_RULE_IDS = [
  // Existential restrictions
  'cls-svf1', 'cls-svf2',
  // Intersection
  'cls-int1', 'cls-int2',
  // Class hierarchy
  'cax-sco', 'cax-eqc1', 'cax-eqc2',
  // Property hierarchy + chains
  'prp-spo1', 'prp-spo2',      // spo2 = property chain
  'prp-dom', 'prp-rng',
  'prp-trp',                   // transitivity (EL supports it)
  // Top/bottom
  'cls-thing', 'cls-nothing1'
];

module.exports = { EL_RULE_IDS };
