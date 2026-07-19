import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AiChatPanel from './AiChatPanel.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** A minimal bridge; no method is exercised by the panel-shell assertions. */
function fakeBridge(): PptxAiBridge {
	return {
		getDeckMeta: () => ({ slideCount: 1, activeSlideIndex: 0, width: 960, height: 540 }),
		getSlides: () => [],
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => undefined,
		selectElements: () => undefined,
		applySlidesUpdate: () => undefined,
		updateElement: () => undefined,
		applyTheme: () => undefined,
	};
}

// A `kind: 'transport'` connection with an inert transport keeps session
// bootstrap fully offline (no model, no network) for the shell assertions.
const config: PptxAiConfig = {
	connection: { kind: 'transport', transport: {} as never },
};

describe('aiChatPanel', () => {
	it('renders the panel shell (assistant title + close control) on open', () => {
		const target = document.createElement('div');
		const instance = mount(AiChatPanel, {
			target,
			props: { bridge: fakeBridge(), config, onclose: vi.fn() },
		});
		cleanup = () => unmount(instance);

		expect(target.querySelector('[data-pptx-ai-panel]')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-ai-title')?.textContent).toBe('AI Assistant');
		expect(target.querySelector('[aria-label="Close AI assistant"]')).not.toBeNull();
	});

	it('invokes onclose when the close button is clicked', () => {
		const onclose = vi.fn();
		const target = document.createElement('div');
		const instance = mount(AiChatPanel, {
			target,
			props: { bridge: fakeBridge(), config, onclose },
		});
		cleanup = () => unmount(instance);

		target.querySelector<HTMLButtonElement>('[aria-label="Close AI assistant"]')?.click();
		expect(onclose).toHaveBeenCalledOnce();
	});
});
