---
title: 快速开始
description: 通过四个完整示例学习创建演示文稿、解析和编辑已有文件、转换为 Markdown，以及使用 React 组件显示幻灯片。
---

# 快速开始 {#quick-start}

本页介绍四种常见的完整操作流程。每个示例都独立使用项目的公共 API。更详细的参考文档见[下一步](#next-steps)。

## 1. 从零创建演示文稿 {#_1-create-a-presentation-from-scratch}

使用 `PptxHandler.create()` 创建演示文稿，通过链式幻灯片构建器添加内容，再调用 `save()` 保存为字节数据。

```ts
import { PptxHandler } from 'pptx-viewer-core';
import { writeFile } from 'node:fs/promises';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'My Presentation',
	creator: 'Author Name',
	theme: {
		name: 'Custom Theme',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

// Build a slide with the fluent API
const slide = createSlide()
	.addText('Hello World', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.addImage('https://example.com/photo.jpg', { x: 450, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

// Save to .pptx (returns a Uint8Array)
const output = await handler.save(data.slides);
await writeFile('presentation.pptx', output);
```

## 2. 解析并编辑已有演示文稿 {#_2-parse-and-edit-an-existing-presentation}

创建 `PptxHandler`，调用 `load()` 加载 `ArrayBuffer`，遍历并修改[数据模型](/zh/guide/data-model)，最后调用 `save()`。

```ts
import { PptxHandler } from 'pptx-viewer-core';
import { readFile, writeFile } from 'node:fs/promises';

const handler = new PptxHandler();
const buffer = await readFile('presentation.pptx');
const data = await handler.load(
	buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

console.log(`Loaded ${data.slides.length} slides`);
console.log(`Theme: ${data.theme?.name}`);

// Access slide content - narrow on the `type` discriminant
for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Text: ${element.text}`);
		}
	}
}

// Modify and save
data.slides[0].elements[0].text = 'Updated Title';
const output = await handler.save(data.slides);
await writeFile('output.pptx', output);
```

::: tip 缩小元素类型范围
`slide.elements` 是由 [`PptxElement`](/zh/guide/data-model) 可辨识联合类型组成的数组。访问特定元素类型的字段前，始终先检查 `element.type`。
:::

## 3. 转换为 Markdown {#_3-convert-to-markdown}

`PptxMarkdownConverter` 将解析后的 `PptxData` 转换为 Markdown，也可以按需将媒体文件提取到指定目录。

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';
import { readFile } from 'node:fs/promises';

const handler = new PptxHandler();
const buffer = await readFile('presentation.pptx');
const data = await handler.load(
	buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
);

const converter = new PptxMarkdownConverter('./output', {
	sourceName: 'presentation.pptx',
	includeSpeakerNotes: true,
	mediaFolderName: 'media',
	includeMetadata: true,
	semanticMode: true, // Clean markdown vs positioned HTML
});

const markdown = await converter.convert(data);
console.log(markdown);
```

## 4. 使用 React 组件显示幻灯片 {#_4-render-with-the-react-viewer}

`PowerPointViewer` 从 `Uint8Array` 读取演示文稿，支持启用编辑模式。演示文稿发生编辑时，`onContentChange` 回调会接收重新序列化后的 `.pptx` 字节数据。

![包含功能区、缩略图和属性面板的可编辑预览界面](/docs-shots/editor.jpg)

```tsx
import { useState } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer/viewer';

function App() {
	const [content, setContent] = useState<Uint8Array>();

	if (!content) return null;

	return (
		<PowerPointViewer
			content={content}
			canEdit
			onContentChange={(bytes) => {
				// `bytes` is the updated .pptx as a Uint8Array
				setContent(bytes);
			}}
		/>
	);
}
```

::: tip 提示
完整的属性说明见[组件属性](/zh/react/props)，该参考文档与源码接口对应。组件接收 `Uint8Array` 类型的内容（不是 `ArrayBuffer`），`onContentChange` 返回序列化后的字节数据，而不是表示未保存修改的布尔值。
:::

如果你使用 Vue、Angular、Svelte 或原生 JavaScript，可以查看 [Vue](/zh/vue/getting-started)、[Angular](/zh/angular/getting-started)、[Svelte](/zh/svelte/getting-started) 或[原生 JavaScript](/zh/vanilla/getting-started) 的接入指南。

## 下一步 {#next-steps}

- [核心引擎概览](/zh/core/)：完整的处理器、构建器和转换器 API。
- [React 组件概览](/zh/react/)：组件属性、编辑、放映和导出。
- [PptxData 数据模型](/zh/guide/data-model)：解析后的演示文稿结构。
- [数据模型中的单位](/zh/guide/data-model#units-emu-and-pixels)：EMU 单位、元素模型和主题解析。
