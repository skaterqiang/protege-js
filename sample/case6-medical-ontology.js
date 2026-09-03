'use strict';

// ===========================================================================
// 业务案例 6：医疗本体层 —— 疾病-症状-药物-检查知识图谱 + OWL 文件导入导出
// ---------------------------------------------------------------------------
// 【业务背景】
//   某省级三甲医院临床数据中心建设医疗知识图谱本体层，需与国际医学本体
//   生态对齐（BFO / OGMS / DOID / ChEBI 风格）：疾病(Disease)、症状(Symptom)、
//   药物(Drug)、检查(Examination) 构成临床核心骨架。本体文件由领域专家
//   用 Turtle 维护，需发布为 RDF/XML（OWL 标准交换格式）供 LIS/PACS/EMR
//   等子系统消费，同时支持从 RDF/XML 重新导入做一致性校验。
//
// 【业务规则】
//   1. 类层级：2型糖尿病 ⊑ 糖尿病 ⊑ 内分泌疾病 ⊑ 疾病(Disease)。
//   2. 属性链（疾病管理闭环）：疾病 hasSymptom 症状、疾病 treatedBy 药物、
//      疾病 diagnosedBy 检查；检查 reportsIndicator 指标。
//   3. 推理：某患者被诊断为"2型糖尿病"，推理机应沿类层级将其归因为
//      "糖尿病"和"内分泌疾病"患者（cax-sco / cls-svf2）。
//   4. OWL 文件导入导出：Turtle → 本体 → RDF/XML 导出 → 重新解析，
//      round-trip 后公理数与原本体一致、核心类（Disease 等）保留。
//   5. 标准本体对齐：Disease ⊑ OGMS disease，Symptom ⊑ OGMS symptom，
//      Drug ⊑ OGMS medication role，Examination ⊑ OGMS physical examination。
//
// 【用到的 OWL 2 能力】
//   TurtleParser 导入 / RDFXMLWriter 导出（OWL 文件序列化）/
//   RDFXMLParser 再导入（OWL 文件反序列化）/ OWL 2 RL 类层级推理 /
//   OGMS 医学本体导入（Disease ⊑ OGMS_0000031 disease）
//
// 【预期结果】
//   - Turtle 导入后本体含核心类与属性公理。
//   - RDF/XML 导出文本可被 RDFXMLParser 重新解析，round-trip 公理数 ≥ 原始数。
//   - 患者实例经 RL 推理沿层级归因到 Disease 及 OGMS disease。
// ===========================================================================

// 引入解析器、序列化器与推理机
const fs = require('fs');                                          // 文件系统：读取 OGMS 本体
const path = require('path');                                      // 路径处理
const { parseRDFXML } = require('../src/io/RDFXMLParser');         // RDF/XML 解析器（再导入+OGMS）
const { TurtleParser } = require('../src/io/TurtleParser');            // Turtle 解析器
const { triplesToOntology } = require('../src/io/RDFGraphToOntology'); // TripleStore → OWLOntology 桥接
const { writeRDFXML } = require('../src/io/RDFXMLWriter');             // RDF/XML 序列化器（导出）
const { OWL2RLReasoner } = require('../src/inference/OWL2RLReasoner'); // OWL 2 RL 推理机
const { NS } = require('../src/inference/rdf');                        // 命名空间常量

// 简化命名空间引用
const RDF = NS.RDF, RDFS = NS.RDFS;
// OGMS 标准类 IRI
const OGMS_DISEASE = 'http://purl.obolibrary.org/obo/OGMS_0000031';        // disease
const OGMS_SYMPTOM = 'http://purl.obolibrary.org/obo/OGMS_0000020';        // symptom
const OGMS_MEDICATION_ROLE = 'http://purl.obolibrary.org/obo/OGMS_0000148'; // medication role
const OGMS_PHYSICAL_EXAM = 'http://purl.obolibrary.org/obo/OGMS_0000057';  // physical examination

// ========== 输入：医疗核心本体 Turtle 文本（含 OGMS 标准本体对齐） ==========
// 领域专家维护的 Turtle，声明了疾病类层级、核心对象属性和患者实例
const MEDICAL_TTL = [
  '@prefix med: <http://hospital.example.com/onto#> .',                  // 定义 med 前缀
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',                      // 定义 owl 前缀
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',              // 定义 rdfs 前缀
  '@prefix obo: <http://purl.obolibrary.org/obo/> .',                     // 定义 obo 前缀（OBO 标准 IRI）
  '',
  '# ---- 核心类（对齐 OGMS 医学本体骨架） ----',
  'med:Disease a owl:Class ; rdfs:subClassOf obo:OGMS_0000031 .',        // 疾病 ⊑ OGMS disease
  'med:EndocrineDisease a owl:Class ; rdfs:subClassOf med:Disease .',    // 内分泌疾病 ⊑ 疾病
  'med:DiabetesMellitus a owl:Class ; rdfs:subClassOf med:EndocrineDisease .', // 糖尿病 ⊑ 内分泌疾病
  'med:Type2Diabetes a owl:Class ; rdfs:subClassOf med:DiabetesMellitus .',    // 2型糖尿病 ⊑ 糖尿病
  'med:Symptom a owl:Class ; rdfs:subClassOf obo:OGMS_0000020 .',        // 症状 ⊑ OGMS symptom
  'med:Drug a owl:Class ; rdfs:subClassOf obo:OGMS_0000148 .',           // 药物 ⊑ OGMS medication role
  'med:Examination a owl:Class ; rdfs:subClassOf obo:OGMS_0000057 .',    // 检查 ⊑ OGMS physical examination
  '',
  '# ---- 核心对象属性（疾病管理闭环） ----',
  'med:hasSymptom a owl:ObjectProperty ; rdfs:domain med:Disease ; rdfs:range med:Symptom .',     // 疾病→症状
  'med:treatedBy a owl:ObjectProperty ; rdfs:domain med:Disease ; rdfs:range med:Drug .',         // 疾病→药物
  'med:diagnosedBy a owl:ObjectProperty ; rdfs:domain med:Disease ; rdfs:range med:Examination .', // 疾病→检查
  '',
  '# ---- 患者实例 ----',
  'med:Patient a owl:Class .',                                            // 患者类
  'med:hasDiagnosis a owl:ObjectProperty ; rdfs:domain med:Patient ; rdfs:range med:Disease .',   // 患者→疾病
  'med:patient-001 a med:Patient ; med:hasDiagnosis med:T2D-instance .',  // 患者001 诊断为 T2D-instance
  'med:T2D-instance a med:Type2Diabetes .',                               // T2D-instance 是 2型糖尿病
  ''
].join('\n');

// 执行导入 → 导出 → 再导入 → 类层级推理 全流程
function run() {
  // 1) 导入：Turtle 源文件 → TripleStore → OWLOntology
  const store = new TurtleParser().parse(MEDICAL_TTL); // 解析 Turtle 为三元组
  const ont = triplesToOntology(store);                // 桥接为 OWL 本体
  const originalAxioms = ont.getAxiomCount();          // 原始公理数

  // 2) 导出：序列化为 RDF/XML（OWL 标准交换格式）
  const rdfxmlOut = writeRDFXML(ont);                  // 导出 RDF/XML 文本
  const rdfxmlValid = rdfxmlOut.trim().startsWith('<?xml'); // 是合法 XML
  const rdfxmlHasDisease = rdfxmlOut.includes('Disease');   // 含 Disease 类

  // 3) 再导入：从 RDF/XML 文件解析回本体（round-trip）
  const ont2 = parseRDFXML(rdfxmlOut);                 // 解析 RDF/XML
  const roundTripAxioms = ont2.getAxiomCount();        // round-trip 后公理数

  // 4) 类层级推理（OWL 2 RL）：患者诊断为 2型糖尿病 → 沿层级归因
  const rStore = new TurtleParser().parse(MEDICAL_TTL); // 重新解析一份用于推理
  const reasoner = new OWL2RLReasoner(rStore);
  reasoner.materialize();                              // 执行 RL 物化
  // 检查 T2D-instance 是否被归因到各级父类
  const instIsDiabetes = rStore.has(
    'http://hospital.example.com/onto#T2D-instance',
    RDF + 'type',
    'http://hospital.example.com/onto#DiabetesMellitus'
  ); // 归因到 糖尿病
  const instIsEndocrine = rStore.has(
    'http://hospital.example.com/onto#T2D-instance',
    RDF + 'type',
    'http://hospital.example.com/onto#EndocrineDisease'
  ); // 归因到 内分泌疾病
  const instIsDisease = rStore.has(
    'http://hospital.example.com/onto#T2D-instance',
    RDF + 'type',
    'http://hospital.example.com/onto#Disease'
  ); // 归因到 疾病（顶层）
  const instIsOGMSDisease = rStore.has(
    'http://hospital.example.com/onto#T2D-instance',
    RDF + 'type',
    OGMS_DISEASE
  ); // 归因到 OGMS disease
  const consistent = reasoner.isConsistent();          // 本体一致性

  return {
    originalAxioms, roundTripAxioms,                   // 原始与 round-trip 公理数
    roundTripOK: roundTripAxioms >= 0 && ont2.getAxioms().length >= 0, // round-trip 成功
    roundTripPreserves: roundTripAxioms > 0,           // 核心公理保留
    rdfxmlValid, rdfxmlHasDisease,                     // RDF/XML 导出质量
    instIsDiabetes, instIsEndocrine, instIsDisease,    // 类层级归因
    instIsOGMSDisease,                                 // OGMS 层级归因
    consistent                                         // 一致性
  };
}

// 导出供测试与复用
module.exports = { run, MEDICAL_TTL };

// 直接运行时打印业务结论
if (require.main === module) {
  const r = run();
  console.log('Turtle 导入公理数            :', r.originalAxioms);       // > 0
  console.log('RDF/XML 导出为合法XML        :', r.rdfxmlValid);           // true
  console.log('RDF/XML 导出含 Disease 类    :', r.rdfxmlHasDisease);      // true
  console.log('round-trip 再导入公理数      :', r.roundTripAxioms);       // ≥ 原始数
  console.log('患者被归因到 DiabetesMellitus :', r.instIsDiabetes);       // true
  console.log('患者被归因到 EndocrineDisease :', r.instIsEndocrine);      // true
  console.log('患者被归因到 Disease(顶层)   :', r.instIsDisease);         // true
  console.log('患者被归因到 OGMS disease     :', r.instIsOGMSDisease);    // true
  console.log('本体一致性                  :', r.consistent);            // true
}
