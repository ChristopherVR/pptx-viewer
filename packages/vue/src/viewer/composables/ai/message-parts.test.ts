import type { UIMessage } from 'ai';
import { toolCanvasTarget } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import { extractReadyToolCalls } from './message-parts';

/**
 * message-parts tests: the live "AI as a collaborator" seam. `extractReadyToolCalls`
 * yields each finalized tool call once, in stream order; feeding its name+input to
 * the shared `toolCanvasTarget` yields the slide / element(s) the canvas should
 * navigate to and highlight. In-flight (input-streaming) calls are skipped.
 */
function message(parts: unknown[]): UIMessage {
	return { id: 'm1', role: 'assistant', parts } as unknown as UIMessage;
}

describe('extractReadyToolCalls', () => {
	it('collects finalized tool calls in stream order, skipping in-flight ones', () => {
		const messages = [
			message([
				{
					type: 'tool-get_slide',
					toolCallId: 'c1',
					state: 'output-available',
					input: { slideIndex: 4 },
				},
				{
					type: 'tool-update_element',
					toolCallId: 'c2',
					state: 'input-streaming',
					input: { slideIndex: 1 },
				},
				{
					type: 'tool-update_element_style',
					toolCallId: 'c3',
					state: 'input-available',
					input: { slideIndex: 2, elementId: 'shape-9' },
				},
			]),
		];
		const calls = extractReadyToolCalls(messages);
		expect(calls.map((c) => c.toolCallId)).toStrictEqual(['c1', 'c3']);
		expect(calls[0].toolName).toBe('get_slide');
	});

	it('feeds the shared canvas-target mapping (navigate + highlight)', () => {
		const messages = [
			message([
				{
					type: 'tool-update_element_style',
					toolCallId: 'c1',
					state: 'output-available',
					input: { slideIndex: 2, elementId: 'shape-9' },
				},
			]),
		];
		const [call] = extractReadyToolCalls(messages);
		const target = toolCanvasTarget(call.toolName, call.input);
		expect(target).toStrictEqual({ slideIndex: 2, elementIds: ['shape-9'] });
	});
});
