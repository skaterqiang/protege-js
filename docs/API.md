# protege-js API 使用手册

完整的 OWL 2 / RDF / SWRL JavaScript 库，零依赖，可在 Node.js 和 Electron 中使用。

## 术语速览（先读这段）

为避免下文中缩写困扰，先集中解释常见缩写：

- **OWL** = **W**eb **O**ntology **L**anguage，万维网联盟（W3C, World Wide Web Consortium）制订的「本体」描述语言标准，用于形式化地定义「类」「属性」「个体」之间的关系。当前版本 OWL 2 发布于 2009/2012 年。
- **RDF** = **R**esource **D**escription **F**ramework，W3C 资源描述框架，把知识表达为「主语-谓语-宾语」三元组（Triple）。OWL 本体最终以 RDF 三元组存储。
- **RDFS** = **RDF S**chema，RDF 的最基础词汇扩展，提供 `rdfs:subClassOf`、`rdfs:label` 等。
- **IRI** = **I**nternationalized **R**esource **I**dentifier，国际化资源标识符，是 URI/URL 的国际化版本，允许中文字符。OWL 中一切资源（类、属性、个体、本体自身）都用 IRI 标识。
- **SWRL** = **S**emantic **W**eb **R**ule **L**anguage，语义网规则语言，可在 OWL 之上写「如果 ... 那么 ...」推导规则。
- **SPO** = **S**ubject / **P**redicate / **O**bject，三元组的三个槽位。
- **RL** = **R**ule **L**anguage，OWL 2 RL 是 OWL 2 的一个「基于规则的剖面（Profile）」，可以用一组 78 条规则做高效前向链推理。

## 目录

1. [核心模型](#1-核心模型)
2. [三元组存储 TripleStore](#2-triplestore)
3. [OWL 2 RL 推理](#3-owl-2-rl-推理)
4. [SWRL 规则推理](#4-swrl-规则推理)
5. [Turtle 解析器](#5-turtle-解析器)
6. [RDF/XML 解析器](#6-rdfxml-解析器)
7. [Functional-Style 解析器](#7-functional-style-解析器)
8. [完整示例](#8-完整示例)
9. [Manchester Syntax 解析器](#9-manchester-syntax-解析器)
10. [OWL/XML 解析器](#10-owlxml-解析器)
11. [Writers 序列化器](#11-writers-序列化器)
12. [QL / EL 推理机](#12-ql--el-推理机)
13. [Profile 检查与全局约束](#13-profile-检查与全局约束)
14. [推理查询 API](#14-推理查询-api)

---

## 1. 核心模型

「核心模型」对应 OWL 2 结构规范（Structural Specification）的抽象语法层，把所有概念（类、属性、个体、公理、类表达式）都建成对应的 JS 类。这一层只做内存表示，不做推理。

### 1.1 IRI

**IRI** = **I**nternationalized **R**esource **I**dentifier，国际化资源标识符。它是 URI 的超集，允许出现中文字符。OWL 中每个资源（类、属性、个体、本体）都有一个唯一的 IRI 作为「身份证」。本类是不可变值对象，`IRI.create(s)` 内部有缓存，同一字符串返回同一实例。

```js
const { IRI } = require('protege-js/src/model/IRI');

const iri = IRI.create('http://example.org/Person');
iri.toString();        // 'http://example.org/Person'
iri.getFragment();     // 'Person'
iri.getNamespace();    // 'http://example.org/'
```

### 1.2 实体（OWLEntity）

**OWLEntity** = **OWL Entity**，OWL 中的「具名实体」基类。OWL 把可命名的事物分为 6 种实体：

- **OWLClass**：类，比如 `Person`、`Student`，表示一组个体的集合。
- **OWLObjectProperty**：对象属性，连接两个个体，比如 `knows(alice, bob)`。
- **OWLDataProperty**：数据属性，连接个体和字面量，比如 `age(alice, "30")`。
- **OWLNamedIndividual**：具名个体，具体的「某个人」，比如 `alice`。
- **OWLDatatype**：数据类型，比如 XSD（XML Schema Definition）中的 `xsd:integer`、`xsd:string`。
- **OWLAnnotationProperty**：注解属性，用于给实体添加元数据（如 `rdfs:label`、`rdfs:comment`），不参与推理。

```js
const {
  OWLClass, OWLObjectProperty, OWLDataProperty,
  OWLNamedIndividual, OWLDatatype, OWLAnnotationProperty
} = require('protege-js/src/model/OWLEntity');

const Person = new OWLClass(IRI.create('http://example.org/Person'));
const knows = new OWLObjectProperty(IRI.create('http://example.org/knows'));
const age = new OWLDataProperty(IRI.create('http://example.org/age'));
const alice = new OWLNamedIndividual(IRI.create('http://example.org/alice'));
const xsdInt = new OWLDatatype(IRI.create('http://www.w3.org/2001/XMLSchema#integer'));
```

### 1.3 字面量（OWLLiteral）

**OWLLiteral** = **OWL Literal**，OWL 字面量。字面量是「具体的值」，对应编程中的字符串、数字、日期等。OWL 字面量有三种形态：

1. **纯字符串**：`"Alice"`，隐式类型是 `xsd:string`。
2. **带数据类型的字面量**：`"30"^^xsd:integer`，常见于属性值。
3. **带语言标签的字面量**：`"你好"@zh`，用于国际化文本。

XSD = **X**ML **S**chema **D**efinition，W3C 定义的标准数据类型集（integer、string、boolean、dateTime 等）。

```js
const { OWLLiteral } = require('protege-js/src/model/OWLLiteral');

const name = new OWLLiteral('Alice');                                          // 字符串
const age30 = new OWLLiteral('30', xsdInt);                                    // 带类型
const title = new OWLLiteral('你好', null, 'zh');                              // 带语言
```

### 1.4 公理（OWLAxiom）— 38 种

**OWLAxiom** = **OWL Axiom**，OWL 公理。公理是「陈述事实的一句话」，是 OWL 本体的最小可陈述单元。一个本体就是一组公理。OWL 2 规范共定义了 38 种公理，本库全部实现，按用途分为：

- **声明公理（Declaration）**：声明某个 IRI 是类/属性/个体，不带来推理效果。
- **类公理**：类之间的层级（SubClassOf）、等价（EquivalentClasses）、互斥（DisjointClasses）、不相交并集（DisjointUnion）。
- **对象属性公理**：属性的层级、等价、互斥、逆属性、定义域（Domain）、值域（Range）、属性链（PropertyChain）。
- **属性特性公理（7 种）**：函数性（Functional）、反函数性（InverseFunctional）、自反（Reflexive）、反自反（Irreflexive）、对称（Symmetric）、反对称（Asymmetric）、传递（Transitive）。
- **数据属性公理**：与对象属性对称的一组。
- **断言（Assertion）**：关于具体个体的事实，例如「alice 是 Person 的实例」「alice 认识 bob」。
- **键（HasKey）**：指定一组属性组合可以唯一标识一个类的实例。
- **注解公理**：对实体或公理本身附加说明文字，不参与逻辑推理。

```js
const AX = require('protege-js/src/model/OWLAxiom');

// 类公理
new AX.OWLDeclarationAxiom(Person);
new AX.OWLSubClassOfAxiom(Student, Person);
new AX.OWLEquivalentClassesAxiom([Person, Human]);
new AX.OWLDisjointClassesAxiom([Cat, Dog]);
new AX.OWLDisjointUnionAxiom(Color, [Red, Green, Blue]);

// 属性公理
new AX.OWLSubObjectPropertyOfAxiom(hasMother, hasParent);
new AX.OWLSubPropertyChainOfAxiom([hasParent, hasBrother], hasUncle);
new AX.OWLEquivalentObjectPropertiesAxiom([hasFather, hasDad]);
new AX.OWLInverseObjectPropertiesAxiom(hasParent, hasChild);
new AX.OWLObjectPropertyDomainAxiom(knows, Person);
new AX.OWLObjectPropertyRangeAxiom(knows, Person);

// 属性特性（7 种）
new AX.OWLFunctionalObjectPropertyAxiom(hasMother);
new AX.OWLInverseFunctionalObjectPropertyAxiom(isMotherOf);
new AX.OWLReflexiveObjectPropertyAxiom(knows);
new AX.OWLIrreflexiveObjectPropertyAxiom(isParentOf);
new AX.OWLSymmetricObjectPropertyAxiom(isSiblingOf);
new AX.OWLAsymmetricObjectPropertyAxiom(isParentOf);
new AX.OWLTransitiveObjectPropertyAxiom(hasAncestor);
new AX.OWLFunctionalDataPropertyAxiom(age);

// 数据属性
new AX.OWLSubDataPropertyOfAxiom(ageInYears, age);
new AX.OWLEquivalentDataPropertiesAxiom([age, years]);
new AX.OWLDisjointDataPropertiesAxiom([name, ssn]);
new AX.OWLDataPropertyDomainAxiom(age, Person);
new AX.OWLDataPropertyRangeAxiom(age, xsdInt);

// 个体断言
new AX.OWLClassAssertionAxiom(alice, Person);
new AX.OWLObjectPropertyAssertionAxiom(alice, knows, bob);
new AX.OWLDataPropertyAssertionAxiom(alice, age, age30);
new AX.OWLSameIndividualAxiom([alice, alicia]);
new AX.OWLDifferentIndividualsAxiom([alice, bob]);
new AX.OWLNegativeObjectPropertyAssertionAxiom(alice, knows, carol);
new AX.OWLNegativeDataPropertyAssertionAxiom(alice, age, age30);

// 其他
new AX.OWLDatatypeDefinitionAxiom(Age, xsdInt);
new AX.OWLHasKeyAxiom(Person, [ssn]);
new AX.OWLAnnotationAssertionAxiom(subjectIRI, labelProp, literal);
new AX.OWLSubAnnotationPropertyOfAxiom(subProp, superProp);
new AX.OWLAnnotationPropertyDomainAxiom(prop, iri);
new AX.OWLAnnotationPropertyRangeAxiom(prop, iri);
```

### 1.5 类表达式（OWLClassExpression）— 26 种

**OWLClassExpression** = **OWL Class Expression**，OWL 类表达式。OWL 除了能用 OWLClass 引用「具名类」之外，还能通过运算符构造「匿名类」。例如「认识 bob 的所有人」可写作 `ObjectSomeValuesFrom(knows, OneOf(bob))`。OWL 2 共定义 26 种类表达式构造器，本库全部实现：

- **命题布尔运算**：交集（IntersectionOf）、并集（UnionOf）、补集（ComplementOf）、枚举（OneOf）。
- **对象属性限制**：存在限制（SomeValuesFrom，「至少认识一个 Person」）、全称限制（AllValuesFrom）、值限制（HasValue）、自反限制（HasSelf）。
- **基数限制**：最小/最大/精确基数（Min/Max/ExactCardinality），如「最多 5 个邮箱」。
- **数据属性限制**：与对象限制对称的一组，但目标是数据范围。
- **数据范围（DataRange）**：数据类型的布尔组合、字面量枚举、限定面（FacetRestriction）——如「[0, 120] 之间的整数」。

**Facet**（限定面）是 XSD 定义的约束，如 `minInclusive` / `maxInclusive` / `length` / `pattern`。

```js
const CE = require('protege-js/src/model/OWLClassExpression');

// 布尔运算
new CE.OWLObjectIntersectionOf([A, B]);
new CE.OWLObjectUnionOf([A, B]);
new CE.OWLObjectComplementOf(A);
new CE.OWLObjectOneOf([alice, bob]);

// 对象限制
new CE.OWLObjectSomeValuesFrom(knows, Person);
new CE.OWLObjectAllValuesFrom(knows, Person);
new CE.OWLObjectHasValue(knows, bob);
new CE.OWLObjectHasSelf(likes);

// 基数限制
new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_MIN_CARDINALITY, 2, hasChild, Person);
new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_MAX_CARDINALITY, 5, hasEmail, null);
new CE.OWLObjectCardinalityRestriction(CE.ClassExpressionType.OBJECT_EXACT_CARDINALITY, 1, hasSSN, null);

// 数据限制
new CE.OWLDataSomeValuesFrom(age, xsdInt);
new CE.OWLDataAllValuesFrom(age, xsdInt);
new CE.OWLDataHasValue(age, age30);
new CE.OWLDataCardinalityRestriction(CE.ClassExpressionType.DATA_MIN_CARDINALITY, 1, age, null);

// 数据范围
new CE.OWLDataIntersectionOf([dt1, dt2]);
new CE.OWLDataUnionOf([dt1, dt2]);
new CE.OWLDataComplementOf(dt);
new CE.OWLDataOneOf([lit1, lit2]);
new CE.OWLDatatypeRestriction(xsdInt, [
  { facet: IRI.create('http://www.w3.org/2001/XMLSchema#minInclusive'), value: new OWLLiteral('0') },
  { facet: IRI.create('http://www.w3.org/2001/XMLSchema#maxInclusive'), value: new OWLLiteral('120') }
]);
```

---

## 2. TripleStore

**TripleStore** = 三元组存储，RDF 数据的内存容器。RDF = Resource Description Framework，把所有事实表达为「主语-谓语-宾语」三元组（SPO）。例如 `⟨alice, rdf:type, Person⟩` 表示「alice 是一个 Person」。本实现使用索引化哈希表，支持任意槽位的通配查询。

**NS** = **N**ame**s**pace，命名空间常量集合。RDF/RDFS/OWL/XSD 都预定义了一组词汇 IRI 前缀，此处集中导出避免硬编码。

```js
const { TripleStore } = require('protege-js/src/inference/TripleStore');
const { NS } = require('protege-js/src/inference/rdf');

const store = new TripleStore();

// 添加
store.add(subject, predicate, object);

// 查询（任一参数传 null 表示通配）
store.match(s, p, o);            // → [[s,p,o], ...]
store.match(null, NS.RDF + 'type', 'http://example.org/Person');   // 找所有 Person

// 单值查询
store.objects(s, p);             // → [o1, o2, ...]
store.subjects(p, o);            // → [s1, s2, ...]

// RDF List（用于 owl:unionOf / owl:intersectionOf 等）
store.listElements(listHead);    // → [item1, item2, ...]

// 命名空间常量
NS.RDF    // http://www.w3.org/1999/02/22-rdf-syntax-ns#
NS.RDFS   // http://www.w3.org/2000/01/rdf-schema#
NS.OWL    // http://www.w3.org/2002/07/owl#
NS.XSD    // http://www.w3.org/2001/XMLSchema#
```

---

## 3. OWL 2 RL 推理

**OWL 2 RL** = **OWL 2 R**ule **L**anguage，W3C 定义的 OWL 2 三个「剖面」之一，专为「可以用规则引擎高效实现」的子集。该剖面把 OWL 2 语义改写为 78 条 if-then 规则（pD* 语义），通过**前向链物化（Forward-Chaining Materialization）**反复触发规则直到不再有新事实（不动点，fixpoint），从而推出所有蕴含的三元组。

**物化（Materialization）**指把所有可推出的事实真正写入存储，之后查询 O(1)。这与「反向链/查询时推理」相对。

```js
const { OWL2RLReasoner } = require('protege-js/src/inference/OWL2RLReasoner');

const r = new OWL2RLReasoner();

// 直接往 store 加三元组
r.store.add('ex:A', NS.RDFS + 'subClassOf', 'ex:B');
r.store.add('ex:x', NS.RDF + 'type', 'ex:A');

// 运行推理（fixpoint，自动终止）
const { added, rounds } = r.materialize();

// 查询蕴含
r.entails('ex:x', NS.RDF + 'type', 'ex:B');   // true

// 一致性检查
r.isConsistent();                              // true / false
r.inconsistencies;                             // 不一致的三元组列表
```

支持规则类别：等值推理（eq）、属性推理（prp）、类表达式（cls）、类断言（cax）、数据类型（dt）、模式公理（scm）。

---

## 4. SWRL 规则推理

**SWRL** = **S**emantic **W**eb **R**ule **L**anguage，语义网规则语言。它在 OWL 之上扩展了一阶规则能力：可以写「如果 x 是 Person 且 x 的父亲有兄弟 y，则 y 是 x 的叔叔」这类 OWL 本身表达不了的规则。SWRL 与 OWL 2 RL 的区别是：RL 是「受限的、可完全物化」的规则集，SWRL 是「表达力更强但不可判定」的通用规则。

**Atom**（原子）是规则中的最小谓词，例如 `Person(?x)`、`hasParent(?x,?y)`。本库实现 7 种原子类型。

**Built-in**（内置函数）是 SWRL 预定义的比较/算术/字符串函数，命名空间 `http://www.w3.org/2003/11/swrlb#`。

```js
const {
  SWRLRule, SWRLClassAtom, SWRLObjectPropertyAtom,
  SWRLDataPropertyAtom, SWRLBuiltInAtom, SWRLVariable
} = require('protege-js/src/model/SWRL');
const { SWRLReasoner } = require('protege-js/src/inference/SWRLReasoner');

// 变量（URI 格式 urn:swrl:var:NAME）
const vx = new SWRLVariable(IRI.create('urn:swrl:var:x'));

// 构造规则： Person(?x) ∧ hasParent(?x,?y) ∧ hasBrother(?y,?z) → hasUncle(?x,?z)
const rule = new SWRLRule(
  [
    new SWRLClassAtom(Person, vx),
    new SWRLObjectPropertyAtom(hasParent, vx, vy),
    new SWRLObjectPropertyAtom(hasBrother, vy, vz)
  ],
  [new SWRLObjectPropertyAtom(hasUncle, vx, vz)]
);

// 推理
const store = new TripleStore();
store.add('ex:a', NS.RDF + 'type', 'ex:Person');
store.add('ex:a', 'ex:hasParent', 'ex:b');
store.add('ex:b', 'ex:hasBrother', 'ex:c');

const r = new SWRLReasoner(store);
const added = r.run([rule]);    // → 1 (新增 hasUncle 三元组)
```

### 内置函数（30+）

```js
const { SWRLBuiltins } = require('protege-js/src/inference/SWRLReasoner');

SWRLBuiltins.call('equal', [5, 5]);                    // true
SWRLBuiltins.call('lessThan', [3, 7]);                 // true
SWRLBuiltins.call('add', [2, 3]);                      // 5
SWRLBuiltins.call('multiply', [4, 5]);                 // 20
SWRLBuiltins.call('upperCase', ['abc']);               // 'ABC'
SWRLBuiltins.call('stringLength', ['hello']);          // 5
SWRLBuiltins.call('contains', ['hello world', 'world']); // true
```

支持：比较（equal/notEqual/lessThan/…）、算术（add/subtract/multiply/divide/mod/pow/abs/ceiling/floor/round/roundHalfToEven/sqrt/sin/cos/tan）、字符串（concat/substring/length/upperCase/lowerCase/contains/startsWith/endsWith/matches/replace）。

### SWRL 原子类型（7 种）

原子是 SWRL 规则的组成部分。每种原子对应 OWL 中一种可匹配的事实类型：

| 类型 | 构造器 | 说明 |
|------|--------|------|
| ClassAtom | `new SWRLClassAtom(classExpr, arg)` | 类成员 |
| ObjectPropertyAtom | `new SWRLObjectPropertyAtom(prop, s, o)` | 对象属性 |
| DataPropertyAtom | `new SWRLDataPropertyAtom(prop, s, v)` | 数据属性 |
| SameAsAtom | `new SWRLSameAsAtom(a, b)` | 同一性 |
| DifferentFromAtom | `new SWRLDifferentFromAtom(a, b)` | 不同性 |
| BuiltInAtom | `new SWRLBuiltInAtom(builtinIRI, args)` | 内置函数 |
| DataRangeAtom | `new SWRLDataRangeAtom(range, arg)` | 数据范围 |

---

## 5. Turtle 解析器

**Turtle** = **T**erse **R**DF **T**riple **L**anguage，W3C RDF 的一种紧凑文本语法，是当前最常用的 RDF 书写格式（比 RDF/XML 可读性高得多）。文件后缀通常为 `.ttl`。

```js
const { TurtleParser } = require('protege-js/src/io/TurtleParser');

const store = new TurtleParser().parse(`
  @prefix ex: <http://example.org/> .
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .

  ex:alice a foaf:Person ;
           foaf:name "Alice" ;
           foaf:age 30 ;
           foaf:knows ex:bob, ex:carol .

  ex:bob a foaf:Person ;
         foaf:interest [ a foaf:Document ; foaf:title "RDF Primer" ] .
`);

store.match(null, NS.RDF + 'type', null);   // 所有类型断言
```

支持语法：
- `@prefix` / `@base` / `PREFIX` / `BASE`
- `a` 缩写（rdf:type）
- `;` 同一主语多谓语、`,` 同一谓语多宾语
- 字符串 `"..."` / `'...'` / `"""..."""` / `'''...'''`
- 类型化字面量 `"30"^^xsd:integer`、语言标签 `"hello"@en`
- 数字自动类型化（`42` → integer、`3.14` → decimal、`1e3` → double）
- 布尔 `true` / `false`
- 空白节点 `[ ... ]`、集合 `( ... )`
- 注释 `# ...`

---

## 6. RDF/XML 解析器

**RDF/XML** 是 RDF 的原始 XML 序列化语法（W3C 1999/2004），是早期 OWL 工具（如 Protégé 4-）的默认保存格式。文件后缀通常为 `.owl` 或 `.rdf`。XML 冗余但工具链成熟。

**OWL 本体文档**常以 RDF/XML 形式分发，本解析器同时识别 `<owl:Class>` 元素式与 `<rdf:Description>` + `<rdf:type>` 描述式两种风格。

```js
const { parseRDFXML } = require('protege-js/src/io/RDFXMLParser');

const ont = parseRDFXML(`<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:ex="http://example.org/">

  <owl:Class rdf:about="http://example.org/Student">
    <rdfs:subClassOf rdf:resource="http://example.org/Person"/>
    <owl:disjointWith rdf:resource="http://example.org/Teacher"/>
  </owl:Class>

  <owl:ObjectProperty rdf:about="http://example.org/hasAncestor">
    <rdf:type rdf:resource="http://www.w3.org/2002/07/owl#TransitiveProperty"/>
  </owl:ObjectProperty>

  <owl:NamedIndividual rdf:about="http://example.org/alice">
    <rdf:type rdf:resource="http://example.org/Student"/>
    <owl:sameAs rdf:resource="http://example.org/alicia"/>
  </owl:NamedIndividual>
</rdf:RDF>`);

ont.getAxioms();    // → 所有解析出的公理
```

识别元素：
- `<owl:Class>` / `<owl:ObjectProperty>` / `<owl:DatatypeProperty>` / `<owl:NamedIndividual>` / `<rdf:Description>`
- 关系：`rdfs:subClassOf` / `owl:equivalentClass` / `owl:disjointWith` / `rdfs:subPropertyOf` / `owl:inverseOf` / `rdfs:domain` / `rdfs:range` / `rdf:type` / `owl:sameAs` / `owl:differentFrom`
- 特性：`owl:FunctionalProperty` / `InverseFunctionalProperty` / `TransitiveProperty` / `SymmetricProperty` / `AsymmetricProperty` / `ReflexiveProperty` / `IrreflexiveProperty`
- 注解：`rdfs:label` / `rdfs:comment`

---

## 7. Functional-Style 解析器

**Functional-Style Syntax**（函数式语法）是 OWL 2 规范文档本身使用的「权威语法」，用类似 Lisp 的 S 表达式书写公理，例如 `SubClassOf(Student Person)`。它的优势是结构严谨、与规范文法一一对应，常用于规范文档、测试套件、工具间交换。Manchester Syntax 是另一种以它为基准设计的「人类友好」语法。

```js
const { FunctionalSyntaxParser } = require('protege-js/src/io/FunctionalSyntaxParser');

const ont = new FunctionalSyntaxParser().parse(`
  Prefix(ex:=<http://example.org/>)
  Prefix(xsd:=<http://www.w3.org/2001/XMLSchema#>)

  Ontology(<http://example.org/ont>
    Declaration(Class(ex:Person))
    Declaration(ObjectProperty(ex:knows))
    Declaration(DataProperty(ex:age))

    SubClassOf(ex:Student ex:Person)
    DisjointUnion(ex:Color ex:Red ex:Green ex:Blue)

    TransitiveObjectProperty(ex:hasAncestor)
    SubObjectPropertyOf(ObjectPropertyChain(ex:hasParent ex:hasBrother) ex:hasUncle)

    ClassAssertion(ex:Person ex:alice)
    DataPropertyAssertion(ex:age ex:alice "30"^^xsd:integer)

    HasKey(ex:Person ex:ssn)
    SameIndividual(ex:alice ex:alicia)
  )
`);

ont.getAxiomCount();   // 12
```

支持所有 37 种公理形式、所有类表达式和数据范围。

---

## 8. 完整示例

### 8.1 从 Turtle 加载 + OWL 2 RL 推理

```js
const { TurtleParser } = require('protege-js/src/io/TurtleParser');
const { OWL2RLReasoner } = require('protege-js/src/inference/OWL2RLReasoner');
const { NS } = require('protege-js/src/inference/rdf');

const ttl = `
  @prefix ex: <http://example.org/> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

  ex:Student rdfs:subClassOf ex:Person .
  ex:alice a ex:Student .
`;

const r = new OWL2RLReasoner();
new TurtleParser().parse(ttl, r.store);   // 填充三元组
r.materialize();

r.entails('http://example.org/alice', NS.RDF + 'type', 'http://example.org/Person');  // true
```

### 8.2 SWRL 规则链

```js
const { SWRLRule, SWRLClassAtom, SWRLObjectPropertyAtom, SWRLDataPropertyAtom, SWRLBuiltInAtom, SWRLVariable } = require('protege-js/src/model/SWRL');
const { SWRLReasoner } = require('protege-js/src/inference/SWRLReasoner');

const v = (n) => new SWRLVariable(IRI.create('urn:swrl:var:' + n));

const rules = [
  // 叔叔规则
  new SWRLRule(
    [new SWRLObjectPropertyAtom(hasParent, v('x'), v('y')),
     new SWRLObjectPropertyAtom(hasBrother, v('y'), v('z'))],
    [new SWRLObjectPropertyAtom(hasUncle, v('x'), v('z'))]
  ),
  // 成年规则（≥18）
  new SWRLRule(
    [new SWRLDataPropertyAtom(age, v('p'), v('a')),
     new SWRLBuiltInAtom(IRI.create('http://www.w3.org/2003/11/swrlb#greaterThanOrEqual'),
       [v('a'), { lexicalValue: '18', datatype: { iri: IRI.create(NS.XSD + 'integer') } }])],
    [new SWRLClassAtom(Adult, v('p'))]
  )
];

const r = new SWRLReasoner(store);
r.run(rules);   // fixpoint，自动终止
```

### 8.3 Functional 语法 → 模型 → RL 推理

```js
const { FunctionalSyntaxParser } = require('protege-js/src/io/FunctionalSyntaxParser');
const { OWL2RLReasoner } = require('protege-js/src/inference/OWL2RLReasoner');

const ont = new FunctionalSyntaxParser().parse(`
  Ontology(
    SubClassOf(<http://x/Student> <http://x/Person>)
    ClassAssertion(<http://x/Student> <http://x/alice>)
  )
`);

// 公理 → 三元组 → RL 推理
const r = new OWL2RLReasoner();
for (const ax of ont.getAxioms()) {
  if (ax.getAxiomType() === 'SubClassOf') {
    r.store.add(ax.subClass.getIRI().toString(), NS.RDFS + 'subClassOf', ax.superClass.getIRI().toString());
  }
  if (ax.getAxiomType() === 'ClassAssertion') {
    r.store.add(ax.individual.getIRI().toString(), NS.RDF + 'type', ax.classExpression.getIRI().toString());
  }
}
r.materialize();
```

---

## 测试

```bash
npm test    # 256 个测试全部通过
```

覆盖：86 个 OWL 2 RL 规则测试 + 170 个全规范测试（axioms / classExpressions / turtle / functional / rdfxml / swrl / manchester / owlxml / writers / profiles / punning / longtail）。

---

## 9. Manchester Syntax 解析器

解析 Protégé 风格的 Manchester Syntax 帧语法。

```js
const { ManchesterSyntaxParser } = require('protege-js/src/io/ManchesterSyntaxParser');
const ont = new ManchesterSyntaxParser({ prefixes: { ex: 'http://ex.org/' } }).parse(`
Prefix: ex: <http://ex.org/>
Class: ex:Person
  SubClassOf: ex:Animal
  EquivalentTo: ex:hasParent some ex:Person
ObjectProperty: ex:hasParent
  Domain: ex:Person
  Range: ex:Person
  Characteristics: Transitive
Individual: ex:alice
  Types: ex:Person
`);
```

支持的帧关键字：`SubClassOf` / `EquivalentTo` / `DisjointWith` / `DisjointUnionOf` / `HasKey` / `Domain` / `Range` / `Characteristics` / `InverseOf` / `SubPropertyOf` / `SubPropertyChain` / `Types` / `SameAs` / `DifferentFrom` / `Facts`。

类表达式关键字：`some` / `only` / `value` / `Self` / `min` / `max` / `exactly` / `and` / `or` / `not` / `{a, b, c}`。

## 10. OWL/XML 解析器

解析 W3C OWL 2 XML Serialization（与 RDF/XML 不同的另一种 XML 语法）。

```js
const { OWLXMLParser } = require('protege-js/src/io/OWLXMLParser');
const ont = new OWLXMLParser().parse(`<Ontology xmlns="http://www.w3.org/2002/07/owl#" ontologyIRI="http://ex.org/ont">
  <Prefix name="ex" IRI="http://ex.org/"/>
  <Declaration><Class IRI="http://ex.org/Person"/></Declaration>
  <SubClassOf>
    <Class IRI="http://ex.org/Student"/>
    <Class IRI="http://ex.org/Person"/>
  </SubClassOf>
</Ontology>`);
```

覆盖约 30 种公理元素与全部类表达式（含带基数的 `ObjectMin/Max/ExactCardinality`）和数据范围（含 `DatatypeRestriction`）。

## 11. Writers 序列化器

把 OWLOntology 写回各种语法，支持 round-trip（加载 → 修改 → 保存）。

```js
const { FunctionalSyntaxWriter, writeFunctionalSyntax } = require('protege-js/src/io/FunctionalSyntaxWriter');
const { TurtleWriter, writeTurtle } = require('protege-js/src/io/TurtleWriter');
const { RDFXMLWriter, writeRDFXML } = require('protege-js/src/io/RDFXMLWriter');

const fsText  = writeFunctionalSyntax(ont);  // Functional-Style Syntax
const ttlText = writeTurtle(ont);            // Turtle（含 @prefix、blank node restriction）
const xmlText = writeRDFXML(ont);            // RDF/XML
```

前缀保真：若解析时通过 `Prefix:` / `Prefix(...)` 声明了前缀，三者都会用 `ont.getPrefixes()` 中的缩写输出。

## 12. QL / EL 推理机

OWL 2 三个 profile 中的 QL（查询重写优化）与 EL（多项式分类）的最小实现，基于 RL 规则子集。

```js
const { OWL2QLReasoner, OWL2ELReasoner } = require('protege-js/src/inference/OWL2ProfileReasoners');

const ql = new OWL2QLReasoner(store);   // 14 条 QL 规则（无 eq-*/prp-fp/ifp）
ql.materialize();
ql.entails('ex:x', NS.RDF + 'type', 'ex:B');

const el = new OWL2ELReasoner(store);   // 14 条 EL 规则（含 prp-trp 传递性）
```

## 13. Profile 检查与全局约束

```js
const { checkRL, checkQL, checkEL, Profiles } = require('protege-js/src/profiles/OWL2Profiles');
const violations = checkRL(ont);  // [{axiom, reason}, ...]

const { GlobalRestrictionsValidator } = require('protege-js/src/validation/GlobalRestrictionsValidator');
const errs = new GlobalRestrictionsValidator().validate(ont);  // 正则性 / simple property 检查
```

## 14. 推理查询 API

```js
const { ReasonerQueries } = require('protege-js/src/inference/ReasonerQueries');
const q = new ReasonerQueries(store);
q.getSubClasses('ex:Animal');
q.getInstances('ex:Person');
q.isSubClassOf('ex:Student', 'ex:Person');
q.isSatisfiable('ex:Nothing');
```

## 规范引用

- [OWL 2 Structural Specification](https://www.w3.org/TR/owl2-syntax/) — OWL 2 结构规范，定义所有公理与类表达式
- [OWL 2 Profiles](https://www.w3.org/TR/owl2-profiles/) — RL / QL / EL 三个剖面
- [OWL 2 Functional-Style Syntax](https://www.w3.org/TR/owl2-syntax/#Functional-Style_Syntax) — 函数式语法文法
- [OWL 2 Manchester Syntax](https://www.w3.org/TR/owl2-manchester-syntax/) — Manchester 语法（供参考）
- [SWRL Submission](https://www.w3.org/Submission/SWRL/) — SWRL 规则语言
- [Turtle 1.1](https://www.w3.org/TR/turtle/) — Turtle 语法
- [RDF/XML](https://www.w3.org/TR/rdf-syntax-grammar/) — RDF/XML 语法
- [RDF 1.1 Concepts](https://www.w3.org/TR/rdf11-concepts/) — RDF 核心概念
- [XML Schema Datatypes](https://www.w3.org/TR/xmlschema-2/) — XSD 数据类型
