import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';

import type { PptxAiUIMessage } from './config';
import { makeMockBridge } from './mock-bridge';
import type { VanillaChatController } from './vanilla-chat';
import { createVanillaChat } from './vanilla-chat';

/**
 * OPT-IN live-model integration test for the AI assistant, exercising a REAL
 * model (gpt-4o-mini via GitHub Models) end to end through the shared session /
 * controller + tool loop. It is SKIPPED by default so CI and a normal
 * `bun run test` never need a token or network; it runs only when a developer
 * explicitly opts in.
 *
 * ## How to run it live
 *
 * A local OpenAI-compatible proxy must be reachable (it relays to GitHub Models
 * with a real token, so the client can send a dummy key). By default this test
 * targets `http://localhost:8787/v1` and model `openai/gpt-4o-mini`.
 *
 * ```bash
 * # single live call (the READ case only):
 * PPTX_AI_LIVE=1 bun run --filter pptx-viewer-shared test src/ai/ai-live.test.ts
 *
 * # also run the staged-write case (one extra live call):
 * PPTX_AI_LIVE=1 PPTX_AI_LIVE_WRITE=1 \
 *   bun run --filter pptx-viewer-shared test src/ai/ai-live.test.ts
 * ```
 *
 * Env overrides (all optional):
 * - `PPTX_AI_LIVE`       gate: set to any truthy value to enable this suite.
 * - `PPTX_AI_LIVE_WRITE` gate: additionally enable the staged-write case.
 * - `PPTX_AI_BASE_URL`   default `http://localhost:8787/v1`.
 * - `PPTX_AI_MODEL`      default `openai/gpt-4o-mini`.
 * - `PPTX_AI_KEY`        default `x` (the proxy injects the real token).
 *
 * The proxy is rate-limited (GitHub Models free tier: a few requests/min), so
 * the suite is written to make VERY few live calls (one per enabled case) and
 * should be run sparingly. Assertions target tool invocation + structural
 * outcome (a read tool ran, a proposal staged, the slide count is referenced),
 * never exact model wording, so they are robust to model nondeterminism.
 */

const LIVE = Boolean(process.env.PPTX_AI_LIVE);
const LIVE_WRITE = Boolean(process.env.PPTX_AI_LIVE_WRITE);
const BASE_URL = process.env.PPTX_AI_BASE_URL ?? 'http://localhost:8787/v1';
const MODEL_ID = process.env.PPTX_AI_MODEL ?? 'openai/gpt-4o-mini';
const API_KEY = process.env.PPTX_AI_KEY ?? 'x';

// The synthetic mock deck (makeMockBridge) has 2 slides; the model must report
// that count. The assertion below matches the digit or the word "two".

const READ_TOOL_NAMES = [
	'get_deck_overview',
	'get_slide',
	'get_element',
	'get_speaker_notes',
	'find_text',
	'get_theme',
];

/** Build a live gpt-4o-mini controller over a fresh mock bridge. */
function makeLiveController(): Promise<VanillaChatController> {
	const model = createOpenAICompatible({
		name: 'live',
		baseURL: BASE_URL,
		apiKey: API_KEY,
	}).chatModel(MODEL_ID) as unknown as LanguageModel;

	return createVanillaChat({
		bridge: makeMockBridge(),
		config: { connection: { kind: 'model', model }, writePolicy: 'stage' },
	});
}

/** Poll until `predicate` holds or the deadline passes. */
async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 50);
		});
	}
}

/** Wait for the turn to settle (ready or error); surface any transport error. */
async function waitForTurn(controller: VanillaChatController, timeoutMs: number): Promise<void> {
	await waitFor(() => {
		const status = controller.getSnapshot().status;
		return status === 'ready' || status === 'error';
	}, timeoutMs);
	const { status, error } = controller.getSnapshot();
	if (status === 'error') {
		throw new Error(`Live model turn failed: ${error?.message ?? 'unknown error'}`);
	}
}

/** Concatenated text of every assistant message part. */
function assistantText(messages: PptxAiUIMessage[]): string {
	const parts = messages.flatMap((m) => (m.role === 'assistant' ? m.parts : []));
	return parts
		.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
		.map((p) => p.text)
		.join('');
}

/** Names of every tool the assistant invoked (SDK parts are `tool-<name>`). */
function invokedToolNames(messages: PptxAiUIMessage[]): string[] {
	const names: string[] = [];
	for (const message of messages) {
		if (message.role !== 'assistant') {
			continue;
		}
		for (const part of message.parts as { type: string }[]) {
			if (part.type.startsWith('tool-')) {
				names.push(part.type.slice('tool-'.length));
			}
		}
	}
	return names;
}

describe.skipIf(!LIVE)('ai live (gpt-4o-mini)', () => {
	it('read: the model calls a read tool and reports the real slide count', async () => {
		const controller = await makeLiveController();
		await controller.sendMessage('How many slides are in this deck?');
		await waitForTurn(controller, 60_000);

		const { messages } = controller.getSnapshot();
		const tools = invokedToolNames(messages);
		// The model chose at least one read tool (e.g. get_deck_overview / get_slide).
		expect(tools.some((name) => READ_TOOL_NAMES.includes(name))).toBeTruthy();

		// The final answer references the correct count (2). Accept digit or word.
		const text = assistantText(messages).toLowerCase();
		expect(/\b2\b|two/u.test(text)).toBeTruthy();

		// A read must never stage a write.
		expect(controller.proposals.size).toBe(0);
	}, 70_000);

	it.skipIf(!LIVE_WRITE)(
		'staged write: the model calls update_text and stages a proposal',
		async () => {
			const controller = await makeLiveController();
			await controller.sendMessage("Change the title on slide 1 to 'Live Test Title'");
			// The proposal may land before the final text; poll on either signal.
			await waitFor(() => {
				const status = controller.getSnapshot().status;
				return controller.proposals.size > 0 || status === 'error';
			}, 60_000).catch(() => undefined);
			await waitForTurn(controller, 60_000);

			const { messages } = controller.getSnapshot();
			expect(invokedToolNames(messages)).toContain('update_text');

			// Under the 'stage' policy the edit is staged for review, not applied.
			const proposals = controller.proposals.list();
			expect(proposals.length).toBeGreaterThan(0);
			expect(proposals[0].summary.length).toBeGreaterThan(0);
		},
		70_000,
	);
});
