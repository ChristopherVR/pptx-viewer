---
title: Svelte 查看器快速上手
description: 安装并挂载 Svelte 5 PowerPoint 查看器组件，从 URL 或文件输入加载 .pptx 字节，切换幻灯片、进入放映模式并启用编辑。
---

# 快速接入 {#getting-started}

本页从空组件开始，逐步实现文件加载、导航、放映模式和编辑，得到可用的查看器。

## 安装 {#install}

```bash
npm i pptx-svelte-viewer
```

`svelte` ^5 是 peer 依赖。引擎的运行时依赖（`jszip`、`fast-xml-parser`）会随组件包自动安装。

然后在应用入口或根组件中导入一次提取出的样式表：

```ts
import 'pptx-svelte-viewer/styles.css';
```

::: warning 必须导入 CSS
组件样式在构建时编译到独立样式表（`css: 'external'`），与 React 和 Vue 包提供 CSS 的方式相同。运行时不会注入样式，因此不导入样式表，查看器就会以无样式状态渲染。
:::

## 1. 挂载组件 {#_1-mount-the-component}

`source` 接受原始 `.pptx` 字节，类型为 `Uint8Array` 或 `ArrayBuffer`，对应 Vue 绑定中的 `content` 属性。查看器会填满容器，因此请为外层容器设置明确的高度：

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	fetch('/decks/quarterly.pptx')
		.then((res) => res.arrayBuffer())
		.then((buf) => (bytes = new Uint8Array(buf)));
</script>

{#if bytes}
	<div style="height: 100dvh">
		<PowerPointViewer
			source={bytes}
			initialSlide={0}
			onload={({ slideCount, canvasSize }) => console.log(slideCount, canvasSize)}
			onerror={(message) => console.error(message)}
			onslidechange={(index) => console.log('slide', index)}
		/>
	</div>
{/if}
```

每次成功加载后，`onload` 触发一次，携带幻灯片数量和以像素表示的幻灯片画布尺寸；加载失败时，`onerror` 接收可读的错误消息。

## 2. 加载演示文稿 {#_2-loading-a-presentation}

没有 URL 属性，需要自行获取或读取字节，并赋值给 `source`。赋予新值会在原位置加载新的演示文稿。

::: code-group

```svelte [From a URL]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	async function load(url: string) {
		const res = await fetch(url);
		bytes = new Uint8Array(await res.arrayBuffer());
	}

	load('/decks/quarterly.pptx');
</script>

{#if bytes}
	<PowerPointViewer source={bytes} />
{/if}
```

```svelte [From a file input]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);

	async function onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) bytes = new Uint8Array(await file.arrayBuffer());
	}
</script>

<input type="file" accept=".pptx,.ppt" onchange={onPick} />
{#if bytes}
	<PowerPointViewer source={bytes} />
{/if}
```

```svelte [From existing bytes]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	// e.g. bytes from an API response, IndexedDB, or a previous save()
	let { deck }: { deck: Uint8Array } = $props();
</script>

<PowerPointViewer source={deck} />
```

:::

## 3. 导航与缩放 {#_3-navigation-and-zoom}

内置工具栏提供导航、缩放、备注、全屏，以及 `editable` 启用时的完整功能区。其全部操作也可以通过组件实例（`bind:this`）编程访问：

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
</script>

<PowerPointViewer source={bytes} bind:this={viewer} />

<button onclick={() => viewer?.goPrev()}>Prev</button>
<button onclick={() => viewer?.goNext()}>Next</button>
<button onclick={() => viewer?.goTo(3)}>Slide 4</button>
<button onclick={() => viewer?.zoomIn()}>Zoom in</button>
```

完整方法参考请参见[实例 API](/zh/svelte/api)。如果希望隐藏内置界面并自行驱动所有操作，请查看[组件属性](/zh/svelte/props)中的 `showToolbar`、`showThumbnails` 和 `hiddenActions`。

## 4. 放映模式 {#_4-presentation-mode}

工具栏的放映按钮和幻灯片放映功能区选项卡，通过真实的 **Fullscreen API** 进入全屏放映模式；按 Esc 退出。放映会播放幻灯片切换效果和动画，演示者视图可以在独立窗口中打开观众画面。

从编程角度看，放映是查看器的一种*模式*：

```ts
viewer?.setMode('present'); // enter fullscreen presentation
viewer?.setMode('preview'); // leave it (back to read-only viewing)
viewer?.getMode(); // 'preview' | 'edit' | 'present' | 'master'
```

通过 `onmodechange` 回调跟踪模式变化。

::: tip 键盘支持
查看器获得焦点时，方向键、PageUp/PageDown 和空格可切换幻灯片；Home/End 跳转到第一张或最后一张；Esc 退出放映模式。
:::

## 5. 编辑 {#editing}

传入 `editable` 即可将查看器变为编辑器：点击选择、拖动移动、通过 8 个缩放控点调整尺寸（Shift 锁定宽高比）、使用旋转控点、双击编辑文本，并使用删除、复制、微移、撤销和重做快捷键。工具栏会增加撤销、重做、保存、下载及完整功能区。

```svelte
<script lang="ts">
	import { PowerPointViewer, type PowerPointViewerApi } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer = $state<PowerPointViewerApi>();
	let dirty = $state(false);
</script>

<PowerPointViewer
	source={bytes}
	editable
	bind:this={viewer}
	ondirtychange={(d) => (dirty = d)}
	onchange={() => console.log('edited')}
/>

<button disabled={!dirty} onclick={() => viewer?.downloadPptx('edited.pptx')}>
	Download
</button>
```

需要自行持久化时，`save()` 会返回序列化后的 `.pptx` 字节，参见[实例 API > 编辑](/zh/svelte/api#editing)。

## 6. 自动保存与崩溃恢复 {#autosave}

允许自动保存（默认行为）且提供 `filePath` 时，提交的编辑会经过防抖，序列化为 `.pptx` 字节并写入共享 IndexedDB 恢复存储。`filePath` 是 IndexedDB 记录键，通常使用文件名。显式 `autosaveIntervalMs` 决定保存频率，否则由用户在“文件 > 选项”中设置的自动恢复频率决定。每次成功生成快照后，`onautosave` 携带字节触发。

```svelte
<PowerPointViewer
	source={bytes}
	editable
	autosave
	filePath="quarterly.pptx"
	onautosave={(snapshot) => console.log('autosaved', snapshot.byteLength)}
/>
```

同一键下存在更新的快照时，查看器在加载后显示内置恢复提示，提供恢复和放弃选项。宿主需要自行控制恢复流程时，仍可使用存储辅助函数：

```ts
import {
	getAutosaveSnapshot,
	listAutosaveSnapshots,
	deleteAutosaveSnapshot,
} from 'pptx-svelte-viewer';

const snapshot = await getAutosaveSnapshot('quarterly.pptx');
if (snapshot) {
	bytes = snapshot.data; // offer "Restore unsaved changes?" and reload
}
```

## 本地化 {#localization}

内置英文翻译。通过 `pptx-svelte-viewer/i18n` 入口注册更多语言，或覆盖单个字符串，然后设置 `locale` 属性：

```ts
import { registerTranslations } from 'pptx-svelte-viewer/i18n';

registerTranslations('fr', {
	'pptx.statusBar.slideOf': 'Diapositive {{current}} sur {{total}}',
	// ...any subset; unset keys fall back to English
});
```

```svelte
<PowerPointViewer source={bytes} locale="fr" />
```

回退顺序、“文件 > 选项 > 语言”选择器（`defaultLocale` / `availableLocales` / `onLocaleChange`）及完整辅助函数参考，请参见[本地化](/zh/svelte/i18n)。

## 下一步 {#next-steps}

- [组件属性](/zh/svelte/props)：完整的属性和事件回调约定。
- [实例 API](/zh/svelte/api)：组件实例的全部方法。
- [主题](/zh/svelte/theming)：共享的 `ViewerTheme` 系统。
- [导出与打印](/zh/svelte/export)：PNG、PDF、GIF、视频、SVG、打印和另存为。
