'use strict';

// ---------------------------------------------------------------------------
// protege-js — public API entry point.
//
// Everything is re-exported here so consumers can do:
//
//   const { OWL2RLReasoner, TurtleParser } = require('@skaterqiang/protege-js');
//
// Namespaced access is available too, for callers that prefer grouping:
//
//   const protege = require('@skaterqiang/protege-js');
//   protege.inference.OWL2RLReasoner
//   protege.io.TurtleParser
//   protege.model.OWLClass
//
// Zero runtime dependencies. CommonJS. Node >= 18 (uses node:test in dev only).
// ---------------------------------------------------------------------------

// --- model -----------------------------------------------------------------
const { IRI } = require('./model/IRI');
const entity = require('./model/OWLEntity');
const axiom = require('./model/OWLAxiom');
const classExpr = require('./model/OWLClassExpression');
const { OWLLiteral } = require('./model/OWLLiteral');
const { OWLOntology, OWLOntologyID } = require('./model/OWLOntology');
const { OWLModelManager } = require('./model/OWLModelManager');
const swrlModel = require('./model/SWRL');
const { EventType, OWLModelManagerChangeEvent } = require('./model/event/OWLModelManagerEvent');
const hierarchy = require('./model/hierarchy/HierarchyProvider');

// --- io --------------------------------------------------------------------
const { TurtleParser, parseTurtle } = require('./io/TurtleParser');
const { writeTurtle, TurtleWriter } = require('./io/TurtleWriter');
const { parseRDFXML } = require('./io/RDFXMLParser');
const { writeRDFXML, RDFXMLWriter } = require('./io/RDFXMLWriter');
const { FunctionalSyntaxParser } = require('./io/FunctionalSyntaxParser');
const funcWriter = require('./io/FunctionalSyntaxWriter');
const { ManchesterSyntaxParser } = require('./io/ManchesterSyntaxParser');
const { OWLXMLParser } = require('./io/OWLXMLParser');
const { SWRLParser } = require('./io/SWRLParser');
const { triplesToOntology } = require('./io/RDFGraphToOntology');
const { OntologyLoader } = require('./io/OntologyLoader');

// --- inference -------------------------------------------------------------
const { TripleStore } = require('./inference/TripleStore');
const rdf = require('./inference/rdf');
const { OWL2RLReasoner } = require('./inference/OWL2RLReasoner');
const { OWL2QLReasoner, OWL2ELReasoner, ProfileReasoner } = require('./inference/OWL2ProfileReasoners');
const { SWRLReasoner, SWRLBuiltins } = require('./inference/SWRLReasoner');
const { ReasonerQueries } = require('./inference/ReasonerQueries');
const { rules: OWL2RL_RULES } = require('./inference/rules/owl2rl');
const { QL_RULE_IDS } = require('./inference/rules/owl2ql');
const { EL_RULE_IDS } = require('./inference/rules/owl2el');

// --- profiles / validation -------------------------------------------------
const profiles = require('./profiles/OWL2Profiles');
const { GlobalRestrictionsValidator } = require('./validation/GlobalRestrictionsValidator');

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

const model = Object.assign(
  {
    IRI,
    OWLLiteral,
    OWLOntology,
    OWLOntologyID,
    OWLModelManager,
    EventType,
    OWLModelManagerChangeEvent
  },
  entity,
  axiom,
  classExpr,
  swrlModel,
  hierarchy
);

const io = {
  // parsers
  TurtleParser,
  parseTurtle,
  parseRDFXML,
  FunctionalSyntaxParser,
  ManchesterSyntaxParser,
  OWLXMLParser,
  SWRLParser,
  // writers
  TurtleWriter,
  writeTurtle,
  RDFXMLWriter,
  writeRDFXML,
  writeFunctionalSyntax: funcWriter.writeFunctionalSyntax,
  // bridges
  triplesToOntology,
  OntologyLoader
};

const inference = {
  TripleStore,
  OWL2RLReasoner,
  OWL2QLReasoner,
  OWL2ELReasoner,
  ProfileReasoner,
  SWRLReasoner,
  SWRLBuiltins,
  ReasonerQueries,
  NS: rdf.NS,
  P: rdf.P,
  C: rdf.C,
  isLiteral: rdf.isLiteral,
  parseLiteral: rdf.parseLiteral,
  literal: rdf.literal,
  OWL2RL_RULES,
  QL_RULE_IDS,
  EL_RULE_IDS
};

// ---------------------------------------------------------------------------
// Flat export surface (most common import style)
// ---------------------------------------------------------------------------

module.exports = Object.assign(
  {
    // namespaces
    model,
    io,
    inference,
    profiles,
    // convenience: profile checks at top level
    checkProfile: profiles.checkProfile,
    isInProfile: profiles.isInProfile,
    checkRL: profiles.checkRL,
    checkQL: profiles.checkQL,
    checkEL: profiles.checkEL,
    Profiles: profiles.Profiles,
    GlobalRestrictionsValidator,
    // convenience: the classes people reach for first
    IRI,
    OWLLiteral,
    OWLOntology,
    OWLOntologyID,
    OWLModelManager,
    TripleStore,
    OWL2RLReasoner,
    OWL2QLReasoner,
    OWL2ELReasoner,
    SWRLReasoner,
    ReasonerQueries,
    TurtleParser,
    parseTurtle,
    parseRDFXML,
    FunctionalSyntaxParser,
    ManchesterSyntaxParser,
    OWLXMLParser,
    SWRLParser,
    writeTurtle,
    writeRDFXML,
    writeFunctionalSyntax: funcWriter.writeFunctionalSyntax,
    triplesToOntology,
    OntologyLoader
  },
  // model layer (entities, axioms, class expressions, SWRL model, hierarchy)
  entity,
  axiom,
  classExpr,
  swrlModel,
  hierarchy,
  { EventType, OWLModelManagerChangeEvent },
  // writers exported as classes too
  { TurtleWriter, RDFXMLWriter },
  // rdf namespace constants
  { NS: rdf.NS, P: rdf.P, C: rdf.C }
);
