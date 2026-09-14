# 智能助手 {#ai-assistant}

每个框架组件都提供可选的 AI 聊天面板。用户点击工具栏中的 AI 星光图标后，聊天面板会在组件右侧打开。助手可以阅读演示文稿、回答相关问题，并提出文本、样式、布局、幻灯片和主题的修改建议。默认流程中，用户可以在实际修改前审阅、接受或拒绝建议。

该功能**不绑定模型提供商**，认证也由宿主提供。组件不附带模型或 API 密钥。你可以接入自己的后端路由、浏览器内模型或完全自定义的传输层。未传入 `ai` 配置时，不显示图标，也不加载相关代码和 `ai` SDK。

## 安装 {#installation}

AI 相关包都是**可选同级依赖**。安装 `ai`，并根据 React、Vue 或 Svelte 框架安装对应的 AI SDK UI 包。Angular 和 Vanilla 使用组件内置的不依赖框架的控制器，因此只需要 `ai`。

```bash
# React
bun add ai @ai-sdk/react
# Vue
bun add ai @ai-sdk/vue
# Svelte
bun add ai @ai-sdk/svelte
# Angular / Vanilla
bun add ai
```

还需要为所选模型安装相应的**提供商**包。它由宿主自行选择，不属于预览组件的依赖：

```bash
# Any OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, a proxy, ...)
bun add @ai-sdk/openai-compatible
# or a first-party provider
bun add @ai-sdk/openai
bun add @ai-sdk/anthropic
```

## 启用面板 {#enabling-the-panel}

向组件传入 `ai` 配置。所有框架使用相同的数据结构，只有属性传递语法不同。

```tsx
// React
import { PowerPointViewer, type PptxAiConfig } from 'pptx-react-viewer';

const ai: PptxAiConfig = { connection: { kind: 'endpoint', api: '/api/ai/chat' } };

<PowerPointViewer content={deck} ai={ai} />;
```

```vue
<!-- Vue -->
<PowerPointViewer :content="deck" :ai="ai" />
```

```html
<!-- Angular -->
<pptx-viewer [content]="deck" [ai]="ai" />
```

```svelte
<!-- Svelte -->
<PowerPointViewer source={deck} {ai} />
```

```ts
// Vanilla
import { createPptxViewer } from 'pptx-vanilla-viewer';

createPptxViewer(container, { source: deck, ai });
```

## 连接方式 {#connection-modes}

`connection` 指定助手如何连接模型，共有三种方式。

### `endpoint`（推荐用于生产环境） {#endpoint-recommended-for-production}

将消息发送到自己的后端路由，模型提供商的密钥保留在服务器端，浏览器无法访问。这是更安全的默认选择。

```ts
const ai: PptxAiConfig = {
	connection: {
		kind: 'endpoint',
		api: '/api/ai/chat',
		// Headers and body may be functions, so auth tokens can be resolved per
		// request (for example from an OAuth session that refreshes).
		headers: async () => ({ Authorization: `Bearer ${await getAccessToken()}` }),
		credentials: 'include',
	},
};
```

服务器使用 AI SDK 调用模型，并以**仅包含 schema** 的形式注册演示文稿工具。工具没有 `execute`，因此模型发起的工具调用会流式传回浏览器，在当前演示文稿上执行，再将结果返回模型。密钥始终留在服务器。

```ts
// A backend route (framework-agnostic helpers from the shared package)
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { buildPptxAiTools, buildPptxAiSystemPrompt } from 'pptx-viewer-shared/ai';

export async function POST(request: Request) {
	const { messages } = await request.json();
	const result = streamText({
		model: openai('gpt-4o'),
		system: buildPptxAiSystemPrompt(),
		tools: await buildPptxAiTools(),
		messages,
	});
	return result.toUIMessageStreamResponse();
}
```

### `model`（浏览器端、本地模型或自带密钥） {#model-browser-side-local-bring-your-own-key}

将浏览器中创建的模型实例传给组件。助手直接在当前进程中运行工具循环，无需后端，适合本地模型、开发环境或可信环境。此方式的密钥存在于浏览器中，不适用于不可信的客户端。

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const provider = createOpenAICompatible({
	name: 'local',
	baseURL: 'http://localhost:11434/v1', // e.g. Ollama
	apiKey: 'ignored-for-local',
});

const ai: PptxAiConfig = {
	connection: { kind: 'model', model: provider.chatModel('llama3.1') },
};
```

### `transport`（高级用法） {#transport-advanced}

提供已经构造好的 AI SDK `ChatTransport`，适用于 WebSocket 网关、工作流传输或测试。

```ts
const ai: PptxAiConfig = { connection: { kind: 'transport', transport: myTransport } };
```

## 审阅修改：提出建议与接受建议 {#reviewing-changes-the-propose-accept-flow}

默认的 `writePolicy: 'stage'` 会先**暂存**助手提出的编辑。面板显示建议卡片，包含简短的修改说明以及接受、拒绝和全部接受按钮。接受后，该修改作为单条记录进入组件的编辑历史，可以通过一次 Ctrl+Z 撤销；拒绝则丢弃建议。读取幻灯片、查找文本等只读工具和导航操作会立即执行，不经过暂存。

`writePolicy` 支持以下选项：

| 值                | 行为                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `'stage'`（默认） | 写入先暂存，由用户明确接受或拒绝。                                                       |
| `'approve'`       | 使用 AI SDK 原生的逐次调用审批提示。                                                     |
| `'auto'`          | 立即应用写入，仍然支持撤销。`delete_slides` 等破坏性工具无论采用何种策略，始终需要确认。 |

## 助手可用的工具 {#what-the-assistant-can-do-tools}

助手默认使用一组固定的演示文稿工具。可以通过 `tools.enabled` 白名单或 `tools.disabled` 黑名单缩小范围，也可以通过 `tools.extra` 添加自定义工具。

这些工具共 **55 个**，由 `PptxAiToolName` 类型定义。大部分与 [MCP 服务器](/zh/packages/mcp)使用相同的函数，因此应用内助手与外部智能体使用相同工具名时语义一致。少数工具依赖当前 UI，例如选择、导航和解析后的演示文稿概览，因此只在组件中提供。

- **组件专用读取工具**（6 个）：`get_deck_overview`、`get_slide`、`get_element`、`get_speaker_notes`、`find_text`、`get_theme`
- **组件专用导航和辅助工具**（3 个）：`go_to_slide`、`select_elements`、`merge_tables`
- **其他读取工具**（7 个）：`get_metadata`、`get_layouts`、`find_placeholders`、`get_presentation_properties`、`run_accessibility_check`、`convert_to_markdown`、`export_to_json`
- **元素编辑工具**（13 个）：`add_element`、`update_element`、`delete_elements`、`arrange_elements`、`clone_element`、`set_element_animation`、`group_elements`、`ungroup_elements`、`batch_update_elements`、`update_element_style`、`replace_geometry`、`set_element_lock`、`manage_hyperlinks`
- **文本、表格、图表和 SmartArt 工具**（11 个）：`replace_text`、`manage_comments`、`update_table_cells`、`manage_table_structure`、`create_chart`、`update_chart`、`add_chart_series`、`remove_chart_series`、`update_chart_series_data`、`manage_smart_art`、`apply_template`
- **幻灯片结构工具**（6 个）：`add_slide`、`duplicate_slide`、`delete_slides`、`reorder_slides`、`update_slide_properties`、`set_slide_transition`
- **主题工具**（3 个）：`apply_theme_preset`、`update_theme_colors`、`update_theme_fonts`
- **演示文稿级工具**（6 个）：`set_canvas_size`、`update_metadata`、`manage_sections`、`update_presentation_properties`、`import_from_json`、`apply_layout`

演讲者备注可以通过 `get_speaker_notes` 读取，没有单独的写入工具；助手通过 `update_slide_properties` 修改备注。

```ts
const ai: PptxAiConfig = {
	connection: { kind: 'endpoint', api: '/api/ai/chat' },
	// Read-only assistant: no editing tools.
	tools: {
		enabled: ['get_deck_overview', 'get_slide', 'get_element', 'find_text', 'go_to_slide'],
	},
};
```

## 演示文稿上下文 {#deck-context}

除了模型通过只读工具自行获取的信息，`contextStrategy` 还控制每轮对话主动发送多少演示文稿内容。

| 值                  | 每轮发送的内容                         |
| ------------------- | -------------------------------------- |
| `'outline'`（默认） | 整份演示文稿的精简逐页大纲。           |
| `'current-slide'`   | 仅当前幻灯片，以 Markdown 表示。       |
| `'none'`            | 不主动发送内容，模型完全依赖只读工具。 |

## 其他选项 {#other-options}

```ts
const ai: PptxAiConfig = {
	connection: { kind: 'endpoint', api: '/api/ai/chat' },
	// Appended to the assistant's base instructions (brand voice, guardrails).
	systemPromptExtras: 'Prefer concise edits. Never change the company logo.',
	// Persist and restore a conversation (host-owned storage).
	history: {
		load: (id) => myStore.load(id),
		save: (id, messages) => myStore.save(id, messages),
	},
	onError: (error) => reportToSentry(error),
};
```

## 隐私 {#privacy}

助手运行时，读取的幻灯片文本、结构以及 `contextStrategy` 允许的上下文，会发送给你配置的模型提供商。请根据数据策略选择连接方式和提供商。`endpoint` 模式让密钥和提供商选择保留在自己的基础设施中；`tools.enabled` 和 `contextStrategy: 'none'` 则可以限制助手读取的范围。

## 包体积 {#bundle-size}

AI 代码不会进入关键加载路径。只有传入 `ai` 配置，并且用户首次打开聊天面板时，才会动态导入面板和 `ai` SDK。未配置 AI 的预览器不会下载这些代码。
