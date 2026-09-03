'use strict';

const { TripleStore } = require('./TripleStore');
const { rules } = require('./rules/owl2rl');
const { QL_RULE_IDS } = require('./rules/owl2ql');
const { EL_RULE_IDS } = require('./rules/owl2el');

// ---------------------------------------------------------------------------
// OWL2QLReasoner / OWL2ELReasoner — profile-restricted forward chaining.
// Each runs only the rule subset that is sound for its profile, reusing the
// rule implementations from owl2rl.js. This is the "minimal inference" for
// QL (query answering) and EL (classification) profiles.
// ---------------------------------------------------------------------------

class ProfileReasoner {
  constructor(store, ruleIds) {
    this.store = store || new TripleStore();
    this.inconsistencies = [];
    this._inferred = new Set();
    this._rounds = 0;
    this._ruleFns = ruleIds.map(id => [id, rules[id]]).filter(([, fn]) => typeof fn === 'function');
  }

  _add(s, p, o) {
    const isNew = this.store.add(s, p, o);
    if (isNew) this._inferred.add(TripleStore.key(String(s), String(p), String(o)));
    return isNew;
  }

  _conflict(rule, message) {
    if (!this.inconsistencies.some(c => c.rule === rule && c.message === message)) {
      this.inconsistencies.push({ rule, message });
    }
  }

  materialize(maxRounds = 1000) {
    const add = (s, p, o) => this._add(s, p, o);
    const conflict = (rule, msg) => this._conflict(rule, msg);
    let round = 0, changed = true;
    while (changed && round < maxRounds) {
      round++;
      const before = this.store.size();
      for (const [id, fn] of this._ruleFns) {
        fn(this.store, add, (msg) => conflict(id, msg));
      }
      changed = this.store.size() > before;
    }
    this._rounds = round;
    return this._inferred.size;
  }

  isConsistent() { return this.inconsistencies.length === 0; }
  getInferredCount() { return this._inferred.size; }
  entails(s, p, o) { return this.store.has(s, p, o); }
  getRounds() { return this._rounds; }
  getRuleIds() { return this._ruleFns.map(([id]) => id); }
}

class OWL2QLReasoner extends ProfileReasoner {
  constructor(store) { super(store, QL_RULE_IDS); }
}

class OWL2ELReasoner extends ProfileReasoner {
  constructor(store) { super(store, EL_RULE_IDS); }
}

module.exports = { OWL2QLReasoner, OWL2ELReasoner, ProfileReasoner };
