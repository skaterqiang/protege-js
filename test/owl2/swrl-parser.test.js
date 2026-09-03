'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SWRLParser } = require('../../src/io/SWRLParser');
const { AtomType } = require('../../src/model/SWRL');

const EX = 'http://ex.org/';
const parser = new SWRLParser({
  prefixes: { ex: EX },
  resolve: (iri) => {
    if (iri === EX + 'Person' || iri === EX + 'Parent') return 'class';
    if (iri === EX + 'age') return 'dataProperty';
    return null;
  }
});

test('class atom ^ class atom -> class atom', () => {
  const r = parser.parse('ex:Person(?x) ^ ex:hasParent(?x,?y) -> ex:Child(?x)');
  assert.equal(r.body.length, 2);
  assert.equal(r.head.length, 1);
  assert.equal(r.body[0].type, AtomType.CLASS);
  assert.equal(r.body[1].type, AtomType.OBJECT_PROPERTY);
  assert.equal(r.head[0].type, AtomType.CLASS);
});

test('data property atom resolved via resolve()', () => {
  const r = parser.parse('ex:Person(?x) ^ ex:age(?x,?a) -> ex:Adult(?x)');
  assert.equal(r.body[1].type, AtomType.DATA_PROPERTY);
});

test('builtin atom swrlb:greaterThan', () => {
  const r = parser.parse('ex:Person(?x) ^ ex:age(?x,?a) ^ swrlb:greaterThan(?a,18) -> ex:Adult(?x)');
  const b = r.body[2];
  assert.equal(b.type, AtomType.BUILTIN);
  assert.equal(b.builtin.toString(), 'http://www.w3.org/2003/11/swrlb#greaterThan');
  assert.equal(b.args.length, 2);
});

test('sameAs / differentFrom', () => {
  const r = parser.parse('ex:Person(?x) ^ ex:Person(?y) ^ differentFrom(?x,?y) -> sameAs(?x,?x)');
  assert.equal(r.body[2].type, AtomType.DIFFERENT_FROM);
  assert.equal(r.head[0].type, AtomType.SAME_AS);
});

test('parseAll multiple rules', () => {
  const rules = parser.parseAll(`
ex:Person(?x) ^ ex:hasParent(?x,?y) -> ex:Child(?x)
ex:Person(?x) ^ ex:age(?x,?a) ^ swrlb:greaterThan(?a,18) -> ex:Adult(?x)
  `);
  assert.equal(rules.length, 2);
});

test('literal argument', () => {
  const r = parser.parse('ex:Person(?x) -> ex:greeting(?x,"hello")');
  const atom = r.head[0];
  // greeting not resolved -> object property, but arg is literal
  assert.equal(atom.arg2.lexicalValue, 'hello');
});
