---
title: 文档概览
description: 按照你的目标查找 pptx-viewer 文档：接入预览组件、编程处理 .pptx 文件、使用编辑器，或通过智能体实现自动化。
---

# 文档概览 {#documentation-overview}

文档按使用目标组织。你可以先找到对应的章节，再按照建议的顺序阅读。

## 选择你的使用场景 {#choose-a-path}

| 你想要做什么                                     | 从这里开始                                                                                                                                                                                                               | 接下来阅读                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 在 Web 应用中接入 PowerPoint 预览或编辑功能      | 对应框架的接入指南：[React](/zh/react/getting-started)、[Vue 3](/zh/vue/getting-started)、[Angular](/zh/angular/getting-started)、[Svelte 5](/zh/svelte/getting-started)、[原生 JavaScript](/zh/vanilla/getting-started) | 同一章节的组件属性或 API 参考，然后阅读[主题配置](/zh/guide/theming)和[国际化](/zh/guide/localization) |
| 通过代码读取、编辑或生成 `.pptx` 文件            | [核心引擎：加载与解析](/zh/core/loading)和[构建器 API](/zh/core/builder)                                                                                                                                                 | [编程编辑](/zh/core/editing)、[保存文件](/zh/core/saving)、[数据模型](/zh/guide/data-model)            |
| 将演示文稿转换为 Markdown、图片、PDF 或 SVG      | [Markdown 转换器](/zh/core/converter)和[SVG 导出](/zh/core/svg-export)                                                                                                                                                   | 对应框架的导出章节，了解如何在浏览器中导出其他格式                                                     |
| 通过代码隐藏、锁定或重新映射查看器界面的部分内容 | [界面自定义](/guide/customization)（英文）                                                                                                                                                                               | 该页中的示例：展台模式、精简功能区、固定设置                                                           |
| 直接使用编辑器操作幻灯片                         | [使用指南](/zh/user/)                                                                                                                                                                                                    | [编辑幻灯片](/zh/user/editing)、[键盘快捷键](/zh/user/shortcuts)                                       |
| 通过智能体或脚本自动处理演示文稿                 | [MCP 与工具](/zh/packages/mcp)                                                                                                                                                                                           | [核心引擎命令行工具](/zh/core/cli)                                                                     |
| 了解组件库的内部实现                             | [架构说明](/zh/guide/architecture)                                                                                                                                                                                       | [OOXML 支持情况](/zh/architecture/openxml-conformance)、[功能限制](/zh/guide/limitations)              |

## 初次了解这个项目 {#new-to-the-project}

如果你还不确定从哪里开始，可以依次阅读以下三篇文档：

1. [什么是 pptx-viewer](/zh/guide/introduction)：了解各个包及其用途。
2. [安装](/zh/guide/installation)：根据你的技术栈选择需要安装的包。
3. [快速开始](/zh/guide/quick-start)：通过四个完整示例了解公共 API 的用法。

## 各章节介绍 {#sections-at-a-glance}

| 章节                                                                                                                                          | 适合读者                 | 内容                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| **开发指南**（当前章节）                                                                                                                      | 开发者                   | 各个包通用的概念：架构、数据模型、主题、国际化和功能限制 |
| **[核心引擎](/zh/core/)**                                                                                                                     | 开发者                   | 无界面的处理引擎：加载、编辑、构建、保存、转换和加密     |
| **[React](/zh/react/)** / **[Vue](/zh/vue/)** / **[Angular](/zh/angular/)** / **[Svelte](/zh/svelte/)** / **[原生 JavaScript](/zh/vanilla/)** | 开发者                   | 各框架组件的接入指南、属性或 API、主题、导出和协作       |
| **[使用指南](/zh/user/)**                                                                                                                     | 编辑器使用者             | 通过界面查看、编辑、放映、导出和协作，无需编写代码       |
| **[MCP 与工具](/zh/packages/mcp)**                                                                                                            | 智能体和自动化应用开发者 | MCP 服务器、73 个工具以及命令行工具                      |
| **[版本发布](/zh/releases/)**                                                                                                                 | 所有用户                 | 各个包的更新日志                                         |
