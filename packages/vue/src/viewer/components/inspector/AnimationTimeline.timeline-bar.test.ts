/**
 * Regression coverage for `AnimationTimeline.vue`'s proportional bar strip:
 * left/width percentages now come from shared's `buildAnimationTimelineBars`
 * (`pptx-viewer-shared`) rather than a local `totalMs` computed + inline
 * template maths.
 */
/* oxlint-disable eslint/one-var -- each `it()` block below declares its own
   independent arrange/act/assert consts; merging unrelated declarations
   across cases would hurt readability, not help it. */
import { mount } from '@vue/test-utils';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AnimationTimeline from './AnimationTimeline.vue';

const elements: PptxElement[] = [
	{ type: 'shape', id: 'a', x: 0, y: 0, width: 10, height: 10 } as PptxElement,
	{ type: 'shape', id: 'b', x: 0, y: 0, width: 10, height: 10 } as PptxElement,
];

describe('animationTimeline bar layout', () => {
	it('computes left/width percentages against the longest end time', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', order: 0, delayMs: 0, durationMs: 500, trigger: 'onClick' },
			{ elementId: 'b', order: 1, delayMs: 500, durationMs: 500, trigger: 'onClick' },
		];
		const wrapper = mount(AnimationTimeline, {
			props: { animations, elements, selectedElementId: 'a' },
		});
		const bars = wrapper.findAll('[aria-hidden="true"] > span');
		expect(bars).toHaveLength(2);
		expect(bars[0].attributes('style')).toContain('left: 0%');
		expect(bars[0].attributes('style')).toContain('width: 50%');
		expect(bars[1].attributes('style')).toContain('left: 50%');
		expect(bars[1].attributes('style')).toContain('width: 50%');
	});
});
