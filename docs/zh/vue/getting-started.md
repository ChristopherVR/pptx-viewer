---
title: 快速上手
description: 将 .pptx ArrayBuffer 加载到 PowerPointViewer，先以只读方式渲染，再通过 dirty-change 和 content-change 事件接入编辑。
---

# 快速接入 {#getting-started}

本页从只读查看器开始，逐步接入文件 `<input>` 以及 `@dirty-change` / `@content-change` 事件，实现可编辑查看器。

::: tip 前置条件
请先安装组件包及其 peer 依赖，参见[概览 > 安装](/zh/vue/#installation)。
:::

## 1. 只读预览 {#_1-read-only-viewer}

组件通过 `content` 属性接收幻灯片数据，类型为包含原始 `.pptx` 字节的 **`Uint8Array`（或 `ArrayBuffer`）**。组件会填满父容器，因此请为父容器设置明确的高度。

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import { ref, onMounted } from 'vue';

// If your app does NOT use Tailwind CSS v4, import the bundled stylesheet once
// at your entry point (see Theming for the three styling modes):
import 'pptx-vue-viewer/styles';

const content = ref<Uint8Array | null>(null);

onMounted(async () => {
	const buf = await fetch('/presentation.pptx').then((r) => r.arrayBuffer());
	content.value = new Uint8Array(buf);
});
</script>

<template>
	<div style="height: 100vh">
		<div v-if="!content">Loading...</div>
		<PowerPointViewer v-else :content="content" />
	</div>
</template>
```

::: tip `content` 接受 `Uint8Array` 或 `ArrayBuffer`
与 React 绑定不同，Vue 属性类型是 `Uint8Array | ArrayBuffer`，因此可以直接传入 `fetch(...) .arrayBuffer()` 的结果，无需包装。
:::

## 2. 从文件 `<input>` 加载 {#_2-loading-from-a-file-input}

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import { ref } from 'vue';

const content = ref<Uint8Array | null>(null);

async function handleFile(e: Event): Promise<void> {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	content.value = new Uint8Array(await file.arrayBuffer());
}
</script>

<template>
	<div style="display: flex; flex-direction: column; height: 100vh">
		<input type="file" accept=".pptx,.ppt" @change="handleFile" />
		<div style="flex: 1; min-height: 0">
			<PowerPointViewer v-if="content" :content="content" />
		</div>
	</div>
</template>
```

## 3. 启用编辑 {#_3-enabling-editing}

设置 `can-edit` 即可启用编辑工具栏和检查器，并通过以下事件跟踪变化：

- `@dirty-change="isDirty => ..."`：未保存修改标记变化时触发。
- `@content-change="bytes => ..."`：文档变化时触发，携带**重新序列化的 `Uint8Array`**。
- `@active-slide-change="index => ..."`：当前幻灯片变化时触发。

```vue
<script setup lang="ts">
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer';
import { ref } from 'vue';

const props = defineProps<{ initial: Uint8Array }>();
const viewer = ref<PowerPointViewerExpose>();
const dirty = ref(false);

async function save(): Promise<void> {
	const bytes = await viewer.value?.getContent(); // Uint8Array
	if (bytes) {
		// POST to your server, write to disk, trigger a download, ...
	}
}
</script>

<template>
	<div style="height: 100vh">
		<button :disabled="!dirty" @click="save">Save{{ dirty ? ' *' : '' }}</button>
		<PowerPointViewer
			ref="viewer"
			:content="props.initial"
			can-edit
			@dirty-change="dirty = $event"
			@content-change="(bytes) => {}"
			@active-slide-change="(i) => console.log('slide', i)"
		/>
	</div>
</template>
```

::: info 保存
获取当前文档最可靠的方式是暴露的 [`getContent()`](/zh/vue/handle)，它会按需序列化。编辑发生时，`@content-change` 也会提供最新字节。
:::

## SSR 注意事项 {#ssr-notes}

`PowerPointViewer` 是仅在客户端运行的组件：初始化时会访问 DOM、`window` 和浏览器 API（文件、画布、剪贴板）。在 SSR 框架（Nuxt、Vite SSR 等）中，请仅在客户端渲染：

```vue
<template>
	<ClientOnly>
		<PowerPointViewer :content="content" />
	</ClientOnly>
</template>
```

Nuxt 全局提供 `<ClientOnly>`；没有类似组件的框架可以通过 `mounted` / `onMounted` 标记控制渲染。组件包本身不提供 SSR 防护，因此使用方必须明确设置客户端边界。

## 样式与所需 CSS {#styling-required-css}

如果应用已经使用 Tailwind CSS v4 和 shadcn 风格的语义令牌，**不强制导入 CSS**，查看器的类名会通过已有配置解析。否则，请在入口处导入一次打包的样式表：

```ts
import 'pptx-vue-viewer/styles'; // or 'pptx-vue-viewer/styles.css'
```

三种样式模式及自定义颜色的方法请参见[主题](/zh/vue/theming)。

## 下一步 {#next-steps}

- [组件属性](/zh/vue/props)：每个属性和事件的详细说明。
- [命令式句柄](/zh/vue/handle)：`defineExpose` API。
- [导出](/zh/vue/export)：将幻灯片转换为 PNG、PDF 等格式。
