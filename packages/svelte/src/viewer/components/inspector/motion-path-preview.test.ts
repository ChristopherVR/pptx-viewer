import type { PptxElementAnimation } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import { previewElementAnimation } from '../ribbon/animations/animation-preview-player';
import { startAnimationPreview, stopAnimationPreview } from './animation-preview-control';

/**
 * Motion-path preview tests for BOTH players (the ribbon's fire-and-forget one
 * and the inspector's cancellable one).
 *
 * The branch under test is the priority rule: an entry carrying a motion path
 * must play the path even when it also carries a preset, because a fade would
 * hide the travel the user just authored. The slide size is read from the
 * element's offset parent, so the fixture fakes an offset parent rather than a
 * layout (jsdom reports 0 for every measurement).
 */

const SLIDE_WIDTH = 1280;
const SLIDE_HEIGHT = 720;

let cleanup: Array<() => void> = [];

afterEach(() => {
	stopAnimationPreview();
	cleanup.forEach((fn) => fn());
	cleanup = [];
	document.querySelectorAll('style').forEach((style) => style.remove());
});

/** Mount an element with a measurable "stage" as its offset parent. */
function mountTarget(id: string): HTMLElement {
	const stage = document.createElement('div');
	const el = document.createElement('div');
	el.dataset.elementId = id;
	stage.appendChild(el);
	document.body.appendChild(stage);
	Object.defineProperty(stage, 'offsetWidth', { value: SLIDE_WIDTH, configurable: true });
	Object.defineProperty(stage, 'offsetHeight', { value: SLIDE_HEIGHT, configurable: true });
	Object.defineProperty(el, 'offsetParent', { value: stage, configurable: true });
	cleanup.push(() => stage.remove());
	return el;
}

/** The keyframes text of the `<style>` the player injected. */
function injectedKeyframes(): string {
	return [...document.querySelectorAll('style')].map((style) => style.textContent).join('\n');
}

function anim(extra: Partial<PptxElementAnimation>): PptxElementAnimation {
	return { elementId: 'shape-1', ...extra };
}

describe('motion path preview', () => {
	it('plays the path from the inspector player, in slide pixels', () => {
		const el = mountTarget('shape-1');
		startAnimationPreview(anim({ motionPath: 'M 0 0 L 0.25 0', durationMs: 2000 }));

		expect(el.style.animation).toContain('pptx-motion-preview');
		expect(el.style.animation).toContain('2000ms');
		// 0.25 of a 1280 px slide is 320 px of travel, not 25% of the element box.
		expect(injectedKeyframes()).toContain('translate(320px, 0px)');
	});

	it('plays the path from the ribbon player too', () => {
		const el = mountTarget('shape-1');
		expect(previewElementAnimation(anim({ motionPath: 'M 0 0 L 0 0.5' }))).toBeTruthy();

		expect(el.style.animation).toContain('pptx-motion-preview');
		expect(injectedKeyframes()).toContain('translate(0px, 360px)');
	});

	it('gives the path priority over a coexisting preset', () => {
		const el = mountTarget('shape-1');
		startAnimationPreview(anim({ entrance: 'fadeIn', motionPath: 'M 0 0 L 0.25 0' }));

		expect(el.style.animation).toContain('pptx-motion-preview');
		expect(el.style.animation).not.toContain('fade');
	});

	it('still plays a plain preset when there is no path', () => {
		const el = mountTarget('shape-1');
		startAnimationPreview(anim({ entrance: 'fadeIn', durationMs: 500 }));

		expect(el.style.animation).not.toBe('');
		expect(el.style.animation).not.toContain('pptx-motion-preview');
	});

	it('restores the element when the inspector preview is stopped', () => {
		const el = mountTarget('shape-1');
		startAnimationPreview(anim({ motionPath: 'M 0 0 L 0.25 0' }));
		stopAnimationPreview();

		expect(el.style.animation).toBe('');
		expect(injectedKeyframes()).not.toContain('pptx-motion-preview');
	});

	it('reports failure rather than throwing when the element is off-canvas', () => {
		expect(previewElementAnimation(anim({ motionPath: 'M 0 0 L 0.25 0' }))).toBeFalsy();
	});

	it('ignores a degenerate path with nowhere to travel', () => {
		const el = mountTarget('shape-1');
		expect(previewElementAnimation(anim({ motionPath: 'M 0 0' }))).toBeFalsy();
		expect(el.style.animation).toBe('');
	});
});
