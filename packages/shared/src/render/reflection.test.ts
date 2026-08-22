import type { ShapeStyle, TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getReflectionWrapperStyle, getTextReflectionWrapperStyle } from './reflection';

describe('getReflectionWrapperStyle', () => {
	it('returns undefined without a style', () => {
		expect(getReflectionWrapperStyle(undefined, 200)).toBeUndefined();
	});

	it('returns undefined when no reflection is set', () => {
		expect(getReflectionWrapperStyle({}, 200)).toBeUndefined();
	});

	it('never depends on -webkit-box-reflect: the wrapper is plain CSS position/transform/mask', () => {
		const wrapper = getReflectionWrapperStyle(
			{ reflectionStartOpacity: 0.5, reflectionDistance: 4 },
			200,
		);
		expect(wrapper).toBeDefined();
		const serialized = JSON.stringify(wrapper);
		expect(serialized).not.toContain('box-reflect');
		expect(serialized).not.toContain('WebkitBoxReflect');
		expect(wrapper).not.toHaveProperty('webkitBoxReflect');
		expect(wrapper).not.toHaveProperty('WebkitBoxReflect');
		// The mask is expressed both unprefixed (Firefox, modern Chromium) and
		// with the Safari/older-Chromium prefix - both properties are plain CSS,
		// unlike `-webkit-box-reflect` which Firefox never implemented at all.
		expect(wrapper?.maskImage).toContain('linear-gradient');
		expect(wrapper?.WebkitMaskImage).toBe(wrapper?.maskImage);
	});

	it('positions the mirrored sibling `dist` px below the source box', () => {
		const wrapper = getReflectionWrapperStyle(
			{ reflectionStartOpacity: 0.5, reflectionDistance: 12 },
			200,
		);
		expect(wrapper?.position).toBe('absolute');
		expect(wrapper?.left).toBe('0');
		expect(wrapper?.top).toBe('calc(100% + 12px)');
		expect(wrapper?.width).toBe('100%');
		expect(wrapper?.height).toBe('100%');
		expect(wrapper?.pointerEvents).toBe('none');
	});

	it('always mirrors with scaleY(-1), even with no other transform attributes', () => {
		const wrapper = getReflectionWrapperStyle({ reflectionStartOpacity: 0.5 }, 200);
		expect(wrapper?.transform).toBe('scaleY(-1)');
	});

	it('honours @sx/@sy (reflectionScaleX/Y, ST_Percentage in 1000ths)', () => {
		const wrapper = getReflectionWrapperStyle(
			{ reflectionStartOpacity: 0.5, reflectionScaleX: 50000, reflectionScaleY: 150000 },
			200,
		);
		expect(wrapper?.transform).toContain('scale(0.5, 1.5)');
	});

	it('honours @kx/@ky (reflectionSkewX/Y, ST_Angle in 60000ths of a degree)', () => {
		const wrapper = getReflectionWrapperStyle(
			{ reflectionStartOpacity: 0.5, reflectionSkewX: 600000, reflectionSkewY: -300000 },
			200,
		);
		expect(wrapper?.transform).toContain('skew(10deg, -5deg)');
	});

	it('honours @rot (reflectionRotation, ST_Angle) as an independent rotation', () => {
		const wrapper = getReflectionWrapperStyle(
			{ reflectionStartOpacity: 0.5, reflectionRotation: 2700000 },
			200,
		);
		expect(wrapper?.transform).toContain('rotate(45deg)');
	});

	it('composes sx/sy, kx/ky and rot together in one transform', () => {
		const wrapper = getReflectionWrapperStyle(
			{
				reflectionStartOpacity: 0.5,
				reflectionScaleX: 80000,
				reflectionScaleY: 80000,
				reflectionSkewX: 300000,
				reflectionRotation: 1800000,
			},
			200,
		);
		expect(wrapper?.transform).toBe('scaleY(-1) scale(0.8, 0.8) skew(5deg, 0deg) rotate(30deg)');
	});

	describe('@algn -> transform-origin', () => {
		const cases: Array<[ShapeStyle['reflectionAlignment'], string]> = [
			['tl', 'left top'],
			['t', 'center top'],
			['tr', 'right top'],
			['l', 'left top'],
			['ctr', 'center top'],
			['r', 'right top'],
			['bl', 'left bottom'],
			['b', 'center bottom'],
			['br', 'right bottom'],
		];

		it.each(cases)('maps algn "%s" to transform-origin "%s"', (algn, origin) => {
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 0.5, reflectionAlignment: algn },
				200,
			);
			expect(wrapper?.transformOrigin).toBe(origin);
		});

		it('defaults to "center top" when @algn is unset', () => {
			const wrapper = getReflectionWrapperStyle({ reflectionStartOpacity: 0.5 }, 200);
			expect(wrapper?.transformOrigin).toBe('center top');
		});
	});

	describe('fade (mask-image gradient)', () => {
		it('derives fade length from reflectionEndPosition x height', () => {
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 1, reflectionEndPosition: 0.5 },
				200,
			);
			// 0.5 * 200 = 100px fade length.
			expect(wrapper?.maskImage).toContain('100px');
		});

		it('defaults the fade axis to straight down (CSS 180deg) matching the old box-reflect default', () => {
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 1, reflectionEndPosition: 0.5 },
				200,
			);
			expect(wrapper?.maskImage).toContain('linear-gradient(180deg,');
		});

		it('honours @fadeDir as an independent fade axis', () => {
			// fadeDir 0deg (OOXML, pointing right) -> CSS 90deg ("to right").
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 1, reflectionEndPosition: 0.5, reflectionFadeDirection: 0 },
				200,
			);
			expect(wrapper?.maskImage).toContain('linear-gradient(90deg,');
		});

		it('uses a three-stop gradient when blurred', () => {
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 1, reflectionBlurRadius: 4, reflectionEndPosition: 0.5 },
				200,
			);
			expect(wrapper?.maskImage.match(/rgba\(0,0,0,/gu)?.length).toBe(3);
			// Effective fade length = 100 + 4*2 = 108.
			expect(wrapper?.maskImage).toContain('108px');
		});

		it('inserts a hold stop so the reflection stays opaque until @stPos', () => {
			// stPos 0.5 of a 100px fade -> hold at 50px.
			const wrapper = getReflectionWrapperStyle(
				{ reflectionStartOpacity: 1, reflectionEndPosition: 0.5, reflectionStartPosition: 0.5 },
				200,
			);
			expect(wrapper?.maskImage).toContain('rgba(0,0,0,1) 50px');
		});

		it('defaults startOpacity/endOpacity to 0.5/0 when unset', () => {
			const wrapper = getReflectionWrapperStyle({ reflectionDistance: 4 }, 200);
			expect(wrapper?.maskImage).toContain('rgba(0,0,0,0.5)');
			expect(wrapper?.maskImage).toContain('rgba(0,0,0,0)');
		});
	});
});

describe('getTextReflectionWrapperStyle', () => {
	it('returns undefined without a style', () => {
		expect(getTextReflectionWrapperStyle(undefined, 20)).toBeUndefined();
	});

	it('returns undefined when textReflection is not set', () => {
		expect(getTextReflectionWrapperStyle({}, 20)).toBeUndefined();
		expect(
			getTextReflectionWrapperStyle({ textReflection: false } as TextStyle, 20),
		).toBeUndefined();
	});

	it('reuses getReflectionWrapperStyle rather than a second implementation: no box-reflect anywhere', () => {
		const wrapper = getTextReflectionWrapperStyle({ textReflection: true } as TextStyle, 20);
		expect(wrapper).toBeDefined();
		const serialized = JSON.stringify(wrapper);
		expect(serialized).not.toContain('box-reflect');
		expect(serialized).not.toContain('WebkitBoxReflect');
		expect(wrapper?.maskImage).toContain('linear-gradient');
		expect(wrapper?.WebkitMaskImage).toBe(wrapper?.maskImage);
		expect(wrapper?.transform).toBe('scaleY(-1)');
	});

	it('maps textReflectionOffset/StartOpacity/EndOpacity onto the same wrapper a shape gets', () => {
		const wrapper = getTextReflectionWrapperStyle(
			{
				textReflection: true,
				textReflectionOffset: 4,
				textReflectionStartOpacity: 0.4,
				textReflectionEndOpacity: 0.1,
			} as TextStyle,
			20,
		);
		expect(wrapper?.top).toBe('calc(100% + 4px)');
		expect(wrapper?.maskImage).toContain('rgba(0,0,0,0.4)');
		expect(wrapper?.maskImage).toContain('rgba(0,0,0,0.1)');
	});

	it('honours textReflectionBlur (parsed but never rendered by the old -webkit-box-reflect CSS)', () => {
		const wrapper = getTextReflectionWrapperStyle(
			{ textReflection: true, textReflectionBlur: 4 } as TextStyle,
			20,
		);
		expect(wrapper?.maskImage.match(/rgba\(0,0,0,/gu)?.length).toBe(3);
	});

	it('defaults startOpacity to 0.5 for a bare <a:reflection/>, matching the old CSS default', () => {
		const wrapper = getTextReflectionWrapperStyle({ textReflection: true } as TextStyle, 20);
		expect(wrapper?.maskImage).toContain('rgba(0,0,0,0.5)');
		expect(wrapper?.maskImage).toContain('rgba(0,0,0,0)');
	});
});
