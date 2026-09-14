---
title: 保存与往返处理
description: 使用 handler.save() 将模型序列化为 PowerPoint 文件，了解原始内容保留、Strict 格式、保存选项和浏览器或磁盘输出。
---

# 保存与往返处理 {#saving-round-tripping}

`handler.save(slides, options?)` 将可能经过编辑的幻灯片序列化为有效的 `.pptx` ZIP 归档，返回 `Uint8Array`。

```ts
const bytes = await handler.save(data.slides); // => Uint8Array
```

::: tip 使用原处理器
请在加载或创建数据的处理器上调用 `save()`。它持有媒体、母版、主题、自定义 XML 和 VBA 等内存 ZIP 内容，保存时会复用未修改部分。其他处理器没有这些原始数据。
:::

## 保存流程 {#what-the-save-pipeline-does}

`PptxHandlerRuntimeSavePipeline` 依次执行：

1. **确定一致性类别**：默认 `'preserve'` 保留加载时检测到的 Strict/Transitional，`'strict'` 或 `'transitional'` 强制指定。
2. **协调幻灯片列表**：将新增、删除和重排同步到 `ppt/presentation.xml` 及其关系，必要时创建备注和讲义母版基础结构。
3. **逐页处理**：根据元素数据重建形状树，包括文本段落和文本段属性、样式、效果、变换、图片/图表/媒体/墨迹关系、动画计时树和备注；新嵌入媒体的扩展名交给下一阶段。
4. **重建 `[Content_Types].xml`**：包括各页的 Override，以及所有媒体和墨迹扩展名的 `Default`。
5. **批注**：清理并重新输出传统批注，重建 `ppt/commentAuthors.xml`，或连同其关系删除以避免 PowerPoint 修复提示，同时保存新版讨论串批注。
6. **母版、版式和主题**：应用保存选项中的类型化修改，未列出的内容从原归档原样透传。
7. **嵌入字体**：自动重新嵌入加载时保留的原始字体数据，默认不损失信息；`embeddedFonts` 和 `embeddedFontList` 可覆盖或删除。
8. **文稿级部件**：处理 `presentation.xml` 中的节、自定义放映、相册、禁则、修改验证器和尺寸，以及 `presProps.xml`、`viewProps.xml`、`tableStyles.xml`、`docProps/core.xml`、`app.xml`、`custom.xml`、标签和备注/讲义母版。
9. **图表、SmartArt 和 OLE**：写入待处理的 XML 更新并补齐内容类型。
10. **原始内容保留**：自定义 XML、缩略图和 VBA 原样保留；**移除数字签名**，因为修改后原签名已无法通过校验。
11. **输出格式覆盖**：根据请求切换 `.ppsx` / `.pptm` 内容类型，或使用旧版 `.ppt` 序列化。
12. **Strict 转换**：目标为 Strict 时，将各部件从 Transitional 命名空间转回 Strict。
13. **清理 ZIP**：删除 JSZip 自动创建的目录条目。ISO/IEC 29500-2 不允许将目录作为部件，否则 PowerPoint OPC 加载器可能提示修复。最后生成 `Uint8Array`。

## 往返保存保证 {#round-trip-guarantees}

引擎按“只修改需要修改的部分，其余内容保留”的方式工作：

| 未编辑时原样保留                     | 每次保存重建                                |
| ------------------------------------ | ------------------------------------------- |
| 幻灯片母版和版式                     | `ppt/presentation.xml` 中的幻灯片列表和关系 |
| 主题部件（`ppt/theme/theme*.xml`）   | 根据元素数据重建各页的 `p:spTree`           |
| 媒体二进制（`ppt/media/*`）          | `[Content_Types].xml`                       |
| 嵌入字体，重新嵌入原始数据           | 批注部件和作者                              |
| VBA 项目和自定义 XML                 | 文档属性                                    |
| 缩略图（`docProps/thumbnail.jpeg`）  | 修改过的图表和 SmartArt 部件                |
| 表格样式中的 `def` GUID 和未建模 XML |                                             |

模型未表示的内容不会从头生成，而是从加载的 ZIP 逐字节保留到输出中。

::: warning 保存会移除数字签名
`save()` 始终移除 XML 数字签名部件，因为任何修改都会使其失效。如果需要带签名的结果，可使用 `pptx-viewer-core/signature-node` 重新签名。
:::

## OOXML Strict 与 Transitional {#ooxml-strict-and-transitional}

Office 365 可以保存为 **ISO/IEC 29500 Strict**，使用 `purl.oclc.org` 命名空间；常见的 **Transitional**（ECMA-376）使用 `schemas.openxmlformats.org`。加载时，引擎检测 Strict 并将 48 组映射的 URI 规范化为 Transitional，包括 PresentationML、DrawingML、officeDocument 关系类型、schemaLibrary 和 descriptions。保存时按 `conformance` 转回：

```ts
// Keep whatever the source file used (default)
await handler.save(data.slides);

// Force Strict Open XML output
await handler.save(data.slides, { conformance: 'strict' });

// Downgrade a Strict file to Transitional
await handler.save(data.slides, { conformance: 'transitional' });
```

Open Packaging Conventions 命名空间（ISO/IEC 29500-2 的内容类型、关系、核心属性）和 Markup Compatibility（ISO/IEC 29500-3 的 `mc:AlternateContent`）与一致性类别无关，**始终不映射**。Office 的真实 Strict 文件也保留它们的规范形式。`p:presentation` 上的 `conformance="strict"` 会按目标类别添加或移除。

## 保存选项 {#save-options}

`save(slides, options?)` 接受 `PptxHandlerSaveOptions`，用于修改逐页元素模型之外的内容。所有字段均可选，省略时保留对应原始部件。

| 选项                                                    | 类型                                       | 用途                                                                   |
| ------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `coreProperties` / `appProperties` / `customProperties` | 类型化对象或数组                           | `docProps/*.xml` 文档元数据。                                          |
| `sections`                                              | `PptxSection[]`                            | 幻灯片节分组。                                                         |
| `customShows`                                           | `PptxCustomShow[]`                         | 自定义放映。                                                           |
| `presentationProperties`                                | `PptxPresentationProperties`               | 放映类型、循环、打印等设置。                                           |
| `slideMasters` / `slideLayouts`                         | `PptxSlideMaster[]` / `PptxSlideLayout[]`  | 按 `path` 修改 clrMap、背景和页眉页脚标记，未列出的母版/版式原样保留。 |
| `notesMaster` / `handoutMaster`                         | 类型化对象                                 | 修改备注和讲义母版，包括 `slidesPerPage`。                             |
| `headerFooter`                                          | `PptxHeaderFooter`                         | 文稿级页眉页脚标记。                                                   |
| `viewProperties`                                        | `PptxViewProperties`                       | `ppt/viewProps.xml`。                                                  |
| `tags` / `customerData`                                 | 数组                                       | `ppt/tags/tag*.xml` 标签和客户数据引用。                               |
| `photoAlbum`                                            | `PptxPhotoAlbum`                           | `p:photoAlbum` 元数据。                                                |
| `kinsoku`                                               | `PptxKinsoku \| null`                      | 东亚文字禁则设置，`null` 表示删除。                                    |
| `modifyVerifier`                                        | `PptxModifyVerifier \| null`               | 写保护验证器，`null` 删除，`undefined` 保留。                          |
| `tableStyles`                                           | `ParsedTableStyleMap`                      | 修改 `ppt/tableStyles.xml`，保留未建模 XML。                           |
| `embeddedFonts` / `embeddedFontList`                    | `PptxEmbeddedFont[]` / `... \| null`       | 覆盖或移除嵌入字体，默认重新嵌入原始数据。                             |
| `outputFormat`                                          | `'pptx' \| 'ppsx' \| 'pptm' \| 'ppt'`      | 标准、放映、启用宏或旧版二进制格式。                                   |
| `pptPassword`                                           | `string`                                   | `outputFormat: 'ppt'` 的 RC4 CryptoAPI 密码，OpenXML 格式忽略。        |
| `conformance`                                           | `'strict' \| 'transitional' \| 'preserve'` | 输出一致性类别，默认 `'preserve'`。                                    |

```ts
const bytes = await handler.save(data.slides, {
	coreProperties: { ...data.coreProperties, title: 'Final Report' },
	sections: data.sections,
	conformance: 'preserve',
});
```

## 输出格式与字节类型 {#output-formats-and-byte-types}

返回值始终为普通 `Uint8Array`，可以直接交给 `node:fs`、`Bun.write` 或浏览器 `Blob`。

| outputFormat | 扩展名  | 行为                                                                              |
| ------------ | ------- | --------------------------------------------------------------------------------- |
| `'pptx'`     | `.pptx` | 默认的标准演示文稿。                                                              |
| `'ppsx'`     | `.ppsx` | 打开后直接进入放映。                                                              |
| `'pptm'`     | `.pptm` | 启用宏的文稿，需要加载文件中的 VBA 数据。                                         |
| `'ppt'`      | `.ppt`  | PowerPoint 97-2003 二进制文件，不支持的元素降级为预览或占位符，并产生兼容性警告。 |

旧版输出使用 `outputFormat: 'ppt'`，`pptPassword` 为其二进制流应用 RC4 CryptoAPI 保护。这条路径不使用 OpenXML ZIP 保存阶段或 `saveEncrypted()`。旧版写入器只读取保存选项中的 `pptPassword`。

```ts
const bytes = await handler.save(data.slides, {
	outputFormat: 'ppt',
	pptPassword: 'legacy-password',
});
```

## 写入结果 {#writing-the-result}

::: code-group

```ts [Node fs]
import { writeFile } from 'node:fs/promises';

const bytes = await handler.save(data.slides);
await writeFile('output.pptx', bytes);
```

```ts [Bun]
const bytes = await handler.save(data.slides);
await Bun.write('output.pptx', bytes);
```

```ts [Browser download]
const bytes = await handler.save(data.slides);
const blob = new Blob([bytes], {
	type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'output.pptx';
a.click();
URL.revokeObjectURL(url);
```

:::

## 保存加密输出 {#saving-encrypted-output}

需要密码保护时使用 `saveEncrypted`，它接收相同保存选项，另加 `encryption` 配置：

```ts
const bytes = await handler.saveEncrypted(data.slides, 'secret');
// => Uint8Array of an encrypted OLE2 package
```

算法选项和细节见[加密](/zh/core/encryption)。

## `exportSlides` {#exportslides}

处理器提供 `exportSlides(slides, options)`，其中 `options.format` 为 `'pdf' | 'png' | 'svg'`，返回以幻灯片索引为键的 `Map`。

**`svg` 无需额外配置。** 它使用同一个[无界面 SVG 导出器](/zh/core/svg-export)，不依赖 DOM，可在 Node、Bun、Deno 和 Workers 中运行：

```ts
const exports = await handler.exportSlides(data.slides, {
	format: 'svg',
	slideIndices: [0, 2],
});
for (const [index, bytes] of exports) {
	await fs.writeFile(`slide_${index}.svg`, Buffer.from(bytes));
}
// => one SVG document per exported slide
```

默认跳过隐藏页，除非传入 `includeHidden: true`，所以返回 `Map` 的大小可能小于 `slideIndices`。通过 `width` 调整视口尺寸，宽高比始终取自文稿。

**`png` 和 `pdf` 会抛出错误。** 栅格化需要平台后端，本包不自带。旧实现曾返回键正确但值为空字节数组的 `Map`，并附上 `EXPORT_BACKEND_UNAVAILABLE` 警告，导致未检查警告的调用方写出零字节文件；现在会直接报错。位图输出请使用浏览器中的框架组件导出流程，或在运行时自行覆盖 `exportSlides` 并接入后端。覆盖会替换方法体，因此不受此报错影响。
