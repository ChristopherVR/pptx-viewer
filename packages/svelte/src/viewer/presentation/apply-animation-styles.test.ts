import type { CSSProperties } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import { applyAnimationStyles } from './apply-animation-styles';

/**
 * DOM-only helper: build a stage with a couple of `[data-element-id]` nodes
 * (happy-dom) and assert that revealed / pending styles are applied and cleared
 * without clobbering the element's own positioning.
 */

function makeStage(): { root: HTMLElement; e1: HTMLElement; e2: HTMLElement } {
	const root = document.createElement('div');
	const e1 = document.createElement('div');
	e1.setAttribute('data-element-id', 'e1');
	e1.style.left = '10px';
	const e2 = document.createElement('div');
	e2.setAttribute('data-element-id', 'e2');
	root.append(e1, e2);
	document.body.append(root);
	return { root, e1, e2 };
}

afterEach(() => {
	document.body.innerHTML = '';
});

const empty: Map<string, CSSProperties> = new Map();

describe('applyAnimationStyles', () => {
	it('applies a revealed style and a pending hidden style by element id', () => {
		const { root, e1, e2 } = makeStage();
		const revealed = new Map<string, CSSProperties>([
			['e1', { 'animation-name': 'pptx-vue-fadeIn', 'animation-duration': '500ms' }],
		]);
		const pending = new Map<string, CSSProperties>([['e2', { opacity: '0' }]]);

		applyAnimationStyles(root, revealed, pending);

		expect(e1.style.getPropertyValue('animation-name')).toBe('pptx-vue-fadeIn');
		expect(e2.style.getPropertyValue('opacity')).toBe('0');
		// Positioning is untouched.
		expect(e1.style.getPropertyValue('left')).toBe('10px');
	});

	it('prefers a revealed style over a pending one for the same id', () => {
		const { root, e1 } = makeStage();
		const revealed = new Map<string, CSSProperties>([
			['e1', { 'animation-name': 'pptx-vue-fadeIn' }],
		]);
		const pending = new Map<string, CSSProperties>([['e1', { opacity: '0' }]]);

		applyAnimationStyles(root, revealed, pending);

		expect(e1.style.getPropertyValue('animation-name')).toBe('pptx-vue-fadeIn');
		expect(e1.style.getPropertyValue('opacity')).toBe('');
	});

	it('clears previously-applied managed properties on a subsequent empty apply', () => {
		const { root, e1 } = makeStage();
		applyAnimationStyles(root, new Map([['e1', { opacity: '0' }]]), empty);
		expect(e1.style.getPropertyValue('opacity')).toBe('0');

		applyAnimationStyles(root, empty, empty);
		expect(e1.style.getPropertyValue('opacity')).toBe('');
		expect(e1.style.getPropertyValue('left')).toBe('10px');
	});
});
