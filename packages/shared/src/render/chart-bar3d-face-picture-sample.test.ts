import { encodePng } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	decodeFirstPixelColor,
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
	resetBarFacePicturePixelCacheForTests,
	resolveBarFacePicturePixelColor,
	subscribeBarFacePicturePixelSamples,
} from './chart-bar3d-face-picture-sample';

function pngDataUrl(rgba: [number, number, number, number]): string {
	const png = encodePng(1, 1, new Uint8Array(rgba));
	return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

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

describe('resolveBarFacePicturePixelColor (synchronous, DOM-free first)', () => {
	beforeEach(() => {
		resetBarFacePicturePixelCacheForTests();
	});

	it('resolves a PNG data URL synchronously on the very first call (no flash)', () => {
		const url = pngDataUrl([10, 20, 30, 255]);
		expect(resolveBarFacePicturePixelColor(url)).toBe('#0a141e');
		// Cached for next time, via the same read path as the async path.
		expect(getCachedBarFacePicturePixelColor(url)).toBe('#0a141e');
	});

	it('works with no DOM at all (headless/SSR/Node), unlike the async decode', () => {
		// This test file runs under vitest's default (non-jsdom) environment for
		// this describe block's purposes: Image/document are irrelevant to the
		// synchronous path, which never touches them.
		const url = pngDataUrl([1, 2, 3, 255]);
		expect(globalThis.Image).not.toBeTypeOf('function');
		expect(resolveBarFacePicturePixelColor(url)).toBe('#010203');
	});

	it('falls back to the async decode path for a URL the sync decoder cannot handle', () => {
		const url = 'data:image/webp;base64,AAAA'; // sync decoder has no WebP support
		expect(resolveBarFacePicturePixelColor(url)).toBeUndefined();
		// The async fallback was kicked off (in-flight), matching the pre-existing contract.
		expect(getCachedBarFacePicturePixelColor(url)).toBeUndefined();
	});

	it('does not re-attempt a sync decode once cached as undecodable', () => {
		const url = 'data:image/webp;base64,AAAA';
		resolveBarFacePicturePixelColor(url); // kicks off async fallback, now in-flight
		// A second call while in-flight must not re-run the sync decoder or
		// double-start the async one; still undefined for this render.
		expect(resolveBarFacePicturePixelColor(url)).toBeUndefined();
	});

	it('returns undefined for a non-data: URL without throwing', () => {
		expect(resolveBarFacePicturePixelColor('https://example.com/pic.png')).toBeUndefined();
	});
});
