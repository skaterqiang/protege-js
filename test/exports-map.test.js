'use strict';

// ---------------------------------------------------------------------------
// test/exports-map.test.js — guards the package.json "exports" map.
//
// WHY THIS TEST EXISTS
// --------------------
// Every other test in this suite `require`s sibling modules by *relative path*
// (e.g. require('../src/model/IRI')). Relative requires bypass the "exports"
// map entirely and fall back to legacy CommonJS resolution, which DOES append
// `.js` for you. So the whole suite can pass while the published package is
// broken for real consumers.
//
// That is exactly what happened: "exports" declared `"./src/*": "./src/*"`,
// and Node's subpath *pattern* substitution performs no extension resolution.
// `require('@skaterqiang/protege-js/src/model/IRI')` — the form documented in
// 42 places across README.md and docs/API.md — threw MODULE_NOT_FOUND, while
// only the explicit `.js` spelling worked.
//
// The fix is two sibling pattern keys:
//     "./src/*.js": "./src/*.js",   // explicit-extension spelling
//     "./src/*":    "./src/*.js",   // extensionless spelling
// Node's best-match rule picks the most specific key by suffix length, so both
// spellings resolve. (An *array* value does NOT work as a fallback chain: once
// a pattern key matches, a failed resolution throws instead of trying the next
// entry.)
//
// HOW THIS TEST STAYS HONEST
// --------------------------
// It resolves the package *by its own name* (Node self-reference, enabled by
// having both "name" and "exports"), so it exercises the real exports map with
// no packing or installing. And rather than hard-coding a list of deep-import
// paths — which would drift from the docs — it *scrapes* README.md and
// docs/API.md for every `require('<pkg>/...')` / `from '<pkg>/...'` specifier
// and asserts each one resolves. If someone documents a new deep import, it is
// covered automatically; if someone breaks "exports", the docs fail the build.
// ---------------------------------------------------------------------------

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const require_ = createRequire(path.join(__dirname, 'noop.js'));
const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = pkg.name;

// Documents that advertise import specifiers to end users.
const DOC_FILES = ['README.md', path.join('docs', 'API.md')];

/**
 * Pull every bare-package import specifier out of a markdown/JS-ish document.
 * Matches require('pkg/...'), require("pkg/..."), from 'pkg/...' and the
 * bare `require('pkg')` form. Deliberately ignores GitHub URLs, which contain
 * the unscoped repo name and must stay unscoped.
 */
function scrapeSpecifiers(text) {
  const out = new Set();
  const re = new RegExp(
    String.raw`(?:require\(|from\s+)\s*['"\`](${NAME.replace(/[/@]/g, (c) => '\\' + c)}(?:/[^'"\`]*)?)['"\`]`,
    'g'
  );
  let m;
  while ((m = re.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

test('package.json declares a scoped name and an exports map', () => {
  assert.ok(NAME.startsWith('@'), `expected a scoped name, got ${NAME}`);
  assert.ok(pkg.exports && typeof pkg.exports === 'object', 'exports map missing');
  assert.strictEqual(pkg.exports['.'], './src/index.js', 'root export must point at src/index.js');
});

test('exports map covers both .js and extensionless deep-import spellings', () => {
  // The extensionless key must map to a *.js target, otherwise Node performs no
  // extension resolution and every documented deep import breaks.
  assert.ok(pkg.exports['./src/*'], 'missing "./src/*" pattern key');
  const target = pkg.exports['./src/*'];
  const targets = Array.isArray(target) ? target : [target];
  assert.ok(
    targets.some((t) => t === './src/*.js'),
    `"./src/*" must resolve to "./src/*.js", got ${JSON.stringify(target)}`
  );
  // And the explicit-extension spelling must still work.
  assert.strictEqual(pkg.exports['./src/*.js'], './src/*.js', 'missing "./src/*.js" identity key');
});

test('flat import by package name resolves (self-reference)', () => {
  const api = require_(NAME);
  assert.ok(api && typeof api === 'object', 'root import returned nothing');
  // A few load-bearing symbols, so a hollow index.js cannot pass.
  for (const sym of ['OWL2RLReasoner', 'TripleStore', 'TurtleParser', 'IRI', 'checkRL']) {
    assert.ok(sym in api, `root export missing ${sym}`);
  }
  assert.ok(api.model && api.io && api.inference && api.profiles, 'namespaced exports missing');
});

test('package.json subpath is exported', () => {
  const meta = require_(`${NAME}/package.json`);
  assert.strictEqual(meta.name, NAME);
});

test('every deep-import specifier documented in the docs actually resolves', () => {
  const specifiers = new Set();
  for (const rel of DOC_FILES) {
    const abs = path.join(ROOT, rel);
    assert.ok(fs.existsSync(abs), `doc not found: ${rel}`);
    for (const s of scrapeSpecifiers(fs.readFileSync(abs, 'utf8'))) specifiers.add(s);
  }

  // Sanity: if the scraper silently matched nothing the test would be vacuous.
  const deep = [...specifiers].filter((s) => s.includes('/'));
  assert.ok(deep.length >= 20, `expected >=20 documented deep imports, scraped ${deep.length}`);

  const failures = [];
  for (const spec of [...specifiers].sort()) {
    try {
      const mod = require_(spec);
      assert.ok(mod, `${spec} resolved to a falsy value`);
    } catch (err) {
      failures.push(`${spec} -> ${err.code || err.message}`);
    }
  }
  assert.deepStrictEqual(failures, [], `unresolvable documented imports:\n  ${failures.join('\n  ')}`);
});

test('extensionless and .js spellings resolve to the same module', () => {
  // The two pattern keys must not accidentally expose different files.
  const probes = [
    'src/model/IRI',
    'src/inference/OWL2RLReasoner',
    'src/inference/TripleStore',
    'src/io/TurtleParser',
    'src/profiles/OWL2Profiles'
  ];
  for (const p of probes) {
    const a = require_(`${NAME}/${p}`);
    const b = require_(`${NAME}/${p}.js`);
    assert.strictEqual(a, b, `${p}: extensionless and .js spellings diverged`);
    assert.ok(Object.keys(a).length > 0, `${p}: module exports nothing`);
  }
});

test('a resolved deep import is functional, not just loadable', () => {
  // Guard against an exports map that resolves to the wrong/empty file.
  const { OWL2RLReasoner } = require_(`${NAME}/src/inference/OWL2RLReasoner`);
  const { TripleStore } = require_(`${NAME}/src/inference/TripleStore`);
  // Take the IRIs from the library itself. Hard-coding them here once produced a
  // false failure: the RDF namespace is http://www.w3.org/1999/02/22-rdf-syntax-ns#
  // and a single mistyped separator makes cax-sco silently not fire, because the
  // rule matches on exact IRI equality. Deriving them removes that whole class of
  // error — and it exercises one more deep import in the process.
  const { NS } = require_(`${NAME}/src/inference/rdf`);
  const TYPE = NS.RDF + 'type';
  const SUBCLASSOF = NS.RDFS + 'subClassOf';

  const r = new OWL2RLReasoner(new TripleStore());
  r.store.add('ex:A', SUBCLASSOF, 'ex:B');
  r.store.add('ex:x', TYPE, 'ex:A');
  r.materialize();
  assert.ok(r.entails('ex:x', TYPE, 'ex:B'), 'deep-imported reasoner failed to entail cax-sco');
  assert.deepStrictEqual(r.inconsistencies, [], 'unexpected inconsistencies');
});
