'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { ManchesterSyntaxParser } = require('../../src/io/ManchesterSyntaxParser');
const { FunctionalSyntaxParser } = require('../../src/io/FunctionalSyntaxParser');
const { SWRLBuiltins } = require('../../src/inference/SWRLReasoner');
const { SWRL_BUILTINS } = require('../../src/model/SWRL');

// --- L5 prefix fidelity ---

test('L5: Manchester parser records prefixes on ontology', () => {
  const ont = new ManchesterSyntaxParser().parse(`
Prefix: ex: <http://ex.org/>
Class: ex:Widget
  `);
  assert.equal(ont.getPrefixes().ex, 'http://ex.org/');
});

test('L5: Functional syntax parser records prefixes on ontology', () => {
  const ont = new FunctionalSyntaxParser().parse(`
Prefix(:=<http://ex.org/>)
Declaration(Class(<http://ex.org/Widget>))
  `);
  // default prefix key is ''
  const pfx = ont.getPrefixes();
  assert.ok(Object.values(pfx).includes('http://ex.org/'));
});

// --- L7 SWRL long-tail builtins ---

test('L7: stringEqualIgnoreCase', () => {
  assert.equal(SWRLBuiltins.call('stringEqualIgnoreCase', ['Hello', 'hello']), true);
  assert.equal(SWRLBuiltins.call('stringEqualIgnoreCase', ['Hello', 'world']), false);
});

test('L7: substringBefore / substringAfter', () => {
  assert.equal(SWRLBuiltins.call('substringBefore', ['abc-def', '-']), 'abc');
  assert.equal(SWRLBuiltins.call('substringAfter', ['abc-def', '-']), 'def');
});

test('L7: translate', () => {
  assert.equal(SWRLBuiltins.call('translate', ['abc', 'abc', 'xyz']), 'xyz');
  assert.equal(SWRLBuiltins.call('translate', ['aaa', 'a', 'b']), 'bbb');
});

test('L7: booleanNot', () => {
  assert.equal(SWRLBuiltins.call('booleanNot', [true]), false);
  assert.equal(SWRLBuiltins.call('booleanNot', [false]), true);
});

test('L7: list ops (member / length / first / rest / empty)', () => {
  assert.equal(SWRLBuiltins.call('member', [2, [1, 2, 3]]), true);
  assert.equal(SWRLBuiltins.call('length', [[1, 2, 3]]), 3);
  assert.equal(SWRLBuiltins.call('first', [[7, 8, 9]]), 7);
  assert.deepEqual(SWRLBuiltins.call('rest', [[7, 8, 9]]), [8, 9]);
  assert.equal(SWRLBuiltins.call('empty', [[]]), true);
  assert.equal(SWRLBuiltins.call('empty', [[1]]), false);
});

test('L7: sublist', () => {
  assert.equal(SWRLBuiltins.call('sublist', [[1, 2, 3, 4], [2, 3]]), true);
  assert.equal(SWRLBuiltins.call('sublist', [[1, 2, 3, 4], [3, 1]]), false);
});

test('L7: SWRL_BUILTINS registry includes long-tail names', () => {
  const ns = 'http://www.w3.org/2003/11/swrlb#';
  for (const b of ['stringEqualIgnoreCase', 'translate', 'substringBefore', 'substringAfter',
    'booleanNot', 'member', 'length', 'first', 'rest', 'sublist', 'empty',
    'listConcat', 'listIntersection', 'listSubtraction', 'anyURI', 'date', 'time']) {
    assert.ok(SWRL_BUILTINS.includes(ns + b), 'missing builtin: ' + b);
  }
});
