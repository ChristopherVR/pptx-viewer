import { describe, expect, it } from 'vitest';

import { getBevelHighlightDirection, isBevelProfileInverted } from './visual-3d-bevel-light';

describe('getBevelHighlightDirection', () => {
	it('defaults to the pre-existing top-left diagonal when no direction is given', () => {
		expect(getBevelHighlightDirection(undefined)).toStrictEqual({ dx: -1, dy: -1 });
	});

	it('defaults to top-left for an unrecognised direction token', () => {
		expect(getBevelHighlightDirection('notADirection')).toStrictEqual({ dx: -1, dy: -1 });
	});

	// COM-measured 2026-09 (mid-grey 2in square, wide `a:bevelT` circle
	// profile, Depth=0; see the module doc comment for the full brightness
	// table): each direction's highlight snaps to exactly one cardinal edge.
	it('maps the 4 cardinal directions to their own edge', () => {
		expect(getBevelHighlightDirection('t')).toStrictEqual({ dx: 0, dy: -1 });
		expect(getBevelHighlightDirection('r')).toStrictEqual({ dx: 1, dy: 0 });
		expect(getBevelHighlightDirection('b')).toStrictEqual({ dx: 0, dy: 1 });
		expect(getBevelHighlightDirection('l')).toStrictEqual({ dx: -1, dy: 0 });
	});

	it('maps each diagonal to the SAME dominant edge as the cardinal direction it follows clockwise', () => {
		// tr measured top=163 (same magnitude as pure `t`), not a diagonal blend.
		expect(getBevelHighlightDirection('tr')).toStrictEqual(getBevelHighlightDirection('t'));
		// br measured right=159 (same as pure `r`).
		expect(getBevelHighlightDirection('br')).toStrictEqual(getBevelHighlightDirection('r'));
		// bl measured bottom=165 (same as pure `b`).
		expect(getBevelHighlightDirection('bl')).toStrictEqual(getBevelHighlightDirection('b'));
		// tl measured left=160 (same as pure `l`).
		expect(getBevelHighlightDirection('tl')).toStrictEqual(getBevelHighlightDirection('l'));
	});
});

// COM-measured 2026-09 (12-profile x 8-direction campaign): 9 of 12 profiles
// (relaxedInset, circle, cross, angle, convex, coolSlant, divot, riblet,
// artDeco) reproduced the exact same cardinal-snap edge as `circle`;
// `softRound` measured the OPPOSITE edge on every direction; `slope` and
// `hardEdge` showed no directional signal at all at any sampled depth (see
// the module doc comment) and are left unverified rather than encoded from
// noisy data.
describe('isBevelProfileInverted', () => {
	it('flags only softRound as inverted', () => {
		expect(isBevelProfileInverted('softRound')).toBeTruthy();
	});

	it('does not flag the other 11 measured profiles', () => {
		const notInverted = [
			'relaxedInset',
			'circle',
			'slope',
			'cross',
			'angle',
			'convex',
			'coolSlant',
			'divot',
			'riblet',
			'hardEdge',
			'artDeco',
		];
		for (const profile of notInverted) {
			expect(isBevelProfileInverted(profile)).toBeFalsy();
		}
	});
});
