'use strict';

const { NS, P, C, literal } = require('../rdf');

// ---------------------------------------------------------------------------
// Equality rules (eq-*) — 9 rules.
// Each rule: (store, add, conflict) => void
//   store    TripleStore
//   add(s,p,o)  derive a new triple (returns true if new)
//   conflict(ruleId, desc)  record an inconsistency (consequent false)
// ---------------------------------------------------------------------------

const BUILTIN_ANNOTATION_PROPERTIES = [
  NS.RDFS + 'label', NS.RDFS + 'comment', NS.RDFS + 'seeAlso', NS.RDFS + 'isDefinedBy',
  NS.OWL + 'versionInfo', NS.OWL + 'priorVersion', NS.OWL + 'backwardCompatibleWith',
  NS.OWL + 'incompatibleWith', NS.OWL + 'deprecated'
];

const BUILTIN_DATATYPES = [
  // Core scalar types
  NS.XSD + 'string', NS.XSD + 'boolean', NS.XSD + 'decimal', NS.XSD + 'integer',
  NS.XSD + 'int', NS.XSD + 'long', NS.XSD + 'short', NS.XSD + 'byte',
  NS.XSD + 'nonNegativeInteger', NS.XSD + 'nonPositiveInteger',
  NS.XSD + 'positiveInteger', NS.XSD + 'negativeInteger',
  NS.XSD + 'unsignedLong', NS.XSD + 'unsignedInt', NS.XSD + 'unsignedShort', NS.XSD + 'unsignedByte',
  NS.XSD + 'float', NS.XSD + 'double', NS.XSD + 'dateTime', NS.XSD + 'dateTimeStamp',
  // Date / time family
  NS.XSD + 'date', NS.XSD + 'time', NS.XSD + 'duration',
  NS.XSD + 'yearMonthDuration', NS.XSD + 'dayTimeDuration',
  NS.XSD + 'gYear', NS.XSD + 'gYearMonth', NS.XSD + 'gMonth', NS.XSD + 'gMonthDay', NS.XSD + 'gDay',
  // String subtypes
  NS.XSD + 'normalizedString', NS.XSD + 'token', NS.XSD + 'language',
  NS.XSD + 'Name', NS.XSD + 'NCName', NS.XSD + 'NMTOKEN',
  // Binary
  NS.XSD + 'hexBinary', NS.XSD + 'base64Binary',
  // IRI-ish
  NS.XSD + 'anyURI',
  // OWL numeric
  NS.OWL + 'real', NS.OWL + 'rational',
  // RDF literals
  NS.RDFS + 'Literal', NS.RDF + 'PlainLiteral', NS.RDF + 'XMLLiteral', NS.RDF + 'HTML',
  NS.RDF + 'langString', NS.RDF + 'JSON'
];

function sameAsClosure(store) {
  // Build symmetric+transitive sameAs equivalence classes.
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const [s, , o] of store.match(null, P.sameAs, null)) union(s, o);
  return { find };
}

const rules = {

  // ---- eq -----------------------------------------------------------------

  'eq-ref'(store, add) {
    for (const [s, p, o] of store.all()) {
      add(s, P.sameAs, s);
      if (!p.startsWith('"')) add(p, P.sameAs, p);
      if (!o.startsWith('"')) add(o, P.sameAs, o);
    }
  },

  'eq-sym'(store, add) {
    for (const [x, , y] of store.match(null, P.sameAs, null)) add(y, P.sameAs, x);
  },

  'eq-trans'(store, add) {
    const { find } = sameAsClosure(store);
    const members = new Map();
    for (const [s] of store.match(null, P.sameAs, null)) {
      const r = find(s);
      if (!members.has(r)) members.set(r, new Set());
      members.get(r).add(s);
    }
    for (const [, , o] of store.match(null, P.sameAs, null)) {
      const r = find(o);
      if (!members.has(r)) members.set(r, new Set());
      members.get(r).add(o);
    }
    for (const set of members.values()) {
      const arr = [...set];
      for (const a of arr) for (const b of arr) if (a !== b) add(a, P.sameAs, b);
    }
  },

  'eq-rep-s'(store, add) {
    for (const [s, , sp] of store.match(null, P.sameAs, null)) {
      if (s === sp) continue;
      for (const [, p, o] of store.match(s, null, null)) {
        if (p !== P.sameAs) add(sp, p, o);
      }
    }
  },

  'eq-rep-p'(store, add) {
    for (const [p, , pp] of store.match(null, P.sameAs, null)) {
      if (p === pp) continue;
      for (const [s, , o] of store.match(null, p, null)) add(s, pp, o);
    }
  },

  'eq-rep-o'(store, add) {
    for (const [o, , op] of store.match(null, P.sameAs, null)) {
      if (o === op) continue;
      for (const [s, p] of store.match(null, null, o)) {
        if (p !== P.sameAs) add(s, p, op);
      }
    }
  },

  'eq-diff1'(store, add, conflict) {
    const { find } = sameAsClosure(store);
    for (const [x, , y] of store.match(null, P.differentFrom, null)) {
      if (find(x) === find(y)) conflict('eq-diff1', `${x} sameAs and differentFrom ${y}`);
    }
  },

  'eq-diff2'(store, add, conflict) {
    const { find } = sameAsClosure(store);
    for (const x of store.subjects(P.type, C.AllDifferent)) {
      for (const y of store.objects(x, P.members)) {
        const zs = store.listElements(y);
        for (let i = 0; i < zs.length; i++)
          for (let j = i + 1; j < zs.length; j++)
            if (find(zs[i]) === find(zs[j])) conflict('eq-diff2', `${zs[i]} sameAs ${zs[j]} in AllDifferent`);
      }
    }
  },

  'eq-diff3'(store, add, conflict) {
    const { find } = sameAsClosure(store);
    for (const x of store.subjects(P.type, C.AllDifferent)) {
      for (const y of store.objects(x, P.distinctMembers)) {
        const zs = store.listElements(y);
        for (let i = 0; i < zs.length; i++)
          for (let j = i + 1; j < zs.length; j++)
            if (find(zs[i]) === find(zs[j])) conflict('eq-diff3', `${zs[i]} sameAs ${zs[j]} in AllDifferent distinctMembers`);
      }
    }
  },

  // ---- prp ----------------------------------------------------------------

  'prp-ap'(store, add) {
    for (const ap of BUILTIN_ANNOTATION_PROPERTIES) add(ap, P.type, C.AnnotationProperty);
  },

  'prp-dom'(store, add) {
    for (const [p, , c] of store.match(null, P.domain, null)) {
      for (const [x, , ] of store.match(null, p, null)) add(x, P.type, c);
    }
  },

  'prp-rng'(store, add) {
    for (const [p, , c] of store.match(null, P.range, null)) {
      for (const [, , y] of store.match(null, p, null)) {
        if (!y.startsWith('"')) add(y, P.type, c);
      }
    }
  },

  'prp-fp'(store, add) {
    for (const p of store.subjects(P.type, C.FunctionalProperty)) {
      const bySubj = new Map();
      for (const [x, , y] of store.match(null, p, null)) {
        if (!bySubj.has(x)) bySubj.set(x, new Set());
        bySubj.get(x).add(y);
      }
      for (const ys of bySubj.values()) {
        const arr = [...ys];
        for (let i = 1; i < arr.length; i++) add(arr[0], P.sameAs, arr[i]);
      }
    }
  },

  'prp-ifp'(store, add) {
    for (const p of store.subjects(P.type, C.InverseFunctionalProperty)) {
      const byObj = new Map();
      for (const [x, , y] of store.match(null, p, null)) {
        if (!byObj.has(y)) byObj.set(y, new Set());
        byObj.get(y).add(x);
      }
      for (const xs of byObj.values()) {
        const arr = [...xs];
        for (let i = 1; i < arr.length; i++) add(arr[0], P.sameAs, arr[i]);
      }
    }
  },

  'prp-irp'(store, add, conflict) {
    for (const p of store.subjects(P.type, C.IrreflexiveProperty)) {
      for (const [x, , y] of store.match(null, p, null)) {
        if (x === y) conflict('prp-irp', `${x} ${p} itself`);
      }
    }
  },

  'prp-symp'(store, add) {
    for (const p of store.subjects(P.type, C.SymmetricProperty)) {
      for (const [x, , y] of store.match(null, p, null)) add(y, p, x);
    }
  },

  'prp-asyp'(store, add, conflict) {
    for (const p of store.subjects(P.type, C.AsymmetricProperty)) {
      for (const [x, , y] of store.match(null, p, null)) {
        if (store.has(y, p, x)) conflict('prp-asyp', `${x} ${p} ${y} and reverse`);
      }
    }
  },

  'prp-trp'(store, add) {
    for (const p of store.subjects(P.type, C.TransitiveProperty)) {
      // Warshall-style closure along p.
      const edges = store.match(null, p, null).map(([x, , y]) => [x, y]);
      const adj = new Map();
      for (const [x, y] of edges) {
        if (!adj.has(x)) adj.set(x, new Set());
        adj.get(x).add(y);
      }
      for (const [x] of edges) {
        const stack = [...(adj.get(x) || [])];
        const seen = new Set();
        while (stack.length) {
          const y = stack.pop();
          if (seen.has(y)) continue;
          seen.add(y);
          if (y !== x) add(x, p, y);
          for (const z of (adj.get(y) || [])) stack.push(z);
        }
      }
    }
  },

  'prp-spo1'(store, add) {
    for (const [p1, , p2] of store.match(null, P.subPropertyOf, null)) {
      for (const [x, , y] of store.match(null, p1, null)) add(x, p2, y);
    }
  },

  'prp-spo2'(store, add) {
    for (const [p, , listHead] of store.match(null, P.propertyChainAxiom, null)) {
      const chain = store.listElements(listHead);
      if (!chain.length) continue;
      // Find all paths u1 -p1-> u2 -p2-> ... -> un+1
      const extend = (node, idx) => {
        if (idx === chain.length) return [[node]];
        const out = [];
        for (const [, , next] of store.match(node, chain[idx], null)) {
          for (const rest of extend(next, idx + 1)) out.push([node, ...rest]);
        }
        return out;
      };
      // Collect distinct start nodes.
      const starts = new Set(store.match(null, chain[0], null).map(t => t[0]));
      for (const u1 of starts) {
        for (const path of extend(u1, 0)) {
          add(u1, p, path[path.length - 1]);
        }
      }
    }
  },

  'prp-eqp1'(store, add) {
    for (const [p1, , p2] of store.match(null, P.equivalentProperty, null)) {
      for (const [x, , y] of store.match(null, p1, null)) add(x, p2, y);
    }
  },

  'prp-eqp2'(store, add) {
    for (const [p1, , p2] of store.match(null, P.equivalentProperty, null)) {
      for (const [x, , y] of store.match(null, p2, null)) add(x, p1, y);
    }
  },

  'prp-pdw'(store, add, conflict) {
    for (const [p1, , p2] of store.match(null, P.propertyDisjointWith, null)) {
      const t1 = new Set(store.match(null, p1, null).map(([x, , y]) => x + '' + y));
      for (const [x, , y] of store.match(null, p2, null)) {
        if (t1.has(x + '' + y)) conflict('prp-pdw', `${x} ${p1}/${p2} ${y}`);
      }
    }
  },

  'prp-adp'(store, add, conflict) {
    for (const x of store.subjects(P.type, C.AllDisjointProperties)) {
      for (const y of store.objects(x, P.members)) {
        const props = store.listElements(y);
        const seenPair = new Map(); // "u v" -> prop
        for (const p of props) {
          for (const [u, , v] of store.match(null, p, null)) {
            const k = u + '' + v;
            if (seenPair.has(k) && seenPair.get(k) !== p) {
              conflict('prp-adp', `${u} disjoint props on ${v}`);
            }
            seenPair.set(k, p);
          }
        }
      }
    }
  },

  'prp-inv1'(store, add) {
    for (const [p1, , p2] of store.match(null, P.inverseOf, null)) {
      for (const [x, , y] of store.match(null, p1, null)) add(y, p2, x);
    }
  },

  'prp-inv2'(store, add) {
    for (const [p1, , p2] of store.match(null, P.inverseOf, null)) {
      for (const [x, , y] of store.match(null, p2, null)) add(y, p1, x);
    }
  },

  'prp-key'(store, add) {
    for (const [c, , listHead] of store.match(null, P.hasKey, null)) {
      const keys = store.listElements(listHead);
      if (!keys.length) continue;
      const instances = store.subjects(P.type, c);
      const sig = new Map(); // signature -> subject
      for (const x of instances) {
        const vals = keys.map(k => store.objects(x, k).sort().join(','));
        if (vals.some(v => v === '')) continue; // must have all key properties
        const s = vals.join('|');
        if (sig.has(s) && sig.get(s) !== x) add(sig.get(s), P.sameAs, x);
        else sig.set(s, x);
      }
    }
  },

  'prp-npa1'(store, add, conflict) {
    for (const x of store.subjects(P.sourceIndividual, null)) {
      const i1 = store.objects(x, P.sourceIndividual)[0];
      const p = store.objects(x, P.assertionProperty)[0];
      const i2 = store.objects(x, P.targetIndividual)[0];
      if (i1 && p && i2 && store.has(i1, p, i2)) {
        conflict('prp-npa1', `negative assertion violated: ${i1} ${p} ${i2}`);
      }
    }
  },

  'prp-npa2'(store, add, conflict) {
    for (const x of store.subjects(P.sourceIndividual, null)) {
      const i = store.objects(x, P.sourceIndividual)[0];
      const p = store.objects(x, P.assertionProperty)[0];
      const lt = store.objects(x, P.targetValue)[0];
      if (i && p && lt && store.has(i, p, lt)) {
        conflict('prp-npa2', `negative data assertion violated: ${i} ${p} ${lt}`);
      }
    }
  },

  // ---- cls ----------------------------------------------------------------

  'cls-thing'(store, add) { add(C.Thing, P.type, C.Class); },

  'cls-nothing1'(store, add) { add(C.Nothing, P.type, C.Class); },

  'cls-nothing2'(store, add, conflict) {
    for (const x of store.subjects(P.type, C.Nothing)) {
      conflict('cls-nothing2', `${x} typed owl:Nothing`);
    }
  },

  'cls-int1'(store, add) {
    for (const [c, , listHead] of store.match(null, P.intersectionOf, null)) {
      const cs = store.listElements(listHead);
      if (!cs.length) continue;
      // candidates = subjects typed as the first operand
      for (const y of store.subjects(P.type, cs[0])) {
        if (cs.every(ci => store.has(y, P.type, ci))) add(y, P.type, c);
      }
    }
  },

  'cls-int2'(store, add) {
    for (const [c, , listHead] of store.match(null, P.intersectionOf, null)) {
      const cs = store.listElements(listHead);
      for (const y of store.subjects(P.type, c)) {
        for (const ci of cs) add(y, P.type, ci);
      }
    }
  },

  'cls-uni'(store, add) {
    for (const [c, , listHead] of store.match(null, P.unionOf, null)) {
      const cs = store.listElements(listHead);
      for (const ci of cs) {
        for (const y of store.subjects(P.type, ci)) add(y, P.type, c);
      }
    }
  },

  'cls-com'(store, add, conflict) {
    for (const [c1, , c2] of store.match(null, P.complementOf, null)) {
      const inC1 = new Set(store.subjects(P.type, c1));
      for (const x of store.subjects(P.type, c2)) {
        if (inC1.has(x)) conflict('cls-com', `${x} in ${c1} and complement ${c2}`);
      }
    }
  },

  'cls-svf1'(store, add) {
    for (const [x, , y] of store.match(null, P.someValuesFrom, null)) {
      for (const p of store.objects(x, P.onProperty)) {
        for (const [u, , v] of store.match(null, p, null)) {
          if (store.has(v, P.type, y)) add(u, P.type, x);
        }
      }
    }
  },

  'cls-svf2'(store, add) {
    for (const [x, , y] of store.match(null, P.someValuesFrom, null)) {
      if (y !== C.Thing) continue;
      for (const p of store.objects(x, P.onProperty)) {
        for (const [u] of store.match(null, p, null)) add(u, P.type, x);
      }
    }
  },

  'cls-avf'(store, add) {
    for (const [x, , y] of store.match(null, P.allValuesFrom, null)) {
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          for (const [, , v] of store.match(u, p, null)) {
            if (!v.startsWith('"')) add(v, P.type, y);
          }
        }
      }
    }
  },

  'cls-hv1'(store, add) {
    for (const [x, , y] of store.match(null, P.hasValue, null)) {
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) add(u, p, y);
      }
    }
  },

  'cls-hv2'(store, add) {
    for (const [x, , y] of store.match(null, P.hasValue, null)) {
      for (const p of store.objects(x, P.onProperty)) {
        for (const [u] of store.match(null, p, y)) add(u, P.type, x);
      }
    }
  },

  'cls-maxc1'(store, add, conflict) {
    const zero = literal('0', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxCardinality, null)) {
      if (v !== zero) continue;
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          if (store.match(u, p, null).length) conflict('cls-maxc1', `${u} violates maxCardinality 0 on ${p}`);
        }
      }
    }
  },

  'cls-maxc2'(store, add) {
    const one = literal('1', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxCardinality, null)) {
      if (v !== one) continue;
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          const ys = store.match(u, p, null).map(t => t[2]);
          for (let i = 1; i < ys.length; i++) add(ys[0], P.sameAs, ys[i]);
        }
      }
    }
  },

  'cls-maxqc1'(store, add, conflict) {
    const zero = literal('0', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxQualifiedCardinality, null)) {
      if (v !== zero) continue;
      const cs = store.objects(x, P.onClass).filter(c => c !== C.Thing);
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          for (const [, , y] of store.match(u, p, null)) {
            for (const c of cs) {
              if (store.has(y, P.type, c)) conflict('cls-maxqc1', `${u} violates maxQualifiedCardinality 0`);
            }
          }
        }
      }
    }
  },

  'cls-maxqc2'(store, add, conflict) {
    const zero = literal('0', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxQualifiedCardinality, null)) {
      if (v !== zero) continue;
      if (!store.objects(x, P.onClass).includes(C.Thing)) continue;
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          if (store.match(u, p, null).length) conflict('cls-maxqc2', `${u} violates maxQC 0 on Thing`);
        }
      }
    }
  },

  'cls-maxqc3'(store, add) {
    const one = literal('1', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxQualifiedCardinality, null)) {
      if (v !== one) continue;
      const cs = store.objects(x, P.onClass).filter(c => c !== C.Thing);
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          const ys = store.match(u, p, null).map(t => t[2])
            .filter(y => cs.some(c => store.has(y, P.type, c)));
          for (let i = 1; i < ys.length; i++) add(ys[0], P.sameAs, ys[i]);
        }
      }
    }
  },

  'cls-maxqc4'(store, add) {
    const one = literal('1', NS.XSD + 'nonNegativeInteger');
    for (const [x, , v] of store.match(null, P.maxQualifiedCardinality, null)) {
      if (v !== one) continue;
      if (!store.objects(x, P.onClass).includes(C.Thing)) continue;
      for (const p of store.objects(x, P.onProperty)) {
        for (const u of store.subjects(P.type, x)) {
          const ys = store.match(u, p, null).map(t => t[2]);
          for (let i = 1; i < ys.length; i++) add(ys[0], P.sameAs, ys[i]);
        }
      }
    }
  },

  'cls-oo'(store, add) {
    for (const [c, , listHead] of store.match(null, P.oneOf, null)) {
      for (const yi of store.listElements(listHead)) add(yi, P.type, c);
    }
  },

  // ---- cax ----------------------------------------------------------------

  'cax-sco'(store, add) {
    for (const [c1, , c2] of store.match(null, P.subClassOf, null)) {
      for (const x of store.subjects(P.type, c1)) add(x, P.type, c2);
    }
  },

  'cax-eqc1'(store, add) {
    for (const [c1, , c2] of store.match(null, P.equivalentClass, null)) {
      for (const x of store.subjects(P.type, c1)) add(x, P.type, c2);
    }
  },

  'cax-eqc2'(store, add) {
    for (const [c1, , c2] of store.match(null, P.equivalentClass, null)) {
      for (const x of store.subjects(P.type, c2)) add(x, P.type, c1);
    }
  },

  'cax-dw'(store, add, conflict) {
    for (const [c1, , c2] of store.match(null, P.disjointWith, null)) {
      const inC1 = new Set(store.subjects(P.type, c1));
      for (const x of store.subjects(P.type, c2)) {
        if (inC1.has(x)) conflict('cax-dw', `${x} in disjoint ${c1} & ${c2}`);
      }
    }
  },

  'cax-adc'(store, add, conflict) {
    for (const x of store.subjects(P.type, C.AllDisjointClasses)) {
      for (const y of store.objects(x, P.members)) {
        const cs = store.listElements(y);
        const memberOf = new Map(); // subject -> Set(class)
        for (const ci of cs) {
          for (const z of store.subjects(P.type, ci)) {
            if (!memberOf.has(z)) memberOf.set(z, new Set());
            memberOf.get(z).add(ci);
          }
        }
        for (const [z, set] of memberOf) {
          if (set.size > 1) conflict('cax-adc', `${z} in multiple disjoint classes`);
        }
      }
    }
  },

  // ---- dt -----------------------------------------------------------------

  'dt-type1'(store, add) {
    for (const dt of BUILTIN_DATATYPES) add(dt, P.type, C.Datatype);
  },

  'dt-type2'(store, add) {
    for (const [, , o] of store.all()) {
      if (o.startsWith('"')) {
        const m = /\^\^<([^>]+)>$/.exec(o);
        if (m) add(o, P.type, m[1]);
        else add(o, P.type, NS.RDFS + 'Literal');
      }
    }
  },

  'dt-eq'(store, add) {
    const byDt = new Map();
    for (const [, , o] of store.all()) {
      if (!o.startsWith('"')) continue;
      if (!byDt.has(o)) byDt.set(o, o);
    }
    // same lexical+datatype -> sameAs (they are identical canonical terms already)
    for (const o of byDt.keys()) add(o, P.sameAs, o);
  },

  'dt-diff'(store, add) {
    const lits = new Set();
    for (const [, , o] of store.all()) if (o.startsWith('"')) lits.add(o);
    const arr = [...lits];
    const byDt = new Map();
    for (const o of arr) {
      const m = /\^\^<([^>]+)>$/.exec(o);
      const dt = m ? m[1] : NS.RDFS + 'Literal';
      if (!byDt.has(dt)) byDt.set(dt, []);
      byDt.get(dt).push(o);
    }
    for (const group of byDt.values()) {
      for (let i = 0; i < group.length; i++)
        for (let j = i + 1; j < group.length; j++)
          if (group[i] !== group[j]) { add(group[i], P.differentFrom, group[j]); add(group[j], P.differentFrom, group[i]); }
    }
  },

  'dt-not-type'(store, add, conflict) {
    for (const [lt, , dt] of store.match(null, P.type, null)) {
      if (!lt.startsWith('"')) continue;
      const m = /^"((?:[^"\\])*)"\^\^<([^>]+)>$/.exec(lt);
      if (!m) continue;
      const lex = m[1], declared = m[2];
      if (declared !== dt) continue;
      // validate value space for a few numeric datatypes
      if (dt === NS.XSD + 'nonNegativeInteger' && !/^\d+$/.test(lex)) {
        conflict('dt-not-type', `"${lex}" not in value space of nonNegativeInteger`);
      } else if (dt === NS.XSD + 'integer' && !/^-?\d+$/.test(lex)) {
        conflict('dt-not-type', `"${lex}" not an integer`);
      } else if (dt === NS.XSD + 'boolean' && !/^(true|false|0|1)$/.test(lex)) {
        conflict('dt-not-type', `"${lex}" not a boolean`);
      }
    }
  },

  // ---- scm ----------------------------------------------------------------

  'scm-cls'(store, add) {
    for (const c of store.subjects(P.type, C.Class)) {
      add(c, P.subClassOf, c);
      add(c, P.equivalentClass, c);
      add(c, P.subClassOf, C.Thing);
      add(C.Nothing, P.subClassOf, c);
    }
  },

  'scm-sco'(store, add) {
    for (const [c1, , c2] of store.match(null, P.subClassOf, null)) {
      for (const [, , c3] of store.match(c2, P.subClassOf, null)) add(c1, P.subClassOf, c3);
    }
  },

  'scm-eqc1'(store, add) {
    for (const [c1, , c2] of store.match(null, P.equivalentClass, null)) {
      add(c1, P.subClassOf, c2);
      add(c2, P.subClassOf, c1);
    }
  },

  'scm-eqc2'(store, add) {
    for (const [c1, , c2] of store.match(null, P.subClassOf, null)) {
      if (store.has(c2, P.subClassOf, c1)) add(c1, P.equivalentClass, c2);
    }
  },

  'scm-op'(store, add) {
    for (const p of store.subjects(P.type, C.ObjectProperty)) {
      add(p, P.subPropertyOf, p);
      add(p, P.equivalentProperty, p);
    }
  },

  'scm-dp'(store, add) {
    for (const p of store.subjects(P.type, C.DatatypeProperty)) {
      add(p, P.subPropertyOf, p);
      add(p, P.equivalentProperty, p);
    }
  },

  'scm-spo'(store, add) {
    for (const [p1, , p2] of store.match(null, P.subPropertyOf, null)) {
      for (const [, , p3] of store.match(p2, P.subPropertyOf, null)) add(p1, P.subPropertyOf, p3);
    }
  },

  'scm-eqp1'(store, add) {
    for (const [p1, , p2] of store.match(null, P.equivalentProperty, null)) {
      add(p1, P.subPropertyOf, p2);
      add(p2, P.subPropertyOf, p1);
    }
  },

  'scm-eqp2'(store, add) {
    for (const [p1, , p2] of store.match(null, P.subPropertyOf, null)) {
      if (store.has(p2, P.subPropertyOf, p1)) add(p1, P.equivalentProperty, p2);
    }
  },

  'scm-dom1'(store, add) {
    for (const [p, , c1] of store.match(null, P.domain, null)) {
      for (const [, , c2] of store.match(c1, P.subClassOf, null)) add(p, P.domain, c2);
    }
  },

  'scm-dom2'(store, add) {
    for (const [p2, , c] of store.match(null, P.domain, null)) {
      for (const [p1] of store.match(null, P.subPropertyOf, p2)) add(p1, P.domain, c);
    }
  },

  'scm-rng1'(store, add) {
    for (const [p, , c1] of store.match(null, P.range, null)) {
      for (const [, , c2] of store.match(c1, P.subClassOf, null)) add(p, P.range, c2);
    }
  },

  'scm-rng2'(store, add) {
    for (const [p2, , c] of store.match(null, P.range, null)) {
      for (const [p1] of store.match(null, P.subPropertyOf, p2)) add(p1, P.range, c);
    }
  },

  'scm-hv'(store, add) {
    const hv = store.match(null, P.hasValue, null);
    for (const [c1, , i] of hv) {
      for (const p1 of store.objects(c1, P.onProperty)) {
        for (const [c2, , i2] of hv) {
          if (c1 === c2 || i !== i2) continue;
          for (const p2 of store.objects(c2, P.onProperty)) {
            if (store.has(p1, P.subPropertyOf, p2)) add(c1, P.subClassOf, c2);
          }
        }
      }
    }
  },

  'scm-svf1'(store, add) {
    for (const [c1, , y1] of store.match(null, P.someValuesFrom, null)) {
      for (const p of store.objects(c1, P.onProperty)) {
        for (const [c2, , y2] of store.match(null, P.someValuesFrom, null)) {
          if (c1 === c2) continue;
          if (!store.objects(c2, P.onProperty).includes(p)) continue;
          if (store.has(y1, P.subClassOf, y2)) add(c1, P.subClassOf, c2);
        }
      }
    }
  },

  'scm-svf2'(store, add) {
    for (const [c1, , y] of store.match(null, P.someValuesFrom, null)) {
      for (const p1 of store.objects(c1, P.onProperty)) {
        for (const [c2, , y2] of store.match(null, P.someValuesFrom, null)) {
          if (c1 === c2 || y !== y2) continue;
          for (const p2 of store.objects(c2, P.onProperty)) {
            if (store.has(p1, P.subPropertyOf, p2)) add(c1, P.subClassOf, c2);
          }
        }
      }
    }
  },

  'scm-avf1'(store, add) {
    for (const [c1, , y1] of store.match(null, P.allValuesFrom, null)) {
      for (const p of store.objects(c1, P.onProperty)) {
        for (const [c2, , y2] of store.match(null, P.allValuesFrom, null)) {
          if (c1 === c2) continue;
          if (!store.objects(c2, P.onProperty).includes(p)) continue;
          if (store.has(y1, P.subClassOf, y2)) add(c1, P.subClassOf, c2);
        }
      }
    }
  },

  'scm-avf2'(store, add) {
    for (const [c1, , y] of store.match(null, P.allValuesFrom, null)) {
      for (const p1 of store.objects(c1, P.onProperty)) {
        for (const [c2, , y2] of store.match(null, P.allValuesFrom, null)) {
          if (c1 === c2 || y !== y2) continue;
          for (const p2 of store.objects(c2, P.onProperty)) {
            if (store.has(p1, P.subPropertyOf, p2)) add(c2, P.subClassOf, c1);
          }
        }
      }
    }
  },

  'scm-int'(store, add) {
    for (const [c, , listHead] of store.match(null, P.intersectionOf, null)) {
      for (const ci of store.listElements(listHead)) add(c, P.subClassOf, ci);
    }
  },

  'scm-uni'(store, add) {
    for (const [c, , listHead] of store.match(null, P.unionOf, null)) {
      for (const ci of store.listElements(listHead)) add(ci, P.subClassOf, c);
    }
  }
};

module.exports = { rules, BUILTIN_ANNOTATION_PROPERTIES, BUILTIN_DATATYPES };
