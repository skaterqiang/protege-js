'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const { OWLModelManager } = require('../model/OWLModelManager');
const {
  AssertedClassHierarchyProvider,
  OWLObjectPropertyHierarchyProvider,
  OWLDataPropertyHierarchyProvider
} = require('../model/hierarchy/HierarchyProvider');
const { OntologyLoader } = require('../io/OntologyLoader');

const PORT = process.env.PROTEGE_JS_PORT ? Number(process.env.PROTEGE_JS_PORT) : 8899;

const manager = new OWLModelManager();
const loader = new OntologyLoader();

function sendJson(res, data, code = 200) {
  const body = JSON.stringify(data);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  }[ext] || 'text/plain; charset=utf-8';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': mime });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', d => (s += d));
    req.on('end', () => {
      try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); }
    });
  });
}

function activeProviders() {
  const ont = manager.getActiveOntology();
  if (!ont) return null;
  const classHp = new AssertedClassHierarchyProvider(ont);
  classHp.rebuild();
  const objHp = new OWLObjectPropertyHierarchyProvider(ont);
  objHp.rebuild();
  const dataHp = new OWLDataPropertyHierarchyProvider(ont);
  dataHp.rebuild();
  return { ont, classHp, objHp, dataHp };
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/load' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.filePath) return sendJson(res, { error: 'filePath required' }, 400);
    try {
      const ont = loader.loadFromFile(body.filePath);
      manager.addOntology(ont);
      return sendJson(res, {
        ok: true,
        ontology: {
          id: ont.getOntologyID().toString(),
          axiomCount: ont.getAxiomCount(),
          classes: ont.getClassesInSignature().length,
          objectProperties: ont.getObjectPropertiesInSignature().length,
          dataProperties: ont.getDataPropertiesInSignature().length,
          individuals: ont.getIndividualsInSignature().length
        }
      });
    } catch (e) {
      return sendJson(res, { error: String(e.message || e) }, 500);
    }
  }

  if (pathname === '/api/tree' && req.method === 'GET') {
    const p = activeProviders();
    if (!p) return sendJson(res, { error: 'no ontology loaded' }, 404);
    const q = url.parse(req.url, true).query;
    const kind = q.kind || 'class';
    let tree;
    if (kind === 'objectProperty') tree = p.objHp.toTree();
    else if (kind === 'dataProperty') tree = p.dataHp.toTree();
    else tree = p.classHp.toTree();
    return sendJson(res, { ok: true, kind, tree });
  }

  if (pathname === '/api/stats' && req.method === 'GET') {
    const ont = manager.getActiveOntology();
    if (!ont) return sendJson(res, { loaded: false });
    return sendJson(res, {
      loaded: true,
      id: ont.getOntologyID().toString(),
      axiomCount: ont.getAxiomCount(),
      classes: ont.getClassesInSignature().length,
      objectProperties: ont.getObjectPropertiesInSignature().length,
      dataProperties: ont.getDataPropertiesInSignature().length,
      individuals: ont.getIndividualsInSignature().length
    });
  }

  return sendJson(res, { error: 'unknown api' }, 404);
}

function createServer() {
  const webRoot = path.join(__dirname, 'public');
  return http.createServer(async (req, res) => {
    const pathname = url.parse(req.url, true).pathname;
    if (pathname.startsWith('/api/')) {
      return handleApi(req, res, pathname);
    }
    let fp = pathname === '/' ? '/index.html' : pathname;
    return sendFile(res, path.join(webRoot, fp));
  });
}

function start(port = PORT) {
  const server = createServer();
  server.listen(port, () => {
    console.log(`protege-js web UI listening on http://localhost:${port}/`);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start, createServer, manager, PORT };
