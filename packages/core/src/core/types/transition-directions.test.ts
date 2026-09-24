import { describe, expect, it } from 'vitest';

import {
	TRANSITION_PATTERN_OPTIONS,
	TRANSITION_THRUBLK_TYPES,
	TRANSITION_VALID_DIRECTIONS,
} from './transition';

/**
 * Locks in the COM-verified p14/p15 direction sets added alongside the p15
 * authoring wave. Each expectation mirrors a `PpEntryEffect` enumeration +
 * `p:transition` XML dump captured against the installed PowerPoint (see the
 * doc comment on `TRANSITION_VALID_DIRECTIONS`), so a future edit that
 * "helpfully" widens one of these back to a naive 4-way set gets caught here
 * instead of silently offering a picker button PowerPoint cannot save.
 */
describe('tRANSITION_VALID_DIRECTIONS (p14/p15 COM-verified additions)', () => {
	it('gives switch and flip only l/r (Up/Down collapse to dir="r" on save)', () => {
		expect(TRANSITION_VALID_DIRECTIONS.switch).toStrictEqual(['l', 'r']);
		expect(TRANSITION_VALID_DIRECTIONS.flip).toStrictEqual(['l', 'r']);
	});

	it('gives ripple only the four diagonals, never a cardinal direction', () => {
		expect(TRANSITION_VALID_DIRECTIONS.ripple).toStrictEqual(['lu', 'ld', 'ru', 'rd']);
	});

	it('gives vortex/glitter/cube/rotate/box/orbit/pan the full cardinal set', () => {
		for (const type of ['vortex', 'glitter', 'cube', 'rotate', 'box', 'orbit', 'pan'] as const) {
			expect(TRANSITION_VALID_DIRECTIONS[type]).toStrictEqual(['l', 'u', 'r', 'd']);
		}
	});

	it('gives gallery/conveyor/ferris only l/r', () => {
		for (const type of ['gallery', 'conveyor', 'ferris'] as const) {
			expect(TRANSITION_VALID_DIRECTIONS[type]).toStrictEqual(['l', 'r']);
		}
	});

	it('gives shred an in/out toggle, not a compass direction', () => {
		expect(TRANSITION_VALID_DIRECTIONS.shred).toStrictEqual(['in', 'out']);
	});

	it('gives every P15_INVX_PRESETS member exactly l/r', () => {
		for (const type of [
			'fallOver',
			'drape',
			'wind',
			'peelOff',
			'pageCurlSingle',
			'pageCurlDouble',
			'airplane',
			'origami',
		] as const) {
			expect(TRANSITION_VALID_DIRECTIONS[type]).toStrictEqual(['l', 'r']);
		}
	});

	it('gives the four p15 presets with no invX axis no direction entry at all', () => {
		for (const type of ['curtains', 'prestige', 'fracture', 'crush'] as const) {
			expect(TRANSITION_VALID_DIRECTIONS[type]).toBeUndefined();
		}
	});
});

describe('tRANSITION_PATTERN_OPTIONS', () => {
	it('offers diamond/hexagon for glitter and strip/rectangle for shred', () => {
		expect(TRANSITION_PATTERN_OPTIONS.glitter).toStrictEqual(['diamond', 'hexagon']);
		expect(TRANSITION_PATTERN_OPTIONS.shred).toStrictEqual(['strip', 'rectangle']);
	});

	it('offers no pattern for any other type', () => {
		for (const type of ['fade', 'wipe', 'vortex', 'cube'] as const) {
			expect(TRANSITION_PATTERN_OPTIONS[type]).toBeUndefined();
		}
	});
});

describe('tRANSITION_THRUBLK_TYPES', () => {
	it('covers exactly cut and fade (COM: no Blinds/Checkerboard black PpEntryEffect exists)', () => {
		expect([...TRANSITION_THRUBLK_TYPES].sort()).toStrictEqual(['cut', 'fade']);
	});
});
