'use strict';

// ===========================================================================
// 业务案例 1：电商订单风控 —— 高风险订单识别（OWL 2 RL）
// ---------------------------------------------------------------------------
// 【业务背景】
//   电商平台要在下单后实时识别「高风险订单」，交给人工审核，防止欺诈。
//
// 【业务规则】
//   1. 预售订单(PreOrder)、批发订单(WholesaleOrder) 都是 订单(Order) 的子类。
//   2. 黑名单买家(BlacklistedBuyer) 是 买家(Buyer) 的一种。
//   3. 规则：凡是被 黑名单买家 提交的订单，自动标记为 高风险订单(HighRiskOrder)。
//      用 OWL 表达：OrderSubmittedByBlacklisted ≡ submittedBy some BlacklistedBuyer，
//      且 OrderSubmittedByBlacklisted ⊑ HighRiskOrder。OWL 2 RL 的 cls-svf1 规则
//      可由 someValuesFrom 限制自动推出实例归类，无需手工挂中间类型。
//   4. 一致性约束：高风险订单 与 可信订单(TrustedOrder) 互斥（disjointWith）。
//      若同一订单既是高风险又是可信，则本体不一致，风控系统应报警。
//
// 【用到的 OWL 2 能力】
//   rdfs:subClassOf (cax-sco) / rdf:type 实例分类 (cax-eqc) /
//   owl:someValuesFrom + owl:onProperty (cls-svf1) / owl:equivalentClass /
//   owl:disjointWith 冲突检测 (cax-dw) / OWL2RLReasoner.materialize
//
// 【预期结果】
//   - ord-001（黑名单买家下单）被自动推导为 OrderSubmittedByBlacklisted → HighRiskOrder。
//   - 把 ord-001 同时声明为 TrustedOrder 后，reasoner.isConsistent() = false。
// ===========================================================================

// 引入推理引擎核心组件
const { TripleStore } = require('../src/inference/TripleStore');      // 三元组存储：存放 RDF 主谓宾
const { OWL2RLReasoner } = require('../src/inference/OWL2RLReasoner'); // OWL 2 RL 推理机：执行规则物化
const { ReasonerQueries } = require('../src/inference/ReasonerQueries'); // 查询接口：读取推理结果
const { NS } = require('../src/inference/rdf');                        // 命名空间常量：RDF/RDFS/OWL/XSD

// 简化命名空间引用，后面拼接 IRI 用
const RDF = NS.RDF, RDFS = NS.RDFS, OWL = NS.OWL;
// 本案例统一前缀：http://shop.example.com/risk#
const ex = (s) => 'http://shop.example.com/risk#' + s;

// 构建知识图谱（TBox 类层级 + ABox 实例 + OWL 限制）
function buildStore() {
  const s = new TripleStore();

  // ========== TBox：类层级与约束 ==========
  // 预售订单是订单的子类
  s.add(ex('PreOrder'), RDFS + 'subClassOf', ex('Order'));
  // 批发订单是订单的子类
  s.add(ex('WholesaleOrder'), RDFS + 'subClassOf', ex('Order'));
  // 黑名单买家是买家的子类
  s.add(ex('BlacklistedBuyer'), RDFS + 'subClassOf', ex('Buyer'));
  // 高风险订单是订单的子类
  s.add(ex('HighRiskOrder'), RDFS + 'subClassOf', ex('Order'));
  // 高风险订单 与 可信订单 互斥（disjointWith）
  s.add(ex('HighRiskOrder'), OWL + 'disjointWith', ex('TrustedOrder'));

  // ========== ABox：实例数据 ==========
  // 黑名单买家实例
  s.add(ex('buyer-bad-9'), RDF + 'type', ex('BlacklistedBuyer'));
  // ord-001 是一笔预售订单
  s.add(ex('ord-001'), RDF + 'type', ex('PreOrder'));
  // ord-001 由黑名单买家提交
  s.add(ex('ord-001'), ex('submittedBy'), ex('buyer-bad-9'));

  // ========== OWL 限制：业务规则形式化 ==========
  // 核心规则：凡 submittedBy 指向某 BlacklistedBuyer 的订单 → 高风险
  // 用 OWL someValuesFrom 表达：OrderSubmittedByBlacklisted ≡ submittedBy some BlacklistedBuyer
  s.add(ex('OrderSubmittedByBlacklisted'), OWL + 'equivalentClass', ex('_restr_submittedByBlacklisted'));
  // 限制：存在 submittedBy 指向 BlacklistedBuyer
  s.add(ex('_restr_submittedByBlacklisted'), OWL + 'someValuesFrom', ex('BlacklistedBuyer'));
  // 限制作用在 submittedBy 属性上
  s.add(ex('_restr_submittedByBlacklisted'), OWL + 'onProperty', ex('submittedBy'));
  // 被黑名单提交的订单 是 高风险订单 的子类
  s.add(ex('OrderSubmittedByBlacklisted'), RDFS + 'subClassOf', ex('HighRiskOrder'));

  // 一笔正常订单对照：批发订单，由普通买家提交
  s.add(ex('ord-002'), RDF + 'type', ex('WholesaleOrder'));
  s.add(ex('ord-002'), ex('submittedBy'), ex('buyer-good-1'));
  s.add(ex('buyer-good-1'), RDF + 'type', ex('Buyer'));

  return s;
}

// 执行推理并返回业务结论
function run() {
  // 构建知识图谱
  const store = buildStore();

  // 保存原始输入三元组快照（推理前），供打印输入区使用
  const inputTriples = store.match(null, null, null).map(t => [t[0], t[1], t[2]]);

  // 创建 OWL 2 RL 推理机并执行物化（把所有能推出的三元组都算出来）
  const reasoner = new OWL2RLReasoner(store);
  reasoner.materialize();

  // 创建查询接口，读取推理结果
  const q = new ReasonerQueries(reasoner);

  // 1) ord-001 应被归类为 HighRiskOrder（经由 someValuesFrom → OrderSubmittedByBlacklisted ⊑ HighRiskOrder）
  const isHighRisk = q.getTypes(ex('ord-001')).includes(ex('HighRiskOrder'));

  // 2) ord-001 同时是 Order（PreOrder ⊑ Order，且 HighRiskOrder ⊑ Order）
  const isOrder = q.getTypes(ex('ord-001')).includes(ex('Order'));

  // 3) 正常订单 ord-002 不应是 HighRiskOrder（对照组）
  const ord2HighRisk = q.getTypes(ex('ord-002')).includes(ex('HighRiskOrder'));

  // 4) 黑名单买家被归类为 Buyer（BlacklistedBuyer ⊑ Buyer）
  const badIsBuyer = q.getTypes(ex('buyer-bad-9')).includes(ex('Buyer'));

  // 5) 一致性检查：此时本体应当一致（没有把 ord-001 同时声明为 TrustedOrder）
  const consistentBefore = reasoner.isConsistent();

  // 6) 制造冲突：把 ord-001 错误地标为 TrustedOrder → 应触发 disjoint 冲突
  store.add(ex('ord-001'), RDF + 'type', ex('TrustedOrder'));
  const r2 = new OWL2RLReasoner(store);   // 重建推理机（因 store 已改）
  r2.materialize();
  const consistentAfter = r2.isConsistent(); // 现在应不一致

  // 返回所有业务结论 + 查询接口 + 原始输入快照
  return { isHighRisk, isOrder, ord2HighRisk, badIsBuyer, consistentBefore, consistentAfter, q, store, inputTriples };
}

// 导出供测试与复用
module.exports = { run, buildStore, ex };

// ===========================================================================
// 直接运行时（node sample/case1-ecommerce-risk.js）打印详细输入/输出
// ===========================================================================
if (require.main === module) {
  const r = run();

  // 本案例命名空间前缀，用于缩短打印
  const EX = 'http://shop.example.com/risk#';
  // 把完整 IRI 缩成 ex:ClassName 形式
  const short = (iri) => (typeof iri === 'string' ? iri.replace(EX, 'ex:') : iri);
  // 只保留业务相关三元组：过滤掉推理机自动生成的 sameAs 噪音
  const bizOnly = ([s, p, o]) =>
    [s, p, o].every(x => typeof x === 'string') &&   // 三元组都是字符串
    (s.startsWith(EX) || o.startsWith(EX)) &&         // 主语或宾语在本案例命名空间
    !p.includes('sameAs');                            // 排除 sameAs 自反噪音

  // ========== 打印输入：TBox + ABox 原始三元组 ==========
  console.log('================ 输入（TBox 类层级 + ABox 实例）================');
  for (const [s, p, o] of r.inputTriples) {
    if (bizOnly([s, p, o])) {
      // 把命名空间缩写成常用前缀
      const pp = p.replace('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'rdf:')
                  .replace('http://www.w3.org/2000/01/rdf-schema#', 'rdfs:')
                  .replace('http://www.w3.org/2002/07/owl#', 'owl:');
      console.log('  ', short(s), pp, short(o));
    }
  }

  // ========== 打印推理后：各实例被归类的类型 ==========
  console.log('\n================ 推理后：各实例被归类的类型 ================');
  for (const inst of ['ord-001', 'ord-002', 'buyer-bad-9', 'buyer-good-1']) {
    // 只保留本案例命名空间的类型，过滤掉 owl:Thing 等顶层噪音
    const types = r.q.getTypes(ex(inst)).filter(t => t.startsWith(EX)).map(short);
    console.log('  ', short(ex(inst)), '→', types.join(', '));
  }

  // ========== 打印业务结论 ==========
  console.log('\n================ 业务结论 ================');
  console.log('ord-001 被识别为高风险订单 :', r.isHighRisk);       // true
  console.log('ord-001 仍是合法订单       :', r.isOrder);          // true
  console.log('ord-002 被误判为高风险     :', r.ord2HighRisk, '(应为 false)'); // false
  console.log('黑名单买家被归类为 Buyer   :', r.badIsBuyer);       // true
  console.log('冲突前本体一致             :', r.consistentBefore); // true
  console.log('误标可信后触发不一致告警   :', !r.consistentAfter); // true（取反后）
}
