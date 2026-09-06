import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	decodeFirstPixelColor,
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	subscribeBarFacePicturePixelSamples,
} from './chart-bar3d-face-picture-sample';

describe('chart-bar3d-face-picture-sample', () => {
	beforeEach(() => {
		resetBarFacePicturePixelCacheForTests();
	});

	it('is uncached before sampling starts', () => {
		expect(getCachedBarFacePicturePixelColor('data:image/png;x')).toBeUndefined();
	});

	it('caches the sampler result keyed by image URL and notifies subscribers', async () => {
		const sampler = vi.fn().mockResolvedValue('#008000');
		const listener = vi.fn();
		const unsubscribe = subscribeBarFacePicturePixelSamples(listener);

		ensureBarFacePicturePixelSampled('data:image/png;a', sampler);
		// Still synchronously uncached: the sampler is async.
		expect(getCachedBarFacePicturePixelColor('data:image/png;a')).toBeUndefined();

		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor('data:image/png;a')).toBe('#008000');
		});
		expect(listener).toHaveBeenCalledOnce();
		unsubscribe();
	});

	it('never re-invokes the sampler for an already-cached or in-flight URL', async () => {
		const sampler = vi.fn().mockResolvedValue('rgb(1, 2, 3)');
		ensureBarFacePicturePixelSampled('data:image/png;b', sampler);
		ensureBarFacePicturePixelSampled('data:image/png;b', sampler); // in-flight: no-op
		await vi.waitFor(() =>
			expect(getCachedBarFacePicturePixelColor('data:image/png;b')).toBeDefined(),
		);
		ensureBarFacePicturePixelSampled('data:image/png;b', sampler); // cached: no-op
		expect(sampler).toHaveBeenCalledOnce();
	});

	it('caches undefined (and does not retry) when the sampler cannot decode the image', async () => {
		const sampler = vi.fn().mockResolvedValue(undefined);
		ensureBarFacePicturePixelSampled('data:image/png;c', sampler);
		await vi.waitFor(() => expect(sampler).toHaveBeenCalledOnce());
		// A subsequent call still sees "cached" (has() is true even for an
		// undefined value), so it must not invoke the sampler again.
		ensureBarFacePicturePixelSampled('data:image/png;c', sampler);
		expect(sampler).toHaveBeenCalledOnce();
		expect(getCachedBarFacePicturePixelColor('data:image/png;c')).toBeUndefined();
	});

	it('caches undefined (rather than throwing) when the sampler rejects', async () => {
		const sampler = vi.fn().mockRejectedValue(new Error('decode failed'));
		ensureBarFacePicturePixelSampled('data:image/png;d', sampler);
		await vi.waitFor(() => {
			expect(getCachedBarFacePicturePixelColor('data:image/png;d')).toBeUndefined();
		});
		expect(sampler).toHaveBeenCalledOnce();
	});

	it('decodeFirstPixelColor resolves to undefined outside a DOM (headless)', async () => {
		await expect(decodeFirstPixelColor('data:image/png;e')).resolves.toBeUndefined();
	});
});
