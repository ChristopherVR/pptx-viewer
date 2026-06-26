import { afterEach, describe, expect, it, vi } from 'vitest';

import { eyedropperAvailable, pickColorByClickFallback, sampleColorFromSlide } from './eyedropper';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('eyedropperAvailable', () => {
	it('is false when the native EyeDropper API is absent (Firefox/Safari/happy-dom)', () => {
		expect('EyeDropper' in window).toBeFalsy();
		expect(eyedropperAvailable()).toBeFalsy();
	});
});

describe('sampleColorFromSlide', () => {
	it('returns null when nothing is under the pointer', () => {
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
		expect(sampleColorFromSlide(10, 10)).toBeNull();
	});

	it('reads the background colour of the element under the pointer', () => {
		const el = document.createElement('div');
		el.style.backgroundColor = 'rgb(68, 114, 196)';
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			backgroundColor: 'rgb(68, 114, 196)',
			fill: 'none',
			color: 'rgb(0, 0, 0)',
		} as unknown as CSSStyleDeclaration);

		const result = sampleColorFromSlide(5, 5);
		expect(result).toStrictEqual({ r: 68, g: 114, b: 196, hex: '#4472c4' });
	});
});

describe('pickColorByClickFallback', () => {
	it('resolves null when the user presses Escape', async () => {
		const promise = pickColorByClickFallback();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		await expect(promise).resolves.toBeNull();
	});

	it('resolves the sampled hex on the next pointer click', async () => {
		const el = document.createElement('div');
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(el);
		vi.spyOn(window, 'getComputedStyle').mockReturnValue({
			backgroundColor: 'rgb(255, 0, 0)',
			fill: 'none',
			color: 'rgb(0, 0, 0)',
		} as unknown as CSSStyleDeclaration);

		const promise = pickColorByClickFallback();
		document.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
		await expect(promise).resolves.toBe('#ff0000');
	});

	it('removes its listeners after resolving (no leak on a second click)', async () => {
		vi.spyOn(document, 'elementFromPoint').mockReturnValue(null);
		const promise = pickColorByClickFallback();
		document.dispatchEvent(new PointerEvent('pointerdown', { clientX: 1, clientY: 1 }));
		await promise;
		// A subsequent Escape must not throw or affect anything (listeners gone).
		expect(() =>
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
		).not.toThrow();
	});
});
