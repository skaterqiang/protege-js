# OWL 2 RL 规范细则

> 本文档逐条列出 **OWL 2 RL** profile 的推理规则（rule set），作为 `protege-js`
> 推理引擎实现与测试的规范依据。
>
> - **规范来源**：W3C Recommendation, *OWL 2 Web Ontology Language Profiles (Second Edition)*, §4.3 "OWL 2 RL"（Table 5–Table 10 的规则集）。
> - **原始规范文档**：本目录下 [`owl2-profiles-spec.html`](./owl2-profiles-spec.html)（W3C 官方页面快照，curl 自 <https://www.w3.org/TR/owl2-profiles/>）。
> - **机器可读规则数据**：[`rl_rules.json`](./rl_rules.json)（从规范表格逐条提取的 if/then）。

## 规则表示法

规则以**一阶逻辑蕴含**形式书写，用**三元组** `T(s, p, o)` 表示 RDF 三元组
(subject, predicate, object)。含义：

```
IF  <前件：一组必须同时匹配的三元组模式>
THEN <后件：推导出的三元组；或 false 表示“不一致/矛盾”>
```

- `?x`、`?c`、`?p` 等以 `?` 开头的是**变量**，可绑定到任意 IRI / 字面量 / 空白节点。
- `T(?s, ?p, ?o)` 匹配知识库中任一三元组。
- `LIST[?x, ?e1, ..., ?en]` 表示 `?x` 是一个 RDF 列表（`rdf:first`/`rdf:rest` 链），元素为 `?e1…?en`。
- 后件为 `false` 表示检测到**逻辑不一致**（ inconsistency ），推理机应报告冲突。
- `lt`/`dt` 表示字面量与其数据类型；`ap` 表示内置注解属性。
- `N ^^ xsd:nonNegativeInteger` 表示带数据类型的字面量。

OWL 2 RL 的规则共 **78 条**（`eq-rep` 在规范表格中为 s/p/o 三个独立行，`dt-not-type` 单独成行），分为 **6 大类**。

---

## 1. 相等与不等（Equality）— `eq-*`（9 条）

处理 `owl:sameAs`（同一性）与 `owl:differentFrom`（差异性）的自反、对称、传递与替换。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **eq-ref** | `T(?s, ?p, ?o)` | `T(?s, owl:sameAs, ?s)` `T(?p, owl:sameAs, ?p)` `T(?o, owl:sameAs, ?o)` |
| **eq-sym** | `T(?x, owl:sameAs, ?y)` | `T(?y, owl:sameAs, ?x)` |
| **eq-trans** | `T(?x, owl:sameAs, ?y)` `T(?y, owl:sameAs, ?z)` | `T(?x, owl:sameAs, ?z)` |
| **eq-rep-s** | `T(?s, owl:sameAs, ?s')` `T(?s, ?p, ?o)` | `T(?s', ?p, ?o)` |
| **eq-rep-p** | `T(?p, owl:sameAs, ?p')` `T(?s, ?p, ?o)` | `T(?s, ?p', ?o)` |
| **eq-rep-o** | `T(?o, owl:sameAs, ?o')` `T(?s, ?p, ?o)` | `T(?s, ?p, ?o')` |
| **eq-diff1** | `T(?x, owl:sameAs, ?y)` `T(?x, owl:differentFrom, ?y)` | `false` |
| **eq-diff2** | `T(?x, rdf:type, owl:AllDifferent)` `T(?x, owl:members, ?y)` `LIST[?y, ?z1,…,?zn]` `T(?zi, owl:sameAs, ?zj)` | `false` |
| **eq-diff3** | `T(?x, rdf:type, owl:AllDifferent)` `T(?x, owl:distinctMembers, ?y)` `LIST[?y, ?z1,…,?zn]` `T(?zi, owl:sameAs, ?zj)` | `false` |

---

## 2. 属性（Properties）— `prp-*`（20 条）

处理属性的定义域/值域、函数性、对称性、传递性、逆属性、属性链、键等。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **prp-ap** | *(空)* | `T(ap, rdf:type, owl:AnnotationProperty)`（对每个内置注解属性） |
| **prp-dom** | `T(?p, rdfs:domain, ?c)` `T(?x, ?p, ?y)` | `T(?x, rdf:type, ?c)` |
| **prp-rng** | `T(?p, rdfs:range, ?c)` `T(?x, ?p, ?y)` | `T(?y, rdf:type, ?c)` |
| **prp-fp** | `T(?p, rdf:type, owl:FunctionalProperty)` `T(?x, ?p, ?y1)` `T(?x, ?p, ?y2)` | `T(?y1, owl:sameAs, ?y2)` |
| **prp-ifp** | `T(?p, rdf:type, owl:InverseFunctionalProperty)` `T(?x1, ?p, ?y)` `T(?x2, ?p, ?y)` | `T(?x1, owl:sameAs, ?x2)` |
| **prp-irp** | `T(?p, rdf:type, owl:IrreflexiveProperty)` `T(?x, ?p, ?x)` | `false` |
| **prp-symp** | `T(?p, rdf:type, owl:SymmetricProperty)` `T(?x, ?p, ?y)` | `T(?y, ?p, ?x)` |
| **prp-asyp** | `T(?p, rdf:type, owl:AsymmetricProperty)` `T(?x, ?p, ?y)` `T(?y, ?p, ?x)` | `false` |
| **prp-trp** | `T(?p, rdf:type, owl:TransitiveProperty)` `T(?x, ?p, ?y)` `T(?y, ?p, ?z)` | `T(?x, ?p, ?z)` |
| **prp-spo1** | `T(?p1, rdfs:subPropertyOf, ?p2)` `T(?x, ?p1, ?y)` | `T(?x, ?p2, ?y)` |
| **prp-spo2** | `T(?p, owl:propertyChainAxiom, ?x)` `LIST[?x, ?p1,…,?pn]` `T(?u1,?p1,?u2)` … `T(?un,?pn,?un+1)` | `T(?u1, ?p, ?un+1)` |
| **prp-eqp1** | `T(?p1, owl:equivalentProperty, ?p2)` `T(?x, ?p1, ?y)` | `T(?x, ?p2, ?y)` |
| **prp-eqp2** | `T(?p1, owl:equivalentProperty, ?p2)` `T(?x, ?p2, ?y)` | `T(?x, ?p1, ?y)` |
| **prp-pdw** | `T(?p1, owl:propertyDisjointWith, ?p2)` `T(?x, ?p1, ?y)` `T(?x, ?p2, ?y)` | `false` |
| **prp-adp** | `T(?x, rdf:type, owl:AllDisjointProperties)` `T(?x, owl:members, ?y)` `LIST[?y, ?p1,…,?pn]` `T(?u, ?pi, ?v)` `T(?u, ?pj, ?v)` | `false` |
| **prp-inv1** | `T(?p1, owl:inverseOf, ?p2)` `T(?x, ?p1, ?y)` | `T(?y, ?p2, ?x)` |
| **prp-inv2** | `T(?p1, owl:inverseOf, ?p2)` `T(?x, ?p2, ?y)` | `T(?y, ?p1, ?x)` |
| **prp-key** | `T(?c, owl:hasKey, ?u)` `LIST[?u, ?p1,…,?pn]` `T(?x, rdf:type, ?c)` `T(?x, ?p1, ?z1)`…`T(?x, ?pn, ?zn)` `T(?y, rdf:type, ?c)` `T(?y, ?p1, ?z1)`…`T(?y, ?pn, ?zn)` | `T(?x, owl:sameAs, ?y)` |
| **prp-npa1** | `T(?x, owl:sourceIndividual, ?i1)` `T(?x, owl:assertionProperty, ?p)` `T(?x, owl:targetIndividual, ?i2)` `T(?i1, ?p, ?i2)` | `false` |
| **prp-npa2** | `T(?x, owl:sourceIndividual, ?i)` `T(?x, owl:assertionProperty, ?p)` `T(?x, owl:targetValue, ?lt)` `T(?i, ?p, ?lt)` | `false` |

---

## 3. 类（Classes）— `cls-*`（19 条）

处理顶层/底层类、交集/并集/补集、值约束（someValuesFrom/allValuesFrom/hasValue）、基数约束、枚举。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **cls-thing** | *(空)* | `T(owl:Thing, rdf:type, owl:Class)` |
| **cls-nothing1** | *(空)* | `T(owl:Nothing, rdf:type, owl:Class)` |
| **cls-nothing2** | `T(?x, rdf:type, owl:Nothing)` | `false` |
| **cls-int1** | `T(?c, owl:intersectionOf, ?x)` `LIST[?x, ?c1,…,?cn]` `T(?y, rdf:type, ?c1)`…`T(?y, rdf:type, ?cn)` | `T(?y, rdf:type, ?c)` |
| **cls-int2** | `T(?c, owl:intersectionOf, ?x)` `LIST[?x, ?c1,…,?cn]` `T(?y, rdf:type, ?c)` | `T(?y, rdf:type, ?c1)`…`T(?y, rdf:type, ?cn)` |
| **cls-uni** | `T(?c, owl:unionOf, ?x)` `LIST[?x, ?c1,…,?cn]` `T(?y, rdf:type, ?ci)` | `T(?y, rdf:type, ?c)` |
| **cls-com** | `T(?c1, owl:complementOf, ?c2)` `T(?x, rdf:type, ?c1)` `T(?x, rdf:type, ?c2)` | `false` |
| **cls-svf1** | `T(?x, owl:someValuesFrom, ?y)` `T(?x, owl:onProperty, ?p)` `T(?u, ?p, ?v)` `T(?v, rdf:type, ?y)` | `T(?u, rdf:type, ?x)` |
| **cls-svf2** | `T(?x, owl:someValuesFrom, owl:Thing)` `T(?x, owl:onProperty, ?p)` `T(?u, ?p, ?v)` | `T(?u, rdf:type, ?x)` |
| **cls-avf** | `T(?x, owl:allValuesFrom, ?y)` `T(?x, owl:onProperty, ?p)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?v)` | `T(?v, rdf:type, ?y)` |
| **cls-hv1** | `T(?x, owl:hasValue, ?y)` `T(?x, owl:onProperty, ?p)` `T(?u, rdf:type, ?x)` | `T(?u, ?p, ?y)` |
| **cls-hv2** | `T(?x, owl:hasValue, ?y)` `T(?x, owl:onProperty, ?p)` `T(?u, ?p, ?y)` | `T(?u, rdf:type, ?x)` |
| **cls-maxc1** | `T(?x, owl:maxCardinality, "0")` `T(?x, owl:onProperty, ?p)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y)` | `false` |
| **cls-maxc2** | `T(?x, owl:maxCardinality, "1")` `T(?x, owl:onProperty, ?p)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y1)` `T(?u, ?p, ?y2)` | `T(?y1, owl:sameAs, ?y2)` |
| **cls-maxqc1** | `T(?x, owl:maxQualifiedCardinality, "0")` `T(?x, owl:onProperty, ?p)` `T(?x, owl:onClass, ?c)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y)` `T(?y, rdf:type, ?c)` | `false` |
| **cls-maxqc2** | `T(?x, owl:maxQualifiedCardinality, "0")` `T(?x, owl:onProperty, ?p)` `T(?x, owl:onClass, owl:Thing)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y)` | `false` |
| **cls-maxqc3** | `T(?x, owl:maxQualifiedCardinality, "1")` `T(?x, owl:onProperty, ?p)` `T(?x, owl:onClass, ?c)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y1)` `T(?y1, rdf:type, ?c)` `T(?u, ?p, ?y2)` `T(?y2, rdf:type, ?c)` | `T(?y1, owl:sameAs, ?y2)` |
| **cls-maxqc4** | `T(?x, owl:maxQualifiedCardinality, "1")` `T(?x, owl:onProperty, ?p)` `T(?x, owl:onClass, owl:Thing)` `T(?u, rdf:type, ?x)` `T(?u, ?p, ?y1)` `T(?u, ?p, ?y2)` | `T(?y1, owl:sameAs, ?y2)` |
| **cls-oo** | `T(?c, owl:oneOf, ?x)` `LIST[?x, ?y1,…,?yn]` | `T(?y1, rdf:type, ?c)`…`T(?yn, rdf:type, ?c)` |

---

## 4. 类公理（Class Axioms）— `cax-*`（6 条）

处理子类、等价类、不相交类。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **cax-sco** | `T(?c1, rdfs:subClassOf, ?c2)` `T(?x, rdf:type, ?c1)` | `T(?x, rdf:type, ?c2)` |
| **cax-eqc1** | `T(?c1, owl:equivalentClass, ?c2)` `T(?x, rdf:type, ?c1)` | `T(?x, rdf:type, ?c2)` |
| **cax-eqc2** | `T(?c1, owl:equivalentClass, ?c2)` `T(?x, rdf:type, ?c2)` | `T(?x, rdf:type, ?c1)` |
| **cax-dw** | `T(?c1, owl:disjointWith, ?c2)` `T(?x, rdf:type, ?c1)` `T(?x, rdf:type, ?c2)` | `false` |
| **cax-adc** | `T(?x, rdf:type, owl:AllDisjointClasses)` `T(?x, owl:members, ?y)` `LIST[?y, ?c1,…,?cn]` `T(?z, rdf:type, ?ci)` `T(?z, rdf:type, ?cj)` | `false` |

---

## 5. 数据类型（Datatypes）— `dt-*`（5 条）

处理字面量的数据类型归属、相等/不等、非法类型。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **dt-type1** | *(空)* | `T(dt, rdf:type, rdfs:Datatype)`（对每个内置数据类型） |
| **dt-type2** | *(空)* | `T(lt, rdf:type, dt)`（对每个良构字面量 lt，其数据类型为 dt） |
| **dt-eq** | *(空)* | `T(lt1, owl:sameAs, lt2)`（若 lt1、lt2 数据类型相同且字面值相等） |
| **dt-diff** | *(空)* | `T(lt1, owl:differentFrom, lt2)`（若数据类型相同但字面值不同） |
| **dt-not-type** | `T(lt, rdf:type, dt)` | `false`（若 lt 的字面值不属于 dt 的值空间） |

---

## 6. 模式公理（Schema Axioms）— `scm-*`（19 条）

处理类/属性的自反子类/子属性、等价、定义域/值域的传播、以及类表达式的模式级子类关系。

| 规则 | 前件 (IF) | 后件 (THEN) |
|------|-----------|-------------|
| **scm-cls** | `T(?c, rdf:type, owl:Class)` | `T(?c, rdfs:subClassOf, ?c)` `T(?c, owl:equivalentClass, ?c)` `T(?c, rdfs:subClassOf, owl:Thing)` `T(owl:Nothing, rdfs:subClassOf, ?c)` |
| **scm-sco** | `T(?c1, rdfs:subClassOf, ?c2)` `T(?c2, rdfs:subClassOf, ?c3)` | `T(?c1, rdfs:subClassOf, ?c3)` |
| **scm-eqc1** | `T(?c1, owl:equivalentClass, ?c2)` | `T(?c1, rdfs:subClassOf, ?c2)` `T(?c2, rdfs:subClassOf, ?c1)` |
| **scm-eqc2** | `T(?c1, rdfs:subClassOf, ?c2)` `T(?c2, rdfs:subClassOf, ?c1)` | `T(?c1, owl:equivalentClass, ?c2)` |
| **scm-op** | `T(?p, rdf:type, owl:ObjectProperty)` | `T(?p, rdfs:subPropertyOf, ?p)` `T(?p, owl:equivalentProperty, ?p)` |
| **scm-dp** | `T(?p, rdf:type, owl:DatatypeProperty)` | `T(?p, rdfs:subPropertyOf, ?p)` `T(?p, owl:equivalentProperty, ?p)` |
| **scm-spo** | `T(?p1, rdfs:subPropertyOf, ?p2)` `T(?p2, rdfs:subPropertyOf, ?p3)` | `T(?p1, rdfs:subPropertyOf, ?p3)` |
| **scm-eqp1** | `T(?p1, owl:equivalentProperty, ?p2)` | `T(?p1, rdfs:subPropertyOf, ?p2)` `T(?p2, rdfs:subPropertyOf, ?p1)` |
| **scm-eqp2** | `T(?p1, rdfs:subPropertyOf, ?p2)` `T(?p2, rdfs:subPropertyOf, ?p1)` | `T(?p1, owl:equivalentProperty, ?p2)` |
| **scm-dom1** | `T(?p, rdfs:domain, ?c1)` `T(?c1, rdfs:subClassOf, ?c2)` | `T(?p, rdfs:domain, ?c2)` |
| **scm-dom2** | `T(?p2, rdfs:domain, ?c)` `T(?p1, rdfs:subPropertyOf, ?p2)` | `T(?p1, rdfs:domain, ?c)` |
| **scm-rng1** | `T(?p, rdfs:range, ?c1)` `T(?c1, rdfs:subClassOf, ?c2)` | `T(?p, rdfs:range, ?c2)` |
| **scm-rng2** | `T(?p2, rdfs:range, ?c)` `T(?p1, rdfs:subPropertyOf, ?p2)` | `T(?p1, rdfs:range, ?c)` |
| **scm-hv** | `T(?c1, owl:hasValue, ?i)` `T(?c1, owl:onProperty, ?p1)` `T(?c2, owl:hasValue, ?i)` `T(?c2, owl:onProperty, ?p2)` `T(?p1, rdfs:subPropertyOf, ?p2)` | `T(?c1, rdfs:subClassOf, ?c2)` |
| **scm-svf1** | `T(?c1, owl:someValuesFrom, ?y1)` `T(?c1, owl:onProperty, ?p)` `T(?c2, owl:someValuesFrom, ?y2)` `T(?c2, owl:onProperty, ?p)` `T(?y1, rdfs:subClassOf, ?y2)` | `T(?c1, rdfs:subClassOf, ?c2)` |
| **scm-svf2** | `T(?c1, owl:someValuesFrom, ?y)` `T(?c1, owl:onProperty, ?p1)` `T(?c2, owl:someValuesFrom, ?y)` `T(?c2, owl:onProperty, ?p2)` `T(?p1, rdfs:subPropertyOf, ?p2)` | `T(?c1, rdfs:subClassOf, ?c2)` |
| **scm-avf1** | `T(?c1, owl:allValuesFrom, ?y1)` `T(?c1, owl:onProperty, ?p)` `T(?c2, owl:allValuesFrom, ?y2)` `T(?c2, owl:onProperty, ?p)` `T(?y1, rdfs:subClassOf, ?y2)` | `T(?c1, rdfs:subClassOf, ?c2)` |
| **scm-avf2** | `T(?c1, owl:allValuesFrom, ?y)` `T(?c1, owl:onProperty, ?p1)` `T(?c2, owl:allValuesFrom, ?y)` `T(?c2, owl:onProperty, ?p2)` `T(?p1, rdfs:subPropertyOf, ?p2)` | `T(?c2, rdfs:subClassOf, ?c1)` |
| **scm-int** | `T(?c, owl:intersectionOf, ?x)` `LIST[?x, ?c1,…,?cn]` | `T(?c, rdfs:subClassOf, ?c1)`…`T(?c, rdfs:subClassOf, ?cn)` |
| **scm-uni** | `T(?c, owl:unionOf, ?x)` `LIST[?x, ?c1,…,?cn]` | `T(?c1, rdfs:subClassOf, ?c)`…`T(?cn, rdfs:subClassOf, ?c)` |

---

## 实现与测试对应

- 实现：`src/inference/OWL2RLReasoner.js`（规则引擎，前向链 + 半朴素物化）。
- 规则注册：`src/inference/rules/`（按 6 大类分文件，每条规则一个导出函数）。
- 测试：`test/owl2rl/`（按大类分文件，每条规则 ≥1 个正向用例；`false` 规则附不一致检测用例）。
- 覆盖核对：每条规则的 `id` 在实现与测试中一一对应，运行 `npm test` 全部通过即视为 100% 支持。
