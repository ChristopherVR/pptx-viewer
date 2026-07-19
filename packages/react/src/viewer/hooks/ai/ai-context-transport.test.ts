import type { ChatTransport } from 'ai';
import type { PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import { injectDeckContext, withDeckContext } from './ai-context-transport';
import { makeTestBridge } from './test-bridge';

/**
 * Deck context is injected into the LAST user message of the copy handed to the
 * transport, without mutating the caller's messages, and only for a non-empty
 * context.
 */

function userMessage(id: string, text: string): PptxAiUIMessage {
	return { id, role: 'user', parts: [{ type: 'text', text }] } as unknown as PptxAiUIMessage;
}

describe('injectDeckContext', () => {
	it('prepends a context text part to the last user message', () => {
		const messages = [userMessage('u1', 'first'), userMessage('u2', 'fix this')];
		const out = injectDeckContext(messages, 'DECK OUTLINE');

		const lastParts = out[1].parts as { type: string; text: string }[];
		expect(lastParts).toHaveLength(2);
		expect(lastParts[0].text).toContain('DECK OUTLINE');
		expect(lastParts[1].text).toBe('fix this');
	});

	it('does not mutate the original messages', () => {
		const messages = [userMessage('u1', 'hello')];
		injectDeckContext(messages, 'CTX');
		expect(messages[0].parts).toHaveLength(1);
	});

	it('returns the input unchanged when there is no user message', () => {
		const messages = [
			{
				id: 'a',
				role: 'assistant',
				parts: [{ type: 'text', text: 'hi' }],
			} as unknown as PptxAiUIMessage,
		];
		expect(injectDeckContext(messages, 'CTX')).toBe(messages);
	});
});

describe('withDeckContext', () => {
	it('injects the deck outline + focus block into the forwarded messages', async () => {
		let seen: PptxAiUIMessage[] = [];
		const inner: ChatTransport<PptxAiUIMessage> = {
			async sendMessages(options: { messages: PptxAiUIMessage[] }) {
				seen = options.messages;
				return new ReadableStream();
			},
			async reconnectToStream() {
				return null;
			},
		} as unknown as ChatTransport<PptxAiUIMessage>;

		const bridge = makeTestBridge({
			focusedTargets: [{ kind: 'element', slideIndex: 0, elementId: 'el-1' }],
		});
		const wrapped = withDeckContext(inner, bridge, 'outline');

		await wrapped.sendMessages({ messages: [userMessage('u1', 'summarise')] } as never);

		const parts = seen[0].parts as { type: string; text: string }[];
		expect(parts).toHaveLength(2);
		// Outline mentions the deck; focus block names the focused element.
		expect(parts[0].text).toContain('Slide');
		expect(parts[0].text).toContain('el-1');
	});
});
