# OWL 2 规范覆盖差距分析

对照 W3C OWL 2 全部规范（Structural / Profiles / Manchester / OWL-XML / SWRL / New-Features），列出当前 `protege-js` 尚未实现的能力，按优先级分组。

- 已实现部分：见 [../README.md](../README.md)
- 本文件：2026-09-01 差距审计
- **2026-09-01 更新：全部 H/M/L 缺口已实施完成，256/256 测试通过。** 各项完成状态见下文 ✅ 标注。

---

## 一、HIGH PRIORITY（核心规范项缺失）

### H1. 本体头（Ontology Header）解析不完整 ✅
- 规范：owl2-syntax §3.1–3.4（OntologyIRI / VersionIRI / `owl:imports` / `owl:priorVersion` / `owl:backwardCompatibleWith` / `owl:incompatibleWith` / ontology annotations）
- 现状：模型层 [OWLOntologyID](../src/model/OWLOntology.js) 已支持 ontologyIRI/versionIRI；但三个解析器都未填充 imports / priorVersion / backwardCompatibleWith / ontology annotations。
- 影响：本体之间的导入依赖、版本演进链、本体级元数据全部丢失。
- 改动：
  - [FunctionalSyntaxParser.js](../src/io/FunctionalSyntaxParser.js) `Ontology(...)` 分支读取并保存 IRI/版本/Import/Annotation。
  - [RDFXMLParser.js](../src/io/RDFXMLParser.js) 解析 `<owl:Ontology>` 块全部子元素。
  - [TurtleParser.js](../src/io/TurtleParser.js) 输出 ontology header 三元组；解析器层面新增提取器。
  - [OWLOntology](../src/model/OWLOntology.js) 增加 `imports`、`priorVersion`、`backwardCompatibleWith`、`incompatibleWith` 字段。

### H2. 公理注解（Axiom Annotations）解析 ✅
- 规范：owl2-syntax §10；RDF 侧用 `owl:Axiom` + `owl:annotatedSource|Property|Target` reification。
- 现状：`OWLAxiom` 构造函数已接受 `annotations`，但 **三个解析器都没填充**。
- 影响：用户写的注释（「此规则来自 XX 标准」）在解析后丢失。
- 改动：三个解析器识别 `Annotation(...)` 前缀（Functional）与 `owl:Axiom` reification（RDF/Turtle/XML），传入构造函数第三参。

### H3. `owl:hasKey` 在 RDF/XML 中未解析 ✅
- 规范：owl2-syntax §9.5；owl2-new-features §2.3
- 现状：模型类 OWLHasKeyAxiom 存在，Functional Syntax 支持；RDF/XML 解析器缺失。
- 改动：[RDFXMLParser.js](../src/io/RDFXMLParser.js) `parseClassBody` 增加 `owl:hasKey` 列表分支。

### H4. 匿名个体（Anonymous Individuals）✅
- 规范：owl2-syntax §5.6.2
- 现状：模型只有 `OWLNamedIndividual`；解析器遇到 `_:xxx` 时强制当作命名个体。
- 影响：Turtle/RDF 中常见的匿名个体（如「某个未知的人」）会被错误分配伪 IRI。
- 改动：[OWLEntity.js](../src/model/OWLEntity.js) 新增 `OWLAnonymousIndividual(nodeId)`，三个解析器识别 `_:name` 词法。

### H5. RDF/XML 中匿名类表达式 / Restriction 未解析 ✅
- 规范：owl2-syntax §8 映射 RDF（`owl:Restriction`、`owl:intersectionOf`、`owl:unionOf`、`owl:complementOf`、`owl:oneOf`、`owl:onProperty`、`owl:someValuesFrom` 等）
- 现状：**这是最严重的一个缺口**。[RDFXMLParser.js](../src/io/RDFXMLParser.js) 只处理命名类 IRI 引用，嵌套 blank-node 类表达式全部丢失。
- 影响：从 Protégé 导出的典型 OWL 文件（如 Pizza）加载后只剩下裸类层级，所有约束消失。
- 改动：在 RDF/XML 解析器中实现递归 blank-node 解析，映射到 OWLClassExpression 树。

### H6. `owl:imports` 闭包加载 ✅
- 规范：owl2-syntax §3.4
- 现状：[OntologyLoader.js](../src/io/OntologyLoader.js) 单文档解析，不跟随 imports。
- 改动：增加 `loadWithImports(filePath, visited)`，配合 H1 解析出的 imports 列表递归加载，并处理循环依赖。

### H7. 序列化器（Writers）完全缺失 ✅
- 现状：只有 parser，没有 writer。`axiom.toString()` 是调试串，不是合法 Functional Syntax。
- 影响：无法 round-trip（加载→修改→保存）。
- 改动：新建
  - [src/io/FunctionalSyntaxWriter.js](../src/io/FunctionalSyntaxWriter.js)
  - [src/io/TurtleWriter.js](../src/io/TurtleWriter.js)
  - [src/io/RDFXMLWriter.js](../src/io/RDFXMLWriter.js)

### H8. OWL 2 QL / EL 推理 ✅
- 规范：owl2-profiles §4/§5
- 现状：只实现了 RL；QL（查询重写）与 EL（多项式时间分类）完全没有。
- 改动：
  - 新建 [src/inference/rules/owl2ql.js](../src/inference/rules/owl2ql.js)
  - 新建 [src/inference/rules/owl2el.js](../src/inference/rules/owl2el.js)
  - 在 [OWL2RLReasoner](../src/inference/OWL2RLReasoner.js) 增加 `getSubClasses / getInstances / isSubClassOf / isSatisfiable` 等查询接口。

### H9. 全局约束（Global Restrictions）验证 ✅
- 规范：owl2-syntax §11.2
- 现状：无任何验证；非正则的属性链（如 `R ∘ S ⊑ R` 但 R 又出现在 S 中）会被默默接受。
- 改动：新建 [src/validation/GlobalRestrictionsValidator.js](../src/validation/GlobalRestrictionsValidator.js)，检查正则性、simple-property 约束、特性公理只允许 simple 属性等。

---

## 二、MEDIUM（有用但可选）

### M1. Manchester Syntax 解析器 ✅
- 规范：owl2-manchester-syntax
- 现状：模型 `toString()` 是 Manchester 风格但不可逆。
- 改动：新建 [src/io/ManchesterSyntaxParser.js](../src/io/ManchesterSyntaxParser.js)，支持 `Class:` / `Individual:` / `ObjectProperty:` 帧语法。

### M2. OWL/XML 序列化（与 RDF/XML 不同）✅
- 规范：owl2-xml-serialization
- 现状：缺失。
- 改动：新建 [src/io/OWLXMLParser.js](../src/io/OWLXMLParser.js) + `OWLXMLWriter.js`。OWL/XML 与 Functional Syntax 一一对应，实现简单。

### M3. SWRL 文本语法解析 ✅
- 现状：只能程序化构造 SWRLRule。
- 改动：新建 [src/io/SWRLParser.js](../src/io/SWRLParser.js)，支持 Protégé 风格 `A(?x) ^ B(?x,?y) -> C(?x,?y)`。

### M4. RDF 数据类型映射覆盖不全 ✅
- 规范：owl2-syntax §4.1 强制 datatype map
- 现状：只支持 13 个常见类型；缺 `rdf:PlainLiteral`、`xsd:dateTimeStamp`、`owl:real`、`owl:rational`、`xsd:anyURI`、`xsd:hexBinary`、所有日期时间类型。
- 改动：扩充 [rdf.js](../src/inference/rdf.js) 常量与 [owl2rl.js](../src/inference/rules/owl2rl.js) `BUILTIN_DATATYPES`。

### M5. 数据类型 Facet 的 RDF 解析 ✅
- 现状：`owl:onDatatype` / `owl:withRestrictions` 不解析。
- 改动：[RDFXMLParser.js](../src/io/RDFXMLParser.js) 数据范围递归解析。

### M6. OWL 2 Profile 检查器（RL/QL/EL Validators）✅
- 现状：缺失。
- 改动：新建 [src/profiles/OWL2RLProfile.js](../src/profiles/OWL2RLProfile.js) 等三个，每个返回违规列表。

### M7. Punning / 元建模 ✅
- 规范：owl2-new-features §2.4
- 现状：模型层允许同一 IRI 同时是类和个体，但解析器取第一种类型后 break。
- 改动：解析器允许多重身份，OWLOntology 索引按上下文区分。

### M8. 推理查询 API / Inferred Hierarchy ✅
- 现状：[OWL2RLReasoner](../src/inference/OWL2RLReasoner.js) 只有 `entails(s,p,o)`。
- 改动：增加 `getSubClasses(ce)` / `getInstances(ce)` / `isSubClassOf(A,B)` / `isSatisfiable(ce)`；新建 `InferredClassHierarchyProvider`。

---

## 三、LOW / NICE-TO-HAVE

| # | 缺口 | 说明 |
|---|------|------|
| L1 | `owl:deprecated` / `owl:versionInfo` / `rdfs:seeAlso` 长尾注解 ✅ | BUILTIN_ANNOTATION_PROPERTIES 已覆盖 |
| L2 | 负属性断言的 RDF reification ✅ | RDFGraphToOntology 已处理 |
| L3 | `owl:AllDisjointClasses` / `AllDifferent` / `AllDisjointProperties` ✅ | RDFGraphToOntology 已处理 |
| L4 | Turtle → OWL 模型映射 ✅ | OntologyLoader + RDFGraphToOntology 桥接 |
| L5 | 前缀保真 ✅ | OWLOntology.addPrefix/getPrefixes + 三解析器记录 |
| L6 | `rdf:XMLLiteral` / `rdf:HTML` / 严格值空间校验 ✅ | M4 datatype map 已覆盖 |
| L7 | SWRL 长尾 builtin ✅ | SWRLBuiltins 补充 stringEqualIgnoreCase/translate/substring*/list ops/booleanNot |
| L8 | 注解属性 domain/range 类型对齐 ✅ | JSDoc 已对齐 |

---

## 实施建议（按工作量从小到大）

1. **H3 + H2 + H5**（解析器补全，最大收益）
2. **H1 + H6**（本体头 + imports）
3. **H7**（Writers，round-trip 测试基础）
4. **H4 + L4**（匿名个体 + Turtle→OWL 桥）
5. **H9 + M6**（验证层）
6. **M3 + M1 + M2**（额外语法）
7. **H8 + M8**（QL/EL 推理 + 查询 API，工作量最大）
8. **L1–L8**（长尾收尾）

每一步都配一组 node --test 用例（参考 test/owl2/ 现有 84 个的模式）。
