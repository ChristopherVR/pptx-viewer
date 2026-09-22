import { describe, expect, it } from 'vitest';

import { extractReadyToolCalls, toRenderableParts } from './ui-parts';
import type { AiUiMessage } from './ui-parts';

function message(parts: unknown[]): AiUiMessage {
	return { id: 'm1', role: 'assistant', parts } as unknown as AiUiMessage;
}

describe('toRenderableParts', () => {
	it('keeps non-empty text and drops whitespace-only text', () => {
		const out = toRenderableParts(
			message([
				{ type: 'text', text: 'hello' },
				{ type: 'text', text: '   ' },
			]),
		);
		expect(out).toStrictEqual([{ kind: 'text', text: 'hello' }]);
	});

	it('renders a tool part with its name derived from the tool- prefix', () => {
		const out = toRenderableParts(
			message([
				{
					type: 'tool-update_text',
					toolCallId: 'c1',
					state: 'output-available',
					input: { slideIndex: 0 },
					output: { ok: true },
				},
			]),
		);
		expect(out).toStrictEqual([
			{
				kind: 'tool',
				toolName: 'update_text',
				toolCallId: 'c1',
				state: 'output-available',
				input: { slideIndex: 0 },
				output: { ok: true },
				errorText: undefined,
			},
		]);
	});

	it('handles dynamic-tool parts via toolName', () => {
		const out = toRenderableParts(
			message([
				{ type: 'dynamic-tool', toolName: 'custom_op', toolCallId: 'c2', state: 'input-streaming' },
			]),
		);
		expect(out[0]).toMatchObject({ kind: 'tool', toolName: 'custom_op', toolCallId: 'c2' });
	});

	it('ignores unrelated part types', () => {
		expect(
			toRenderableParts(message([{ type: 'step-start' }, { type: 'reasoning', text: 'x' }])),
		).toStrictEqual([]);
	});
});

describe('extractReadyToolCalls', () => {
	it('collects finalized static and dynamic tool calls in order', () => {
		const out = extractReadyToolCalls([
			message([
				{
					type: 'tool-get_slide',
					toolCallId: 'c1',
					state: 'output-available',
					input: { slideIndex: 2 },
				},
				{ type: 'tool-update', toolCallId: 'c2', state: 'input-streaming', input: {} },
				{
					type: 'dynamic-tool',
					toolName: 'custom',
					toolCallId: 'c3',
					state: 'input-available',
					input: { value: 1 },
				},
				{ type: 'tool-missing-id', state: 'input-available', input: {} },
			]),
		]);
		expect(out).toStrictEqual([
			{ toolName: 'get_slide', toolCallId: 'c1', input: { slideIndex: 2 } },
			{ toolName: 'custom', toolCallId: 'c3', input: { value: 1 } },
		]);
	});
});
