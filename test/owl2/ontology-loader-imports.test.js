'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { OntologyLoader } = require('../../src/io/OntologyLoader');

const EX = 'http://ex.org/';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'owl-imports-'));
}

test('loadWithImports merges imported ontology axioms', () => {
  const dir = tmpDir();
  // Child ontology: declares class B
  fs.writeFileSync(path.join(dir, 'child.owl'), `
Prefix(:=<${EX}>)
Ontology(<${EX}child>
  Declaration(Class(<${EX}B>))
)
  `.trim());
  // Parent ontology: imports child, declares A subClassOf B
  fs.writeFileSync(path.join(dir, 'parent.owl'), `
Prefix(:=<${EX}>)
Ontology(<${EX}parent>
  Import(child.owl)
  Declaration(Class(<${EX}A>))
  SubClassOf(<${EX}A> <${EX}B>)
)
  `.trim());

  const loader = new OntologyLoader();
  const merged = loader.loadWithImports(path.join(dir, 'parent.owl'));
  // Should have A, B declarations and SubClassOf
  assert.ok(merged.getAxiomsOfType('SubClassOf').length >= 1);
  assert.ok(merged.getAxiomsOfType('Declaration').length >= 2);
  assert.ok(merged.imports.length >= 1);
});

test('loadWithImports guards against cyclic imports', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'a.owl'), `Ontology(<${EX}a> Import(b.owl) Declaration(Class(<${EX}A>)))`);
  fs.writeFileSync(path.join(dir, 'b.owl'), `Ontology(<${EX}b> Import(a.owl) Declaration(Class(<${EX}B>)))`);
  const loader = new OntologyLoader();
  const merged = loader.loadWithImports(path.join(dir, 'a.owl'));
  // Must terminate; both A and B present
  const decls = merged.getAxiomsOfType('Declaration');
  assert.ok(decls.length >= 2);
});

test('loadFromFile auto-detects functional syntax', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'x.ofn'), `Ontology(<${EX}x> Declaration(Class(<${EX}C>)))`);
  const loader = new OntologyLoader();
  const ont = loader.loadFromFile(path.join(dir, 'x.ofn'));
  assert.equal(ont.format, 'Functional');
  assert.equal(ont.getAxiomsOfType('Declaration').length, 1);
});
