# 业务案例（sample/）—— OWL 2 端到端实战

本目录收录 **10 个真实业务场景** 的端到端示例，演示 protege-js 如何用 OWL 2 解决具体业务问题。每个案例独立成文件、可直接运行，并由 [../test/owl2/sample-e2e.test.js](../test/owl2/sample-e2e.test.js) 做自动化断言。

其中 [ontologies/](ontologies/) 目录存放**真实下载的行业公开标准本体** OWL 文件（BFO / OGMS / RO-core / IAO，均来自 OBO Foundry 官方 PURL），案例 8、9 直接加载这些真实文件。

## 运行

```bash
# 单独运行某个案例（打印中文业务结论）
node sample/case1-ecommerce-risk.js

# 运行全部 10 个案例
for f in sample/case*.js; do echo "=== $f ==="; node "$f"; done

# 作为端到端测试运行（纳入 npm test）
node --test test/owl2/sample-e2e.test.js
```

## 案例一览

| # | 文件 | 业务场景 | 用到的 OWL 2 能力 |
|---|------|---------|------------------|
| 1 | [case1-ecommerce-risk.js](case1-ecommerce-risk.js) | **电商订单风控**：黑名单买家下单自动标记为高风险订单；误标可信订单时触发一致性告警 | `rdfs:subClassOf` 分类、`rdf:type` 实例归类、`owl:disjointWith` 冲突检测 |
| 2 | [case2-family-swrl.js](case2-family-swrl.js) | **家庭关系推理**：由「父亲+其兄弟」推出叔叔；按年龄自动判定成年 | SWRL 规则（类/对象属性/数据属性/内置函数原子）、`swrlb:greaterThanOrEqual`、`owl:inverseOf` |
| 3 | [case3-pharma-safety.js](case3-pharma-safety.js) | **医疗用药安全**：防止给同一病人开具相互禁忌的药物；相同身份证号的病人记录自动合并 | `owl:disjointWith` 一致性、`owl:hasKey` 唯一识别（prp-key）、`owl:sameAs` |
| 4 | [case4-knowledge-publishing.js](case4-knowledge-publishing.js) | **知识库内容发布**：Turtle 手写本体 → 解析 → 结构化 → 导出为 Turtle/Functional/RDF-XML，往返不丢公理 | TurtleParser、triplesToOntology 桥接、三种 Writer、前缀保真 |
| 5 | [case5-obda-profiles.js](case5-obda-profiles.js) | **企业数据集成(OBDA)**：分散员工数据按本体统一查询召回；组织架构传递分类；profile 合规校验 | OWL2QLReasoner、OWL2ELReasoner、`prp-trp` 传递性、checkQL/checkEL |
| 6 | [case6-medical-ontology.js](case6-medical-ontology.js) | **医疗本体层**（BFO/OGMS/DOID 风格）：疾病-症状-药物-检查核心骨架 + **OWL 文件导入导出**（Turtle→RDF/XML→再导入 round-trip） | TurtleParser、`writeRDFXML`、`parseRDFXML`、OWL 2 RL 类层级推理（cax-sco） |
| 7 | [case7-manufacturing-ppr.js](case7-manufacturing-ppr.js) | **制造业本体层**（ISA-95/BFO+CCO 风格）：产品-工艺-资源(PPR)三角 + BOM 结构 + **OWL 文件导入导出** round-trip | TurtleParser、`writeRDFXML`、`parseRDFXML`、`prp-trp` 传递(hasPart)、`prp-inv` 逆关系(partOf) |
| 8 | [case8-real-medical-bfo-ogms.js](case8-real-medical-bfo-ogms.js) | **真实医疗标准本体层**：直接加载下载的 **BFO + OGMS + RO-core** 公开 OWL 文件，提取真实类层级（230 条 subclass 边 / 187 个 OGMS 类 / 38 个临床核心类），沿真实层级对临床实例做 RL 归因 | 真实公开 OWL 文件加载、`parseRDFXML`、OWL 2 RL 类层级推理、RDF/XML 再导出 |
| 9 | [case9-real-manufacturing-iao.js](case9-real-manufacturing-iao.js) | **真实制造业标准本体层**：加载真实 **BFO + IAO**，把「工艺文件/批生产记录/作业指导书」挂到 IAO 标准类 | 真实公开 OWL 文件加载、IAO 信息制品标准类复用、`cax-sco` 类层级归因、RDF/XML 导出 |
| 10 | [case10-ecommerce-customer-service.js](case10-ecommerce-customer-service.js) | **电商客服智能工单分派**：SWRL 技能路由 + 根因分析 + 升级预测 + 跨渠道关联 | SWRL 路由规则、BFO/IAO 归因、`cax-dw` disjoint、`prp-trp` 传递、RDF/XML 导出 |

## 真实公开本体（ontologies/）

以下文件为 OBO Foundry 官方发布的**真实行业标准本体**，供案例 8、9 直接使用：

| 文件 | 本体 | 来源 | 公理数 | 用途 |
|------|------|------|-------|------|
| [ontologies/bfo.owl](ontologies/bfo.owl) | Basic Formal Ontology (BFO) | https://purl.obolibrary.org/obo/bfo.owl | 178 | ISO/IEC 21838-2 顶层本体，医疗/制造共用基础 |
| [ontologies/ogms.owl](ontologies/ogms.owl) | Ontology for General Medical Science (OGMS) | https://purl.obolibrary.org/obo/ogms.owl | 845 | 医疗通用科学本体（disease/diagnosis 等临床核心类） |
| [ontologies/ro-core.owl](ontologies/ro-core.owl) | OBO Relation Ontology core | https://purl.obolibrary.org/obo/ro/core.owl | 245 | 标准关系（part_of/has_part 等），制造业 BOM 谓词来源 |
| [ontologies/iao.owl](ontologies/iao.owl) | Information Artifact Ontology (IAO) | https://purl.obolibrary.org/obo/iao.owl | 2361 | 信息制品本体（工艺文档/批记录/计划规范等标准类） |

## 每个案例的结构

- 文件顶部块注释：**业务背景 / 业务规则 / 用到的 OWL 2 能力 / 预期结果**。
- `buildStore()`：构造业务数据（TBox 类层级 + ABox 实例）。
- `run()`：执行推理/解析/序列化，返回关键结论。
- `if (require.main === module)`：直接运行时打印中文业务结论，便于人工核对。

## 覆盖的 OWL 2 规范面

- **OWL 2 RL**：分类（cax-sco/eqc）、一致性（cax-dw）、hasKey（prp-key）、等价合并（eq-*）
- **OWL 2 QL / EL**：最小推理机 + 查询召回 + 传递闭包
- **SWRL**：规则模型 + 求值器（含 builtin）
- **解析/序列化**：Turtle、Functional Syntax、RDF/XML、round-trip
- **OWL 文件导入导出**：Turtle 导入 → RDF/XML 导出 → RDF/XML 再导入（医疗/制造本体层交换格式）
- **真实公开本体加载**：直接解析 OBO Foundry 官方 BFO/OGMS/RO/IAO OWL 文件并复用其标准类层级与关系
- **Profile 校验**：OWL2Profiles（checkQL / checkEL）
