import type { ElementAnimationState } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it } from 'vitest';

import { applyAnimationStyles } from './apply-animation-styles';

/**
 * DOM-only helper: build a stage with a couple of `[data-element-id]` nodes
 * (happy-dom) and assert that each element's native-animation state (visibility,
 * CSS animation, trigger-shape cursor) is applied and cleared without clobbering
 * the element's own positioning.
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

const empty: Map<string, ElementAnimationState> = new Map();

describe('applyAnimationStyles', () => {
	it('applies the CSS animation and hides a not-yet-visible element', () => {
		const { root, e1, e2 } = makeStage();
		const states = new Map<string, ElementAnimationState>([
			['e1', { visible: true, cssAnimation: 'pptx-vue-fadeIn 500ms both' }],
			['e2', { visible: false, cssAnimation: undefined }],
		]);

		applyAnimationStyles(root, states);

		expect(e1.style.animation).toBe('pptx-vue-fadeIn 500ms both');
		expect(e1.style.visibility).toBe('');
		expect(e2.style.visibility).toBe('hidden');
		// Positioning is untouched.
		expect(e1.style.getPropertyValue('left')).toBe('10px');
	});

	it('marks interactive / hover trigger shapes with a pointer cursor', () => {
		const { root, e1, e2 } = makeStage();
		applyAnimationStyles(root, empty, new Set(['e1']), new Set(['e2']));

		expect(e1.style.cursor).toBe('pointer');
		expect(e2.style.cursor).toBe('pointer');
	});

	it('clears previously-applied managed properties on a subsequent empty apply', () => {
		const { root, e1 } = makeStage();
		applyAnimationStyles(
			root,
			new Map([['e1', { visible: false, cssAnimation: 'x 1ms' }]]),
			new Set(['e1']),
		);
		expect(e1.style.visibility).toBe('hidden');
		expect(e1.style.cursor).toBe('pointer');

		applyAnimationStyles(root, empty);
		expect(e1.style.visibility).toBe('');
		expect(e1.style.animation).toBe('');
		expect(e1.style.cursor).toBe('');
		expect(e1.style.getPropertyValue('left')).toBe('10px');
	});
});
