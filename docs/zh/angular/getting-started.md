---
title: 快速上手
description: 将 .pptx ArrayBuffer 加载到 pptx-viewer，先以只读方式渲染，再通过 dirty 和 content 输出接入编辑。
---

# 快速接入 {#getting-started}

本页从只读查看器开始，逐步接入文件 `<input>` 以及 `contentChange` / `dirtyChange` 输出，实现可编辑查看器。

::: tip 前置条件
请先安装组件包及其 peer 依赖，参见[概览 > 安装](/zh/angular/#installation)。
:::

## 1. 只读预览 {#_1-read-only-viewer}

`PowerPointViewerComponent` 是一个**独立组件**，选择器为 `pptx-viewer`。它通过 `content` 输入接收幻灯片数据，类型为包含原始 `.pptx` 字节的 `Uint8Array` 或 `ArrayBuffer`。组件会填满父容器，因此请为父容器设置明确的高度。

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

// Base chrome styles (toolbar, thumbnails, layout). Import once, e.g. in styles.css or main.ts.
import 'pptx-angular-viewer/styles';

@Component({
	selector: 'app-viewer-only',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="height: 100vh">
			@if (content(); as bytes) {
				<pptx-viewer [content]="bytes" />
			} @else {
				<div>Loading…</div>
			}
		</div>
	`,
})
export class ViewerOnlyComponent {
	readonly content = signal<ArrayBuffer | null>(null);

	constructor() {
		fetch('/presentation.pptx')
			.then((r) => r.arrayBuffer())
			.then((buf) => this.content.set(buf));
	}
}
```

::: tip `content` 接受两种类型
React 属性只接受 `Uint8Array`，而 Angular 的 `content` 输入接受 `Uint8Array | ArrayBuffer | null`，因此可以直接传入 `fetch(...).arrayBuffer()` 的结果。
:::

## 2. 从文件 `<input>` 加载 {#_2-loading-from-a-file-input}

```ts
import { Component, signal } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-file-picker-viewer',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="display: flex; flex-direction: column; height: 100vh">
			<input type="file" accept=".pptx,.ppt" (change)="onFile($event)" />
			<div style="flex: 1; min-height: 0">
				@if (content(); as bytes) {
					<pptx-viewer [content]="bytes" />
				}
			</div>
		</div>
	`,
})
export class FilePickerViewerComponent {
	readonly content = signal<ArrayBuffer | null>(null);

	async onFile(event: Event): Promise<void> {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		this.content.set(await file.arrayBuffer());
	}
}
```

## 3. 启用编辑 {#_3-enabling-editing}

设置 `canEdit` 即可启用编辑功能区和检查器，并通过以下输出跟踪变化：

- `dirtyChange`：未保存修改标记变化时触发。
- `contentChange`：文档变化时触发，携带**重新序列化的 `Uint8Array`**。
- `activeSlideChange`：当前幻灯片变化时触发。

```ts
import { Component, input, signal, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-editor',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: `
		<div style="height: 100vh">
			<button (click)="save()" [disabled]="!dirty()">Save{{ dirty() ? ' *' : '' }}</button>
			<pptx-viewer
				[content]="initial()"
				[canEdit]="true"
				(dirtyChange)="dirty.set($event)"
				(contentChange)="onContentChange($event)"
				(activeSlideChange)="onSlideChange($event)"
			/>
		</div>
	`,
})
export class EditorComponent {
	readonly initial = input.required<Uint8Array>();
	readonly viewer = viewChild.required(PowerPointViewerComponent);
	readonly dirty = signal(false);

	async save(): Promise<void> {
		const bytes = await this.viewer().getContent(); // Uint8Array
		// POST to your server, write to disk, trigger a download, …
	}

	onContentChange(bytes: Uint8Array): void {
		// `bytes` is the latest serialized document
	}

	onSlideChange(index: number): void {
		console.log('slide', index);
	}
}
```

::: info 保存
获取当前文档最可靠的方式是调用组件实例上的 [`getContent()`](/zh/angular/api)，它会按需序列化。编辑发生时，`contentChange` 也会提供最新字节。
:::

## 样式与所需 CSS {#styling-required-css}

在应用入口处或全局 `styles.css` 中导入一次打包的样式表：

```ts
import 'pptx-angular-viewer/styles'; // or 'pptx-angular-viewer/styles.css'
```

在基础样式表之上定制颜色的方法请参见[主题](/zh/angular/theming)。

## 下一步 {#next-steps}

- [组件输入与输出](/zh/angular/props)：每个输入和输出的详细说明。
- [公开 API](/zh/angular/api)：组件实例暴露的方法。
- [导出](/zh/angular/export)：将幻灯片转换为 PNG、PDF、GIF 和视频。
