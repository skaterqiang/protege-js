'use strict';

// SWRL built-in evaluator + forward-chaining rule engine over TripleStore.
// Applies each rule repeatedly: for each match of the antecedent, asserts the
// consequent as new triples. Continues to fixpoint.

const { SWRLB_NS, AtomType } = require('../model/SWRL');
const { NS } = require('./rdf');
const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL, XSD = NS.XSD;

function isVar(t) { return t && typeof t === 'object' && t.iri && t.iri.toString && t.iri.toString().startsWith('urn:swrl:var:'); }
function varName(t) { return t.iri.toString().slice('urn:swrl:var:'.length); }

function lit(value, datatype) {
  if (typeof value === 'string' && value.startsWith('"')) return value; // already encoded
  if (typeof value === 'number') {
    const dt = Number.isInteger(value) ? 'integer' : 'double';
    return `"${value}"^^<${XSD}${dt}>`;
  }
  if (typeof value === 'boolean') return `"${value}"^^<${XSD}boolean>`;
  return `"${String(value)}"^^<${XSD}string>`;
}

function parseLiteral(lex) {
  if (typeof lex !== 'string' || !lex.startsWith('"')) return null;
  const end = lex.lastIndexOf('"');
  const v = lex.slice(1, end);
  const m = lex.slice(end + 1).match(/^\^\^<([^>]+)>/);
  const dt = m ? m[1] : null;
  if (dt === XSD + 'integer' || dt === XSD + 'int' || dt === XSD + 'long' || dt === XSD + 'short' || dt === XSD + 'byte') return parseInt(v, 10);
  if (dt === XSD + 'decimal' || dt === XSD + 'double' || dt === XSD + 'float') return parseFloat(v);
  if (dt === XSD + 'boolean') return v === 'true' || v === '1';
  return v;
}

class SWRLBuiltins {
  static call(name, args) {
    // args already evaluated (JS values); return boolean or assignment value
    const n = name.startsWith(SWRLB_NS) ? name.slice(SWRLB_NS.length) : name;
    switch (n) {
      case 'equal': return args[0] === args[1];
      case 'notEqual': return args[0] !== args[1];
      case 'lessThan': return args[0] < args[1];
      case 'lessThanOrEqual': return args[0] <= args[1];
      case 'greaterThan': return args[0] > args[1];
      case 'greaterThanOrEqual': return args[0] >= args[1];
      case 'add': return args[0] + args[1];
      case 'subtract': return args[0] - args[1];
      case 'multiply': return args[0] * args[1];
      case 'divide': return args[1] === 0 ? null : args[0] / args[1];
      case 'integerDivide': return args[1] === 0 ? null : Math.floor(args[0] / args[1]);
      case 'mod': return args[1] === 0 ? null : args[0] % args[1];
      case 'pow': return Math.pow(args[0], args[1]);
      case 'abs': return Math.abs(args[0]);
      case 'ceiling': return Math.ceil(args[0]);
      case 'floor': return Math.floor(args[0]);
      case 'round': return Math.round(args[0]);
      case 'roundHalfToEven': {
        const x = args[0]; const f = Math.floor(x); const diff = x - f;
        if (diff > 0.5) return f + 1;
        if (diff < 0.5) return f;
        return f % 2 === 0 ? f : f + 1;
      }
      case 'sqrt': return Math.sqrt(args[0]);
      case 'sin': return Math.sin(args[0]);
      case 'cos': return Math.cos(args[0]);
      case 'tan': return Math.tan(args[0]);
      case 'stringConcat': return args.slice(0, -1).join('') === args[args.length - 1] ? true : args.join('');
      case 'substring': {
        const s = String(args[0]); const start = args[1]; const len = args[2];
        return s.substr(start, len);
      }
      case 'stringLength': return String(args[0]).length;
      case 'normalizeSpace': return String(args[0]).trim().replace(/\s+/g, ' ');
      case 'upperCase': return String(args[0]).toUpperCase();
      case 'lowerCase': return String(args[0]).toLowerCase();
      case 'contains': return String(args[0]).includes(String(args[1]));
      case 'startsWith': return String(args[0]).startsWith(String(args[1]));
      case 'endsWith': return String(args[0]).endsWith(String(args[1]));
      case 'matches': return new RegExp(args[1]).test(String(args[0]));
      case 'replace': return String(args[0]).replace(new RegExp(args[1], 'g'), String(args[2]));
      // --- string long-tail ---
      case 'stringEqualIgnoreCase': return String(args[0]).toLowerCase() === String(args[1]).toLowerCase();
      case 'translate': {
        const s = String(args[0]), from = String(args[1]), to = String(args[2]);
        let out = '';
        for (const ch of s) {
          const idx = from.indexOf(ch);
          if (idx < 0) { out += ch; continue; }
          if (idx < to.length) out += to[idx];
          // if from longer than to at this idx, char is deleted
        }
        return out;
      }
      case 'substringBefore': {
        const s = String(args[0]), m = String(args[1]);
        const i = s.indexOf(m);
        return i < 0 ? '' : s.slice(0, i);
      }
      case 'substringAfter': {
        const s = String(args[0]), m = String(args[1]);
        const i = s.indexOf(m);
        return i < 0 ? '' : s.slice(i + m.length);
      }
      // --- boolean ---
      case 'booleanNot': return !args[0];
      // --- list operations (lists as JS arrays) ---
      case 'listConcat': {
        const lists = args.slice(0, -1);
        const result = lists.reduce((acc, l) => acc.concat(l), []);
        const last = args[args.length - 1];
        if (Array.isArray(last)) return JSON.stringify(result) === JSON.stringify(last) ? true : result;
        return result;
      }
      case 'listIntersection': {
        const a = Array.isArray(args[0]) ? args[0] : [];
        const b = Array.isArray(args[1]) ? args[1] : [];
        const inter = a.filter(x => b.includes(x));
        if (args.length > 2 && Array.isArray(args[2])) {
          return JSON.stringify(inter) === JSON.stringify(args[2]) ? true : inter;
        }
        return inter;
      }
      case 'listSubtraction': {
        const a = Array.isArray(args[0]) ? args[0] : [];
        const b = Array.isArray(args[1]) ? args[1] : [];
        const diff = a.filter(x => !b.includes(x));
        if (args.length > 2 && Array.isArray(args[2])) {
          return JSON.stringify(diff) === JSON.stringify(args[2]) ? true : diff;
        }
        return diff;
      }
      case 'member': return Array.isArray(args[1]) && args[1].includes(args[0]);
      case 'length': return Array.isArray(args[0]) ? args[0].length : 0;
      case 'first': return Array.isArray(args[0]) && args[0].length ? args[0][0] : null;
      case 'rest': return Array.isArray(args[0]) ? args[0].slice(1) : [];
      case 'sublist': {
        const list = Array.isArray(args[0]) ? args[0] : [];
        const sub = Array.isArray(args[1]) ? args[1] : [];
        if (!sub.length) return true;
        outer: for (let i = 0; i + sub.length <= list.length; i++) {
          for (let j = 0; j < sub.length; j++) if (list[i + j] !== sub[j]) continue outer;
          return true;
        }
        return false;
      }
      case 'empty': return Array.isArray(args[0]) && args[0].length === 0;
      default: return null;
    }
  }
}

// Forward-chaining SWRL execution. rule: SWRLRule; store: TripleStore.
// atom property/class references are OWL entities with .iri (IRI instance).
// arg values: SWRLVariable (iri urn:swrl:var:NAME), OWLNamedIndividual, or literal.
class SWRLReasoner {
  constructor(store) {
    this.store = store;
  }

  /** Run rules until fixpoint. Returns number of new facts added. */
  run(rules) {
    let totalNew = 0;
    let changed = true;
    let rounds = 0;
    while (changed && rounds++ < 200) {
      changed = false;
      for (const rule of rules) {
        const newFacts = this._applyRule(rule);
        if (newFacts > 0) { changed = true; totalNew += newFacts; }
      }
    }
    return totalNew;
  }

  _applyRule(rule) {
    // Gather all body matches via backtracking over atoms.
    const bindings = [{}];
    for (const atom of rule.body) {
      const next = [];
      for (const b of bindings) {
        for (const nb of this._matchAtom(atom, b)) next.push(nb);
      }
      bindings.length = 0;
      bindings.push(...next);
      if (bindings.length === 0) return 0;
    }
    let added = 0;
    for (const b of bindings) {
      for (const atom of rule.head) {
        if (this._emitAtom(atom, b)) added++;
      }
    }
    return added;
  }

  _resolve(t, binding) {
    if (isVar(t)) {
      const k = varName(t);
      if (k in binding) return binding[k];
      return { var: k };
    }
    // OWLNamedIndividual or literal
    if (t && t.iri) return t.iri.toString();
    if (t && typeof t === 'object' && 'lexicalValue' in t) {
      const dt = t.datatype ? t.datatype.iri.toString() : XSD + 'string';
      return `"${t.lexicalValue}"^^<${dt}>`;
    }
    return String(t);
  }

  _bind(binding, varKey, value) {
    if (varKey in binding) return binding[varKey] === value ? binding : null;
    const nb = { ...binding, [varKey]: value };
    return nb;
  }

  _matchAtom(atom, binding) {
    const S = this.store;
    const results = [];
    switch (atom.type) {
      case AtomType.CLASS: {
        const cls = atom.classExpression && atom.classExpression.iri
          ? atom.classExpression.iri.toString()
          : String(atom.classExpression);
        const arg = this._resolve(atom.arg, binding);
        if (arg.var) {
          // bind all instances
          for (const [s] of S.match(null, RDF + 'type', cls)) {
            const nb = this._bind(binding, arg.var, s);
            if (nb) results.push(nb);
          }
        } else {
          if (S.match(arg, RDF + 'type', cls).length > 0) results.push(binding);
        }
        return results;
      }
      case AtomType.OBJECT_PROPERTY: {
        const p = atom.property.iri.toString();
        const a1 = this._resolve(atom.arg1, binding);
        const a2 = this._resolve(atom.arg2, binding);
        const subjects = a1.var ? S.match(null, p, null).map(t => t[0]) : [a1];
        for (const s of subjects) {
          const objs = S.match(s, p, null).map(t => t[2]);
          for (const o of objs) {
            let nb = binding;
            if (a1.var) { nb = this._bind(nb, a1.var, s); if (!nb) continue; }
            if (a2.var) { nb = this._bind(nb, a2.var, o); if (!nb) continue; }
            else if (o !== a2) continue;
            results.push(nb);
          }
        }
        return results;
      }
      case AtomType.DATA_PROPERTY: {
        const p = atom.property.iri.toString();
        const a1 = this._resolve(atom.arg1, binding);
        const a2 = this._resolve(atom.arg2, binding);
        const subjects = a1.var ? S.match(null, p, null).map(t => t[0]) : [a1];
        for (const s of subjects) {
          const objs = S.match(s, p, null).map(t => t[2]);
          for (const o of objs) {
            let nb = binding;
            if (a1.var) { nb = this._bind(nb, a1.var, s); if (!nb) continue; }
            if (a2.var) { nb = this._bind(nb, a2.var, o); if (!nb) continue; }
            else if (o !== a2) continue;
            results.push(nb);
          }
        }
        return results;
      }
      case AtomType.SAME_AS: {
        const a1 = this._resolve(atom.arg1, binding);
        const a2 = this._resolve(atom.arg2, binding);
        if (a1.var && a2.var) {
          // try all sameAs pairs
          for (const [s, , o] of S.match(null, OWL + 'sameAs', null)) {
            const nb1 = this._bind(binding, a1.var, s);
            if (nb1) { const nb2 = this._bind(nb1, a2.var, o); if (nb2) results.push(nb2); }
          }
          return results;
        }
        if (a1.var) {
          const vals = S.match(null, OWL + 'sameAs', a2).map(t => t[0])
            .concat(S.match(a2, OWL + 'sameAs', null).map(t => t[2]));
          for (const v of vals) { const nb = this._bind(binding, a1.var, v); if (nb) results.push(nb); }
          return results;
        }
        if (a2.var) {
          const vals = S.match(null, OWL + 'sameAs', a1).map(t => t[0])
            .concat(S.match(a1, OWL + 'sameAs', null).map(t => t[2]));
          for (const v of vals) { const nb = this._bind(binding, a2.var, v); if (nb) results.push(nb); }
          return results;
        }
        if (a1 === a2 || S.match(a1, OWL + 'sameAs', a2).length > 0 || S.match(a2, OWL + 'sameAs', a1).length > 0) {
          results.push(binding);
        }
        return results;
      }
      case AtomType.DIFFERENT_FROM: {
        const a1 = this._resolve(atom.arg1, binding);
        const a2 = this._resolve(atom.arg2, binding);
        if (a1.var || a2.var) return results; // open world: skip
        if (a1 !== a2 && (S.match(a1, OWL + 'differentFrom', a2).length > 0 || S.match(a2, OWL + 'differentFrom', a1).length > 0)) {
          results.push(binding);
        }
        return results;
      }
      case AtomType.BUILTIN: {
        // Evaluate: if last arg is a variable, bind result; else check truthiness.
        const args = atom.args.map(a => {
          const r = this._resolve(a, binding);
          return r;
        });
        // find first unbound
        let unboundIdx = -1;
        const values = [];
        for (let i = 0; i < args.length; i++) {
          if (args[i] && args[i].var) { unboundIdx = i; values.push(null); }
          else values.push(parseLiteral(args[i]) !== null ? parseLiteral(args[i]) : args[i]);
        }
        if (unboundIdx === -1) {
          // all bound: predicate form (equal, lessThan, ...)
          const res = SWRLBuiltins.call(atom.builtin.toString(), values);
          if (res === true) results.push(binding);
        } else {
          // compute builtin with all-but-last bound, bind last
          const vals = values.slice();
          vals.splice(unboundIdx, 1);
          const res = SWRLBuiltins.call(atom.builtin.toString(), vals);
          if (res !== null && res !== false && res !== true) {
            const key = args[unboundIdx].var;
            const dt = typeof res === 'number' ? (Number.isInteger(res) ? XSD + 'integer' : XSD + 'double') : XSD + 'string';
            const enc = `"${res}"^^<${dt}>`;
            const nb = this._bind(binding, key, enc);
            if (nb) results.push(nb);
          }
        }
        return results;
      }
      default:
        return results;
    }
  }

  _emitAtom(atom, binding) {
    const S = this.store;
    switch (atom.type) {
      case AtomType.CLASS: {
        const cls = atom.classExpression && atom.classExpression.iri
          ? atom.classExpression.iri.toString()
          : String(atom.classExpression);
        const arg = this._resolve(atom.arg, binding);
        if (arg.var) return false; // cannot assert unbound
        if (S.match(arg, RDF + 'type', cls).length === 0) {
          S.add(arg, RDF + 'type', cls);
          return true;
        }
        return false;
      }
      case AtomType.OBJECT_PROPERTY: {
        const p = atom.property.iri.toString();
        const s = this._resolve(atom.arg1, binding);
        const o = this._resolve(atom.arg2, binding);
        if (s.var || o.var) return false;
        if (S.match(s, p, o).length === 0) {
          S.add(s, p, o);
          return true;
        }
        return false;
      }
      case AtomType.DATA_PROPERTY: {
        const p = atom.property.iri.toString();
        const s = this._resolve(atom.arg1, binding);
        const o = this._resolve(atom.arg2, binding);
        if (s.var || o.var) return false;
        if (S.match(s, p, o).length === 0) {
          S.add(s, p, o);
          return true;
        }
        return false;
      }
      case AtomType.SAME_AS: {
        const a = this._resolve(atom.arg1, binding);
        const b = this._resolve(atom.arg2, binding);
        if (a.var || b.var) return false;
        if (S.match(a, OWL + 'sameAs', b).length === 0) {
          S.add(a, OWL + 'sameAs', b);
          return true;
        }
        return false;
      }
      case AtomType.DIFFERENT_FROM: {
        const a = this._resolve(atom.arg1, binding);
        const b = this._resolve(atom.arg2, binding);
        if (a.var || b.var) return false;
        if (S.match(a, OWL + 'differentFrom', b).length === 0) {
          S.add(a, OWL + 'differentFrom', b);
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }
}

module.exports = { SWRLReasoner, SWRLBuiltins };
