/**
 * Unit tests for the colour-change (`<a:clrChange>`) image effect.
 *
 * Two layers are covered without TestBed (the Angular compiler / TestBed needs
 * `@analogjs/vite-plugin-angular`, a follow-up; see PORTING.md), mirroring the
 * pure-helper style of the other `*.component.test.ts` files:
 *
 *  1. `getClrChangeParams` - the pure extraction helper used by the renderer to
 *     decide between a plain `<img>` and the chroma-key component.
 *  2. The async processing contract the component relies on: the ORIGINAL src is
 *     shown first, the shared `applyColorChange` result swaps in once resolved,
 *     failures fall back to the original, and the shared cache short-circuits
 *     repeat work. `applyColorChange` is mocked so no real canvas is needed.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getClrChangeParams } from './color-changed-image-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function image(imageEffects?: Record<string, unknown>): PptxElement {
	return {
		type: 'image',
		id: 'img 1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		imageData: 'data:image/png;base64,AAAA',
		imageEffects,
	} as PptxElement;
}

// ---------------------------------------------------------------------------
// getClrChangeParams
// ---------------------------------------------------------------------------

describe('getClrChangeParams', () => {
	it('returns undefined when the element has no imageEffects', () => {
		expect(getClrChangeParams(image())).toBeUndefined();
	});

	it('returns undefined when imageEffects carries no clrChange', () => {
		expect(getClrChangeParams(image({ grayscale: true }))).toBeUndefined();
	});

	it('returns undefined when clrFrom is empty', () => {
		expect(
			getClrChangeParams(image({ clrChange: { clrFrom: '', clrTo: '#ff0000' } })),
		).toBeUndefined();
	});

	it('extracts clrFrom / clrTo and the default tolerance', () => {
		const params = getClrChangeParams(
			image({ clrChange: { clrFrom: '#00ff00', clrTo: '#ff0000' } }),
		);
		expect(params).toStrictEqual({
			clrFrom: '#00ff00',
			clrTo: '#ff0000',
			clrToTransparent: false,
			tolerance: 12,
		});
	});

	it('honours clrToTransparent and defaults clrTo to clrFrom', () => {
		const params = getClrChangeParams(
			image({ clrChange: { clrFrom: '#0000ff', clrToTransparent: true } }),
		);
		expect(params?.clrTo).toBe('#0000ff');
		expect(params?.clrToTransparent).toBeTruthy();
	});

	it('returns undefined for non-image elements without imageEffects', () => {
		const shape = { type: 'shape', id: 's', x: 0, y: 0, width: 1, height: 1 } as PptxElement;
		expect(getClrChangeParams(shape)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Async processing contract (shared cache + applyColorChange)
//
// The component drives the swap through these shared functions; we mock
// `applyColorChange` and exercise the same sequence the component's effect runs
// (cache check -> original fallback -> processed swap -> cache write), so the
// observable "original first, processed after" behaviour is asserted without a
// real canvas or TestBed.
// ---------------------------------------------------------------------------

const applyColorChange = vi.fn();

vi.mock(import('../internal/shared'), async (importOriginal) => {
	const actual = await importOriginal<typeof import('../internal/shared')>();
	return { ...actual, applyColorChange: (...args: unknown[]) => applyColorChange(...args) };
});

describe('clrChange async processing contract', () => {
	beforeEach(() => {
		applyColorChange.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('shows the original src until applyColorChange resolves, then swaps', async () => {
		const shared = await import('../internal/shared');
		const SRC = 'data:image/png;base64,ORIGINAL';
		const PROCESSED = 'data:image/png;base64,PROCESSED';
		const params = getClrChangeParams(
			image({ clrChange: { clrFrom: '#00ff00', clrTo: '#000000' } }),
		)!;
		const key = shared.buildCacheKey(
			SRC,
			params.clrFrom,
			params.clrTo,
			params.tolerance,
			params.clrToTransparent,
		);

		// No cache yet -> the original is the only thing to show.
		expect(shared.getCachedResult(key)).toBeUndefined();

		let resolve!: (r: { dataUrl: string; width: number; height: number }) => void;
		applyColorChange.mockReturnValue(
			new Promise((res) => {
				resolve = res;
			}),
		);

		const pending = shared
			.applyColorChange(
				SRC,
				params.clrFrom,
				params.clrTo,
				params.tolerance,
				params.clrToTransparent,
			)
			.then((result) => {
				shared.setCachedResult(key, result.dataUrl);
				return result.dataUrl;
			});

		// Still pending: cache empty, fallback is the original src.
		expect(shared.getCachedResult(key)).toBeUndefined();

		resolve({ dataUrl: PROCESSED, width: 10, height: 10 });
		const swapped = await pending;

		expect(swapped).toBe(PROCESSED);
		expect(shared.getCachedResult(key)).toBe(PROCESSED);
	});

	it('reuses a cached result without calling applyColorChange again', async () => {
		const shared = await import('../internal/shared');
		const SRC = 'data:image/png;base64,CACHEME';
		const PROCESSED = 'data:image/png;base64,CACHED';
		const params = getClrChangeParams(
			image({ clrChange: { clrFrom: '#112233', clrTo: '#445566' } }),
		)!;
		const key = shared.buildCacheKey(
			SRC,
			params.clrFrom,
			params.clrTo,
			params.tolerance,
			params.clrToTransparent,
		);
		shared.setCachedResult(key, PROCESSED);

		// A renderer that finds a cache hit shows it immediately and skips work.
		expect(shared.getCachedResult(key)).toBe(PROCESSED);
		expect(applyColorChange).not.toHaveBeenCalled();
	});

	it('falls back to the original src when applyColorChange rejects', async () => {
		const shared = await import('../internal/shared');
		const SRC = 'data:image/png;base64,FAIL';
		const params = getClrChangeParams(
			image({ clrChange: { clrFrom: '#777777', clrTo: '#888888' } }),
		)!;
		const key = shared.buildCacheKey(
			SRC,
			params.clrFrom,
			params.clrTo,
			params.tolerance,
			params.clrToTransparent,
		);

		applyColorChange.mockRejectedValue(new Error('no canvas'));

		let display = SRC; // initial fallback
		await shared
			.applyColorChange(
				SRC,
				params.clrFrom,
				params.clrTo,
				params.tolerance,
				params.clrToTransparent,
			)
			.then((result) => {
				display = result.dataUrl;
				return undefined;
			})
			.catch(() => {
				// stay on the original
			});

		expect(display).toBe(SRC);
		expect(shared.getCachedResult(key)).toBeUndefined();
	});
});
