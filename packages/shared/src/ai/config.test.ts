import * as aiSdk from 'ai';
import type { ChatTransport, LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';

import type { PptxAiUIMessage } from './config';
import { resolveChatTransport } from './config';
import type { AiSdkModule } from './loader';

const sdk = aiSdk as unknown as AiSdkModule;

describe('resolveChatTransport', () => {
	it('builds a DefaultChatTransport for an endpoint connection', () => {
		const transport = resolveChatTransport({
			sdk,
			connection: { kind: 'endpoint', api: '/api/chat', headers: { 'x-test': '1' } },
		});
		expect(transport).toBeInstanceOf(sdk.DefaultChatTransport);
	});

	it('builds a DirectChatTransport for a model connection', () => {
		const transport = resolveChatTransport({
			sdk,
			connection: { kind: 'model', model: {} as LanguageModel, maxSteps: 8 },
			toolsWithExecute: {},
			system: 'be helpful',
		});
		expect(transport).toBeInstanceOf(sdk.DirectChatTransport);
	});

	it('passes a preconstructed transport through unchanged', () => {
		const stub = {
			async sendMessages() {
				return new ReadableStream();
			},
			async reconnectToStream() {
				return null;
			},
		} as unknown as ChatTransport<PptxAiUIMessage>;
		const transport = resolveChatTransport({
			sdk,
			connection: { kind: 'transport', transport: stub },
		});
		expect(transport).toBe(stub);
	});
});
