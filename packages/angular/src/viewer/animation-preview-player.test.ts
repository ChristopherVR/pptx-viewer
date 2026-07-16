import type { PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { previewAngularAnimation, stopAngularAnimationPreview } from './animation-preview-player';

afterEach(() => {
	stopAngularAnimationPreview();
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('angular animation preview player', () => {
	it('previews the selected canvas element and restores its styles', () => {
		vi.useFakeTimers();
		const target = document.createElement('div');
		target.dataset['elementId'] = 'shape-1';
		target.style.animation = 'original 1s';
		document.body.appendChild(target);
		const animation = {
			elementId: 'shape-1',
			entrance: 'fadeIn',
			durationMs: 250,
		} as PptxElementAnimation;

		expect(previewAngularAnimation(animation)).toBeTruthy();
		expect(target.style.animation).toContain('250ms');
		vi.advanceTimersByTime(350);
		expect(target.style.animation).toBe('original 1s');
	});

	it('does not start without an effect or matching canvas element', () => {
		expect(previewAngularAnimation({ elementId: 'missing' } as PptxElementAnimation)).toBeFalsy();
		expect(
			previewAngularAnimation({ elementId: 'missing', entrance: 'fadeIn' } as PptxElementAnimation),
		).toBeFalsy();
	});
});
