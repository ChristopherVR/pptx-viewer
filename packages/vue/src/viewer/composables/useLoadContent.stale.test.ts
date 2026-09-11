import { PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';

import {
	editPresentation,
	holdPresentationAsset,
	presentationLoadFixtures,
	settlePresentationLoad,
} from '../../../../shared/test-utils/presentation-load.mjs';
import { useLoadContent } from './useLoadContent';

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
			const scope = effectScope();
			const content = ref(fixtures.first);
			const applied = vi.fn();
			const loader = scope.run(() =>
				useLoadContent(() => content.value, { onContentApplied: applied }),
			)!;
			try {
				await held.entered;
				if (action === 'dispose') {
					scope.stop();
				} else {
					content.value = fixtures.second;
					await vi.waitFor(() => expect(loader.coreProperties.value?.title).toBe('Presentation B'));
					loader.slides.value = editPresentation(loader.slides.value);
				}
				const currentMedia = [...loader.mediaDataUrls.value];
				const currentHandler = loader.handler.value;
				held.release();
				await settlePresentationLoad();
				if (action === 'replace') {
					expect([...loader.mediaDataUrls.value]).toStrictEqual(currentMedia);
					expect(loader.coreProperties.value?.title).toBe('Presentation B');
					expect(loader.slides.value[0].notes).toBe('Unsaved edit in B');
					expect(loader.handler.value).toBe(currentHandler);
				}
				expect(applied).toHaveBeenCalledTimes(action === 'replace' ? 1 : 0);
				expect(held.disposal).toHaveBeenCalledOnce();
			} finally {
				held.release();
				scope.stop();
			}
		},
		30_000,
	);
});
