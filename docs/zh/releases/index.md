---
title: 版本发布
---

# 版本发布 {#releases}

monorepo 中每个已发布的包都独立管理版本和发布：只有自身代码或打包在内的依赖发生变化时，该包才发布新版本。版本递增级别遵循 [Conventional Commits](https://www.conventionalcommits.org)：破坏性变更升级主版本，新功能升级次版本，其余变更升级补丁版本。

以下是发布流程根据提交历史生成的各包版本说明，保留原始发布记录：

| 包                                      | 版本说明                      | npm                                                                                                                             |
| --------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `pptx-viewer-core` (无界面引擎)         | [更新日志](/releases/core)    | [![npm](https://img.shields.io/npm/v/pptx-viewer-core)](https://www.npmjs.com/package/pptx-viewer-core)                         |
| `pptx-react-viewer` (React)             | [更新日志](/releases/react)   | [![npm](https://img.shields.io/npm/v/pptx-react-viewer)](https://www.npmjs.com/package/pptx-react-viewer)                       |
| `pptx-vue-viewer` (Vue 3)               | [更新日志](/releases/vue)     | [![npm](https://img.shields.io/npm/v/pptx-vue-viewer)](https://www.npmjs.com/package/pptx-vue-viewer)                           |
| `pptx-angular-viewer` (Angular)         | [更新日志](/releases/angular) | [![npm](https://img.shields.io/npm/v/pptx-angular-viewer)](https://www.npmjs.com/package/pptx-angular-viewer)                   |
| `pptx-vanilla-viewer` (原生 JavaScript) | [更新日志](/releases/vanilla) | [![npm](https://img.shields.io/npm/v/pptx-vanilla-viewer)](https://www.npmjs.com/package/pptx-vanilla-viewer)                   |
| `pptx-svelte-viewer` (Svelte 5)         | [更新日志](/releases/svelte)  | [![npm](https://img.shields.io/npm/v/pptx-svelte-viewer)](https://www.npmjs.com/package/pptx-svelte-viewer)                     |
| `pptx-viewer-mcp` (MCP 服务器与工具)    | [更新日志](/releases/mcp)     | [![npm](https://img.shields.io/npm/v/pptx-viewer-mcp)](https://www.npmjs.com/package/pptx-viewer-mcp)                           |
| `@christophervr/pptx-viewer` (CLI)      | [更新日志](/releases/cli)     | [![npm](https://img.shields.io/npm/v/%40christophervr%2Fpptx-viewer)](https://www.npmjs.com/package/@christophervr/pptx-viewer) |

仓库根目录的 [CHANGELOG.md](https://github.com/ChristopherVR/pptx-viewer/blob/main/CHANGELOG.md) 提供跨包的汇总视图，每次发布也会出现在 [GitHub Releases 页面](https://github.com/ChristopherVR/pptx-viewer/releases)。

这些页面由 `docs/sync-changelogs.mjs` 在文档构建前，根据各包的历史 `CHANGELOG.md` 生成。当前 API 用法应在对应包的文档中修改，不要重写历史版本说明来描述今天的实现。`shared`、`locales` 和 `react-compat` 等内部包没有独立对外发布的版本。
