---
title: 架构说明
description: 了解 pptx-viewer 的加载和保存流程、mixin 组合运行时、主题解析、几何引擎，以及各框架组件共用的渲染层。
---

# 架构说明 {#architecture}

`pptx-viewer` 采用分层设计。React、Vue 3、Angular、Svelte 和使用原生 DOM 的 JavaScript 组件负责 UI；共享渲染层提供不依赖框架的逻辑；核心引擎负责 PowerPoint 文件的解析、编辑和保存。每一层只依赖下层。

## 整体结构 {#overview}

```
+---------------------------------------------------------------+
|                      Framework bindings                       |
|   React    |   Vue 3   |  Angular  |  Svelte 5  |  Vanilla JS |
| pptx-react | pptx-vue  | pptx-ang. | pptx-svelte| pptx-vanilla|
+------------------------------+--------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|            Shared rendering layer (pptx-viewer-shared)        |
|     geometry, styles, gradients, charts, connectors, text     |
+------------------------------+--------------------------------+
                               |
                               v
+---------------------------------------------------------------+
|                Core engine (pptx-viewer-core)                 |
|  PptxHandler (public API)                                     |
|    -> Runtime (parsing, serialization, theme resolution)      |
|         -> Types, Geometry, Colour, Builders, Converter       |
+---------------------------------------------------------------+
```

## 框架组件 {#framework-bindings}

各框架组件是较薄的视图层，将 `pptx-viewer-shared` 预先计算的渲染数据转换为对应框架的模板或调用：JSX、Vue SFC、Angular 组件、Svelte 5 runes，以及 Vanilla 版本的原生 DOM 调用。幻灯片使用 HTML/SVG 和 CSS transform 缩放，提供清晰的文本、原生无障碍能力和完整的 DOM 交互。

每个组件均提供顶层的预览和编辑入口，通过框架惯用的方式协调状态、编辑、加载、导出和放映模式：React 使用 hooks，Vue 使用组合式函数，Angular 使用服务，Svelte 使用 runes，原生 JavaScript 则提供工厂函数和命令式实例 API。五个组件共用相同的共享层，因此渲染输出保持一致。

## 共享渲染层（`pptx-viewer-shared`） {#shared-rendering-layer-pptx-viewer-shared}

大部分预览逻辑不依赖框架，均位于 `packages/shared/src/`。仅 `render/` 目录就包含约 250 个职责明确的模块，例如：

- **连接线路由**：在障碍物图上运行 A* 路由算法（`connector-router-astar.ts`、`connector-router-graph.ts`），并负责路径构建和重新路由。
- **图表计算**：坐标轴范围、分类定位、笛卡尔坐标和极坐标绘图构建器、箱线图统计，以及组合图和股票图的组合逻辑（`chart-*` 系列模块）。
- **动画和平滑切换引擎**：构建和播放时间线（`animation-timeline-*.ts`），以及平滑切换中的匹配和几何插值（`morph-matching.ts`、`morph-geometry-interp.ts`、`morph-text.ts`）。
- **文本和样式解析**：项目符号编号、填充和渐变样式、图片效果滤镜，以及禁则换行样式。
- **数学公式**：OMML 到 MathML、LaTeX 到 OMML 的转换器（`omml-to-mathml.ts`、`latex-to-omml.ts`）。
- **编辑行为**：历史记录、剪贴板、对齐参考线、格式刷、查找替换、协作同步和在线状态。

同级目录还包括 `export/`、`i18n/`、`loader/`、`theme/`，以及可选的 `smartart-3d/` 渲染器。

::: info 内部包
`pptx-viewer-shared` 是私有包，不发布到 npm。构建时，它的源码会被打包进各个组件；Angular 采用复制源码后随组件构建的方式。这样可以让 React、Vue、Angular、Svelte 和原生 JavaScript 保持功能一致，同时避免重复实现逻辑，对外仍只需为每个框架安装一个包。
:::

## 核心引擎（`pptx-viewer-core`） {#core-engine-pptx-viewer-core}

核心包完全不依赖框架，可以在浏览器、Node.js、Web Worker 或 Serverless 函数等 JavaScript 环境中运行。公共入口是 `PptxHandler`。

### 外观接口与 mixin 组合运行时 {#the-facade-and-the-mixin-composed-runtime}

引擎通过以下三层组织对外接口和内部实现：

```
PptxHandler                    static factories (create / createBlank)
  └─ PptxHandlerCore           thin facade: load / save / export / encryption
       └─ IPptxHandlerRuntime  the actual engine, assembled from ~98 mixin modules
```

- **`PptxHandler`**（`packages/core/src/core/PptxHandler.ts`）添加静态的 `create()` 和 `createBlank()` 构建器入口。
- **`PptxHandlerCore`** 将解析、序列化和 XML 操作委托给注入的 `IPptxHandlerRuntime`。可以通过构造函数依赖 `runtime` 或 `runtimeFactory` 替换运行时，供测试和其他宿主环境切换实现。
- **`PptxHandlerRuntime`** 并非集中在一个文件中的单个类，而是由 `packages/core/src/core/core/runtime/` 下约 **98 个职责单一的模块**组合而成。每个模块以 `PptxHandlerRuntime<Concern>.ts` 命名，例如 `PptxHandlerRuntimeChartParsing.ts`、`PptxHandlerRuntimeThemeLoading.ts`、`PptxHandlerRuntimeSaveElementWriter.ts` 和 `PptxHandlerRuntimeSmartArtParsing.ts`。

每个模块声明一个类，继承前一个模块导出的类，形成逐层叠加能力的线性继承链：

```ts
// PptxHandlerRuntimeLoadPipeline.ts
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLoadSession';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	// adds the load-pipeline capability on top of everything below it
}
```

新能力（包括新元素类型）通过在这条链上增加模块实现，避免已有文件不断膨胀。兼容性警告、XML 工厂和内容类型构建器等跨模块协作者通过 `I*` 服务接口定义，并由依赖工厂注入，使每个 mixin 都能独立测试。

### 加载流程 {#the-load-pipeline}

`handler.load(arrayBuffer)` 按以下阶段执行：

```
ArrayBuffer
  │  container sniff: an OLE compound file is either a legacy binary
  │  .ppt (converted to an in-memory .pptx package) or an encrypted
  │  OOXML package (decrypted with the supplied password)
  │  ZIP signature check on whatever comes out
  ▼
JSZip.loadAsync                 in-memory archive
  │  zip-bomb guard: 500 MiB uncompressed budget (configurable),
  │  hard cap of 65,536 entries
  ▼
fast-xml-parser                 XML parts -> JS object trees
  │  Strict OOXML detection: strict namespace URIs are transparently
  │  normalized to Transitional for all subsequent parses
  ▼
Theme / master / layout resolution
  │  colour maps, font schemes, format schemes, placeholder styles
  ▼
Per-slide shape-tree (spTree) parsing
  │  each <p:sp>, <p:pic>, <p:graphicFrame>, ... becomes a typed PptxElement
  ▼
PptxLoadDataBuilder             assembles the final model
  ▼
PptxData
```

1. **先检查容器。** OLE 复合文件不一定表示输入错误，旧版二进制 `.ppt` 和加密 OOXML 都使用这种容器。通过 `PowerPoint Document` 流识别出的 PowerPoint 97-2003 演示文稿，会由 `core/ppt/` 转换为内存中的等价 `.pptx`，再交给后续流程，因此其余加载阶段无需区分原始格式。其他 OLE 容器按加密文件处理，未提供解密密码时抛出 `EncryptedFileError`；受密码保护的 `.ppt` 会抛出 `EncryptedPptError`，因为不支持旧版 RC4 解密。既不是 ZIP 也不是 OLE 复合文件的输入会被明确拒绝。过大的归档在解析前就会抛出 `ZipBombError`。
2. **XML 解析**使用 `fast-xml-parser`，每个部件都会变成普通对象树（`XmlObject` 类型），属性以 `@_` 为前缀。
3. **主题解析**加载各母版的主题、颜色映射（`p:clrMap`）、字体方案和格式方案，以便解析幻灯片时求出方案颜色和样式引用的实际值。
4. **元素解析**将各幻灯片的形状树转换为 [`PptxElement` 可辨识联合类型](/zh/guide/data-model#the-pptxelement-union)，将 EMU 坐标换算为像素，并为类型化模型尚未覆盖的结构保留原始 XML。
5. **`PptxLoadDataBuilder`** 汇总其余数据，包括节、自定义放映、嵌入字体、备注母版和讲义母版、标签、批注作者、文档属性、缩略图及兼容性警告。

### 保存流程 {#the-save-pipeline}

`handler.save(slides, options?)` 按相反方向执行（`PptxHandlerRuntimeSavePipeline.ts`）：

```
PptxSlide[]
  │  resolve conformance class ('preserve' | 'strict' | 'transitional')
  ▼
Reconcile presentation slide list      order, additions, deletions, rels
  ▼
Serialize each slide to OpenXML        elements -> <p:spTree>, embed new media
  ▼
Rebuild [Content_Types].xml            slide overrides + media defaults
  ▼
Comments, masters, layouts             typed mutations applied; untouched
  │                                    parts pass through verbatim
  ▼
Optional Strict conversion             remap namespaces if target is strict
  ▼
JSZip -> Uint8Array                    a valid .pptx / .ppsx / .pptm
```

以下两点与保存还原度密切相关：

- **默认透传未编辑内容。** 未编辑的母版、版式、备注、未知扩展和厂商标记，会从原归档逐字节保留，或从已保存的解析树重新输出。保存过程进行有针对性的重写，而非重新生成全部文件。
- **遵循原文件的一致性类别。** 默认输出与加载文件相同的 OOXML 一致性类别，也可以强制选择 Strict 或 Transitional。具体映射规则见 [OpenXML 支持情况](/zh/architecture/openxml-conformance)。

### 主题解析链 {#theme-resolution-chain}

引擎遵循 PowerPoint 的样式继承链：

```
Element  ->  Placeholder  ->  Layout  ->  Master  ->  Theme
```

- 元素显式设置的属性优先级最高。
- 标题、正文、页脚等占位符，会从**版式**中匹配的占位符继承文本和位置默认值；版式再从**母版**继承。标题、正文和其他文本的默认样式由 `p:txStyles` 提供。
- 样式引用（`a:fillRef`、`a:lnRef`、`a:effectRef`、`a:fontRef`）按索引查找**主题**的格式方案，再用引用中的颜色替换主题占位颜色。
- 方案颜色（`accent1`、`bg1`、`tx1` 等）通过母版的 `p:clrMap` 以及版式的 `p:clrMapOvr` 映射到主题颜色方案。

这条链由专门的运行时 mixin 实现：`PptxHandlerRuntimeThemeLoading`、`...ThemeProcessing`、`...ThemeFormatScheme`、`...ThemeRefResolution`、`...ThemeOverrides`，以及占位符相关的 `...PlaceholderLookup`、`...PlaceholderDefaults` 和 `...PlaceholderStyles`。同一演示文稿可以包含多个母版，每个母版拥有自己的颜色映射和格式方案。

### 几何引擎 {#geometry-engine}

`packages/core/src/core/geometry/` 中的 42 个模块将 DrawingML 几何转换为可渲染路径：

- **预设形状**：按类别组织 ECMA-376 预设形状，例如 `preset-shape-definitions-arrows.ts`、`-flowchart.ts`、`-action-buttons.ts` 和 `-callouts`，并使用规范中的辅助公式描述。
- **辅助公式计算**（`guide-formula-eval.ts` 等）：实现 ECMA-376 公式语言（`*/`、`+-`、`pin`、`at2`、`cos` 等），使形状几何能够正确响应调整值，也就是 PowerPoint 中可拖动的黄色菱形控点。
- **自定义几何**（`custom-geometry-parser.ts`、`freeform-builder.ts`）：解析 `a:custGeom` 路径命令，构建自由形状。
- **裁剪路径**（`preset-clip-paths-core.ts`、`-extended.ts`）：生成 CSS/SVG 裁剪路径，将图片、文本等 HTML 内容裁剪为任意预设形状。
- **连接线几何**（`connector-geometry.ts`）：处理折线、曲线连接线、箭头和翻转。绕开障碍物的实时**路由**则由共享层的 A* 路由器完成。

### 转换器 {#converter}

`packages/core/src/converter/` 通过注册表模式实现 PPTX 到 Markdown 的转换。每种元素类型的处理器（例如 `shape-element-processor`、`table-element-processor`、`ole-element-processor`）按 `type` 注册，再由 `PptxMarkdownConverter` 逐元素分派。同一目录还包含 SVG 导出器，以及公式使用的 OMML 到 LaTeX 转换器。

## 关键设计选择 {#key-design-decisions}

| 设计                           | 原因                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **基于 CSS 渲染，而非 Canvas** | 提供缩放后清晰的文本、原生无障碍能力、DOM 交互和标准 CSS 样式。                                                                    |
| **通过 mixin 组合引擎**        | 约 98 个职责单一的小模块将各项能力隔离，便于测试。新增能力和元素类型通过新 mixin 实现，避免文件持续增大。                          |
| **使用可辨识联合类型表示元素** | TypeScript 通过 `type` 字段缩小到正确的元素类型，无需类型断言即可保证类型安全。                                                    |
| **遵循主题解析链**             | 元素、占位符、版式、母版、主题的继承关系与 PowerPoint 一致。                                                                       |
| **内部使用 EMU 单位**          | 每英寸为 914,400 EMU；96 DPI 下每像素为 9,525 EMU。解析后的元素使用像素，便于布局计算；需要保证往返保存精度的地方保留精确 EMU 值。 |
| **透传式保存**                 | 只重写编辑过的部分，其余内容原样保留，因此未知标记和厂商扩展不会丢失。                                                             |
| **共享逻辑，保持组件层精简**   | 不依赖框架的预览逻辑只在 `pptx-viewer-shared` 中实现一次，各框架仅负责视图层，便于五个组件保持一致。                               |

## 相关阅读 {#related-reading}

- [PptxData 数据模型](/zh/guide/data-model)：解析后演示文稿的完整结构、元素类型和单位。
- [OpenXML 支持情况](/zh/architecture/openxml-conformance)：Strict 与 Transitional 的处理方式及一致性约定。
- [核心引擎概览](/zh/core/)：公共 API 参考。
