import type { ChatTransport } from 'ai';
import { describe, expect, it } from 'vitest';

import type { PptxAiUIMessage } from './config';
import { makeMockBridge } from './mock-bridge';
import { createVanillaChat } from './vanilla-chat';
import type { VanillaChatSnapshot } from './vanilla-chat';

/** A transport that streams a single fixed assistant text response. */
function stubTransport(text: string): ChatTransport<PptxAiUIMessage> {
	const chunks = [
		{ type: 'start' },
		{ type: 'start-step' },
		{ type: 'text-start', id: '0' },
		{ type: 'text-delta', id: '0', delta: text },
		{ type: 'text-end', id: '0' },
		{ type: 'finish-step' },
		{ type: 'finish' },
	];
	return {
		async sendMessages() {
			return new ReadableStream({
				start(controller) {
					for (const chunk of chunks) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
		},
		async reconnectToStream() {
			return null;
		},
	} as unknown as ChatTransport<PptxAiUIMessage>;
}

function assistantText(messages: PptxAiUIMessage[]): string {
	const parts = messages.flatMap((m) => (m.role === 'assistant' ? m.parts : []));
	return parts
		.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
		.map((p) => p.text)
		.join('');
}

describe('createVanillaChat', () => {
	it('starts ready and empty', async () => {
		const controller = await createVanillaChat({
			bridge: makeMockBridge(),
			config: { connection: { kind: 'transport', transport: stubTransport('hi') } },
		});
		const snap = controller.getSnapshot();
		expect(snap.status).toBe('ready');
		expect(snap.messages).toHaveLength(0);
	});

	it('notifies subscribers and completes a send with an assistant reply', async () => {
		const controller = await createVanillaChat({
			bridge: makeMockBridge(),
			config: { connection: { kind: 'transport', transport: stubTransport('Hello there') } },
		});

		const seen: VanillaChatSnapshot[] = [];
		controller.subscribe((snapshot) => seen.push(snapshot));

		await controller.sendMessage('summarise the deck');

		const final = controller.getSnapshot();
		expect(final.status).toBe('ready');
		expect(final.messages.length).toBeGreaterThanOrEqual(2);
		expect(assistantText(final.messages)).toContain('Hello there');
		expect(seen.length).toBeGreaterThan(0);
	});

	it('setMessages replaces the transcript and notifies subscribers', async () => {
		const controller = await createVanillaChat({
			bridge: makeMockBridge(),
			config: { connection: { kind: 'transport', transport: stubTransport('hi') } },
		});
		const seen: VanillaChatSnapshot[] = [];
		controller.subscribe((snapshot) => seen.push(snapshot));

		const transcript: PptxAiUIMessage[] = [
			{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'resumed question' }] },
			{ id: 'm2', role: 'assistant', parts: [{ type: 'text', text: 'resumed answer' }] },
		] as PptxAiUIMessage[];
		controller.setMessages(transcript);

		expect(seen).toHaveLength(1);
		expect(seen[0].messages).toStrictEqual(transcript);
		expect(controller.getSnapshot().messages).toStrictEqual(transcript);

		controller.setMessages([]);
		expect(controller.getSnapshot().messages).toStrictEqual([]);
		expect(seen).toHaveLength(2);
	});
});
