import type { PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createInitialViewerState, createStore } from '../state';
import { createDeckActions } from './editor-deck-actions';

function makeSlide(id: string): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

function setup(options: { handler?: PptxHandler | null; editable?: boolean } = {}) {
	const store = createStore({
		...createInitialViewerState(),
		editable: options.editable ?? true,
		slides: [makeSlide('s1')],
		slideMasters: [
			{ path: 'ppt/slideMasters/slideMaster1.xml' },
			{ path: 'ppt/slideMasters/slideMaster2.xml' },
		] as unknown as PptxSlideMaster[],
	});
	const ops = {
		pushHistory: vi.fn(),
		commitChange: vi.fn(() => store.set({ dirty: true })),
		updatePresentationProperties: vi.fn(),
	};
	const actions = createDeckActions({
		store,
		ops,
		getHandler: () => options.handler ?? null,
	});
	return { store, ops, actions };
}

describe('editor deck actions (no-selection inspector)', () => {
	it('updates the canvas size in the store and marks the deck dirty', () => {
		const { store, actions } = setup();
		actions.updateCanvasSize({ width: 1280.4, height: 720.2 });
		expect(store.get().canvasSize).toStrictEqual({ width: 1280, height: 720 });
		expect(store.get().dirty).toBeTruthy();
	});

	it('ignores canvas-size edits when not editable or not finite', () => {
		const { store, actions } = setup({ editable: false });
		const before = store.get().canvasSize;
		actions.updateCanvasSize({ width: 1280, height: 720 });
		expect(store.get().canvasSize).toBe(before);
		expect(store.get().dirty).toBeFalsy();

		const editable = setup();
		editable.actions.updateCanvasSize({ width: Number.NaN, height: 720 });
		expect(editable.store.get().dirty).toBeFalsy();
	});

	it('applies a theme by path to the first master only', async () => {
		const setPresentationTheme = vi.fn().mockResolvedValue(undefined);
		const handler = { setPresentationTheme } as unknown as PptxHandler;
		const { store, actions } = setup({ handler });

		actions.applyThemeByPath('ppt/theme/theme2.xml', false);
		await vi.waitFor(() => expect(store.get().dirty).toBeTruthy());

		expect(setPresentationTheme).toHaveBeenCalledWith('ppt/theme/theme2.xml', false);
		const masters = store.get().slideMasters as unknown as Array<{ themePath?: string }>;
		expect(masters[0].themePath).toBe('ppt/theme/theme2.xml');
		expect(masters[1].themePath).toBeUndefined();
	});

	it('applies a theme by path to all masters', async () => {
		const setPresentationTheme = vi.fn().mockResolvedValue(undefined);
		const handler = { setPresentationTheme } as unknown as PptxHandler;
		const { store, actions } = setup({ handler });

		actions.applyThemeByPath('ppt/theme/theme1.xml', true);
		await vi.waitFor(() => expect(store.get().dirty).toBeTruthy());

		expect(setPresentationTheme).toHaveBeenCalledWith('ppt/theme/theme1.xml', true);
		const masters = store.get().slideMasters as unknown as Array<{ themePath?: string }>;
		expect(masters.every((m) => m.themePath === 'ppt/theme/theme1.xml')).toBeTruthy();
	});

	it('does not apply a theme without a handler or when not editable', () => {
		const { store, actions } = setup({ handler: null });
		actions.applyThemeByPath('ppt/theme/theme1.xml', true);
		expect(store.get().dirty).toBeFalsy();

		const setPresentationTheme = vi.fn().mockResolvedValue(undefined);
		const handler = { setPresentationTheme } as unknown as PptxHandler;
		const locked = setup({ handler, editable: false });
		locked.actions.applyThemeByPath('ppt/theme/theme1.xml', true);
		expect(setPresentationTheme).not.toHaveBeenCalled();
	});

	it('patches the active slide with history (theme override)', () => {
		const { store, ops, actions } = setup();
		actions.updateActiveSlide({ clrMapOverride: { bg1: 'lt1' } });
		expect(ops.pushHistory).toHaveBeenCalledOnce();
		expect(store.get().slides[0].clrMapOverride).toStrictEqual({ bg1: 'lt1' });
		expect(store.get().dirty).toBeTruthy();
	});

	it('merges presentation-setting patches into the current properties', () => {
		const { store, ops, actions } = setup();
		store.set({ presentationProperties: { loopContinuously: true } });
		actions.updatePresentationSettings({ showType: 'kiosk' });
		expect(ops.updatePresentationProperties).toHaveBeenCalledWith({
			loopContinuously: true,
			showType: 'kiosk',
		});
	});

	/**
	 * The SLIDE BACKGROUND card's template rows: React/Vue/Angular's shortcut
	 * to edit a layout/master's background colour directly from the slide
	 * inspector, without leaving the slide for Master Views.
	 */
	describe('setTemplateBackground / getTemplateBackgroundColor', () => {
		it('writes through the handler and mirrors the colour back onto the store', () => {
			const setTemplateBackground = vi.fn();
			const handler = { setTemplateBackground } as unknown as PptxHandler;
			const { store, actions } = setup({ handler });

			actions.setTemplateBackground('ppt/slideMasters/slideMaster1.xml', '#ff0000');

			expect(setTemplateBackground).toHaveBeenCalledWith(
				'ppt/slideMasters/slideMaster1.xml',
				'#ff0000',
			);
			const masters = store.get().slideMasters as unknown as Array<{
				path: string;
				backgroundColor?: string;
			}>;
			expect(masters[0].backgroundColor).toBe('#ff0000');
			expect(masters[1].backgroundColor).toBeUndefined();
			expect(store.get().dirty).toBeTruthy();
		});

		it('does nothing without a handler or while not editable', () => {
			const setTemplateBackground = vi.fn();
			const handler = { setTemplateBackground } as unknown as PptxHandler;

			const noHandler = setup();
			noHandler.actions.setTemplateBackground('ppt/slideMasters/slideMaster1.xml', '#ff0000');
			expect(setTemplateBackground).not.toHaveBeenCalled();

			const locked = setup({ handler, editable: false });
			locked.actions.setTemplateBackground('ppt/slideMasters/slideMaster1.xml', '#ff0000');
			expect(setTemplateBackground).not.toHaveBeenCalled();
		});

		it('reads the colour straight from the handler', () => {
			const getTemplateBackgroundColor = vi.fn().mockReturnValue('#123456');
			const handler = { getTemplateBackgroundColor } as unknown as PptxHandler;
			const { actions } = setup({ handler });

			expect(actions.getTemplateBackgroundColor('ppt/slideMasters/slideMaster1.xml')).toBe(
				'#123456',
			);
			expect(getTemplateBackgroundColor).toHaveBeenCalledWith('ppt/slideMasters/slideMaster1.xml');
		});

		it('returns undefined without a handler', () => {
			const { actions } = setup();
			expect(
				actions.getTemplateBackgroundColor('ppt/slideMasters/slideMaster1.xml'),
			).toBeUndefined();
		});
	});
});
