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

	it('motionOrigin "parent" scales against the parent-group custom property, not the slide (G12)', () => {
		const result = buildTransformKeyframes(
			{
				targetId: 'shape-1',
				presetClass: 'path',
				motionPath: 'M 0 0 L 0.5 0.5 E',
				motionOrigin: 'parent',
			},
			2,
			PREFIXES,
		);

		expect(result?.css).toContain('var(--pptx-parent-w, 1280px)');
		expect(result?.css).toContain('var(--pptx-parent-h, 720px)');
		expect(result?.css).not.toContain('--pptx-slide-w');
		expect(result?.css).not.toContain('--pptx-slide-h');
	});

	it('defaults to the slide-space custom property when motionOrigin is "layout" (or absent)', () => {
		const result = buildTransformKeyframes(
			{
				targetId: 'shape-1',
				presetClass: 'path',
				motionPath: 'M 0 0 L 0.5 0.5 E',
				motionOrigin: 'layout',
			},
			3,
			PREFIXES,
		);

		expect(result?.css).toContain('var(--pptx-slide-w, 1280px)');
		expect(result?.css).toContain('var(--pptx-slide-h, 720px)');
	});

	it('travels a motion path at an even pace along its length', () => {
		// A 0.3-long leg then a 0.1-long one on a square slide: the corner is
		// reached at 75% of the time, not at the halfway point count.
		const result = buildTransformKeyframes(
			{ targetId: 'shape-1', presetClass: 'path', motionPath: 'M 0 0 L 0.3 0 L 0.3 0.1 E' },
			2,
			PREFIXES,
			{ x: 0, y: 0, width: 0.1, height: 0.1, slideAspect: 1 },
		);
		expect(result?.css).toContain(
			'75% { transform: translate(calc(var(--pptx-slide-w, 1280px) * 0.3000), calc(var(--pptx-slide-h, 720px) * 0.0000)); }',
		);
		expect(result?.css).not.toContain('	50%');
	});
});
