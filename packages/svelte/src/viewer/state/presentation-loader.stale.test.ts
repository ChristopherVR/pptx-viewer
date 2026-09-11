import { PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	editPresentation,
	holdPresentationAsset,
	presentationLoadFixtures,
} from '../../../../shared/test-utils/presentation-load.mjs';
import { PresentationLoader } from './presentation-loader.svelte';

afterEach(() => vi.restoreAllMocks());

describe('presentation load cancellation after parsing', () => {
	it.each([
		['replace', 'image'],
		['dispose', 'image'],
		['replace', 'media'],
		['dispose', 'media'],
	] as const)(
		'discards delayed assets on %s (%s)',
		async (action, asset) => {
			const fixtures = await presentationLoadFixtures(PptxHandler, asset);
			const held = holdPresentationAsset(PptxHandler, asset);
			const loader = new PresentationLoader();
			const first = loader.load(fixtures.first);
			try {
				await held.entered;
				if (action === 'dispose') {
					loader.dispose();
				} else {
					await loader.load(fixtures.second);
					loader.slides = editPresentation(loader.slides);
				}
				const currentMedia = [...loader.mediaDataUrls];
				const currentHandler = loader.handler;
				held.release();
				await first;
				if (action === 'replace') {
					expect([...loader.mediaDataUrls]).toStrictEqual(currentMedia);
					expect(loader.coreProperties?.title).toBe('Presentation B');
					expect(loader.slides[0].notes).toBe('Unsaved edit in B');
					expect(loader.handler).toBe(currentHandler);
				}
				expect(loader.loadCount).toBe(action === 'replace' ? 1 : 0);
				expect(held.disposal).toHaveBeenCalledOnce();
			} finally {
				held.release();
				loader.dispose();
			}
		},
		30_000,
	);
});
