---
title: OpenXML 符合性
description: ECMA-376 / ISO/IEC 29500 符合性约定，Strict 和 Transitional 包的检测、规范化与往返处理，以及保存时重映射的命名空间族。
---

# Open XML 符合性约定 {#open-xml-conformance-contract}

本项目面向 PresentationML 包所需的 ECMA-376 / ISO/IEC 29500 部分，不宣称支持独立的 WordprocessingML 或 SpreadsheetML 文档。

## 完全支持的含义 {#meaning-of-parity}

只有验证了以下所有适用能力，才能认为某项功能得到完整支持。保留未知 XML 很有价值，但不等于理解或编辑该 XML。

覆盖清单 `OPENXML_COVERAGE` 位于 `packages/core/src/core/openxml/`，按**四个**维度评估每个结构，类型为 `OpenXmlCoverageFacet`：

| 维度        | 要求                                                             |
| ----------- | ---------------------------------------------------------------- |
| `parse`     | 解析每种符合规范的表示形式，不丢失数据，也不发生未报告的回退。   |
| `preserve`  | 在修改后的保存中保留不支持的标记、关系、内容类型、顺序和包部件。 |
| `edit`      | 在带类型的模型中暴露该功能，执行支持的修改时不破坏无关标记。     |
| `serialize` | 输出能通过所选符合性类别验证的 Strict 或 Transitional 标记。     |

每个维度使用 `OpenXmlCoverageLevel` 评级：`native`、`partial`、`passthrough`、`unsupported` 或 `unassessed`。

::: warning 清单不评价渲染
这里有意**不设置 `render` 维度**。清单描述的是包级往返能力，而非像素效果：某个结构的四个维度都可能是 `native`，屏幕显示却仍采用近似实现。视觉保真度单独记录在[已知限制](/zh/guide/limitations)中，了解幻灯片实际显示效果时应阅读该页。
:::

## Strict 与 Transitional {#strict-vs-transitional}

ISO/IEC 29500 为包内标记定义了两种符合性类别：

- **Transitional**（ECMA-376）：几乎所有 PowerPoint 文件使用的形式，标记命名空间位于 `http://schemas.openxmlformats.org/...`。
- **Strict**（ISO/IEC 29500 Strict）：ISO 推荐的子集，Office 2013 及以上版本可通过“Strict Open XML Presentation”生成。标记命名空间位于 `http://purl.oclc.org/ooxml/...`，根 `p:presentation` 元素带有 `conformance="strict"`。

两种类别对*相同元素使用不同的命名空间 URI*。硬编码 Transitional URI 的解析器会把 Strict 文件看作无法识别的标记，因此许多库完全无法处理 Strict 文件。`pptx-viewer` 双向支持这两种类别。

### 加载时的处理 {#what-happens-on-load}

Strict 处理实现在 `packages/core/src/core/utils/strict-namespace-map.ts`，并接入运行时状态模块：

1. `detectStrictConformance()` 检查解析后的演示文稿根元素上的命名空间声明（`xmlns` / `xmlns:*`）。存在任意 `http://purl.oclc.org/ooxml/...` URI，就将文件标记为 Strict。
2. `normalizeStrictXml()` **原地**重写已解析的树，将命名空间声明、关系 `Type` 属性和扩展 `uri` 属性转换为对应的 Transitional 形式。
3. XML 解析器包在 Proxy 中，因此整个加载流程后续的每次 `parse()` 调用都会透明地规范化结果。其他代码，包括所有元素解析器、主题解析、图表解析等，始终只看到 Transitional URI，无需感知 Strict。
4. 检测出的类别记录在模型的 `data.conformance: 'strict' | 'transitional'` 中。

### 保存时的处理 {#what-happens-on-save}

`save()` 接受符合性选项：

```ts
const bytes = await handler.save(data.slides, {
	conformance: 'preserve', // default: match the loaded file
	// conformance: 'strict',       // force Strict output
	// conformance: 'transitional', // force Transitional output
});
```

- `'preserve'` 是默认值，使用加载时检测到的类别。因此 Strict 文件经过加载、编辑和保存后，仍然输出 Strict，无需额外设置。
- 实际类别为 `'strict'` 时，保存流程最后一步 `convertZipToStrictConformance()` 重新解析归档中每个 `.xml` 和 `.rels` 部件，原地应用 `convertXmlToStrict()`，转换命名空间声明、关系类型和扩展 URI，并按 Strict 模式要求，在 `p:presentation` 根元素上设置 `conformance="strict"`。无法解析的部件，例如扩展名为 `.xml` 的二进制内容，保持不变；转换会逐部件尽力完成。
- 与符合性类别相关的保存常量，包括关系类型和写入器使用的命名空间，会提前根据实际类别选定，因此新创建部件从一开始就是正确形式，无需事后翻译。

## 重映射范围与保持规范形式的内容 {#what-gets-remapped-and-what-stays-canonical}

只有 ISO/IEC 29500-1 定义的**标记语言族**会在两种符合性类别之间重映射。这与 Open XML SDK 打开 Strict 包时使用的权威转换表一致。

| 命名空间族                                                      | 是否重映射       | Strict URI 示例                                                 | Transitional URI 示例                                                       |
| --------------------------------------------------------------- | ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `presentationml`                                                | 是               | `http://purl.oclc.org/ooxml/presentationml/main`                | `http://schemas.openxmlformats.org/presentationml/2006/main`                |
| `drawingml` （主命名空间、图表、图形、图片等）                  | 是               | `http://purl.oclc.org/ooxml/drawingml/chart`                    | `http://schemas.openxmlformats.org/drawingml/2006/chart`                    |
| `officeDocument` （包括关系类型 URI、数学、参考文献和文档属性） | 是               | `http://purl.oclc.org/ooxml/officeDocument/relationships/image` | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/image` |
| `spreadsheetml` （嵌入图表工作簿）                              | 是               | `http://purl.oclc.org/ooxml/spreadsheetml/main`                 | `http://schemas.openxmlformats.org/spreadsheetml/2006/main`                 |
| `wordprocessingml` （嵌入文档）                                 | 是               | `http://purl.oclc.org/ooxml/wordprocessingml/main`              | `http://schemas.openxmlformats.org/wordprocessingml/2006/main`              |
| `schemaLibrary`                                                 | 是               | `http://purl.oclc.org/ooxml/schemaLibrary/main`                 | `http://schemas.openxmlformats.org/schemaLibrary/2006/main`                 |
| `descriptions`                                                  | 是（不同主机名） | `http://purl.oclc.org/ooxml/descriptions/base`                  | `http://descriptions.openxmlformats.org/description/base`                   |
| 开放打包约定（`package/*` 内容类型、关系、核心属性、数字签名）  | **否**           | 两种类别中均保持规范形式                                        | 两种类别中均保持规范形式                                                    |
| 标记兼容性（`markup-compatibility/2006`）                       | **否**           | 两种类别中均保持规范形式                                        | 两种类别中均保持规范形式                                                    |

::: warning OPC 和 MCE 独立于符合性类别
Open Packaging Conventions（ISO/IEC 29500-2）以及 Markup Compatibility and Extensibility（ISO/IEC 29500-3）是共享规范，不依赖符合性类别。真实 Office“Strict Open XML”文件即使在部件内部使用 Strict 的 `purl.oclc.org` 命名空间，仍会让 OPC 关系类型和 `mc:` 命名空间保持规范的 `schemas.openxmlformats.org` 形式。重映射它们会产生 Office 和规范都不接受的文件，因此 `pptx-viewer` 在双向转换中都明确保持它们不变。
:::

### 结构推导规则 {#the-structural-derivation-rule}

除了明确列出的已知对应关系表之外，映射还利用了一项规律：需要重映射的族中，Strict 与 Transitional URI 通过确定性规则关联，并非任意查表：

```
Strict:        http://purl.oclc.org/ooxml/<family>/<tail...>
Transitional:  http://schemas.openxmlformats.org/<family>/2006/<tail...>
```

主机名发生替换，并在族路径段后插入 `2006` 版本段。`pptx-viewer` 通过算法推导这些族中任意 URI 的对应关系，因此即使某个仅 Strict 使用的关系类型或 DrawingML 子命名空间未明确列出，也仍会在加载时规范化、保存时转换回去。`descriptions` 是唯一不遵循此规则的重映射族，它有自己的 Transitional 主机名，因此只放在显式映射表中。

## 往返保证 {#round-trip-guarantees}

- **Strict 输入，Strict 输出。** 加载 Strict 文件时记录 `data.conformance === 'strict'`，使用默认 `'preserve'` 保存时，再次输出 Strict 命名空间和 `conformance="strict"`。
- **无损内部规范化。** 规范化只针对命名空间 URI，不改变元素结构、顺序、属性和未知标记，因此 Strict 处理可以与透传保存行为配合。
- **双向显式转换。** `conformance: 'strict'` 和 `conformance: 'transitional'` 可将包转换为另一类别，不改写与类别无关的 OPC 和 MCE 命名空间。
- **依据真实包结构验证。** 映射本身由 `strict-namespace-map.test.ts` 单元测试覆盖，集成往返测试位于 `packages/core/src/__tests__/integration/strict-conformance-roundtrip.test.ts`。其中的包模拟真实 Office 创建的 Strict 文件结构，包括这些文件保留的规范 OPC 命名空间。

## 符合性检查门槛 {#conformance-gates}

宣称完整支持 PresentationML，需要通过全部以下门槛：

1. 官方 ECMA-376 Strict 和 Transitional 模式验证每个生成包，以及语料库中每个修改后保存的结果。
2. Open Packaging Conventions 检查覆盖部件名称、内容类型、关系、外部目标、压缩和标记兼容性。
3. 兼容性 API 以稳定代码和 XML 位置报告每个仅保留、回退、有损或不支持的结构。
4. `mc:Choice` 根据已验证的功能能力选择，不能仅因识别了命名空间前缀就选中。
5. 真实 PowerPoint 创建的语料测试强制执行修改后序列化，并比较包结构、类型化语义和参考渲染。
6. Strict 到 Transitional，以及 Transitional 到 Strict 的转换，在不改写无关命名空间的前提下都能通过验证。
7. 发布完全支持的声明前，覆盖清单中不能有任何维度仍为 `partial`、`passthrough`、`unsupported` 或 `unassessed`。

## 覆盖族范围 {#scope-families}

覆盖清单必须包含：

- Open Packaging Conventions 和文档属性。
- 演示文稿结构、幻灯片、母版、布局、备注、讲义、批注、标签、节、自定义放映、视图和演示文稿属性。
- DrawingML 的几何、文本、颜色、填充、线条、效果、变换、锁定、媒体、主题和表格词汇。
- 经典图表、扩展图表、图表绘图和嵌入工作簿。
- DiagramML / SmartArt 的数据、布局、颜色、样式和缓存绘图。
- 时间树、构建列表、切换、触发器、声音和媒体计时。
- 图片、SVG、墨迹、内容部件、OLE、ActiveX、VML、三维模型和扩展。
- 标记兼容性和 Microsoft PresentationML 扩展命名空间。
- Strict 和 Transitional 符合性类别。

## 证据要求 {#evidence-policy}

单元测试证明单个映射，合成包测试证明写入器组合，真实文件修改后保存测试证明互操作性，模式验证证明结构符合性。任何一种证据都不能单独作为完全支持的证明。

## 扩展命名空间与模式边界属性 {#extension-namespace-and-schema-edge-attributes}

有些结构看起来像缺口，检查基础模式的实际声明后才能理解：

**切换时长使用扩展命名空间是合法行为，并非遗漏。** `CT_SlideTransition`（S19.3.1.50，Transitional 模式）只声明 `spd`、`advClick` 和 `advTm` 属性；基础 PresentationML 模式中，没有任何以毫秒表示幻灯片切换时长的 `dur` 属性。PowerPoint 自身需要这个值，因此将其写入 Office 2010 扩展命名空间，作为 `p14:dur`。COM 已验证：在 PowerPoint 2016 中，通过 `Presentations.Add`、`Slide.SlideShowTransition.Duration = 2.5` 和 `SaveAs(ppSaveAsOpenXMLPresentation)`，PowerPoint 会将整个 `p:transition` 包在 `mc:AlternateContent` 中，写出 `<mc:Choice Requires="p14"><p:transition spd="slow" p14:dur="2500" .../></mc:Choice><mc:Fallback><p:transition spd="slow" .../></mc:Fallback>`。对于不带前缀的 `dur`，PowerPoint 不只是容忍，而是静默忽略：只含 `dur="2000"` 的包重新打开后使用 PowerPoint 默认的 0.5 秒，已通过 COM 验证。`pptx-viewer` 也写入 `p14:dur`（`packages/core/src/core/core/runtime/slide-transition-duration-ns.ts`），但使用更简单的幻灯片根元素 `mc:Ignorable="p14"` 声明，而不是把每个切换包进 `mc:AlternateContent`。PowerPoint 接受两种形式，并都遵循时长，已通过 COM 验证。两种形式都不理解的读取器会回退到 `spd` 速度关键字，因此 PowerPoint 和 `pptx-viewer` 都会在输出 `p14:dur` 的同时保留 `spd`。

**`p:animEffect/@filter="image"` 指定了没有实际载荷的滤镜。** `ST_TLAnimateEffectFilter`（19.5.5）枚举 `p:animEffect` 的 `@filter` 可指定的 SMIL 风格滤镜族，其中包括 `image`。但 `CT_TLAnimateEffectBehavior`（19.5.3）没有为该元素提供任何可承载第二个、独立指定图片引用的子元素或属性。`image` 表示基于图片的擦除或遮罩切换，但时间树和关系中没有任何模式位置可指定使用哪张图片，因此包括 PowerPoint 在内，任何符合规范的读取器都无法恢复预期滤镜。`pptx-viewer` 将它与其他没有专门渲染实现的滤镜族一样处理，回退为中性的淡入淡出。

**`p:bldP/p:tmplLst` 是创作时模板，不是播放输入。** `CT_TLTemplateList`（19.5.84）及其 `p:tmpl` 条目（`CT_TLTemplate`，19.5.85），让文本构建为各大纲级别声明默认计时。`packages/core/src/core/services/animation-timing-templates.ts` 会以类型化形式解析并往返保留它们，但有意不将其用于播放。其语义是：只有某个大纲级别尚无实例化节点时，PowerPoint 才复制模板的 `p:tnLst` 为它初始化计时，也就是用户正在动画窗格中添加新项目符号时。保存文件中实际存在且可见的段落，在其所属级别下，都已在 `p:timing/p:tnLst` 中有明确节点；PowerPoint 保存前会为每个当前使用的级别实例化节点，因此合法保存的文稿中不存在只有模板覆盖的级别。真实 PowerPoint 创建的语料 `anatidae-animation.pptx`（由 `animation-build-templates-surgical-roundtrip.test.ts` 使用）和完整重建往返测试支持这一结论，但没有通过新的 COM `CreateVideo` 捕获重新验证。要构造当前使用级别缺少自身节点的文件，必须手工编辑时间树，而已知 PowerPoint 在关闭 `DisplayAlerts` 时会静默修复格式不正确的包（参见 `scripts/pptx-com-open.ps1`），这样无论观察到怎样的“模板被忽略”结果，都无法作为可靠证据。

## 组合边界重包围与编辑顺序 {#group-re-wrap-and-edit-order}

位置和尺寸以整数像素暴露，每像素对应 9,525 EMU，同时保留精确源 EMU（`xEmu` / `yEmu` / `widthEmu` / `heightEmu`）。未移动的元素，以及任意嵌套深度中未修改的组合，包括其自身位置、`a:chOff` / `a:chExt` 和每个子元素，在保存时都会逐字节输出原始 `a:off` / `a:ext` / `a:chOff` / `a:chExt`，无论文件使用哪种子坐标空间约定。直接调整组合尺寸时，子坐标空间和每个子元素保持逐字节相同，与 PowerPoint 一致，已通过 COM 验证。

移动或调整子元素尺寸时，会保持组合原有子坐标空间，未触碰的同级元素逐字节不变；同时像 PowerPoint 的边界框自动适应一样，让组合自身的 `a:chOff` / `a:chExt` 和 `a:off` / `a:ext` 紧密重新包围新的子元素集合，并向上传播到每个因此发生边界变化的祖先组合。以下情况已通过 COM 验证为逐字节一致：普通移动；旋转子元素（单独旋转不产生影响，与 PowerPoint 一致）；旋转组合（重现固定旋转中心）；嵌套组合传播；未旋转组合在同一次保存中既直接调整自身尺寸，又编辑子元素；旋转组合在同一次保存中既直接调整自身尺寸，又移动和缩放子元素；以及作为组合直接子元素的旋转形状只调整尺寸而不移动，包括一次编辑中同时调整宽高。最后一种情况在 25 / 37 / -40 / 61 / 113 / 155 / 200 / 290 度均经 COM 验证为逐字节一致。要匹配 PowerPoint，必须将考虑旋转的尺寸调整组合为按轴顺序执行的两次修正，先宽后高，每一步都以上一步结果重新锚定，而非一次性旋转。

直接调整旋转组合尺寸且不修改子元素，也达到逐字节一致。COM 真值覆盖 25 / 90 / 180 / -40 度、同时或分别设置 `Shape.Width` / `Height`，以及从左上角或中心执行 `ScaleWidth`，都符合一条规则：尺寸变化后，单个锚点经旋转在屏幕上保持固定；锚点是未移动的边，或中心锚定缩放时的精确中心。保存流程通过相应移动 `a:off` 重现该规则。同一修复和 COM 验证也覆盖直接调整普通非组合旋转形状的尺寸，包括一次编辑同时调整两轴，使用相同顺序修正和相同 8 个角度扫描。

剩下的一处非直角差距是：旋转组合在**同一次保存**中既直接调整自身尺寸，又移动或调整子元素尺寸。COM 扫描确认了两点。首先，先提交组合自身尺寸调整，再执行子元素编辑和紧密重包围，是此 SDK 单一最终状态保存流程唯一能够实现的顺序。反向顺序最多相差 71,000 EMU，约 0.08 英寸，视觉上可见，不是舍入差异，因为 PowerPoint 在子元素变化时立即重新适应组合边界，后执行的编辑总是基于已经重新适应的中间边界组合计算。从一个最终元素树保存，无法恢复用户两次独立操作谁先谁后，因此反向顺序不属于该修复的目标。在可实现的顺序内，8 个角度乘以 3 种编辑组合（子元素移动、缩放、移动加缩放），共 24 种情况中 9 种逐字节一致；其余在 `a:off` 的 x/y 或 `a:ext` 的宽高上，与 COM 真值最多差 2 EMU，即 2/914400 英寸，没有一致的符号或轴方向。这与上面的顺序修正问题不同：将该修复应用到此情况的自身缩放步骤，24 个结果都没有变化，已验证；以相同方式进一步拆分紧密重包围步骤会变差，只剩 6/24 一致；让中间中心在整条链中保持未舍入浮点数则为 5/24，还破坏了一个原本精确的未旋转情况；全程使用单精度三角函数也没有任何变化。多个情况中 `a:ext` 高度发生漂移，而该公式里的高度根本没有旋转项，这表明 PowerPoint 对这一特定组合使用不同内部流程，而不是可以从黑盒输出推导出来的舍入顺序修正。

后续 COM 实验（提交 `dc6692eba`）证明了这一点：固定子元素**最终**位置和尺寸，只改变 `GroupItems(1).Left` / `Top` / `Width` / `Height` 的赋值**顺序**，四个目标值相同、同一 COM 会话、只保存一次，组合自身保存的 `a:ext` 在 200 度时最多变化 589,402 EMU，即 0.64 英寸；25 度时，仅 `cy` 就相差 115,531 EMU（`1029931` 对比 `914400`）。两种顺序各自都可以逐字节复现，并不存在其中一种“更正确”。PowerPoint 在**每次属性赋值后**都会重新适应组合边界，而不是每个逻辑编辑后只做一次。因此这一组合情况没有唯一正确答案：用户输入四个数值的顺序有多少种，就可能有多少个逐字节正确的答案，而最终元素树并没有可供重放的顺序。上面固定某一种顺序真值后，9/24 精确、偏差不超过 2 EMU 的结果，已经接近单一最终状态保存架构所能达到的极限；即使对这一种顺序消除到零，也无法推广到其他同样合法的顺序。完整调查和证明见 `group-tight-rewrap-own-box.ts`，COM 固定数值见 `group-tight-rewrap.test.ts` 的 `grp1st` 扫描和顺序敏感性样例。

## `.ppt` 导出的能力上限 {#ppt-export-ceiling}

`save(slides, { outputFormat: 'ppt' })` 在 OLE2（CFB）容器中写入真实的 MS-PPT/OfficeArt 记录流（`packages/core/src/core/ppt/writer/`），不是占位实现。它可无损往返保留幻灯片数量、形状几何、文本和文本片段格式、图片、组合、表格（使用 PowerPoint 2003 自身的组合矩形模型）和背景，支持明文及 RC4 CryptoAPI 密码保护（`pptPassword`）。完全通过 SDK 从零创建的文稿，可经 COM 在真实 PowerPoint 16.0 中打开，幻灯片和形状数量及文本一致，已由 `scripts/com-acceptance-ppt.mjs` 验证。

**已完成并通过 COM 验证：**

- 形状级和文本片段级超链接或点击操作，包括 URL、跳转到指定幻灯片、所有相对跳转（下一张、上一张、第一张、最后一张、结束放映、上次查看的幻灯片）、具名自定义放映、`mailto:`，以及打开文件或演示文稿，均对照 `ActionSettings(ppMouseClick)` 验证。
- 存在 PNG/JPEG 预览时，嵌入 OLE 对象（`oleEmbeddedData`）会写为真实 Windows“OLE Package”对象，在嵌套 OLE2 存储中包含 `CompObj` / `Ole10Native`，验证结果为 `OLEFormat.ProgID === "Package"` / `msoEmbeddedOLEObject`。导入器也能读回：`ExOleEmbedContainer` / `ExOleObjStg`（`packages/core/src/core/ppt/ole-embed-parser.ts`）解析为可编辑的 `ole` 元素。已使用真实 PowerPoint 创建的、带原生 `Excel.Sheet.8` 嵌入对象的 `.ppt` 验证，样例为 `e2e/fixtures/ole-embed-excel.ppt`，由 `scripts/make-ole-embed-excel-fixture.ps1` 的 `Shapes.AddOLEObject` 创建，实测 `OLEFormat.ProgID` 为 `"Excel.Sheet.8"`。恢复字节经项目自身 BIFF8 读取器解码，得到与 PowerPoint 写入完全相同的单元格值。
- 嵌入音频（WAV）写为真实、可播放的 `SoundCollectionContainer` / `SoundDataBlob`（`media-writer.ts`），甚至超过 PowerPoint 16.0 自身的行为：PowerPoint“另存为 PowerPoint 97-2003”只保留 `SoundContainer` 外壳，`Shape.MediaFormat.Length` 为 0，任何位置都没有 `RIFF` 字节；此写入器的音频经 PowerPoint 重新保存为 `.pptx` 后，重新导出的 WAV 与源文件逐字节一致。
- 视频不会嵌入，但 PowerPoint 16.0 也无法将视频嵌入 97-2003：尝试嵌入后保存会退化为静态图片，`Shape.Type` 为 `msoPicture`。因此写入器现有的图片或占位符降级已达到 PowerPoint 自身上限。真正链接外部文件路径的视频是另一项尚未实现的能力，而字节输入、字节输出的 `save()` API 没有可供建立链接的目标目录。
- 三维模型栅格化为普通图片（`Shape.Type` 为 13 / `msoPicture`，没有 `OLEFormat`），与 PowerPoint 16.0 另存为 97-2003 的行为完全一致。测量脚本为 `scripts/measure-model3d-ole-97.ps1`，它在脚本内构造最小的符合规范的二进制 glTF，再通过 `Shapes.Add3DModel` 插入。
- 图表也会栅格化为图片。PowerPoint 16.0 另存为 97-2003 时，则会将现代图表保留为嵌入的 `Excel.Chart.8` OLE 对象，即旧式 MS Graph。`scripts/measure-chart-ole-97.ps1` 测得 `Shape.Type` 为 7 / `msoEmbeddedOLEObject`，`OLEFormat.ProgID` 为 `"Excel.Chart.8"`，`Shape.HasChart` 为 `False`。目前不计划写入真正的 `Excel.Chart.8` 对象：上面已实现的 `ExOleObjStg` 有 [MS-PPT]/[MS-ODRAW] 文档，而旧式 MS Graph 图表内部二进制布局没有公开 Microsoft 规范可供验证。
- 导入不支持 CryptoAPI 之前的 Office 95 RC4/XOR 混淆方案。导入保真度受格式早于 DrawingML 这一事实限制：没有可传递的主题字体方案，转换器会根据文稿收集到的第一个字体合成名为“Imported PPT”的主题，回退字体为 Arial；没有二进制对应形式的效果会降级。每个降级元素都以 `save` 作用域的 `PptxCompatibilityWarning` 标记。

**未解决的差距：墨迹与 SmartArt。** 与图表、视频和三维模型不同，PowerPoint 16.0 在同样的 97-2003 往返过程中仍原生保留墨迹和 SmartArt，因此写入器将它们降级为图片，尚未达到 PowerPoint 自身上限。墨迹使用真实 PowerPoint 创建、带真正 `p14:` 墨迹内容的样例测量（`e2e/fixtures/ink-contentpart.pptx`、`scripts/measure-ink-ole-97.ps1`），每个墨迹形状读回后仍为 `Shape.Type` = 23 / `msoInk`。SmartArt 使用真实 COM 创建的样例测量（`packages/core/src/__tests__/fixtures/corpus/smartart-orgchart-many.pptx`、`scripts/measure-smartart-ole-97.ps1`），前后 `Shape.HasSmartArt` 都为 `True`，`Shape.Type` 为 24 / `msoDiagram`。

2026-09-11 的从零复现尝试，通过项目自身的 `ole2-parser-read.ts` 和 `record-stream.ts` 读取器分析两个已保存文件，发现 PowerPoint 将两者都表示为普通 MSOSPT 75（“Picture Frame”）形状，其 `OfficeArtTertiaryFOPT` 恰好包含一个复杂属性，未文档化的 ID 为 `0x3A9`，原始字节为 `A9 C3`，即设置了 `fComplex` 和 `fBlipId`。它承载原始 ZIP/OPC“迷你包”，包含真实的 `[Content_Types].xml` / `_rels` 结构，以及未文档化但确实存在的内容类型：`application/vnd.ms-office.DrsInk+xml`、`application/inkml+xml`、`application/vnd.ms-office.DrsE2oDoc+xml`、`application/vnd.ms-office.DrsDownRev+xml`。墨迹包的 `drs/inkxml.xml` 是 `p:contentPart`，与源文件的 `p14:contentPart` 逐字节相同，另有逐字节相同的 `drs/ink/ink1.xml`。SmartArt 的 `drs/e2oDoc.xml` 是 `p:E2oFrame`，即重命名的 `p:graphicFrame` / `dgm:relIds`，再加上核心引擎已能无损往返的全部五个图形部件，完全自包含。这修正了之前认为文档级 `RoundTripCustomTableStyles12Atom`（`0x428C`）参与其中的假设；它实际只保存与两项功能都无关的通用 `tableStyles.xml` 往返内容。墨迹和 SmartArt 使用相同的 `0x3A9` 属性 ID。

在从零创建的 `.ppt` 中，将相同属性写入 MSOSPT 75 形状，**无法**重现 `Shape.Type` = `msoInk` / `msoDiagram`。测试既使用项目自身生成包的逐字节副本，也曾原样拼入捕获的 PowerPoint 字节。COM 重新打开后，有 `pib` 图片引用时读回 `Shape.Type` = 13 / `msoPicture`，没有引用时为 1 / `msoAutoShape`。墨迹已经做了全面测试，独立改变精确 FOPT 属性表、精确 `ClientAnchor` 位置（来自源文件的 `p14:xfrm`），以及形状在 1 至 3 个同级元素中的顺序位置，始终未生成 `msoInk`。这意味着除了 `TertiaryFOPT` 迷你包，还需要至少一个尚未文档化的标记，但从两个实测样例中无法识别，因此没有继续尝试写入。当前写入器仍将墨迹和 SmartArt 降级为栅格预览图，并保留兼容性警告。

这次调查另发现并修复了一项无关问题，已通过 COM 验证：`wzName` OfficeArt 复杂属性，即形状 `name`，缺少结尾的 UTF-16 空字符，导致真实 PowerPoint 直接拒绝写入器为具名形状生成的任何 `.ppt`，提示“Office has detected a problem with this file”，且没有修复选项。修复位于 `fopt-writer.ts` 的 `encodeComplexString`，并添加了字节级回归测试。

## SmartArt 布局实测基准 {#smartart-layout-ground-truth}

`.pptx` 包含 PowerPoint 自身预计算的绘图部件时，会使用该精确布局，并像 PowerPoint 一样按原始偏移放置，已通过实时 COM 验证。否则由 DiagramML 解释器重建，支持全部十种 `dgm:alg` 类型、`constrLst` / `ruleLst`（包括由 `dgm:choose` 控制的条目）、相对约束和 `presLayoutVars`。

解释器依据包含 229 个样例的图库测量，这些样例覆盖所有内置布局，均由 PowerPoint 自身通过 COM 创建。测试位于 `packages/core/src/__tests__/integration/smartart-gallery-ground-truth.test.ts`，本地运行，在全部通过之前于 CI 中跳过：

- 229 个样例中，227 个生成的带文本形状集合与 PowerPoint 完全一致。
- 循环、径向、层次、水平层次、组织结构图和棱锥族，在平坦数据集上的几何与 PowerPoint 偏差在 1% 以内。
- 文本自动适应遵循实测规则：使用整数磅字号、真实文本框边距和圆角内缩，以及折叠子段落固定的 0.78 比例。
- 组织结构图还由 `smartart-orgchart-genuine-fixture.test.ts` 固定拓扑、悬挂尾部偏移和扇形与列式布局选择。

仍未解决的部分可能让文稿与 PowerPoint 在字号上相差几磅，或位置上相差几个百分点：多数多角色条目模板（项目符号、方框和括号列表）的精确字号；超过第三代的深层或不均衡组织结构图；弯折蛇形连接线的预留通道；以及一个预设特有的空白段落（气泡图片列表，Bubble Picture List）。

## 相关阅读 {#related-reading}

- [已知限制](/zh/guide/limitations)：当前尚未解决的差距。
- [架构](/zh/guide/architecture)：符合性处理在加载和保存流程中的位置。
