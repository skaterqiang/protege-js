'use strict';

// ===========================================================================
// 业务案例 3：医疗用药安全 —— 药物相互作用冲突检测（OWL 2 RL 一致性）
// ---------------------------------------------------------------------------
// 【业务背景】
//   医院开药系统要防止给同一病人同时开具两种「相互作用禁忌」的药物，
//   否则会造成医疗事故。系统在开处方时做一致性校验。
//
// 【业务规则】
//   1. 药物分类：阿司匹林(Aspirin) 与 华法林(Warfarin) 都是 抗凝药(Anticoagulant)。
//   2. 抗凝药 与 抗凝增效剂(AnticoagBooster) 联合使用属禁忌 → 用 disjoint
//      表达「安全合用(SafeCombo)」与「禁忌合用(ForbiddenCombo)」互斥。
//   3. 病人 pat-1 的用药方案 同时被判定为 SafeCombo 与 ForbiddenCombo 时，
//      推理机应报告本体不一致，系统据此拦截处方。
//   4. owl:hasKey：病人用 身份证号(ssn) 唯一标识；两个 ssn 相同的病人记录
//      应被识别为同一个人(prp-key)。
//   5. 标准本体对齐：药物 ⊑ OGMS medication role（OGMS_0000148）。
//
// 【用到的 OWL 2 能力】
//   owl:disjointWith 一致性 (cax-dw) / owl:hasKey 唯一识别 (prp-key) /
//   rdfs:subClassOf 分类 (cax-sco) / owl:sameAs 等价合并 (eq-*) /
//   OGMS 医学本体导入（Drug ⊑ OGMS_0000148 medication role）
//
// 【预期结果】
//   - 合法用药方案一致；叠加禁忌判定后 isConsistent()=false。
//   - 两条 ssn 相同的病人记录被 prp-key 合并为同一个体（owl:sameAs）。
//   - 药物沿 OGMS 层级被归因为 medication role。
// ===========================================================================

// 引入推理引擎核心组件
const fs = require('fs');                                          // 文件系统：读取 OGMS 本体
const path = require('path');                                      // 路径处理
const { parseRDFXML } = require('../src/io/RDFXMLParser');         // RDF/XML 解析器
const { TripleStore } = require('../src/inference/TripleStore');      // 三元组存储
const { OWL2RLReasoner } = require('../src/inference/OWL2RLReasoner'); // OWL 2 RL 推理机
const { NS } = require('../src/inference/rdf');                        // 命名空间常量

// 简化命名空间引用
const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL, XSD = NS.XSD;
// 本案例统一前缀：http://hospital.example.com/rx#
const ex = (s) => 'http://hospital.example.com/rx#' + s;
// OGMS 标准类 IRI
const OGMS_MEDICATION_ROLE = 'http://purl.obolibrary.org/obo/OGMS_0000148'; // medication role

// 构建知识图谱（药物分类 + 病人记录 + 用药方案）
function buildStore() {
  const s = new TripleStore();

  // 加载 OGMS 医学本体（药物 ⊑ medication role）
  const ogmsPath = path.join(__dirname, 'ontologies', 'ogms.owl');
  const ogmsOnt = parseRDFXML(fs.readFileSync(ogmsPath, 'utf8'));
  for (const ax of ogmsOnt.getAxioms()) {
    if (ax.constructor.name === 'OWLSubClassOfAxiom') {
      const sub = typeof ax.subClass === 'string' ? ax.subClass : (ax.subClass && ax.subClass.iri && ax.subClass.iri._iri);
      const sup = typeof ax.superClass === 'string' ? ax.superClass : (ax.superClass && ax.superClass.iri && ax.superClass.iri._iri);
      if (sub && sup && sub.startsWith('http') && sup.startsWith('http')) s.add(sub, RDFS + 'subClassOf', sup);
    }
  }
  // 声明 Anticoagulant ⊑ OGMS medication role
  s.add(ex('Anticoagulant'), RDFS + 'subClassOf', OGMS_MEDICATION_ROLE);

  // ========== TBox：药物分类与方案约束 ==========
  // 阿司匹林是抗凝药
  s.add(ex('Aspirin'), RDFS + 'subClassOf', ex('Anticoagulant'));
  // 华法林是抗凝药
  s.add(ex('Warfarin'), RDFS + 'subClassOf', ex('Anticoagulant'));
  // 安全合用 与 禁忌合用 互斥（disjointWith）
  s.add(ex('SafeCombo'), OWL + 'disjointWith', ex('ForbiddenCombo'));
  // 安全合用是用药方案的一种
  s.add(ex('SafeCombo'), RDFS + 'subClassOf', ex('PrescriptionPlan'));
  // 禁忌合用是用药方案的一种
  s.add(ex('ForbiddenCombo'), RDFS + 'subClassOf', ex('PrescriptionPlan'));

  // ========== hasKey：病人用 ssn 唯一标识 ==========
  // 声明 Patient 的 hasKey 是 ssn 属性
  s.add(ex('Patient'), OWL + 'hasKey', '_:key1');
  // key 列表 _:key1 = ( ssn )，RDF List 结构
  s.add('_:key1', RDF + 'first', ex('ssn'));
  s.add('_:key1', RDF + 'rest', RDF + 'nil');

  // ========== ABox：病人记录与用药方案 ==========
  // 第一条病人记录（ssn: 110101199001011234）
  s.add(ex('pat-record-1'), RDF + 'type', ex('Patient'));
  s.add(ex('pat-record-1'), ex('ssn'), '"110101199001011234"^^<' + XSD + 'string>');
  // 第二条病人记录，ssn 相同 → 应被 hasKey 识别为同一人
  s.add(ex('pat-record-2'), RDF + 'type', ex('Patient'));
  s.add(ex('pat-record-2'), ex('ssn'), '"110101199001011234"^^<' + XSD + 'string>');

  // 一个用药方案，初始标记为安全合用
  s.add(ex('plan-001'), RDF + 'type', ex('SafeCombo'));
  return s;
}

// 执行推理并返回业务结论
function run() {
  const store = buildStore();
  const reasoner = new OWL2RLReasoner(store);
  reasoner.materialize(); // 执行 OWL 2 RL 物化

  // 1) 初始：方案仅标记为 SafeCombo，应一致
  const consistentBefore = reasoner.isConsistent();

  // 2) hasKey 合并：两条 ssn 相同的病人记录应被识别为同一个体（owl:sameAs）
  const merged = store.has(ex('pat-record-1'), OWL + 'sameAs', ex('pat-record-2'))
    || store.has(ex('pat-record-2'), OWL + 'sameAs', ex('pat-record-1'));

  // 3) 制造冲突：医生又开了相互作用的药，方案被追加判定为 ForbiddenCombo
  store.add(ex('plan-001'), RDF + 'type', ex('ForbiddenCombo'));
  const r2 = new OWL2RLReasoner(store);   // 重建推理机（因 store 已改）
  r2.materialize();
  const consistentAfter = r2.isConsistent(); // 现在应不一致
  const conflictFound = r2.inconsistencies.length > 0; // 推理机应记录冲突明细

  // 4) OGMS 层级归因：Anticoagulant 应被归为 medication role
  const anticoagulantIsMedRole = store.has(ex('Anticoagulant'), RDFS + 'subClassOf', OGMS_MEDICATION_ROLE);

  return { consistentBefore, merged, consistentAfter, conflictFound, anticoagulantIsMedRole, store };
}

// 导出供测试与复用
module.exports = { run, buildStore, ex };

// 直接运行时打印业务结论
if (require.main === module) {
  const r = run();
  console.log('初始合法用药方案一致         :', r.consistentBefore); // true
  console.log('相同ssn病人记录被识别为同一人:', r.merged);           // true
  console.log('叠加禁忌后触发不一致         :', !r.consistentAfter); // true（取反后）
  console.log('推理机报告了冲突明细         :', r.conflictFound);   // true
  console.log('抗凝药归为 OGMS medication role:', r.anticoagulantIsMedRole); // true
}
