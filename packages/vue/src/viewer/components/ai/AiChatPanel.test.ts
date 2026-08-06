import { flushPromises, mount } from '@vue/test-utils';
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { afterEach, describe, expect, it } from 'vitest';

import AiChatPanel from './AiChatPanel.vue';

/**
 * AiChatPanel tests: with a no-op `kind: 'transport'` connection (so no network
 * and no model), the panel bootstraps a real session, reaches the ready state,
 * and renders its title, empty-state hint, and composer. This proves the panel
 * "opens" end to end without a live model, and that the close button emits.
 */
function makeBridge(): PptxAiBridge {
	const slides = [{ id: 's1', slideNumber: 1, elements: [] }] as unknown as PptxSlide[];
	return {
		getDeckMeta: () => ({ slideCount: 1, activeSlideIndex: 0, width: 960, height: 540 }),
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: () => {},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
}

/** A transport that never emits: enough to construct a session, never called. */
function stubConfig(): PptxAiConfig {
	const transport = {
		sendMessages: async () => new ReadableStream(),
		reconnectToStream: async () => null,
	};
	return { connection: { kind: 'transport', transport: transport as never } };
}

async function settle(): Promise<void> {
	// Drain the queues a few times so the async availability check (a dynamic
	// `import('ai')` that resolves on a macrotask), the session build, and the
	// `useChat` mount all settle. Both micro- and macro-task ticks are needed.
	for (let i = 0; i < 8; i += 1) {
		await flushPromises();
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
}

let wrapper: ReturnType<typeof mount> | null = null;

afterEach(() => {
	wrapper?.unmount();
	wrapper = null;
});

describe('aiChatPanel', () => {
	it('reaches the ready state and shows the title, composer, and empty hint', async () => {
		wrapper = mount(AiChatPanel, { props: { bridge: makeBridge(), config: stubConfig() } });
		await settle();

		expect(wrapper.text()).toContain('AI Assistant');
		const textarea = wrapper.find('textarea');
		expect(textarea.exists()).toBeTruthy();
		expect(textarea.attributes('placeholder')).toBe('Ask about this deck…');
		expect(wrapper.text()).toContain('Ask the assistant');
	});

	it('renders a Chats button that toggles the saved-chat history menu', async () => {
		wrapper = mount(AiChatPanel, { props: { bridge: makeBridge(), config: stubConfig() } });
		await settle();

		const chatsBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Chats');
		expect(chatsBtn).toBeTruthy();
		expect(wrapper.text()).not.toContain('Saved chats');

		await chatsBtn?.trigger('click');
		expect(wrapper.text()).toContain('Saved chats');
		expect(wrapper.text()).toContain('No saved chats yet.');
		expect(wrapper.text()).toContain('Chats are saved in this browser.');
		const newChat = wrapper.findAll('button').find((b) => b.text().trim() === 'New chat');
		expect(newChat).toBeTruthy();
	});

	it('emits close when the close button is clicked', async () => {
		wrapper = mount(AiChatPanel, { props: { bridge: makeBridge(), config: stubConfig() } });
		await settle();

		const closeBtn = wrapper
			.findAll('button')
			.find((b) => b.attributes('aria-label') === 'Close AI assistant');
		expect(closeBtn).toBeTruthy();
		await closeBtn?.trigger('click');
		expect(wrapper.emitted('close')).toBeTruthy();
	});
});
