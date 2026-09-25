import type { PptxAnimBehavior } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	animValueAt,
	evaluateBehaviorFormula,
	isResolvableAnim,
} from './animation-behavior-values';

const VARS = {
	orig_ppt_x: 0.5,
	orig_ppt_y: 0.5,
	orig_ppt_w: 0.2,
	orig_ppt_h: 0.4,
	ppt_x: 0.5,
	ppt_y: 0.5,
	ppt_w: 0.01,
	ppt_h: 0.4,
};

function anim(partial: Partial<PptxAnimBehavior>): PptxAnimBehavior {
	return { kind: 'anim', attrNames: ['ppt_y'], keyframes: [], timing: {}, ...partial };
}

describe('evaluateBehaviorFormula', () => {
	it('reads #ppt_* as the authored geometry and bare ppt_* as the current value', () => {
		expect(evaluateBehaviorFormula('#ppt_w', VARS)).toBe(0.2);
		expect(evaluateBehaviorFormula('ppt_w/.05', VARS)).toBeCloseTo(0.2, 9);
		expect(evaluateBehaviorFormula('#ppt_x+#ppt_w', VARS)).toBeCloseTo(0.7, 9);
	});
});

describe('animValueAt', () => {
	it('shapes a formula stop with $ interpolated from the stop values (Bounce hop)', () => {
		const hop = anim({
			keyframes: [
				{ tm: 0, value: 0.5, valueType: 'flt', fmla: '#ppt_y-sin(pi*$)/3' },
				{ tm: 100000, value: 1, valueType: 'flt' },
			],
		});
		// $ = 0.5 at the start: a third of the slide above the resting point.
		expect(animValueAt(hop, 0, undefined, VARS)).toBeCloseTo(0.5 - 1 / 3, 9);
		// The bare last stop is `$`, not a position: the hop lands at rest.
		expect(animValueAt(hop, 1, undefined, VARS)).toBeCloseTo(0.5, 9);
	});

	it('adds a by-ramp onto the underlying value', () => {
		const wobble = anim({ by: '(#ppt_h/4)', additive: 'sum' });
		expect(animValueAt(wobble, 0.5, 0.3, VARS)).toBeCloseTo(0.35, 9);
	});

	it('ramps from/to formulas absolutely', () => {
		const fly = anim({ from: '(-#ppt_h/2)', to: '(#ppt_y)' });
		expect(animValueAt(fly, 0, 0.9, VARS)).toBeCloseTo(-0.2, 9);
		expect(animValueAt(fly, 1, 0.9, VARS)).toBeCloseTo(0.5, 9);
	});

	it('keeps discrete strings discrete', () => {
		const flip = anim({
			attrNames: ['style.visibility'],
			calcMode: 'discrete',
			keyframes: [
				{ tm: 0, value: 'visible', valueType: 'str' },
				{ tm: 50000, value: 'hidden', valueType: 'str' },
			],
		});
		expect(animValueAt(flip, 0.25, undefined, VARS)).toBe('visible');
		expect(animValueAt(flip, 0.75, undefined, VARS)).toBe('hidden');
	});

	it('reports an unresolvable formula', () => {
		expect(isResolvableAnim(anim({ from: 'nope(', to: '1' }), VARS)).toBeFalsy();
		expect(isResolvableAnim(anim({ from: '#ppt_y', to: '1' }), VARS)).toBeTruthy();
	});
});
