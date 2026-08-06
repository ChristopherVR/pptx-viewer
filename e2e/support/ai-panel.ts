/**
 * Driving the AI assistant panel without a real language model.
 *
 * Every demo wires the assistant the same way: an OpenAI-compatible base URL /
 * API key / model id read from localStorage becomes a `{ kind: 'model' }`
 * connection (`@ai-sdk/openai-compatible`), so the whole agent loop runs in the
 * browser and its only network traffic is `POST <baseURL>/chat/completions` in
 * the OpenAI chat-completions wire format. {@link seedMockAiProvider} points
 * that base URL at a path on the demo's own origin and
 * {@link installMockAiModel} answers it with scripted SSE chunks, so a spec can
 * exercise the full round trip - composer, streaming reply, tool call, staged
 * proposal, Apply - deterministically and offline. Both demo localStorage
 * schemes (React/Vue/Angular one JSON key; Svelte/Vanilla three string keys)
 * are seeded so the specs stay framework-neutral.
 *
 * @module e2e/support/ai-panel
 */
import type { Locator, Page } from '@playwright/test';

/**
 * Base path (on the demo's own origin) the mocked provider is served from, and
 * the route pattern for the one endpoint the in-browser agent loop calls.
 */
export const MOCK_AI_BASE_PATH = '/mock-ai/v1';
export const MOCK_AI_COMPLETIONS_GLOB = `**${MOCK_AI_BASE_PATH}/chat/completions`;

/** Accessible name of the assistant toggle in every binding's toolbar. */
export const AI_TOGGLE_NAME = 'Toggle AI assistant';

/**
 * How long opening the panel may take before we call it missing, and how long
 * the lazily-loaded chat session may take to become ready.
 */
export const PANEL_TIMEOUT_MS = 10_000;
export const SESSION_READY_TIMEOUT_MS = 20_000;

/**
 * The assistant pane: all five bindings emit the shared `data-pptx-ai-panel`
 * marker (Vanilla gained it last), so the neutral attribute is the one and
 * only hook.
 */
export const PANEL_SELECTOR = '[data-pptx-ai-panel]';

/** The neutral marker alone, for the marker-parity assertion. */
export const PANEL_MARKER_SELECTOR = '[data-pptx-ai-panel]';

/**
 * Seed both demo localStorage schemes before any app script runs, pointing the
 * OpenAI-compatible base URL at {@link MOCK_AI_BASE_PATH} on the page's own
 * origin (so no port ever appears in a spec). Call before the first navigation.
 */
export async function seedMockAiProvider(page: Page): Promise<void> {
	await page.addInitScript((basePath: string) => {
		const base = `${location.origin}${basePath}`;
		localStorage.setItem(
			'pptx-demo-ai-config',
			JSON.stringify({ baseURL: base, apiKey: 'mock-key', model: 'mock-model' }),
		);
		localStorage.setItem('demo.ai.baseURL', base);
		localStorage.setItem('demo.ai.apiKey', 'mock-key');
		localStorage.setItem('demo.ai.model', 'mock-model');
	}, MOCK_AI_BASE_PATH);
}

/** A tool invocation the mocked model should emit (`input` becomes the JSON `function.arguments`). */
export interface MockToolCall {
	name: string;
	input: Record<string, unknown>;
}

/**
 * What the mocked model says: `reply` for ordinary turns; when the latest user
 * message matches `toolTrigger`, one `toolCall` turn followed (after the tool
 * result comes back) by `toolFollowUp`.
 */
export interface MockAiScript {
	reply: string;
	toolTrigger?: RegExp;
	toolCall?: MockToolCall;
	toolFollowUp?: string;
}

interface CompletionsRequest {
	stream?: boolean;
	messages?: { role: string; content?: unknown }[];
}

interface WireDelta {
	role?: 'assistant';
	content?: string;
	tool_calls?: {
		index: number;
		id: string;
		type: 'function';
		function: { name: string; arguments: string };
	}[];
}

/** Extract plain text from wire content that may be a string or text parts. */
function textOf(content: unknown): string {
	if (typeof content === 'string') {
		return content;
	}
	const parts = Array.isArray(content) ? (content as { text?: unknown }[]) : [];
	return parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join(' ');
}

/** One SSE data line in the OpenAI chat-completion-chunk shape. */
function chunk(delta: WireDelta, finish: string | null): string {
	const choices = [{ index: 0, delta, finish_reason: finish }];
	return `data: ${JSON.stringify({ id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1_720_000_000, model: 'mock-model', choices })}\n\n`;
}

/** The SSE stream for one model turn: content/tool delta, finish, `[DONE]`. */
function sseTurn(delta: WireDelta, finish: string): string {
	return `${chunk(delta, null)}${chunk({}, finish)}data: [DONE]\n\n`;
}

/** Answer the chat-completions endpoint from the script; returns the request log. */
export async function installMockAiModel(
	page: Page,
	script: MockAiScript,
): Promise<CompletionsRequest[]> {
	const log: CompletionsRequest[] = [];
	await page.route(MOCK_AI_COMPLETIONS_GLOB, async (route) => {
		const body = route.request().postDataJSON() as CompletionsRequest;
		log.push(body);
		const messages = body.messages ?? [];
		const hasToolResult = messages.some((message) => message.role === 'tool');
		const lastUser = [...messages].reverse().find((message) => message.role === 'user');

		let turn: string;
		if (hasToolResult) {
			turn = sseTurn({ role: 'assistant', content: script.toolFollowUp ?? script.reply }, 'stop');
		} else if (script.toolCall && script.toolTrigger?.test(textOf(lastUser?.content))) {
			const call = {
				index: 0,
				id: 'call_mock_1',
				type: 'function' as const,
				function: {
					name: script.toolCall.name,
					arguments: JSON.stringify(script.toolCall.input),
				},
			};
			turn = sseTurn({ role: 'assistant', tool_calls: [call] }, 'tool_calls');
		} else {
			turn = sseTurn({ role: 'assistant', content: script.reply }, 'stop');
		}
		await route.fulfill({
			status: 200,
			headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
			body: turn,
		});
	});
	return log;
}

/** The assistant pane, addressed by the shared neutral marker. */
export function aiPanel(page: Page): Locator {
	return page.locator(PANEL_SELECTOR).first();
}

/** The visible assistant toggle (mobile chrome keeps hidden clones mounted). */
export function aiToggle(page: Page): Locator {
	return page.getByRole('button', { name: AI_TOGGLE_NAME }).filter({ visible: true }).first();
}

/** Bounded visibility probe: true when `locator` appears within `timeoutMs`. */
export async function appears(locator: Locator, timeoutMs: number): Promise<boolean> {
	return locator
		.waitFor({ timeout: timeoutMs })
		.then(() => true)
		.catch(() => false);
}

/** Click the toggle and wait for the pane; `false` (never a throw) when absent. */
export async function openAiPanel(page: Page): Promise<boolean> {
	if (!(await appears(aiToggle(page), PANEL_TIMEOUT_MS))) {
		return false;
	}
	await aiToggle(page).click();
	return appears(aiPanel(page), PANEL_TIMEOUT_MS);
}

/**
 * The message composer, by role and accessible name (every binding's textarea
 * carries the "Ask about this deck" name explicitly).
 */
export function aiComposer(page: Page): Locator {
	return aiPanel(page)
		.getByRole('textbox', { name: /ask about this deck/iu })
		.first();
}

/** The send control inside the pane. */
export function aiSendButton(page: Page): Locator {
	return aiPanel(page)
		.getByRole('button', { name: /^send$/iu })
		.first();
}

/** Wait for the lazily-initialised session, then send one user message. */
export async function sendAiMessage(page: Page, text: string): Promise<void> {
	const composer = aiComposer(page);
	await composer.waitFor({ timeout: SESSION_READY_TIMEOUT_MS });
	await composer.fill(text);
	await aiSendButton(page).click();
}

/** The Apply control of a staged proposal card. */
export function aiApplyButton(page: Page): Locator {
	return aiPanel(page)
		.getByRole('button', { name: /^apply$/iu })
		.first();
}

/**
 * What the pane's chrome offers, compared across bindings by the parity spec:
 * the shared `data-pptx-ai-panel` marker, the "AI Assistant" title, the
 * "Ask about this deck" composer, and the Send / "Close AI assistant" /
 * "Chats" (history) controls.
 */
export interface AiPanelChrome {
	present: boolean;
	neutralMarker: boolean;
	title: boolean;
	composer: boolean;
	send: boolean;
	close: boolean;
	history: boolean;
}

const NO_PANEL: AiPanelChrome = {
	present: false,
	neutralMarker: false,
	title: false,
	composer: false,
	send: false,
	close: false,
	history: false,
};

/** Snapshot the opened pane's chrome. All probes are bounded, never throwing. */
export async function snapshotAiPanelChrome(page: Page): Promise<AiPanelChrome> {
	const panel = aiPanel(page);
	if (!(await appears(panel, PANEL_TIMEOUT_MS))) {
		return NO_PANEL;
	}
	// The session loads its SDK lazily; the composer is the "ready" signal.
	const composer = await appears(aiComposer(page), SESSION_READY_TIMEOUT_MS);
	return {
		present: true,
		composer,
		neutralMarker: (await page.locator(PANEL_MARKER_SELECTOR).count()) > 0,
		title: await appears(panel.getByText('AI Assistant', { exact: true }).first(), 1_000),
		send: await appears(aiSendButton(page), 1_000),
		close: await appears(
			panel.getByRole('button', { name: /close ai assistant/iu }).first(),
			1_000,
		),
		history: await appears(panel.getByRole('button', { name: /^chats$/iu }).first(), 1_000),
	};
}

/**
 * Where the pane sits relative to the viewport (mobile bottom-sheet checks).
 * `bottomOverflowPx` is how far the pane hangs BELOW the viewport bottom: a
 * sheet may legitimately end above the bottom edge (it sits above the mobile
 * bottom toolbar), but content past the bottom edge is unreachable.
 */
export interface AiSheetGeometry {
	present: boolean;
	topFraction: number;
	heightFraction: number;
	bottomOverflowPx: number;
}

/** Measure the opened pane against the viewport (absent-safe: never throws). */
export async function measureAiSheet(page: Page): Promise<AiSheetGeometry> {
	const missing = { present: false, topFraction: 0, heightFraction: 0, bottomOverflowPx: 0 };
	if (!(await appears(aiPanel(page), 1_000))) {
		return missing;
	}
	const box = await aiPanel(page).boundingBox();
	const viewport = page.viewportSize();
	if (!box || !viewport) {
		return missing;
	}
	return {
		present: true,
		topFraction: box.y / viewport.height,
		heightFraction: box.height / viewport.height,
		bottomOverflowPx: Math.max(0, box.y + box.height - viewport.height),
	};
}
