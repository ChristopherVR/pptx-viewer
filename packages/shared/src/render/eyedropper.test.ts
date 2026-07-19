import { describe, expect, it } from 'vitest';

import { eyedropperAvailable, openNativeEyeDropper } from './eyedropper';

// These run in a node environment (no window / native EyeDropper), covering the
// SSR / headless guards. The DOM sampling path (sampleColorFromSlide,
// pickColorByClickFallback) needs a live DOM and is exercised by the binding
// tests that run under jsdom.
describe('eyedropper', () => {
	it('reports the native API as unavailable without a window', () => {
		if (typeof window === 'undefined') {
			expect(eyedropperAvailable()).toBeFalsy();
		} else {
			expect(eyedropperAvailable()).toBeTypeOf('boolean');
		}
	});

	it('openNativeEyeDropper resolves null when the API is absent', async () => {
		if (typeof window === 'undefined' || !('EyeDropper' in window)) {
			await expect(openNativeEyeDropper()).resolves.toBeNull();
		}
	});
});
