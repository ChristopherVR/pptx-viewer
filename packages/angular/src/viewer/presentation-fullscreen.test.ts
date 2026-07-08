/**
 * Unit tests for the DOM-only Fullscreen API helpers used by
 * `PresentationOverlayComponent`. `happy-dom` (this package's vitest
 * environment) does not implement `requestFullscreen`/`exitFullscreen`, so
 * every scenario mocks them explicitly, including "unsupported browser"
 * (mirrors iOS Safari's partial support) by simply omitting the method.
 */
import { describe, expect, it, vi } from 'vitest';

import {
	exitPresentationFullscreen,
	hasExitedFullscreen,
	requestPresentationFullscreen,
} from './presentation-fullscreen';

// ---------------------------------------------------------------------------
// requestPresentationFullscreen
// ---------------------------------------------------------------------------

describe('requestPresentationFullscreen', () => {
	it('calls requestFullscreen on the element when the API is available', () => {
		const requestFullscreen = vi.fn().mockResolvedValue(undefined);
		const el = { requestFullscreen } as unknown as HTMLElement;

		requestPresentationFullscreen(el);

		expect(requestFullscreen).toHaveBeenCalledOnce();
	});

	it('does nothing when passed a null/undefined element', () => {
		expect(() => requestPresentationFullscreen(null)).not.toThrow();
		expect(() => requestPresentationFullscreen(undefined)).not.toThrow();
	});

	it('does nothing when the element has no requestFullscreen (unsupported browser)', () => {
		const el = {} as HTMLElement;
		expect(() => requestPresentationFullscreen(el)).not.toThrow();
	});

	it('swallows a rejected requestFullscreen promise (denied / no active user gesture)', async () => {
		const requestFullscreen = vi.fn().mockRejectedValue(new Error('denied'));
		const el = { requestFullscreen } as unknown as HTMLElement;

		expect(() => requestPresentationFullscreen(el)).not.toThrow();
		// Let the rejected promise's .catch() microtask flush.
		await Promise.resolve();
		await Promise.resolve();
	});

	it('swallows a synchronous throw from requestFullscreen', () => {
		const requestFullscreen = vi.fn(() => {
			throw new Error('synchronous failure');
		});
		const el = { requestFullscreen } as unknown as HTMLElement;

		expect(() => requestPresentationFullscreen(el)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// exitPresentationFullscreen
// ---------------------------------------------------------------------------

describe('exitPresentationFullscreen', () => {
	it('calls exitFullscreen when the document is currently in fullscreen', () => {
		const exitFullscreen = vi.fn().mockResolvedValue(undefined);
		const doc = {
			fullscreenElement: {} as Element,
			exitFullscreen,
		} as unknown as Document;

		exitPresentationFullscreen(doc);

		expect(exitFullscreen).toHaveBeenCalledOnce();
	});

	it('does nothing when the document is not in fullscreen', () => {
		const exitFullscreen = vi.fn();
		const doc = { fullscreenElement: null, exitFullscreen } as unknown as Document;

		exitPresentationFullscreen(doc);

		expect(exitFullscreen).not.toHaveBeenCalled();
	});

	it('does nothing when passed a null/undefined document', () => {
		expect(() => exitPresentationFullscreen(null)).not.toThrow();
		expect(() => exitPresentationFullscreen(undefined)).not.toThrow();
	});

	it('does nothing when exitFullscreen is unsupported', () => {
		const doc = { fullscreenElement: {} as Element } as unknown as Document;
		expect(() => exitPresentationFullscreen(doc)).not.toThrow();
	});

	it('swallows a rejected exitFullscreen promise', async () => {
		const exitFullscreen = vi.fn().mockRejectedValue(new Error('failed'));
		const doc = { fullscreenElement: {} as Element, exitFullscreen } as unknown as Document;

		expect(() => exitPresentationFullscreen(doc)).not.toThrow();
		await Promise.resolve();
		await Promise.resolve();
	});

	it('swallows a synchronous throw from exitFullscreen', () => {
		const exitFullscreen = vi.fn(() => {
			throw new Error('synchronous failure');
		});
		const doc = { fullscreenElement: {} as Element, exitFullscreen } as unknown as Document;

		expect(() => exitPresentationFullscreen(doc)).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// hasExitedFullscreen
// ---------------------------------------------------------------------------

describe('hasExitedFullscreen', () => {
	it('returns true when there is no fullscreenElement', () => {
		expect(hasExitedFullscreen({ fullscreenElement: null } as unknown as Document)).toBeTruthy();
	});

	it('returns true for a null/undefined document', () => {
		expect(hasExitedFullscreen(null)).toBeTruthy();
		expect(hasExitedFullscreen(undefined)).toBeTruthy();
	});

	it('returns false when a fullscreenElement is present', () => {
		const doc = { fullscreenElement: {} as Element } as unknown as Document;
		expect(hasExitedFullscreen(doc)).toBeFalsy();
	});
});
