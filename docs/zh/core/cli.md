---
title: 命令行工具
description: 使用 pptx-viewer-core 的 pptx 命令执行 info、export-svg、export-md、merge、find、replace、create 和 diff。
---

# 命令行工具 {#cli}

`pptx-viewer-core` 在 `bin` 字段声明 `pptx` 可执行文件，入口为 `packages/core/src/cli/index.ts`。它将常见 PPTX 操作封装为终端命令，无需编写代码。各命令是引擎的薄封装，行为与编程 API 一致。

## 安装与运行 {#install-run}

```bash
# One-off, no install (npx runs the package's single binary)
npx pptx-viewer-core info deck.pptx

# Global install
npm install -g pptx-viewer-core
pptx info deck.pptx

# Bun
bunx pptx-viewer-core info deck.pptx
```

运行 `pptx --help`、`-h` 或不带参数可查看完整用法。未知命令会打印用法并以状态码 1 退出；命令错误会输出 `Error: <message>` 并以 1 退出。

::: warning 不要使用 npx pptx
可执行文件叫 `pptx`，但 npm 包名是 `pptx-viewer-core`。`npx pptx` 会下载另一个无关同名包。请按包名运行，或先全局安装。
:::

## 命令一览 {#command-summary}

| 命令                                  | 用途                       |
| ------------------------------------- | -------------------------- |
| `info <file>`                         | 显示文档元数据和数量统计。 |
| `export-svg <file> [dir]`             | 将各页导出为 SVG。         |
| `export-md <file> [out.md]`           | 导出 Markdown。            |
| `merge <a> <b> -o <out>`              | 合并两份文稿。             |
| `find <file> "text"`                  | 跨幻灯片查找文本。         |
| `replace <file> "old" "new" -o <out>` | 替换文本并保存新文件。     |
| `create -o <out>`                     | 创建空白文稿。             |
| `diff <a> <b>`                        | 比较两份文稿。             |

以下命令与选项对应 `packages/core/src/cli/index.ts` 和 `commands.ts`。

### `info` {#info}

```bash
pptx info deck.pptx
```

始终显示幻灯片数量和像素尺寸，然后输出文件中存在的字段：尺寸类型、标题、作者、主题、主题名称、标题/正文字体、版式数量及名称、节数量及名称、递归统计组合内元素后的总元素数。还会按情况显示隐藏页、含备注页、批注、宏、数字签名、嵌入字体和自定义放映。

### `export-svg` {#export-svg}

```bash
pptx export-svg deck.pptx ./svg-output
pptx export-svg deck.pptx ./svg-output --include-hidden
```

向输出目录写入 `slide_1.svg`、`slide_2.svg` 等文件，每个文件打印一条 `Written:`。目录默认是 `.`，不存在时自动创建。此命令封装 [`SvgExporter.exportAll`](/zh/core/svg-export)。

| 选项               | 作用         |
| ------------------ | ------------ |
| `--include-hidden` | 包含隐藏页。 |

### `export-md` {#export-md}

```bash
pptx export-md deck.pptx deck.md
pptx export-md deck.pptx deck.md --semantic --no-notes
```

转换为 Markdown，输出路径默认将输入扩展名改为 `.md`。它封装 [Markdown 转换器](/zh/core/converter)，设置 `includeMetadata: true`，并将 `sourceName` 设为输入文件主名。

| 选项         | 作用                                     |
| ------------ | ---------------------------------------- |
| `--semantic` | 输出干净的语义 Markdown，而非定位 HTML。 |
| `--no-notes` | 不包含演讲者备注。                       |

::: info 仅输出 Markdown
CLI 没有为转换器接入文件系统适配器，因此**不会提取媒体文件**。Markdown 中的图片引用指向未实际写入的 `media/` 目录。需要磁盘图片时，请编程使用转换器并提供 `FileSystemAdapter`。
:::

### `merge` {#merge}

```bash
pptx merge deck1.pptx deck2.pptx -o combined.pptx
pptx merge deck1.pptx deck2.pptx -o combined.pptx --keep-source-theme --insert-at 2
```

通过 `mergePresentation` 将第二份文稿追加到第一份，写入结果并报告合并页数和总页数。

| 选项                  | 作用                                  |
| --------------------- | ------------------------------------- |
| `-o <output.pptx>`    | 必填，输出文件。                      |
| `--keep-source-theme` | 保留被合并文稿的主题。                |
| `--insert-at <index>` | 从 0 开始的插入位置，默认追加到末尾。 |

### `find` {#find}

```bash
pptx find deck.pptx "quarterly report"
pptx find deck.pptx "Q4" -i
```

默认区分大小写并按子串查找。先打印 `Found N match(es):`，再逐项显示 `Slide <n>, Element <id>: "text"`；没有结果时显示 `No matches found for "..."`。

| 选项 | 作用         |
| ---- | ------------ |
| `-i` | 忽略大小写。 |

### `replace` {#replace}

```bash
pptx replace deck.pptx "2025" "2026" -o updated.pptx
pptx replace deck.pptx "draft" "final" -o updated.pptx -i
```

通过 `replaceText` 替换所有匹配内容，经完整保存流程写入，并报告替换次数。

| 选项               | 作用             |
| ------------------ | ---------------- |
| `-o <output.pptx>` | 必填，输出文件。 |
| `-i`               | 忽略大小写。     |

### `create` {#create}

```bash
pptx create -o blank.pptx --title "New Deck"
pptx create -o blank.pptx --title "New Deck" --creator "Sales Team"
```

通过 `PptxHandler.createBlank` 创建只有一张空白标题页的文稿。

| 选项                 | 作用             |
| -------------------- | ---------------- |
| `-o <output.pptx>`   | 必填，输出文件。 |
| `--title "Title"`    | 设置文稿标题。   |
| `--creator "Author"` | 设置作者。       |

底层 `handleCreate` 在编程调用时还支持 `width`、`height` 和包含名称、颜色、字体的完整 `theme` 对象，但 CLI 不提供这些参数。

### `diff` {#diff}

```bash
pptx diff old.pptx new.pptx
```

比较两份文稿并输出：

- 双方幻灯片数量，以及尺寸和主题名称是否一致。
- 各页状态和元素数：`[+]` 新增、`[-]` 删除、`[~]` 修改、`[ ]` 未改变。
- 各页文本差异，以 `- removed text` / `+ added text` 表示删除和新增内容。

元素数、提取文本、背景颜色或版式名称不同，就会将该页判定为修改。

## 编程使用 {#programmatic-use}

命令处理器从 `pptx-viewer-core/cli` 导出，可直接接收原始 `Uint8Array` 并返回类型化结果，无需启动可执行文件：

```ts
import {
	handleInfo, //    (bytes)                          => InfoResult
	handleExportSvg, // (bytes, { slideIndices?, includeHidden? }) => ExportSvgResult
	handleExportMd, //  (bytes, { sourceName?, includeSpeakerNotes?, semanticMode?, slideRange? }) => ExportMdResult
	handleMerge, //   (targetBytes, sourceBytes, MergeOptions?) => MergeResult
	handleFind, //    (bytes, search, { caseSensitive? }) => FindCommandResult
	handleReplace, // (bytes, search, replacement, { caseSensitive? }) => ReplaceResult
	handleCreate, //  ({ title?, creator?, theme?, width?, height? }?) => CreateResult
	handleDiff, //    (bytesA, bytesB)                 => DiffResult
} from 'pptx-viewer-core/cli';

const info = await handleInfo(bytes);
console.log(info.slideCount, info.themeName, info.totalElements);
```

同时导出 `InfoResult`、`ExportSvgResult`、`ExportMdResult`、`MergeResult`、`FindCommandResult`、`ReplaceResult`、`CreateResult`、`DiffResult` 和 `SlideDiffEntry`。生成文件的命令返回 `outputBytes: Uint8Array`；查找结果的 `matches` 是 `FindResult`，包含 `slideIndex`、`elementId`、`segmentIndex`、`text` 和 `matchIndex`。

::: tip caseSensitive 语义
`handleFind` 和 `handleReplace` 默认区分大小写并按子串匹配。传入 `caseSensitive: false`，即 CLI 的 `-i`，会将查找文本转义后用于不区分大小写的正则表达式。
:::

::: warning 导入入口模块会执行命令
`pptx-viewer-core/cli` 是可执行入口，导入时会使用当前进程的 `process.argv` 执行一次 `main()`。空参数或未知参数会打印用法并调用 `process.exit`。只在可接受这种行为的短期脚本中使用；服务器中应从包根入口调用 `PptxHandler`、`SvgExporter`、`PptxMarkdownConverter`、`findText`、`replaceText` 和 `mergePresentation` 等等价引擎 API。
:::
