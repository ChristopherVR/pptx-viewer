import { describe, expect, it } from 'vitest';

import {
	maskHoleDecl,
	maskHoleInitialStyle,
	maskPlusHoleDecl,
	maskPlusHoleInitialStyle,
} from './animation-mask-hole-reveal';

/**
 * COM-verified (`Sequence.AddEffect` + `EffectParameters.Direction =
 * msoAnimDirectionIn`, `CreateVideo` frame capture): the Box/Circle/Diamond/
 * Plus entrance "In" direction is a hole shrinking from the element's own
 * edges inward, the geometric inverse of the `xOut` growing-solid mask these
 * used to reuse verbatim.
 */
describe('maskHoleDecl', () => {
	it('is fully hollow (100% hole) at the hidden phase for every shape', () => {
		for (const shape of ['box', 'circle', 'diamond'] as const) {
			const decl = maskHoleDecl(shape, 'hidden');
			expect(decl).toContain('mask-size: 100% 100%, 100% 100%');
		}
	});

	it('is fully solid (0% hole) at the shown phase for every shape', () => {
		for (const shape of ['box', 'circle', 'diamond'] as const) {
			const decl = maskHoleDecl(shape, 'shown');
			expect(decl).toContain('mask-size: 0% 0%, 100% 100%');
		}
	});

	it('excludes the shape hole from an always-solid base layer', () => {
		const decl = maskHoleDecl('box', 'hidden');
		expect(decl).toContain('mask-composite: add, exclude');
		expect(decl).toContain('linear-gradient(#000, #000), linear-gradient(#000, #000)');
	});

	it('uses a distinct mask-image per shape', () => {
		const box = maskHoleDecl('box', 'hidden');
		const circle = maskHoleDecl('circle', 'hidden');
		const diamond = maskHoleDecl('diamond', 'hidden');
		expect(circle).toContain('radial-gradient(circle');
		expect(diamond).toContain('polygon');
		expect(box).not.toContain('radial-gradient');
		expect(box).not.toContain('polygon');
	});
});

describe('maskHoleInitialStyle', () => {
	it('matches the hidden-phase declaration as a camelCase style map', () => {
		const style = maskHoleInitialStyle('circle');
		expect(style).toStrictEqual({
			maskImage: 'radial-gradient(circle, #000 0%, #000 100%), linear-gradient(#000, #000)',
			maskPosition: 'center, center',
			maskRepeat: 'no-repeat, no-repeat',
			maskSize: '100% 100%, 100% 100%',
			maskComposite: 'add, exclude',
			opacity: 1,
		});
	});
});

describe('maskPlusHoleDecl', () => {
	it('is a full-size cross (both bars at 100%) at the hidden phase', () => {
		expect(maskPlusHoleDecl('hidden')).toContain('mask-size: 100% 100%, 100% 100%, 100% 100%');
	});

	it('is fully solid (both bars at 0%) at the shown phase', () => {
		expect(maskPlusHoleDecl('shown')).toContain('mask-size: 100% 0%, 0% 100%, 100% 100%');
	});

	it('unions the two bars before excluding from the solid base (add, add, exclude)', () => {
		expect(maskPlusHoleDecl('hidden')).toContain('mask-composite: add, add, exclude');
	});
});

describe('maskPlusHoleInitialStyle', () => {
	it('matches the hidden-phase declaration as a camelCase style map', () => {
		expect(maskPlusHoleInitialStyle()).toStrictEqual({
			maskImage:
				'linear-gradient(#000, #000), linear-gradient(#000, #000), linear-gradient(#000, #000)',
			maskPosition: 'center, center, center',
			maskRepeat: 'no-repeat, no-repeat, no-repeat',
			maskSize: '100% 100%, 100% 100%, 100% 100%',
			maskComposite: 'add, add, exclude',
			opacity: 1,
		});
	});
});
