import { PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	editPresentation,
	holdPresentationAsset,
	presentationLoadFixtures,
} from '../../../shared/test-utils/presentation-load.mjs';
import { createLoadingController } from './loading-controller';
import { createInitialViewerState, createStore } from './state';

afterEach(() => vi.restoreAllMocks());

describe('presentation load cancellation after parsing', () => {
	it.each([
		['replace', 'image'],
		['invalidate', 'image'],
		['replace', 'media'],
		['invalidate', 'media'],
	] as const)(
		'discards delayed assets on %s (%s)',
		async (action, asset) => {
			const fixtures = await presentationLoadFixtures(PptxHandler, asset);
			const held = holdPresentationAsset(PptxHandler, asset);
			const store = createStore(createInitialViewerState());
			const applied = vi.fn();
			const loader = createLoadingController({
				options: {},
				store,
				getTranslator: () => (key) => key,
				getEditor: () => undefined,
				onContentApplied: applied,
			});
			const first = loader.load(fixtures.first);
			try {
				await held.entered;
				if (action === 'invalidate') {
					loader.invalidate();
					loader.releaseLoaded();
				} else {
					await loader.load(fixtures.second);
					store.set({ slides: editPresentation(store.get().slides) });
				}
				const currentMedia = [...store.get().mediaDataUrls];
				const currentHandler = loader.getHandler();
				held.release();
				await first;
				if (action === 'replace') {
					expect([...store.get().mediaDataUrls]).toStrictEqual(currentMedia);
					expect(store.get().coreProperties?.title).toBe('Presentation B');
					expect(store.get().slides[0].notes).toBe('Unsaved edit in B');
					expect(loader.getHandler()).toBe(currentHandler);
				}
				expect(applied).toHaveBeenCalledTimes(action === 'replace' ? 1 : 0);
				expect(held.disposal).toHaveBeenCalledOnce();
			} finally {
				held.release();
				loader.releaseLoaded();
			}
		},
		30_000,
	);
});
