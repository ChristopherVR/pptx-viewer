# AI Assistant

Every binding ships an optional, opt-in AI chat panel. A user clicks the AI
(sparkles) icon in the toolbar and a chat panel opens on the right side of the
viewer. The assistant can read the deck, answer questions about it, and propose
edits (text, styles, layout, slides, theme) that the user reviews and accepts or
rejects before anything changes.

The feature is **provider-agnostic** and **bring-your-own-auth**: the library
ships no model and no API key. You wire the assistant to a model you control (a
backend route, a browser-side model, or a fully custom transport). If you do not
pass an `ai` config, no icon renders and none of the AI code (or the `ai` SDK)
is loaded, so there is zero cost when the feature is unused.

## Installation

The AI packages are **optional peer dependencies**. Install `ai` plus, for
React / Vue / Svelte, that framework's AI SDK UI package. Angular and Vanilla
use the framework-agnostic controller bundled in the viewer, so they only need
`ai`.

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

You also install one **provider** package for whichever model you use. This is
never a dependency of the viewer; it is your choice:

```bash
# Any OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, a proxy, ...)
bun add @ai-sdk/openai-compatible
# or a first-party provider
bun add @ai-sdk/openai
bun add @ai-sdk/anthropic
```

## Enabling the panel

Pass an `ai` config to the viewer. The shape is identical across every binding;
only the host-syntax for passing a prop differs.

```tsx
// React
import { PowerPointViewer, type PptxAiConfig } from 'pptx-react-viewer';

const ai: PptxAiConfig = { connection: { kind: 'endpoint', api: '/api/ai/chat' } };

<PowerPointViewer src={deck} ai={ai} />;
```

```vue
<!-- Vue -->
<PowerPointViewer :src="deck" :ai="ai" />
```

```html
<!-- Angular -->
<pptx-power-point-viewer [src]="deck" [ai]="ai" />
```

```svelte
<!-- Svelte -->
<PowerPointViewer {src} {ai} />
```

```ts
// Vanilla
new PptxViewer(container, { src: deck, ai });
```

## Connection modes

`connection` declares how the assistant reaches a model. There are three kinds.

### `endpoint` (recommended for production)

Post messages to a route on your own backend. The provider key stays
server-side; the browser never sees it. This is the safest default.

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

On the server, run the model with the AI SDK and expose the deck tools as
**schema-only** tools. Because the tools carry no `execute`, the model's tool
calls are streamed back to the browser and run against the live deck there, then
the results stream back to the model. Your key never leaves the server.

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

### `model` (browser-side / local / bring-your-own key)

Hand the viewer a model instance you construct in the browser. The assistant
runs the tool loop in-process, with no backend. Use this for local models, dev
setups, or trusted environments. Note the key is present in the browser, so this
is not appropriate for untrusted clients.

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

### `transport` (advanced)

Provide a fully-constructed AI SDK `ChatTransport`. Use this for a WebSocket
gateway, a workflow transport, or tests.

```ts
const ai: PptxAiConfig = { connection: { kind: 'transport', transport: myTransport } };
```

## Reviewing changes: the propose / accept flow

By default (`writePolicy: 'stage'`) every edit the assistant makes is **staged**,
not applied. The panel shows a proposal card with a short summary of the change
and Accept / Reject / Accept all buttons. Accepting commits the change through
the viewer's own editor history as a single entry, so one Ctrl+Z reverts an
accepted AI edit. Rejecting discards it. Read tools (reading slides, finding
text) and navigation run immediately and are never staged.

`writePolicy` options:

| Value               | Behavior                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `'stage'` (default) | Writes are staged for explicit accept / reject.                                                                              |
| `'approve'`         | Uses the AI SDK's native per-call approval prompt.                                                                           |
| `'auto'`            | Writes apply immediately (still undoable). Destructive tools such as `delete_slides` always require confirmation regardless. |

## What the assistant can do (tools)

The assistant is given a fixed set of deck tools. You can narrow them with
`tools.enabled` (allowlist) / `tools.disabled` (denylist), or add your own with
`tools.extra`.

- **Read**: `get_deck_overview`, `get_slide`, `get_element`, `get_speaker_notes`,
  `find_text`, `get_theme`
- **Navigate**: `go_to_slide`, `select_elements`
- **Edit elements**: `update_text`, `set_text_style`, `set_shape_style`,
  `move_resize_element`, `add_element`, `delete_elements`, `arrange_elements`,
  `group_elements`, `update_table_cell`, `update_chart_data`, `replace_all`
- **Edit slides**: `add_slide`, `duplicate_slide`, `delete_slides`,
  `reorder_slides`, `set_speaker_notes`, `update_slide_properties`,
  `set_slide_transition`, `set_element_animation`
- **Edit theme**: `apply_theme_preset`, `update_theme_colors`, `update_theme_fonts`

```ts
const ai: PptxAiConfig = {
	connection: { kind: 'endpoint', api: '/api/ai/chat' },
	// Read-only assistant: no editing tools.
	tools: {
		enabled: ['get_deck_overview', 'get_slide', 'get_element', 'find_text', 'go_to_slide'],
	},
};
```

## Deck context

`contextStrategy` controls how much of the deck is sent to the model with each
turn, in addition to what the model fetches itself via the read tools.

| Value                 | Sent each turn                                    |
| --------------------- | ------------------------------------------------- |
| `'outline'` (default) | A compact per-slide outline of the whole deck.    |
| `'current-slide'`     | Only the active slide, as markdown.               |
| `'none'`              | Nothing; the model relies entirely on read tools. |

## Other options

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

## Privacy

When the assistant runs, the deck content it reads (slide text, structure, and
the context you allow via `contextStrategy`) is sent to whichever model provider
you configured. Choose the connection mode and provider that match your data
policy: the `endpoint` mode keeps your key and provider choice on your own
infrastructure, and `tools.enabled` / `contextStrategy: 'none'` let you limit
what the assistant can read.

## Bundle size

None of the AI code ships on the critical path. The chat panel and the `ai` SDK
are dynamically imported only when the user first opens the panel, and only when
you pass an `ai` config at all. A viewer without AI configured downloads zero AI
bytes.
