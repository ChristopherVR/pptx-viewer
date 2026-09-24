import { describe, expect, it } from 'vitest';

import {
	redirectMaskEffectByFilterSubtype,
	resolveAnimationWheelSpokeCount,
} from './animation-presets-subtypes';

const SELECTABLE_SPOKE_COUNTS = [1, 2, 3, 4, 8];

describe('resolveAnimationWheelSpokeCount', () => {
	it('returns the exact count for a recognised subtype token', () => {
		expect(resolveAnimationWheelSpokeCount('1')).toBe(1);
		expect(resolveAnimationWheelSpokeCount('2')).toBe(2);
		expect(resolveAnimationWheelSpokeCount('3')).toBe(3);
		expect(resolveAnimationWheelSpokeCount('4')).toBe(4);
		expect(resolveAnimationWheelSpokeCount('8')).toBe(8);
	});

	it('rounds an unlisted count to the nearest of the five selectable spoke counts', () => {
		expect(resolveAnimationWheelSpokeCount('5')).toBe(4);
		// 6 is equidistant between 4 and 8; ties resolve to the smaller count.
		expect(resolveAnimationWheelSpokeCount('6')).toBe(4);
		expect(resolveAnimationWheelSpokeCount('7')).toBe(8);
	});

	it("defaults to 4 (PowerPoint's own default) when the token is absent or unparsable", () => {
		expect(resolveAnimationWheelSpokeCount(undefined)).toBe(4);
		expect(resolveAnimationWheelSpokeCount('not-a-number')).toBe(4);
	});

	it('every value it can return is one of the five selectable spoke counts', () => {
		for (const token of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '100']) {
			expect(SELECTABLE_SPOKE_COUNTS).toContain(resolveAnimationWheelSpokeCount(token));
		}
	});
});

describe('redirectMaskEffectByFilterSubtype', () => {
	it('redirects blindsIn to the matching direction variant', () => {
		expect(
			redirectMaskEffectByFilterSubtype('blindsIn', { family: 'blinds', subtype: 'vertical' }),
		).toBe('blindsInVertical');
		expect(
			redirectMaskEffectByFilterSubtype('blindsIn', { family: 'blinds', subtype: 'horizontal' }),
		).toBe('blindsInHorizontal');
	});

	it('redirects checkerboardIn to the matching direction variant', () => {
		expect(
			redirectMaskEffectByFilterSubtype('checkerboardIn', {
				family: 'checkerboard',
				subtype: 'across',
			}),
		).toBe('checkerboardInAcross');
		expect(
			redirectMaskEffectByFilterSubtype('checkerboardIn', {
				family: 'checkerboard',
				subtype: 'down',
			}),
		).toBe('checkerboardInDown');
	});

	it('redirects randomBarsIn to the matching direction variant', () => {
		expect(
			redirectMaskEffectByFilterSubtype('randomBarsIn', {
				family: 'randombar',
				subtype: 'vertical',
			}),
		).toBe('randomBarsInVertical');
		expect(
			redirectMaskEffectByFilterSubtype('randomBarsIn', {
				family: 'randombar',
				subtype: 'horizontal',
			}),
		).toBe('randomBarsInHorizontal');
	});

	it('redirects wheelIn to the matching spoke-count variant', () => {
		expect(redirectMaskEffectByFilterSubtype('wheelIn', { family: 'wheel', subtype: '1' })).toBe(
			'wheelIn1',
		);
		expect(redirectMaskEffectByFilterSubtype('wheelIn', { family: 'wheel', subtype: '8' })).toBe(
			'wheelIn8',
		);
	});

	it('leaves the effect unchanged when the family does not match the effect', () => {
		expect(
			redirectMaskEffectByFilterSubtype('blindsIn', { family: 'checkerboard', subtype: 'across' }),
		).toBe('blindsIn');
	});

	it('leaves the effect unchanged when there is no filter at all', () => {
		expect(redirectMaskEffectByFilterSubtype('blindsIn', undefined)).toBe('blindsIn');
	});

	it('leaves an unrecognised subtype token to fall back to the default keyframe', () => {
		expect(
			redirectMaskEffectByFilterSubtype('blindsIn', { family: 'blinds', subtype: 'diagonal' }),
		).toBe('blindsIn');
	});

	it('passes through an effect with no matching redirect branch unchanged', () => {
		expect(redirectMaskEffectByFilterSubtype('boxIn', { family: 'box', subtype: 'in' })).toBe(
			'boxIn',
		);
	});

	it('returns undefined unchanged', () => {
		expect(
			redirectMaskEffectByFilterSubtype(undefined, { family: 'blinds', subtype: 'vertical' }),
		).toBeUndefined();
	});
});
