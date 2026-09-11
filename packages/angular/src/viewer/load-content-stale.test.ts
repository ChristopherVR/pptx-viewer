import { Injector } from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	editPresentation,
	holdPresentationAsset,
	presentationLoadFixtures,
} from '../../../shared/test-utils/presentation-load.mjs';
import { LoadContentService } from './load-content.service';

afterEach(() => vi.restoreAllMocks());

describe('presentation load cancellation after parsing', () => {
	it.each([
		['replace', 'image'],
		['destroy', 'image'],
		['replace', 'media'],
		['destroy', 'media'],
	] as const)(
		'discards delayed assets on %s (%s)',
		async (action, asset) => {
			const fixtures = await presentationLoadFixtures(PptxHandler, asset);
			const held = holdPresentationAsset(PptxHandler, asset);
			const injector = Injector.create({
				providers: [{ provide: LoadContentService, useClass: LoadContentService }],
			});
			const destroy = () => {
				if (!injector.destroyed) {
					injector.destroy();
				}
			};
			const loader = injector.get(LoadContentService);
			const first = loader.load(fixtures.first);
			try {
				await held.entered;
				if (action === 'destroy') {
					destroy();
				} else {
					await loader.load(fixtures.second);
					loader.slides.set(editPresentation(loader.slides()));
				}
				const currentMedia = [...loader.mediaDataUrls()];
				held.release();
				await first;
				if (action === 'replace') {
					expect([...loader.mediaDataUrls()]).toStrictEqual(currentMedia);
					expect(loader.coreProperties()?.title).toBe('Presentation B');
					expect(loader.slides()[0].notes).toBe('Unsaved edit in B');
					const saved = new PptxHandler();
					try {
						const data = await saved.load((await loader.getContent()).buffer as ArrayBuffer);
						expect(data.slides[0].notes).toBe('Unsaved edit in B');
					} finally {
						saved.dispose();
					}
				} else {
					expect(loader.slides()).toHaveLength(0);
				}
				expect(held.disposal).toHaveBeenCalledOnce();
			} finally {
				held.release();
				destroy();
			}
		},
		30_000,
	);
});
