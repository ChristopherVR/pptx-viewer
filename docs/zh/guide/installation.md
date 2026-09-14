---
title: 安装
description: 从 npm 安装 pptx-viewer，为 React、Vue 3、Angular、Svelte 或原生 JavaScript 配置依赖，并在本地运行 monorepo。
---

# 安装 {#installation}

`pptx-viewer` 的各个包在 npm 上独立发布。按需安装不依赖框架的[核心引擎](/zh/core/)，或与你使用的框架对应的预览组件即可。

::: tip Node 版本
编译 TypeScript 和在浏览器外运行这些包需要 **Node.js 18 或更高版本**。
:::

## 选择你的框架 {#choose-your-framework}

| 框架                        | 包                    | 说明                                        |
| --------------------------- | --------------------- | ------------------------------------------- |
| React                       | `pptx-react-viewer`   | 预览、编辑、放映、导出和协作                |
| Vue 3                       | `pptx-vue-viewer`     | 与 React 组件使用相同的引擎，功能一致       |
| Angular                     | `pptx-angular-viewer` | 与 React 组件使用相同的引擎，功能一致       |
| Svelte 5                    | `pptx-svelte-viewer`  | 与 React 组件使用相同的引擎，功能一致       |
| 无框架                      | `pptx-vanilla-viewer` | 使用相同的引擎和原生 DOM，无需框架依赖      |
| 无界面处理（Node / 浏览器） | `pptx-viewer-core`    | 不包含 UI，不依赖框架                       |
| AI / MCP 工具               | `pptx-viewer-mcp`     | 73 个 MCP 工具、命令行工具和 Y.Doc 编解码器 |

## 从 npm 安装 {#installing-from-npm}

### React 组件 {#react-viewer}

React 预览和编辑组件的包名为 **`pptx-react-viewer`**。核心引擎已**打包在其中**，无需单独安装。

::: code-group

```bash [npm]
npm install pptx-react-viewer react react-dom
```

```bash [pnpm]
pnpm add pptx-react-viewer react react-dom
```

```bash [yarn]
yarn add pptx-react-viewer react react-dom
```

```bash [bun]
bun add pptx-react-viewer react react-dom
```

:::

::: tip 其他同级依赖
组件还使用 `framer-motion`、`lucide-react`、`react-icons`、`jspdf`、`jszip`、`fast-xml-parser` 和 `i18next`/`react-i18next`，请安装所用功能需要的依赖。
:::

### Vue 3 组件 {#vue-3-viewer}

Vue 3 组件的包名为 **`pptx-vue-viewer`**，已包含核心引擎。

::: code-group

```bash [npm]
npm install pptx-vue-viewer vue
```

```bash [pnpm]
pnpm add pptx-vue-viewer vue
```

```bash [yarn]
yarn add pptx-vue-viewer vue
```

```bash [bun]
bun add pptx-vue-viewer vue
```

:::

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { PowerPointViewer } from 'pptx-vue-viewer';

const content = ref<ArrayBuffer | null>(null);
</script>

<template>
	<PowerPointViewer :content="content" />
</template>
```

### Angular 组件 {#angular-viewer}

Angular 组件的包名为 **`pptx-angular-viewer`**，已包含核心引擎。

::: code-group

```bash [npm]
npm install pptx-angular-viewer @angular/core @angular/common
```

```bash [pnpm]
pnpm add pptx-angular-viewer @angular/core @angular/common
```

```bash [yarn]
yarn add pptx-angular-viewer @angular/core @angular/common
```

```bash [bun]
bun add pptx-angular-viewer @angular/core @angular/common
```

:::

```typescript
// app.module.ts
import { PptxAngularViewerModule } from 'pptx-angular-viewer';

@NgModule({
	imports: [PptxAngularViewerModule],
})
export class AppModule {}
```

```html
<!-- app.component.html -->
<pptx-viewer [content]="content"></pptx-viewer>
```

### Svelte 5 组件 {#svelte-5-viewer}

Svelte 5 组件的包名为 **`pptx-svelte-viewer`**，已包含核心引擎。完整的组件参考见 [Svelte 文档](/zh/svelte/)。

::: code-group

```bash [npm]
npm install pptx-svelte-viewer svelte
```

```bash [pnpm]
pnpm add pptx-svelte-viewer svelte
```

```bash [yarn]
yarn add pptx-svelte-viewer svelte
```

```bash [bun]
bun add pptx-svelte-viewer svelte
```

:::

```svelte
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';

	let bytes = $state<Uint8Array | null>(null);
</script>

{#if bytes}
	<PowerPointViewer source={bytes} />
{/if}
```

### 原生 JavaScript 组件（无需框架） {#vanilla-js-viewer-no-framework}

无框架组件的包名为 **`pptx-vanilla-viewer`**，已包含核心引擎，没有框架同级依赖。通过一个工厂函数即可使用预览、放映和编辑功能，其中编辑由 `editable` 选项控制。完整 API 参考见[原生 JavaScript 文档](/zh/vanilla/)。

::: code-group

```bash [npm]
npm install pptx-vanilla-viewer
```

```bash [pnpm]
pnpm add pptx-vanilla-viewer
```

```bash [yarn]
yarn add pptx-vanilla-viewer
```

```bash [bun]
bun add pptx-vanilla-viewer
```

:::

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx',
	editable: true,
});
```

### 核心引擎 {#core-engine}

不依赖框架的核心引擎用于解析、编辑、序列化和转换 PPTX 文件，适合无界面自动化、构建脚本和不需要 UI 的 Node.js 工作流。上面的 UI 组件包均已包含核心引擎，使用它们时无需重复安装。

::: code-group

```bash [npm]
npm install pptx-viewer-core
```

```bash [pnpm]
pnpm add pptx-viewer-core
```

```bash [yarn]
yarn add pptx-viewer-core
```

```bash [bun]
bun add pptx-viewer-core
```

:::

### MCP 服务器与工具 {#mcp-server-and-tools}

基于核心引擎提供 73 个 PPTX 操作工具函数、面向 AI 智能体的 MCP 服务器，以及 Y.Doc 协作编解码器。

::: code-group

```bash [npm]
npm install pptx-viewer-mcp
```

```bash [pnpm]
pnpm add pptx-viewer-mcp
```

```bash [yarn]
yarn add pptx-viewer-mcp
```

```bash [bun]
bun add pptx-viewer-mcp
```

:::

## 可选同级依赖 {#optional-peer-dependencies}

React 包的部分功能只有在对应的可选同级依赖存在时才会启用。

| 功能                     | 可选同级依赖         | 说明                                   |
| ------------------------ | -------------------- | -------------------------------------- |
| **三维模型**（GLB/GLTF） | `three`              | 未安装时，三维元素回退为预览图片。     |
| **实时协作**             | `yjs`、`y-websocket` | 使用 Yjs CRDT 同步数据并跟踪在线状态。 |

::: code-group

```bash [npm]
npm install three yjs y-websocket
```

```bash [pnpm]
pnpm add three yjs y-websocket
```

```bash [yarn]
yarn add three yjs y-websocket
```

```bash [bun]
bun add three yjs y-websocket
```

:::

## 本地开发（克隆 monorepo） {#local-development-cloning-the-monorepo}

项目使用 **Bun** 管理依赖和运行工作区，各个包通过 `workspace:*` 协议相互引用。

```bash
# Clone the repository
git clone https://github.com/ChristopherVR/pptx-viewer
cd pptx-viewer

# Install all workspace dependencies
bun install

# Build all packages
bun run build

# Run tests / type-check
bun run test
bun run typecheck
```

::: warning 注意构建顺序
各个包必须按照依赖顺序构建：

```
core -> shared -> react / vue / angular / vanilla / svelte
```

在仓库根目录运行 `bun run build` 会自动处理这一顺序。手动构建单个包（`cd packages/<pkg> && bun run build`）时，请确保先构建它的依赖。
:::

### 常用工作区命令 {#common-workspace-commands}

```bash
bun run build         # Build all packages in dependency order
bun run test          # Run vitest across all packages
bun run typecheck     # Type-check all packages
bun run fmt           # Format with oxfmt
bun run lint          # Lint with oxlint
bun run demo          # Start the React demo dev server (port 4173)
bun run demo:vue      # Start the Vue demo dev server (port 4175)
bun run demo:angular  # Start the Angular demo dev server (port 4174)
bun run demo:vanilla  # Start the Vanilla JS demo dev server (port 4176)
bun run demo:svelte   # Start the Svelte demo dev server (port 4177)
```

## 下一步 {#next-steps}

- [快速开始](/zh/guide/quick-start)：创建、解析、转换和显示演示文稿。
- [架构说明](/zh/guide/architecture)：了解各层之间的关系。
- [功能限制](/zh/guide/limitations)：投入生产环境前需要了解的注意事项。
