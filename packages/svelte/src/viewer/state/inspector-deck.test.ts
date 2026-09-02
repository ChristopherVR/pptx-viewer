import type { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { EditorState } from '../editor/editor-state.svelte';
import { createInspectorDeckActions } from './inspector-deck';
import { PresentationLoader } from './presentation-loader.svelte';

/**
 * Unit tests for the inspector deck-action facade (the Svelte port of Vue's
 * `useInspectorDeckActions`): theme apply routing through the handler +
 * master `themePath` update, canvas-size clamping, and the merge semantics of
 * the presentation- / document-property patches.
 */

function makeEditor(handler: PptxHandler | null = null): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => handler });
	editor.editable = true;
	editor.setSlides(
		[{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [] }],
		[
			{ path: 'ppt/slideMasters/slideMaster1.xml', themePath: 'ppt/theme/theme1.xml' },
			{ path: 'ppt/slideMasters/slideMaster2.xml', themePath: 'ppt/theme/theme1.xml' },
		],
	);
	return editor;
}

interface FakeHandlerCalls {
	setTheme: Array<[string, boolean]>;
	saves: number;
}

function makeFakeHandler(): { handler: PptxHandler; calls: FakeHandlerCalls } {
	const calls: FakeHandlerCalls = { setTheme: [], saves: 0 };
	const fake = {
		setPresentationTheme: (themePath: string, applyToAllMasters = true): Promise<void> => {
			calls.setTheme.push([themePath, applyToAllMasters]);
			return Promise.resolve();
		},
		save: (): Promise<Uint8Array> => {
			calls.saves += 1;
			return Promise.resolve(new Uint8Array([1, 2, 3]));
		},
	};
	return { handler: fake as unknown as PptxHandler, calls };
}

describe('createInspectorDeckActions', () => {
	it('applyThemeByPath routes through the handler and retags only the first master', async () => {
		const { handler, calls } = makeFakeHandler();
		const editor = makeEditor(handler);
		const loader = new PresentationLoader();
		loader.handler = handler;
		const deck = createInspectorDeckActions({ loader, editor });

		deck.applyThemeByPath('ppt/theme/theme2.xml', false);
		await vi.waitFor(() => {
			expect(editor.slideMasters[0]?.themePath).toBe('ppt/theme/theme2.xml');
		});

		expect(calls.setTheme).toStrictEqual([['ppt/theme/theme2.xml', false]]);
		expect(editor.slideMasters[1]?.themePath).toBe('ppt/theme/theme1.xml');
		expect(editor.dirty).toBeTruthy();
		// The content refresh re-serialised the deck through the handler.
		await vi.waitFor(() => {
			expect(calls.saves).toBe(1);
		});
	});

	it('applyThemeByPath retags every master when applying to all', async () => {
		const { handler } = makeFakeHandler();
		const editor = makeEditor(handler);
		const loader = new PresentationLoader();
		loader.handler = handler;
		const deck = createInspectorDeckActions({ loader, editor });

		deck.applyThemeByPath('ppt/theme/theme2.xml', true);
		await vi.waitFor(() => {
			expect(editor.slideMasters[1]?.themePath).toBe('ppt/theme/theme2.xml');
		});
		expect(editor.slideMasters[0]?.themePath).toBe('ppt/theme/theme2.xml');
	});

	it('applyThemeByPath is a no-op without a loaded handler', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		const deck = createInspectorDeckActions({ loader, editor });

		deck.applyThemeByPath('ppt/theme/theme2.xml', true);

		expect(editor.slideMasters[0]?.themePath).toBe('ppt/theme/theme1.xml');
		expect(editor.dirty).toBeFalsy();
	});

	it('updateCanvasSize rounds, clamps to >= 1px, and marks the deck dirty', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		const deck = createInspectorDeckActions({ loader, editor });

		deck.updateCanvasSize({ width: 1280.4, height: 0 });

		expect(loader.canvasSize).toStrictEqual({ width: 1280, height: 1 });
		expect(editor.dirty).toBeTruthy();
	});

	it('updateCanvasSize ignores non-finite input', () => {
		const editor = makeEditor();
		const loader = new PresentationLoader();
		const before = loader.canvasSize;
		const deck = createInspectorDeckActions({ loader, editor });

		deck.updateCanvasSize({ width: Number.NaN, height: 540 });

		expect(loader.canvasSize).toBe(before);
		expect(editor.dirty).toBeFalsy();
	});

	it('updatePresentationProperties merges the patch over the current settings', () => {
		const editor = makeEditor();
		const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

		deck.updatePresentationProperties({ loopContinuously: true });
		deck.updatePresentationProperties({ showType: 'kiosk' });

		expect(editor.presentationProperties.loopContinuously).toBeTruthy();
		expect(editor.presentationProperties.showType).toBe('kiosk');
		expect(editor.dirty).toBeTruthy();
	});

	it('core/app/custom property updates merge independently and mark dirty', () => {
		const editor = makeEditor();
		const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

		deck.updateCoreProperties({ title: 'Deck' });
		deck.updateAppProperties({ company: 'Acme' });
		deck.updateCustomProperties([{ name: 'Project', value: 'Apollo', type: 'lpwstr' }]);

		expect(editor.coreProperties?.title).toBe('Deck');
		expect(editor.appProperties?.company).toBe('Acme');
		expect(editor.customProperties).toStrictEqual([
			{ name: 'Project', value: 'Apollo', type: 'lpwstr' },
		]);
		expect(editor.dirty).toBeTruthy();
	});

	/**
	 * The SLIDE BACKGROUND card's template rows: React/Vue/Angular's shortcut
	 * to edit a layout/master's background colour directly from the slide
	 * inspector, without leaving the slide for Master Views. Svelte had no
	 * path to this at all before.
	 */
	describe('setTemplateBackground / getTemplateBackgroundColor', () => {
		it('writes through the handler and mirrors the colour back onto editor.slideMasters', () => {
			const { handler } = makeFakeHandler();
			const setTemplateBackground = vi.fn();
			(
				handler as unknown as { setTemplateBackground: typeof setTemplateBackground }
			).setTemplateBackground = setTemplateBackground;
			const editor = makeEditor(handler);
			const loader = new PresentationLoader();
			loader.handler = handler;
			const deck = createInspectorDeckActions({ loader, editor });

			deck.setTemplateBackground('ppt/slideMasters/slideMaster1.xml', '#ff0000');

			expect(setTemplateBackground).toHaveBeenCalledWith(
				'ppt/slideMasters/slideMaster1.xml',
				'#ff0000',
			);
			expect(editor.slideMasters[0]?.backgroundColor).toBe('#ff0000');
			expect(editor.slideMasters[1]?.backgroundColor).toBeUndefined();
			expect(editor.dirty).toBeTruthy();
		});

		it('does nothing without a loaded handler', () => {
			const editor = makeEditor();
			const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

			deck.setTemplateBackground('ppt/slideMasters/slideMaster1.xml', '#ff0000');

			expect(editor.slideMasters[0]?.backgroundColor).toBeUndefined();
			expect(editor.dirty).toBeFalsy();
		});

		it('reads the colour straight from the handler', () => {
			const { handler } = makeFakeHandler();
			const getTemplateBackgroundColor = vi.fn().mockReturnValue('#123456');
			(
				handler as unknown as { getTemplateBackgroundColor: typeof getTemplateBackgroundColor }
			).getTemplateBackgroundColor = getTemplateBackgroundColor;
			const editor = makeEditor(handler);
			const loader = new PresentationLoader();
			loader.handler = handler;
			const deck = createInspectorDeckActions({ loader, editor });

			expect(deck.getTemplateBackgroundColor('ppt/slideMasters/slideMaster1.xml')).toBe('#123456');
			expect(getTemplateBackgroundColor).toHaveBeenCalledWith('ppt/slideMasters/slideMaster1.xml');
		});

		it('returns undefined without a loaded handler', () => {
			const editor = makeEditor();
			const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

			expect(deck.getTemplateBackgroundColor('ppt/slideMasters/slideMaster1.xml')).toBeUndefined();
		});
	});

	/**
	 * Wave 4 #4: the Maximize/Ensure Fit rescale, applied through
	 * `updateSlideSize`'s optional `rescaleMode` as ONE undo step alongside the
	 * size change.
	 */
	describe('updateSlideSize rescale', () => {
		it('hasContent is false for a deck with no elements on any slide', () => {
			const editor = makeEditor();
			const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

			expect(deck.hasContent).toBeFalsy();
		});

		it('hasContent is true once a slide carries an element', () => {
			const editor = makeEditor();
			editor.setSlides([
				{
					id: 's1',
					rId: 'rId1',
					slideNumber: 1,
					elements: [{ type: 'shape', id: 'el1', x: 0, y: 0, width: 100, height: 100 }],
				},
			]);
			const deck = createInspectorDeckActions({ loader: new PresentationLoader(), editor });

			expect(deck.hasContent).toBeTruthy();
		});

		it('without a rescaleMode, applies the size directly and does not touch element geometry', () => {
			const editor = makeEditor();
			editor.setSlides([
				{
					id: 's1',
					rId: 'rId1',
					slideNumber: 1,
					elements: [{ type: 'shape', id: 'el1', x: 0, y: 0, width: 100, height: 100 }],
				},
			]);
			const loader = new PresentationLoader();
			const deck = createInspectorDeckActions({ loader, editor });

			deck.updateSlideSize({ widthEmu: 6096000, heightEmu: 6858000, type: 'custom' });

			expect(loader.slideSize).toStrictEqual({
				widthEmu: 6096000,
				heightEmu: 6858000,
				type: 'custom',
			});
			expect(editor.slides[0]?.elements[0]?.width).toBe(100);
			expect(editor.canUndo).toBeFalsy();
		});

		it('with rescaleMode "ensureFit", scales element geometry as one undo step alongside the size', () => {
			const editor = makeEditor();
			editor.setSlides([
				{
					id: 's1',
					rId: 'rId1',
					slideNumber: 1,
					elements: [{ type: 'shape', id: 'el1', x: 0, y: 0, width: 100, height: 100 }],
				},
			]);
			const loader = new PresentationLoader();
			// Default canvas is 1280x720px = 12192000x6858000 EMU (widescreen).
			const deck = createInspectorDeckActions({ loader, editor });

			// Half the width, same height: ensureFit scales by the SMALLER ratio (0.5).
			deck.updateSlideSize({ widthEmu: 6096000, heightEmu: 6858000, type: 'custom' }, 'ensureFit');

			expect(loader.slideSize).toStrictEqual({
				widthEmu: 6096000,
				heightEmu: 6858000,
				type: 'custom',
			});
			expect(editor.slides[0]?.elements[0]?.width).toBe(50);
			expect(editor.dirty).toBeTruthy();

			// One undo step: the rescale (content) and the size change land together.
			expect(editor.canUndo).toBeTruthy();
			editor.undo();
			expect(editor.slides[0]?.elements[0]?.width).toBe(100);
		});
	});
});
