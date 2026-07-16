import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditorController } from './editor';
import type { LoadingController } from './loading-controller';
import { applyPresentationThemePreset } from './presentation-theme-controller';
import { createInitialViewerState, createStore } from './state';

describe('applyPresentationThemePreset', () => {
	it('switches the archive theme and commits the re-resolved slides', async () => {
		const slide: PptxSlide = { id: 's1', rId: 'rId1', slideNumber: 1, elements: [] };
		const store = createStore({ ...createInitialViewerState(), slides: [slide], editable: true });
		const preset = THEME_PRESETS[1];
		const updatedSlide = { ...slide, backgroundColor: preset.colorScheme.accent1 };
		const switchThemePreset = vi.fn(async () => ({
			slides: [updatedSlide],
			width: 960,
			height: 540,
		}));
		const loading = {
			getHandler: () => ({ switchThemePreset }) as unknown as PptxHandler,
		} as LoadingController;
		const commitSlides = vi.fn();
		const editor = { commitSlides } as unknown as EditorController;

		const result = await applyPresentationThemePreset({
			presetId: preset.id,
			loading,
			store,
			editor,
		});

		expect(result).toBeTruthy();
		expect(switchThemePreset).toHaveBeenCalledOnce();
		expect(commitSlides).toHaveBeenCalledWith([updatedSlide], 0);
		expect(store.get().colorScheme).toStrictEqual(preset.colorScheme);
	});
});
