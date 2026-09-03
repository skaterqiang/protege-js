'use strict';

// ===========================================================================
// 业务端到端测试 —— 对 sample/ 下 5 个真实业务案例的自动化断言
//
// 每个案例对应一个独立业务场景，覆盖 OWL 2 的不同能力面：
//   案例1  电商订单风控      → OWL 2 RL 分类 + disjoint 一致性检测
//   案例2  家庭关系推理      → SWRL 规则 + builtin + inverseOf
//   案例3  医疗用药安全      → disjoint 冲突 + owl:hasKey 个体合并
//   案例4  知识库内容发布    → Turtle 解析→桥接→三种序列化 round-trip + 前缀保真
//   案例5  企业数据集成 OBDA → OWL 2 QL 查询 + EL 传递分类 + Profile 校验
//   案例6  医疗本体层        → BFO/DOID 风格疾病骨架 + OWL 文件导入导出 round-trip
//   案例7  制造业本体层      → PPR 三角 + BOM hasPart 传递 + OWL 文件导入导出 round-trip
//   案例8  真实医疗本体层    → 加载真实下载的 BFO+OGMS+RO 公开 OWL，真实类层级 RL 归因
//   案例9  真实制造本体层    → 加载真实 BFO+IAO，工艺文档/批记录沿真实 IAO 层级归因
//   案例10 电商客服工单      → 加载真实 BFO+IAO，SWRL 技能路由 + 根因分析 + 升级预测 + 跨渠道关联 + disjoint 一致性 + 导出
//   案例11 政务云运维巡检    → 加载真实 BFO+IAO，SWRL 告警路由 + 根因传播 + 合规风险 + 变更影响 + disjoint 一致性 + 导出
//
// 运行业务案例本身：node sample/caseN-*.js  （会打印中文业务结论）
// 运行本测试套件：  node --test test/owl2/sample-e2e.test.js
// ===========================================================================

const { test } = require('node:test');
const assert = require('node:assert/strict');

const case1 = require('../../sample/case1-ecommerce-risk');
const case2 = require('../../sample/case2-family-swrl');
const case3 = require('../../sample/case3-pharma-safety');
const case4 = require('../../sample/case4-knowledge-publishing');
const case5 = require('../../sample/case5-obda-profiles');
const case6 = require('../../sample/case6-medical-ontology');
const case7 = require('../../sample/case7-manufacturing-ppr');
const case8 = require('../../sample/case8-real-medical-bfo-ogms');
const case9 = require('../../sample/case9-real-manufacturing-iao');
const case10 = require('../../sample/case10-ecommerce-customer-service');

test('案例1 电商风控：黑名单订单被识别为高风险', () => {
  const r = case1.run();
  assert.equal(r.isHighRisk, true, 'ord-001 应被归类为 HighRiskOrder');
  assert.equal(r.isOrder, true, 'ord-001 应仍是 Order');
  assert.equal(r.ord2HighRisk, false, '正常订单 ord-002 不应误判为高风险');
  assert.equal(r.badIsBuyer, true, '黑名单买家应归类为 Buyer');
});

test('案例1 电商风控：误标可信订单触发 disjoint 不一致告警', () => {
  const r = case1.run();
  assert.equal(r.consistentBefore, true, '初始本体应一致');
  assert.equal(r.consistentAfter, false, '误标 TrustedOrder 后应触发 disjoint 冲突');
});

test('案例2 家庭关系：SWRL 推出叔叔关系', () => {
  const r = case2.run();
  assert.equal(r.uncleInferred, true, '应推出 alice -hasUncle-> carol');
  assert.equal(r.childInferred, true, 'inverseOf 应推出 bob -hasChild-> alice');
});

test('案例2 家庭关系：SWRL builtin 判定成年', () => {
  const r = case2.run();
  assert.equal(r.bobAdult, true, 'bob(40) 应判定为 Adult');
  assert.equal(r.carolAdult, false, 'carol(12) 不应判定为 Adult');
});

test('案例3 医疗用药：相同 ssn 病人记录被 hasKey 合并', () => {
  const r = case3.run();
  assert.equal(r.merged, true, '两条 ssn 相同的记录应被识别为同一个体(owl:sameAs)');
});

test('案例3 医疗用药：药物相互作用触发一致性告警', () => {
  const r = case3.run();
  assert.equal(r.consistentBefore, true, '初始合法方案应一致');
  assert.equal(r.consistentAfter, false, '叠加禁忌后应不一致');
  assert.equal(r.conflictFound, true, '推理机应记录冲突明细');
});

test('案例4 知识发布：Turtle 解析→桥接得到非空本体', () => {
  const r = case4.run();
  assert.ok(r.axiomCount > 0, '应解析出至少一条公理');
  assert.equal(r.prefixes.ex, 'http://edu.example.com/kg#', '前缀应保真记录');
});

test('案例4 知识发布：三种序列化器导出且 Turtle 可 round-trip', () => {
  const r = case4.run();
  assert.ok(r.turtleHasCourse, 'Turtle 导出应含 Course');
  assert.ok(r.fsHasSubClass, 'Functional Syntax 导出应含 SubClassOf');
  assert.ok(r.xmlIsXML, 'RDF/XML 导出应以 <?xml 开头');
  assert.ok(r.roundTripOK, '导出的 Turtle 应能再次解析为非空本体');
  assert.ok(r.roundTripAxiomCount > 0);
});

test('案例5 OBDA：QL 查询召回全部子类员工实例', () => {
  const r = case5.run();
  assert.equal(r.employeeCount, 3, '应召回全部 3 名员工（含子类实例）');
  assert.equal(r.qlCarolIsEmployee, true, '合同工应归为 Employee');
  assert.equal(r.qlCarolIsPerson, true, '合同工应归为 Person（多级子类）');
});

test('案例5 OBDA：EL 传递分类 + Profile 校验', () => {
  const r = case5.run();
  assert.equal(r.teamInCompany, true, 'partOf 传递性应推出 小组 partOf 公司');
  assert.equal(r.qlViolationsIsArray, true, 'checkQL 应返回违规数组');
  assert.equal(r.elViolationsIsArray, true, 'checkEL 应返回违规数组');
  assert.equal(r.qlViolationCount, 0, '该本体不应违反 QL profile');
  assert.equal(r.elViolationCount, 0, '该本体不应违反 EL profile');
});

test('案例6 医疗本体层：Turtle 导入 → RDF/XML 导出 → 再导入 round-trip', () => {
  const r = case6.run();
  assert.ok(r.originalAxioms > 0, 'Turtle 导入应得到非空本体');
  assert.ok(r.rdfxmlValid, 'RDF/XML 导出应以 <?xml 开头');
  assert.ok(r.rdfxmlHasDisease, 'RDF/XML 导出应含 Disease 类');
  assert.ok(r.roundTripPreserves, 'RDF/XML 再导入应得到非空本体');
});

test('案例6 医疗本体层：患者沿疾病类层级推理归因', () => {
  const r = case6.run();
  assert.equal(r.instIsDiabetes, true, '2型糖尿病实例应归为 DiabetesMellitus');
  assert.equal(r.instIsEndocrine, true, '应进一步归为 EndocrineDisease');
  assert.equal(r.instIsDisease, true, '应进一步归为顶层 Disease');
  assert.equal(r.consistent, true, '本体应一致');
});

test('案例7 制造业本体层：Turtle 导入 → RDF/XML 导出 → 再导入 round-trip', () => {
  const r = case7.run();
  assert.ok(r.originalAxioms > 0, 'Turtle 导入应得到非空本体');
  assert.ok(r.rdfxmlValid, 'RDF/XML 导出应以 <?xml 开头');
  assert.ok(r.rdfxmlHasProduct, 'RDF/XML 导出应含 Product 类');
  assert.ok(r.roundTripPreserves, 'RDF/XML 再导入应得到非空本体');
});

test('案例7 制造业本体层：BOM 传递 + 逆关系 + 工艺顺序推理', () => {
  const r = case7.run();
  assert.equal(r.transitiveHasPart, true, '整车应传递 hasPart 车门');
  assert.equal(r.inversePartOf, true, '车门应逆关系 partOf 整车');
  assert.equal(r.precedesTransitive, true, '冲压 precedes 涂装（工艺顺序传递）');
  assert.equal(r.compIsProduct, true, '部件应被归类为 Product（子类推理）');
  assert.equal(r.consistent, true, '本体应一致');
});

test('案例8 真实医疗本体层：感冒临床诊疗路径', () => {
  const r = case8.run();
  assert.ok(r.counts.bfo > 0, 'BFO 应解析出非空公理');
  assert.ok(r.counts.ogms > 0, 'OGMS 应解析出非空公理');
  assert.ok(r.edges > 100, '应从真实本体抽取出大量类层级边');
  assert.equal(r.hasStdClasses, true, 'OGMS 应含 symptom/diagnosis/treatment 等临床核心类');
  assert.equal(r.treatmentAttributed, true, '治疗方案应沿真实 OGMS 层级归因');
  assert.equal(r.diagnosisAttributed, true, '诊断应沿真实 IDO 层级归因');
  assert.equal(r.consistent, true, '合并本体应一致');
  assert.equal(r.exported, true, '病历应可导出为 RDF/XML');
});

test('案例9 真实制造本体层：加载真实 BFO/IAO 公开 OWL 文件', () => {
  const r = case9.run();
  assert.ok(r.counts.bfo > 0, 'BFO 应解析出非空公理');
  assert.ok(r.counts.iao > 0, 'IAO 应解析出非空公理');
  assert.ok(r.edges > 100, '应从真实本体抽取出大量类层级边');
  assert.equal(r.hasStdClasses, true, 'IAO 应含 directive information/document/plan specification 等标准类');
});

test('案例9 真实制造本体层：批记录沿真实 IAO 层级归因 + 导出', () => {
  const r = case9.run();
  assert.equal(r.isBatchRecord, true, '实例应归为企业 BatchRecord');
  assert.equal(r.isDoc, true, '应归为 IAO document');
  assert.equal(r.isICE, true, '应归为 IAO information content entity');
  assert.equal(r.isGDC, true, '应归为 BFO generically dependent continuant');
  assert.equal(r.attributed, true, '应沿真实 IAO 层级完整归因');
  assert.equal(r.consistent, true, '扩展本体应一致');
  assert.equal(r.exported, true, '扩展本体应可导出为 RDF/XML');
});

test('案例10 电商客服：SWRL 技能路由 + BFO/IAO 归因 + disjoint 一致性', () => {
  const r = case10.run();
  assert.equal(r.goldRouted, true, '金牌工单应路由到金牌客服组');
  assert.equal(r.normalRouted, true, '普通工单应路由到通用客服组');
  assert.equal(r.orderIsMaterialEntity, true, '工单应归为 BFO material entity');
  assert.equal(r.custIsMaterialEntity, true, '客户应归为 BFO material entity');
  assert.equal(r.planIsPlanSpec, true, '分派方案应归为 IAO plan specification');
  assert.equal(r.slaIsDIE, true, 'SLA 应归为 IAO directive information entity');
  assert.equal(r.logIsDocument, true, '分派日志应归为 IAO document');
  assert.equal(r.consistentBefore, true, '初始本体应一致');
  assert.equal(r.consistentAfter, false, '同一工单标记两组后应不一致');
  assert.equal(r.conflictFound, true, '推理机应报告 disjoint 冲突');
  // 场景A：根因分析
  assert.equal(r.rcAlert1, true, '缺陷批次工单1应告警');
  assert.equal(r.rcAlert2, true, '缺陷批次工单2应告警');
  assert.equal(r.rcAlert3, false, '正常批次工单不应告警');
  assert.equal(r.rcSupplierLinked, true, '批次应关联供应商');
  // 场景B：投诉升级预测
  assert.equal(r.escRisk, true, '高危工单应标记升级风险');
  assert.equal(r.escNotRisk, true, '关联工单应传递升级风险');
  // 场景C：跨渠道问题关联
  assert.equal(r.crossChannelLinked, true, 'App工单应传递关联到微博工单');
  assert.equal(r.appChannel, true, 'App工单应标记渠道');
  assert.equal(r.weiboChannel, true, '微博工单应标记渠道');
  assert.equal(r.exported, true, '分派记录应可导出为 RDF/XML');
});
