import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { PptxSlide, TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { PptxAiUIMessage } from './config';
import { makeMockBridge, makeSlide } from './mock-bridge';
import type { VanillaChatController } from './vanilla-chat';
import { createVanillaChat } from './vanilla-chat';

/**
 * OPT-IN live-model test proving a REAL model (gpt-4o-mini via the local proxy)
 * uses the first-class `merge_tables` tool when asked to merge two tables, and
 * that the resulting write is staged as a proposal.
 *
 * Gated behind BOTH `PPTX_AI_LIVE` and `PPTX_AI_LIVE_WRITE` so a normal
 * `bun run test` never needs a token / network, and so it only runs alongside
 * the other opt-in write case. It makes a single live turn (the proxy is
 * rate-limited), and asserts tool invocation + a staged proposal, never exact
 * model wording.
 *
 * ```bash
 * PPTX_AI_LIVE=1 PPTX_AI_LIVE_WRITE=1 \
 *   bun run --filter pptx-viewer-shared test src/ai/ai-live-merge.test.ts
 * ```
 */

const LIVE = Boolean(process.env.PPTX_AI_LIVE);
const LIVE_WRITE = Boolean(process.env.PPTX_AI_LIVE_WRITE);
const BASE_URL = process.env.PPTX_AI_BASE_URL ?? 'http://localhost:8787/v1';
const MODEL_ID = process.env.PPTX_AI_MODEL ?? 'openai/gpt-4o-mini';
const API_KEY = process.env.PPTX_AI_KEY ?? 'x';

/** Build a table element with a cell-text grid. */
function table(id: string, grid: string[][], y: number): TablePptxElement {
	const cols = grid[0].length;
	return {
		id,
		type: 'table',
		x: 40,
		y,
		width: 400,
		height: 120,
		tableData: {
			rows: grid.map((cells) => ({ cells: cells.map((text) => ({ text })) })),
			columnWidths: Array.from({ length: cols }, () => 1 / cols),
		},
	} as unknown as TablePptxElement;
}

/** A live controller over a deck whose slide 1 holds two mergeable tables. */
function makeMergeController(): Promise<VanillaChatController> {
	const model = createOpenAICompatible({
		name: 'live',
		baseURL: BASE_URL,
		apiKey: API_KEY,
	}).chatModel(MODEL_ID) as unknown as LanguageModel;

	const slide: PptxSlide = makeSlide(0, [
		table(
			'tbl-north',
			[
				['Region', 'Q1'],
				['North', '100'],
			],
			40,
		),
		table(
			'tbl-south',
			[
				['Region', 'Q1'],
				['South', '250'],
			],
			200,
		),
	] as unknown as PptxSlide['elements']);

	return createVanillaChat({
		bridge: makeMockBridge({ slides: [slide] }),
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

describe.skipIf(!LIVE || !LIVE_WRITE)('ai live merge_tables (gpt-4o-mini)', () => {
	it('the model calls merge_tables and stages a merged-table proposal', async () => {
		const controller = await makeMergeController();
		await controller.sendMessage(
			'Merge the two tables on slide 1 into one combined table. Go ahead and stage the ' +
				'merge now using your tools; no need to ask me to confirm first.',
		);
		// The client-side tool loop runs multiple steps (read then merge); wait on
		// the proposal itself, not on a transient inter-step `ready` status.
		await waitFor(() => {
			const status = controller.getSnapshot().status;
			return controller.proposals.size > 0 || status === 'error';
		}, 90_000).catch(() => undefined);
		await waitFor(() => {
			const status = controller.getSnapshot().status;
			return status === 'ready' || status === 'error';
		}, 90_000);

		const { status, error } = controller.getSnapshot();
		if (status === 'error') {
			throw new Error(`Live merge turn failed: ${error?.message ?? 'unknown error'}`);
		}

		const { messages } = controller.getSnapshot();
		expect(invokedToolNames(messages)).toContain('merge_tables');

		const proposals = controller.proposals.list();
		expect(proposals.length).toBeGreaterThan(0);
		expect(proposals[0].summary.length).toBeGreaterThan(0);
	}, 100_000);
});
