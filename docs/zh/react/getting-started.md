---
title: 快速接入
description: 将 .pptx 内容加载到 PowerPointViewer，从只读预览开始，再启用编辑和内容变化回调。
---

# 快速接入 {#getting-started}

本页从只读预览逐步扩展为可编辑组件，并接入文件 `<input>`、`onContentChange` 和 `onDirtyChange` 回调。

::: tip 前提条件
请先安装组件包及同级依赖，详见[概览中的安装说明](/zh/react/#installation)。
:::

## 1. 只读预览 {#_1-read-only-viewer}

组件的 `content` 属性接收包含原始 `.pptx` 字节的 **`Uint8Array`**。组件会填满父容器，因此请为父容器设置明确的高度。

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useEffect, useState } from 'react';

// If your app does NOT use Tailwind CSS v4, import the bundled stylesheet once
// at your entry point (see Theming for the three styling modes):
import 'pptx-react-viewer/styles';

export function ViewerOnly() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	useEffect(() => {
		fetch('/presentation.pptx')
			.then((r) => r.arrayBuffer())
			.then((buf) => setContent(new Uint8Array(buf)));
	}, []);

	if (!content) return <div>Loading…</div>;

	return (
		<div style={{ height: '100vh' }}>
			<PowerPointViewer content={content} />
		</div>
	);
}
```

::: warning `content` 使用 `Uint8Array`
属性类型为 `Uint8Array`，不是 `ArrayBuffer`。如果数据来自 `fetch(...).arrayBuffer()` 或 `file.arrayBuffer()`，请通过 `new Uint8Array(buffer)` 包装后传入。
:::

## 2. 从文件 `<input>` 加载 {#_2-loading-from-a-file-input}

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useState } from 'react';

export function FilePickerViewer() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const buf = await file.arrayBuffer();
		setContent(new Uint8Array(buf));
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
			<input type='file' accept='.pptx,.ppt' onChange={handleFile} />
			<div style={{ flex: 1, minHeight: 0 }}>
				{content && <PowerPointViewer content={content} />}
			</div>
		</div>
	);
}
```

## 3. 启用编辑 {#_3-enabling-editing}

设置 `canEdit` 开启编辑工具栏和属性面板，并通过以下回调跟踪变化：

- `onDirtyChange(isDirty)`：未保存修改标记发生变化时调用。
- `onContentChange(content)`：文档变化时返回**重新序列化后的 `Uint8Array`**。
- `onActiveSlideChange(index)`：当前幻灯片变化时调用。

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useRef, useState } from 'react';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';

export function Editor({ initial }: { initial: Uint8Array }) {
	const ref = useRef<PowerPointViewerHandle>(null);
	const [dirty, setDirty] = useState(false);

	async function save() {
		const bytes = await ref.current?.getContent(); // Uint8Array
		if (bytes) {
			// POST to your server, write to disk, trigger a download, …
		}
	}

	return (
		<div style={{ height: '100vh' }}>
			<button onClick={save} disabled={!dirty}>
				Save{dirty ? ' *' : ''}
			</button>
			<PowerPointViewer
				ref={ref}
				content={initial}
				canEdit
				onDirtyChange={setDirty}
				onContentChange={(bytes) => {
					// `bytes` is the latest serialized document
				}}
				onActiveSlideChange={(i) => console.log('slide', i)}
			/>
		</div>
	);
}
```

::: info 保存
获取当前文档最直接可靠的方式是调用命令式句柄的 [`getContent()`](/zh/react/handle)，按需序列化。编辑发生时，`onContentChange` 也会提供最新字节数据。
:::

## SSR 与 `'use client'` {#ssr-and-use-client}

`PowerPointViewer` 只能在客户端运行，会访问 DOM、`window` 以及文件、Canvas 和剪贴板等浏览器 API。使用 Next.js App Router 等 React Server Components 框架时，应从客户端组件渲染它，并在**自己的包装模块**顶部添加 `'use client'`：

```tsx
'use client';
import { PowerPointViewer } from 'pptx-react-viewer';
// … your wrapper component
```

::: warning 包内没有附带该指令
组件源码没有为 `PowerPointViewer` 附带 `'use client'`，需要由使用方声明边界。避免在服务端组件中直接导入，并保护预渲染阶段可能访问 `window` 的代码路径。
:::

## 样式与所需 CSS {#styling-required-css}

如果应用已经使用 Tailwind CSS v4 和 shadcn 风格的语义变量，则**不强制导入 CSS**，组件类名会使用现有配置。否则，请在应用入口导入一次随包提供的样式表：

```tsx
import 'pptx-react-viewer/styles'; // or 'pptx-react-viewer/styles.css'
```

三种样式接入方式及颜色自定义见[主题配置](/zh/react/theming)。

## 下一步 {#next-steps}

- [组件属性](/zh/react/props)：逐项属性说明。
- [命令式句柄](/zh/react/handle)：ref API。
- [导出](/zh/react/export)：将幻灯片转换为 PNG、PDF 等格式。
