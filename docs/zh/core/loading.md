---
title: 加载与解析
description: 使用 PptxHandler 将 PPTX、旧版 PPT 或可移植 JSON 的 ArrayBuffer 解析为 PptxData，并访问幻灯片、元素、主题和元数据。
---

# 加载与解析 {#loading-parsing}

加载将 `.pptx`、旧版 `.ppt` 或 `pptx-viewer-json` 字节转换为完成解析的类型化 [`PptxData`](/zh/guide/data-model)。所有解析都在内存中完成，不使用临时文件或原生代码。

## 创建处理器并加载 {#construct-a-handler-and-load}

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(arrayBuffer);

console.log(`${data.slides.length} slides loaded`);
console.log(`Canvas: ${data.width} x ${data.height}`);
```

`handler.load(data, options?)` 接收 `ArrayBuffer`，返回 `Promise<PptxData>`，可识别 OpenXML ZIP、旧版 OLE2 PowerPoint，以及带 `"format": "pptx-viewer-json"` 标记的 JSON 对象。

::: tip 保留处理器
处理器持有内存 ZIP。后续保存或通过 `getImageData()` / `getMediaArrayBuffer()` 获取媒体时，请使用**同一个实例**。
:::

## 获取 `ArrayBuffer` {#getting-an-arraybuffer}

引擎不依赖特定环境，只需要提供文件字节。

::: code-group

```ts [fetch (browser/server)]
const buffer = await fetch('presentation.pptx').then((r) => r.arrayBuffer());
const data = await handler.load(buffer);
```

```ts [File input (browser)]
const file = input.files[0]; // File from <input type="file">
const buffer = await file.arrayBuffer();
const data = await handler.load(buffer);
```

```ts [Node fs]
import { readFile } from 'node:fs/promises';

const node = await readFile('presentation.pptx'); // Buffer
const buffer = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength);
const data = await handler.load(buffer as ArrayBuffer);
```

:::

## 加载流程 {#what-the-load-pipeline-does}

调用 `load()` 后，运行时依次执行：

1. 检测格式。可移植 JSON 经校验后覆盖到生成的空白归档上；提供密码时先解密加密的 OpenXML OLE2/CFB 文件；旧版二进制 PowerPoint 转换为模型。
2. 使用 JSZip 打开 ZIP，解析 `[Content_Types].xml` 和 `ppt/presentation.xml`。
3. 解析每个母版、主题、颜色映射和版式。
4. 逐页解析形状树，求值**版式 → 母版 → 主题**的样式继承链，详见[架构说明](/zh/guide/architecture)。
5. 解析带样式继承的文本、动画、切换和媒体关系。
6. 解析批注、文档属性和嵌入字体。

最终得到单个 `PptxData`，包含渲染、编辑或转换文稿所需的数据。

## 可移植文稿 JSON {#portable-deck-json}

`PptxJsonConverter` 生成带版本、自包含的 `pptx-viewer-json` 文档，其中二进制模型字段以带标记的 base64 保存，可脱离原归档传输。`load()` 自动识别格式标记，并准备最小归档，使普通编辑和 `save()` 继续工作。

```ts
import { PptxHandler, PptxJsonConverter } from 'pptx-viewer-core';

const json = PptxJsonConverter.toJson(data, { pretty: true, generator: 'my-app' });
const imported = new PptxHandler();
const restored = await imported.load(new TextEncoder().encode(json).buffer);
const bytes = await imported.save(restored.slides); // valid .pptx bytes
```

当前格式版本为 1。只需校验而不重建 `PptxData` 时使用 `PptxJsonConverter.parse()`，只需模型时使用 `fromJson()`。

## 加载选项 {#load-options}

```ts
const data = await handler.load(buffer, {
	password: 'secret', // decrypt an encrypted file (see below)
	allowExternalImages: false, // default false - http(s) image URLs are dropped
	maxUncompressedBytes: 500 * 1024 * 1024, // zip-bomb guard, 500 MiB default
});
```

| 选项                   | 默认值    | 用途                                                                                                          |
| ---------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| `password`             | -         | 解析前解密加密文件。                                                                                          |
| `allowExternalImages`  | `false`   | 默认从渲染幻灯片中移除解析到 `http://` 或 `https://` 的关系目标，以降低 SSRF 和隐私风险。设为 `true` 才允许。 |
| `maxUncompressedBytes` | `500 MiB` | 总解压预算，超出该值或 65,536 个条目时抛出 `ZipBombError`。                                                   |
| `eagerDecodeImages`    | `false`   | 加载时立即解码嵌入图片，而非延迟解码。                                                                        |

## 访问幻灯片、主题和元数据 {#accessing-slides-theme-and-metadata}

```ts
const data = await handler.load(buffer);

// Slides
const first = data.slides[0];
console.log(first.id, first.elements.length, first.notes);

// Canvas / dimensions
console.log(data.width, data.height); // pixels

// Theme
console.log(data.theme?.name);
console.log(data.theme?.fontScheme?.majorFont?.latin);

// Document metadata
console.log(data.coreProperties?.title, data.coreProperties?.creator);

// Structure
console.log(data.sections, data.slideMasters, data.slideLayouts);
```

`PptxData`、`PptxSlide` 等完整结构见[数据模型](/zh/guide/data-model)。

## 遍历元素并通过 type 缩小类型 {#iterating-elements-and-narrowing-by-type}

各页的 `elements` 是由 16 种类型组成的 [`PptxElement`](/zh/guide/data-model) 可辨识联合数组。访问专有字段前，始终通过 `type` 缩小范围：

```ts
for (const slide of data.slides) {
	for (const el of slide.elements) {
		switch (el.type) {
			case 'shape':
			case 'text':
				console.log('text:', el.text);
				break;
			case 'image':
				console.log('image at', el.imagePath);
				break;
			case 'table':
				console.log('table rows:', el.tableData?.rows.length);
				break;
			case 'chart':
				console.log('chart type:', el.chartData?.type);
				break;
			case 'group':
				// groups nest child elements recursively
				console.log('group children:', el.children.length);
				break;
		}
	}
}
```

::: warning 先缩小类型，再访问字段
只有判断 `el.type` 后，TypeScript 才允许访问 `imagePath`、`tableData` 等专有字段。这是预期的使用方式，详见[数据模型](/zh/guide/data-model)。
:::

## 嵌入媒体 {#embedded-media}

获取元素所引用的嵌入图片或媒体文件字节：

```ts
const dataUrl = await handler.getImageData(element.imagePath); // base64 data URL
const bytes = await handler.getMediaArrayBuffer(mediaPath); // ArrayBuffer
```

## 加密文件 {#encrypted-files}

文件有密码保护且调用 `load()` 时**未提供密码**，引擎会抛出 `EncryptedFileError`。通过 `options.password` 在解析前解密：

```ts
const data = await handler.load(buffer, { password: 'secret' });
```

完整的加密和写回 API 见[加密](/zh/core/encryption)。
