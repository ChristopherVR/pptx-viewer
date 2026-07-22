import type { LanguageModel } from 'ai';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { describe, expect, it } from 'vitest';

import type { PptxAiConfig } from './config';
import { makeMockBridge } from './mock-bridge';
import { createAiChatSession } from './session';
import { createVanillaChat } from './vanilla-chat';

/**
 * Regression test for the model-mode double-staging bug.
 *
 * A `kind: 'model'` connection wires an in-process `ToolLoopAgent` whose tools
 * carry `execute`, so the agent runs the whole tool loop locally and stages
 * proposals itself. The binding must therefore NOT also execute tools from its
 * `onToolCall`; doing so staged every proposal TWICE (one from the agent, one
 * from the client). This proves a single tool call now stages EXACTLY one
 * proposal, and that the client-side loop stays enabled for other connections.
 */

/** A stub model whose first turn calls `update_element` once, then replies. */
function stubModel(): LanguageModel {
	let call = 0;
	return new MockLanguageModelV4({
		doStream: async () => {
			call += 1;
			if (call === 1) {
				return {
					stream: simulateReadableStream({
						chunks: [
							{ type: 'stream-start', warnings: [] },
							{
								type: 'tool-call',
								toolCallId: 'call-1',
								toolName: 'update_element',
								input: JSON.stringify({
									slideIndex: 0,
									elementId: 'el-1',
									text: 'Renamed by model',
								}),
							},
							{
								type: 'finish',
								finishReason: 'tool-calls',
								usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
							},
						],
					}),
				};
			}
			return {
				stream: simulateReadableStream({
					chunks: [
						{ type: 'stream-start', warnings: [] },
						{ type: 'text-start', id: 't' },
						{ type: 'text-delta', id: 't', delta: 'Staged a title edit.' },
						{ type: 'text-end', id: 't' },
						{
							type: 'finish',
							finishReason: 'stop',
							usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
						},
					],
				}),
			};
		},
	}) as unknown as LanguageModel;
}

async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

describe('model-mode tool execution (double-staging regression)', () => {
	it('model connections do not ask the client to execute tools', async () => {
		const session = await createAiChatSession(makeMockBridge(), {
			connection: { kind: 'model', model: stubModel() },
		} satisfies PptxAiConfig);
		expect(session.clientExecutesTools).toBeFalsy();
	});

	it('endpoint/transport connections keep the client-side tool loop', async () => {
		const session = await createAiChatSession(makeMockBridge(), {
			connection: { kind: 'endpoint', api: '/api/ai' },
		} satisfies PptxAiConfig);
		expect(session.clientExecutesTools).toBeTruthy();
	});

	it('a single model tool call stages exactly one proposal', async () => {
		const controller = await createVanillaChat({
			bridge: makeMockBridge(),
			config: { connection: { kind: 'model', model: stubModel() }, writePolicy: 'stage' },
		});

		await controller.sendMessage('Rename the first title');
		await waitFor(() => controller.proposals.size > 0);
		// Let any erroneous second staging settle before asserting.
		await new Promise((resolve) => {
			setTimeout(resolve, 30);
		});

		expect(controller.proposals.size).toBe(1);
	});
});
