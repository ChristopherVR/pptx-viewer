import { describe, expect, it } from 'vitest';

import type { AiUiMessage } from './ai-message-parts';
import { extractReadyToolCalls } from './ai-message-parts';

/** Build a message carrying one tool part in the given streaming state. */
function toolMessage(
	id: string,
	toolName: string,
	toolCallId: string,
	state: string,
	input: unknown,
): AiUiMessage {
	return {
		id,
		role: 'assistant',
		parts: [{ type: `tool-${toolName}`, toolCallId, state, input } as never],
	} as unknown as AiUiMessage;
}

describe('extractReadyToolCalls', () => {
	it('returns a tool call once its input is available', () => {
		const calls = extractReadyToolCalls([
			toolMessage('m1', 'create_chart', 'c1', 'input-available', { slideIndex: 1 }),
		]);
		expect(calls).toStrictEqual([
			{ toolName: 'create_chart', toolCallId: 'c1', input: { slideIndex: 1 } },
		]);
	});

	it('accepts output-available and output-error states (input still present)', () => {
		const calls = extractReadyToolCalls([
			toolMessage('m1', 'get_slide', 'c1', 'output-available', { slideIndex: 2 }),
			toolMessage('m2', 'update_element', 'c2', 'output-error', { slideIndex: 0, elementId: 'x' }),
		]);
		expect(calls.map((c) => c.toolCallId)).toStrictEqual(['c1', 'c2']);
	});

	it('skips calls whose input is still streaming', () => {
		expect(
			extractReadyToolCalls([
				toolMessage('m1', 'create_chart', 'c1', 'input-streaming', undefined),
			]),
		).toStrictEqual([]);
	});

	it('skips parts without a stable tool-call id', () => {
		expect(
			extractReadyToolCalls([toolMessage('m1', 'create_chart', '', 'input-available', { s: 1 })]),
		).toStrictEqual([]);
	});

	it('preserves stream order across messages (latest is last)', () => {
		const calls = extractReadyToolCalls([
			toolMessage('m1', 'get_slide', 'c1', 'output-available', { slideIndex: 0 }),
			toolMessage('m2', 'manage_smart_art', 'c2', 'input-available', { slideIndex: 4 }),
		]);
		expect(calls.map((c) => c.toolCallId)).toStrictEqual(['c1', 'c2']);
		expect(calls.at(-1)?.toolName).toBe('manage_smart_art');
	});

	it('ignores plain text parts', () => {
		const msg = { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] } as unknown;
		expect(extractReadyToolCalls([msg as AiUiMessage])).toStrictEqual([]);
	});
});
