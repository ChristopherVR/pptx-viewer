import type { PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import { previewVueAnimation, stopVueAnimationPreview } from './animation-preview-player';

/** A stand-in for the rendered element the preview animates on the stage. */
function mountElement(elementId: string): HTMLElement {
	const element = document.createElement('div');
	element.dataset['elementId'] = elementId;
	document.body.appendChild(element);
	return element;
}

/** Every `@keyframes` block the player has injected into the document head. */
function injectedKeyframes(): string {
	return [...document.head.querySelectorAll('style')].map((style) => style.textContent).join('\n');
}

afterEach(() => {
	stopVueAnimationPreview();
	document.body.innerHTML = '';
});

/**
 * animation-preview-player: plays one animation entry on the canvas.
 *
 * The branch worth guarding is precedence: an entry can carry BOTH a motion
 * path and a preset, and the path has to win, because it is the effect being
 * authored at that moment and a fade would hide the travel entirely.
 */
describe('previewVueAnimation', () => {
	it('plays a motion path in slide pixels, not element-box percentages', () => {
		const element = mountElement('el-1');
		const animation: PptxElementAnimation = {
			elementId: 'el-1',
			motionPath: 'M 0 0 L 0.25 0',
			durationMs: 1500,
		};

		expect(previewVueAnimation(animation)).toBeTruthy();
		// No measurable stage in the test DOM, so the 1280x720 fallback applies:
		// 0.25 * 1280 = 320px of travel.
		expect(injectedKeyframes()).toContain('translate(320px, 0px)');
		expect(element.style.animation).toContain('1500ms');
	});

	it('prefers the motion path over a preset on the same entry', () => {
		mountElement('el-1');
		const animation: PptxElementAnimation = {
			elementId: 'el-1',
			entrance: 'fadeIn',
			motionPath: 'M 0 0 L 0 0.5',
		};

		expect(previewVueAnimation(animation)).toBeTruthy();
		const css = injectedKeyframes();
		expect(css).toContain('pptx-motion-preview');
		expect(css).toContain('translate(0px, 360px)');
		expect(css).not.toContain('opacity');
	});

	it('still plays a preset when no path is applied', () => {
		mountElement('el-1');

		expect(previewVueAnimation({ elementId: 'el-1', entrance: 'fadeIn' })).toBeTruthy();
		expect(injectedKeyframes()).not.toContain('pptx-motion-preview');
	});

	it('reports no preview for an entry with neither a path nor a preset', () => {
		mountElement('el-1');
		expect(previewVueAnimation({ elementId: 'el-1' })).toBeFalsy();
		expect(injectedKeyframes()).toBe('');
	});

	it('restores the element once the preview is stopped', () => {
		const element = mountElement('el-1');
		element.style.animation = 'original 1s';

		previewVueAnimation({ elementId: 'el-1', motionPath: 'M 0 0 L 0.25 0' });
		stopVueAnimationPreview();

		expect(element.style.animation).toBe('original 1s');
		expect(injectedKeyframes()).toBe('');
	});
});
