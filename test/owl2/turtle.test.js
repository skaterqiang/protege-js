'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { TurtleParser } = require('../../src/io/TurtleParser');
const { TripleStore } = require('../../src/inference/TripleStore');
const { NS } = require('../../src/inference/rdf');

test('Turtle: basic triples with @prefix', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:alice a ex:Person .
  `;
  const store = new TurtleParser().parse(text);
  assert.strictEqual(
    store.match('http://example.org/alice', NS.RDF + 'type', 'http://example.org/Person').length,
    1
  );
});

test('Turtle: semicolon predicate-object lists', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:alice ex:name "Alice" ;
             ex:age 30 .
  `;
  const store = new TurtleParser().parse(text);
  assert.strictEqual(store.match('http://example.org/alice', 'http://example.org/name', null).length, 1);
  assert.strictEqual(store.match('http://example.org/alice', 'http://example.org/age', null).length, 1);
});

test('Turtle: comma object lists', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:alice ex:knows ex:bob, ex:carol .
  `;
  const store = new TurtleParser().parse(text);
  assert.strictEqual(store.match('http://example.org/alice', 'http://example.org/knows', null).length, 2);
});

test('Turtle: typed literal', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    ex:alice ex:age "30"^^xsd:integer .
  `;
  const store = new TurtleParser().parse(text);
  const objs = store.match('http://example.org/alice', 'http://example.org/age', null);
  assert.strictEqual(objs.length, 1);
  assert.match(objs[0][2], /30/);
  assert.match(objs[0][2], /integer/);
});

test('Turtle: language-tagged literal', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:alice ex:name "Alice"@en .
  `;
  const store = new TurtleParser().parse(text);
  const objs = store.match('http://example.org/alice', 'http://example.org/name', null);
  assert.match(objs[0][2], /@en/);
});

test('Turtle: numeric auto-typing', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:x ex:i 42 ; ex:d 3.14 ; ex:e 1.5e3 .
  `;
  const store = new TurtleParser().parse(text);
  assert.match(store.match('http://example.org/x', 'http://example.org/i', null)[0][2], /integer/);
  assert.match(store.match('http://example.org/x', 'http://example.org/d', null)[0][2], /decimal/);
  assert.match(store.match('http://example.org/x', 'http://example.org/e', null)[0][2], /double/);
});

test('Turtle: boolean literals', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:x ex:flag true .
  `;
  const store = new TurtleParser().parse(text);
  assert.match(store.match('http://example.org/x', 'http://example.org/flag', null)[0][2], /true/);
});

test('Turtle: blank node', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:alice ex:address [ ex:city "NYC" ] .
  `;
  const store = new TurtleParser().parse(text);
  const addr = store.match('http://example.org/alice', 'http://example.org/address', null);
  assert.strictEqual(addr.length, 1);
  const bn = addr[0][2];
  assert.match(bn, /^_:/);
  assert.strictEqual(store.match(bn, 'http://example.org/city', null).length, 1);
});

test('Turtle: collection list', () => {
  const text = `
    @prefix ex: <http://example.org/> .
    ex:x ex:items ( ex:a ex:b ex:c ) .
  `;
  const store = new TurtleParser().parse(text);
  const list = store.listElements(store.match('http://example.org/x', 'http://example.org/items', null)[0][2]);
  assert.strictEqual(list.length, 3);
});

test('Turtle: comments ignored', () => {
  const text = `
    # a comment
    @prefix ex: <http://example.org/> .
    ex:a ex:b ex:c . # trailing comment
  `;
  const store = new TurtleParser().parse(text);
  assert.strictEqual(store.match('http://example.org/a', 'http://example.org/b', 'http://example.org/c').length, 1);
});

test('Turtle: SPARQL PREFIX style', () => {
  const text = `
    PREFIX ex: <http://example.org/>
    ex:a ex:b ex:c .
  `;
  const store = new TurtleParser().parse(text);
  assert.strictEqual(store.match('http://example.org/a', 'http://example.org/b', 'http://example.org/c').length, 1);
});
