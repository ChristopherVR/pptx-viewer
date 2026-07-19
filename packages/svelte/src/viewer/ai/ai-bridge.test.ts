import type { PptxHandler, PptxSlide, PptxTheme } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createSvelteAiBridge } from './ai-bridge';
import type { SvelteAiBridgeDeps } from './ai-bridge';

function textSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{
				id: 'e1',
				type: 'text',
				x: 0,
				y: 0,
				width: 100,
				height: 40,
				text: 'Old',
				textSegments: [{ text: 'Old', style: {} }],
			},
		],
	} as unknown as PptxSlide;
}

function makeDeps(overrides: Partial<SvelteAiBridgeDeps> = {}): SvelteAiBridgeDeps & {
	commitSlides: ReturnType<typeof vi.fn>;
} {
	const slides = [textSlide()];
	const commitSlides = vi.fn();
	return {
		getSlides: () => slides,
		getActiveSlideIndex: () => 0,
		getCanvasSize: () => ({ width: 960, height: 540 }),
		getTheme: () => undefined as PptxTheme | undefined,
		getHandler: () => null as PptxHandler | null,
		getFileName: () => undefined,
		goToSlide: vi.fn(),
		selectElements: vi.fn(),
		commitSlides,
		applyTheme: vi.fn(),
		...overrides,
	};
}

describe('createSvelteAiBridge', () => {
	it('routes a slides update through commitSlides as a single entry', () => {
		const deps = makeDeps();
		const bridge = createSvelteAiBridge(deps);

		bridge.applySlidesUpdate((slides) => {
			slides[0].slideNumber = 9;
			return slides;
		}, 'Renumber');

		expect(deps.commitSlides).toHaveBeenCalledOnce();
		const [next, label] = deps.commitSlides.mock.calls[0];
		expect(label).toBe('Renumber');
		expect((next as PptxSlide[])[0].slideNumber).toBe(9);
		// The original array is not mutated (the updater runs on a clone).
		expect(deps.getSlides()[0].slideNumber).toBe(1);
	});

	it('applies element field updates via the shared helper as one commit', () => {
		const deps = makeDeps();
		const bridge = createSvelteAiBridge(deps);

		bridge.updateElement(0, 'e1', { text: 'New', bold: true });

		expect(deps.commitSlides).toHaveBeenCalledOnce();
		const [next] = deps.commitSlides.mock.calls[0];
		const el = (next as PptxSlide[])[0].elements[0] as unknown as {
			text: string;
			textStyle?: { bold?: boolean };
		};
		expect(el.text).toBe('New');
		expect(el.textStyle?.bold).toBeTruthy();
	});

	it('exposes deck metadata and passes the handler through', () => {
		const handler = { id: 'h' } as unknown as PptxHandler;
		const deps = makeDeps({ getHandler: () => handler, getFileName: () => 'Deck.pptx' });
		const bridge = createSvelteAiBridge(deps);

		const meta = bridge.getDeckMeta();
		expect(meta.slideCount).toBe(1);
		expect(meta.title).toBe('Deck.pptx');
		expect(meta.width).toBe(960);
		expect(bridge.getHandler()).toBe(handler);
	});

	it('navigates before selecting elements on another slide', () => {
		const goToSlide = vi.fn();
		const selectElements = vi.fn();
		const bridge = createSvelteAiBridge(makeDeps({ goToSlide, selectElements }));

		bridge.selectElements(2, ['e1']);
		expect(selectElements).toHaveBeenCalledWith(2, ['e1']);
	});
});
