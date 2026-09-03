'use strict';

const { TripleStore } = require('./TripleStore');
const { rules } = require('./rules/owl2rl');

// ---------------------------------------------------------------------------
// OWL2RLReasoner — forward-chaining materialization of the OWL 2 RL ruleset.
// Runs all 78 rules to a fixpoint. Rules whose consequent is `false` record
// an inconsistency instead of throwing.
// ---------------------------------------------------------------------------

class OWL2RLReasoner {
  constructor(store) {
    this.store = store || new TripleStore();
    this.inconsistencies = [];   // [{rule, message}]
    this._inferred = new Set();  // triples added during materialization
    this._rounds = 0;
  }

  _add(s, p, o) {
    const isNew = this.store.add(s, p, o);
    if (isNew) this._inferred.add(TripleStore.key(String(s), String(p), String(o)));
    return isNew;
  }

  _conflict(rule, message) {
    // dedupe identical findings
    if (!this.inconsistencies.some(c => c.rule === rule && c.message === message)) {
      this.inconsistencies.push({ rule, message });
    }
  }

  /** Run the ruleset to a fixpoint. Returns number of new triples derived. */
  materialize(maxRounds = 1000) {
    const add = (s, p, o) => this._add(s, p, o);
    const conflict = (rule, msg) => this._conflict(rule, msg);
    let round = 0;
    let changed = true;
    while (changed && round < maxRounds) {
      round++;
      const before = this.store.size();
      for (const [id, fn] of Object.entries(rules)) {
        fn(this.store, add, (msg) => conflict(id, msg));
      }
      changed = this.store.size() > before;
      // conflicts don't add triples, so keep looping while they emerge? They are
      // terminal; no need to loop for conflicts alone.
    }
    this._rounds = round;
    return this._inferred.size;
  }

  /** True iff no inconsistency was recorded. */
  isConsistent() { return this.inconsistencies.length === 0; }

  /** Number of triples inferred (not present in the input). */
  getInferredCount() { return this._inferred.size; }

  /** True iff triple (s,p,o) holds in the materialized store. */
  entails(s, p, o) { return this.store.has(s, p, o); }

  getRounds() { return this._rounds; }
}

module.exports = { OWL2RLReasoner, TripleStore };
