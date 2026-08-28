import type { PptxAttributeAnimation, PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { createAttributeTransformModel } from './animation-attribute-transform';
import { buildTransformKeyframes } from './animation-transform-keyframes';

const PREFIXES = {
	motion: 'motion',
	rotationAbsolute: 'rotation-absolute',
	rotationRelative: 'rotation-relative',
	scaleAbsolute: 'scale-absolute',
	scaleRelative: 'scale-relative',
	transform: 'transform',
};

function component(
	attrName: string,
	from: number | string,
	to: number | string,
): PptxAttributeAnimation {
	return {
		attrName,
		durationMs: 1000,
		keyframes: [
			{ tm: 0, value: from, valueType: typeof from === 'number' ? 'flt' : 'str' },
			{ tm: 100000, value: to, valueType: typeof to === 'number' ? 'flt' : 'str' },
		],
	};
}

describe('generic p:anim transform composition', () => {
	it('combines authored width, height, and rotation siblings', () => {
		const anim: PptxNativeAnimation = {
			durationMs: 1000,
			presetClass: 'entr',
			presetId: 31,
			attributeAnimations: [
				component('ppt_w', 0, '#ppt_w'),
				component('ppt_h', 0, '#ppt_h'),
				component('style.rotation', 90, 0),
			],
		};

		const result = buildTransformKeyframes(anim, 7, PREFIXES);
		expect(result?.keyframeName).toBe('transform-7');
		expect(result?.css).toContain('rotate(90deg) scale(0, 0)');
		expect(result?.css).toContain('rotate(0deg) scale(1, 1)');
	});

	it('converts position formulas into slide-relative offsets', () => {
		const model = createAttributeTransformModel({
			durationMs: 1000,
			attributeAnimations: [
				component('ppt_x', '#ppt_x', '#ppt_x'),
				component('ppt_y', '#ppt_y-.1', '#ppt_y'),
			],
		});

		expect(model?.stateAt(0)).toMatchObject({ translateX: 0, translateY: -10 });
		expect(model?.stateAt(1)).toMatchObject({ translateX: 0, translateY: 0 });
	});
});
