import { describe, expect, it } from 'vitest';

import { buildTransformKeyframes } from './animation-transform-keyframes';

const PREFIXES = {
	motion: 'motion',
	rotationAbsolute: 'rotation-absolute',
	rotationRelative: 'rotation-relative',
	scaleAbsolute: 'scale-absolute',
	scaleRelative: 'scale-relative',
	transform: 'transform',
};

describe('buildTransformKeyframes', () => {
	it('rotates a motion path around its authored p:rCtr centre', () => {
		const result = buildTransformKeyframes(
			{
				targetId: 'shape-1',
				presetClass: 'path',
				motionPath: 'M 0 0 L 0.2 0 E',
				motionPathRotationAngle: 90,
				motionPathRotationCenterX: 10,
				motionPathRotationCenterY: 0,
			},
			1,
			PREFIXES,
		);

		expect(result?.css).toContain(
			'translate(calc(var(--pptx-slide-w, 1280px) * 0.1000), calc(var(--pptx-slide-h, 720px) * -0.1000))',
		);
		expect(result?.css).toContain(
			'translate(calc(var(--pptx-slide-w, 1280px) * 0.1000), calc(var(--pptx-slide-h, 720px) * 0.1000))',
		);
	});
});
