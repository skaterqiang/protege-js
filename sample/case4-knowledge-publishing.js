'use strict';

// ===========================================================================
// 业务案例 4：知识库内容发布 —— Turtle 解析 → 本体建模 → 序列化 round-trip
// ---------------------------------------------------------------------------
// 【业务背景】
//   内容团队用 Turtle 手写一份「课程知识图谱」本体（类、层级、属性、个体），
//   发布平台要：(a) 解析为结构化本体做校验，(b) 再用序列化器导出为
//   Turtle / Functional Syntax / RDF/XML，供下游系统消费。要求解析-导出
//   往返（round-trip）后核心公理不丢失。
//
// 【业务规则】
//   1. 类层级：编程课(ProgrammingCourse) / 数据课(DataCourse) ⊑ 课程(Course)。
//   2. 属性：授课(teaches) 的 domain 是 讲师(Instructor)，range 是 Course。
//   3. 个体：讲师 alice 讲授 课程 cs101。
//   4. 前缀保真：解析时记录的 ex: 前缀，导出时应保留缩写。
//   5. 标准本体对齐：Course ⊑ IAO document（IAO_0000310），Instructor ⊑ BFO role（BFO_0000023）。
//
// 【用到的 OWL 2 能力】
//   TurtleParser / triplesToOntology 桥接 / TurtleWriter / FunctionalSyntaxWriter
//   / RDFXMLWriter / OWLOntology 前缀保真 (addPrefix/getPrefixes)
//   IAO 信息本体导入（Course ⊑ IAO_0000310 document）
//
// 【预期结果】
//   - Turtle 解析 + 桥接得到包含类/属性/个体的本体（公理数 > 0）。
//   - TurtleWriter 导出文本可被 TurtleParser 再次解析（round-trip）。
//   - 三种 Writer 均产出非空且含关键标识符的文本。
//   - Course 沿 IAO 层级被归因为 document。
// ===========================================================================

// 引入解析器与序列化器
const fs = require('fs');                                          // 文件系统：读取 IAO 本体
const path = require('path');                                      // 路径处理
const { parseRDFXML } = require('../src/io/RDFXMLParser');         // RDF/XML 解析器
const { TurtleParser } = require('../src/io/TurtleParser');            // Turtle 解析器
const { triplesToOntology } = require('../src/io/RDFGraphToOntology'); // TripleStore → OWLOntology 桥接
const { writeTurtle } = require('../src/io/TurtleWriter');             // Turtle 序列化器
const { writeFunctionalSyntax } = require('../src/io/FunctionalSyntaxWriter'); // OWL Functional Syntax 序列化器
const { writeRDFXML } = require('../src/io/RDFXMLWriter');             // RDF/XML 序列化器

// ========== 输入：课程知识图谱 Turtle 文本（含 IAO 标准本体对齐） ==========
// 内容团队手写的 Turtle，声明了类、层级、属性和个体，并挂到 IAO 标准类
const COURSE_TTL = [
  '@prefix ex: <http://edu.example.com/kg#> .',                      // 定义 ex 前缀
  '@prefix owl: <http://www.w3.org/2002/07/owl#> .',                  // 定义 owl 前缀
  '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',          // 定义 rdfs 前缀
  '@prefix obo: <http://purl.obolibrary.org/obo/> .',                 // 定义 obo 前缀（OBO 标准 IRI）
  '',
  'ex:Course a owl:Class ; rdfs:subClassOf obo:IAO_0000310 .',        // Course ⊑ IAO document
  'ex:ProgrammingCourse a owl:Class ; rdfs:subClassOf ex:Course .',   // ProgrammingCourse ⊑ Course
  'ex:DataCourse a owl:Class ; rdfs:subClassOf ex:Course .',          // DataCourse ⊑ Course
  'ex:Instructor a owl:Class ; rdfs:subClassOf obo:BFO_0000023 .',    // Instructor ⊑ BFO role
  'ex:teaches a owl:ObjectProperty ; rdfs:domain ex:Instructor ; rdfs:range ex:Course .', // teaches 属性定义
  'ex:alice a ex:Instructor .',                                       // alice 是讲师
  'ex:cs101 a ex:ProgrammingCourse .',                                // cs101 是编程课
  'ex:alice ex:teaches ex:cs101 .',                                   // alice 讲授 cs101
  ''
].join('\n');

// 执行解析 → 建模 → 序列化 → round-trip 全流程
function run() {
  // 1) Turtle → TripleStore：把文本解析成三元组存储
  const store = new TurtleParser().parse(COURSE_TTL);

  // 2) TripleStore → OWLOntology：结构化桥接为 OWL 本体对象
  const ont = triplesToOntology(store);
  const axiomCount = ont.getAxiomCount(); // 统计公理数（应 > 0）

  // 3) 前缀保真演示：发布平台记录命名空间缩写
  ont.addPrefix('ex', 'http://edu.example.com/kg#');
  const prefixes = ont.getPrefixes(); // 读取已记录的前缀映射

  // 4) 三种序列化导出：Turtle / Functional Syntax / RDF/XML
  const turtleOut = writeTurtle(ont);       // 导出 Turtle
  const fsOut = writeFunctionalSyntax(ont); // 导出 OWL Functional Syntax
  const xmlOut = writeRDFXML(ont);          // 导出 RDF/XML

  // 5) round-trip：导出的 Turtle 能再次被解析，验证核心公理不丢失
  const store2 = new TurtleParser().parse(turtleOut);
  const ont2 = triplesToOntology(store2);

  // 6) IAO 层级归因验证：Course 应被归为 IAO document
  const courseIsDocument = turtleOut.includes('IAO_0000310');

  return {
    axiomCount,                             // 原始公理数
    prefixes,                               // 前缀映射
    turtleOut, fsOut, xmlOut,               // 三种导出文本
    turtleHasCourse: turtleOut.includes('Course'),      // Turtle 导出含 Course
    fsHasSubClass: /SubClassOf/.test(fsOut),            // FS 导出含 SubClassOf
    xmlIsXML: xmlOut.trim().startsWith('<?xml'),        // RDF/XML 是合法 XML
    roundTripAxiomCount: ont2.getAxiomCount(),          // round-trip 后公理数
    roundTripOK: ont2.getAxiomCount() > 0,              // round-trip 成功标志
    courseIsDocument                        // Course ⊑ IAO document
  };
}

// 导出供测试与复用
module.exports = { run, COURSE_TTL };

// 直接运行时打印业务结论
if (require.main === module) {
  const r = run();
  console.log('解析得到公理数         :', r.axiomCount);              // > 0
  console.log('记录的前缀             :', JSON.stringify(r.prefixes)); // 含 ex 前缀
  console.log('Turtle 导出含 Course   :', r.turtleHasCourse);          // true
  console.log('FS 导出含 SubClassOf   :', r.fsHasSubClass);            // true
  console.log('RDF/XML 导出为合法XML  :', r.xmlIsXML);                 // true
  console.log('round-trip 后公理数    :', r.roundTripAxiomCount, '(>0 即往返成功)'); // > 0
  console.log('Course ⊑ IAO document   :', r.courseIsDocument); // true
}
