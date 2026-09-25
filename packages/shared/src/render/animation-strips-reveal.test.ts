import { describe, expect, it } from 'vitest';

import { getInitialStyleForEffect } from './animation-effects';
import { resolveFilterEffect } from './animation-filter-effects';
import { getEffectKeyframes } from './animation-keyframes';
import {
	resolveStripsDirection,
	STRIPS_BAND,
	stripsDecl,
	stripsEffectName,
} from './animation-strips-reveal';
import type { StripsDirection } from './animation-strips-reveal';
import { resolveEffect } from './animation-timeline-helpers';

/**
 * Evaluate the mask a {@link stripsDecl} declaration list paints at one
 * element point (`u`, `v` in 0-1 element units), replicating CSS's
 * `mask-size`/`mask-position` placement and the magic-corner
 * `linear-gradient(to <corner>)` parameterisation.
 */
function maskAlphaAt(decl: string, u: number, v: number): number {
	const toward = /linear-gradient\(to (\w+) (\w+),/.exec(decl)!;
	const stops = [...decl.matchAll(/(#000|transparent) ([\d.]+)%/g)].map((m) => Number(m[2]) / 100);
	const size = Number(/mask-size: ([\d.]+)%/.exec(decl)![1]) / 100;
	const [px, py] = /mask-position: ([-\d.]+)% ([-\d.]+)%/
		.exec(decl)!
		.slice(1)
		.map((value) => Number(value) / 100);
	const imageU = (u - (1 - size) * px) / size;
	const imageV = (v - (1 - size) * py) / size;
	if (imageU < 0 || imageU > 1 || imageV < 0 || imageV > 1) {
		return 0;
	}
	const endsLeft = toward[2] === 'left';
	const endsBottom = toward[1] === 'bottom';
	const s = ((endsLeft ? 1 - imageU : imageU) + (endsBottom ? imageV : 1 - imageV)) / 2;
	if (s <= stops[0]) {
		return 1;
	}
	if (s >= stops[1]) {
		return 0;
	}
	return (stops[1] - s) / (stops[1] - stops[0]);
}

const START: Record<StripsDirection, [number, number]> = {
	downLeft: [1, 0],
	upLeft: [1, 1],
	downRight: [0, 0],
	upRight: [0, 1],
};

const DIRECTIONS = Object.keys(START) as StripsDirection[];

describe('animation-strips-reveal', () => {
	it.each(DIRECTIONS)('%s: hidden at 0, shown at 1, sweeping from its start corner', (dir) => {
		const [su, sv] = START[dir];
		const corners: Array<[number, number]> = [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		];
		for (const [u, v] of corners) {
			expect(maskAlphaAt(stripsDecl(dir, 0), u, v)).toBe(0);
			expect(maskAlphaAt(stripsDecl(dir, 1), u, v)).toBe(1);
		}
		// Half-way: the start corner is in, the far corner out, the centre on the band.
		const half = stripsDecl(dir, 0.5);
		expect(maskAlphaAt(half, su, sv)).toBe(1);
		expect(maskAlphaAt(half, 1 - su, 1 - sv)).toBe(0);
		expect(maskAlphaAt(half, 0.5, 0.5)).toBeCloseTo(0.5, 2);
	});

	it('puts the band midline at the linear progress, as PowerPoint does (CreateVideo)', () => {
		// Measured on strips(downLeft): the 50%-alpha front sits at the
		// effect's linear progress along the top-right -> bottom-left diagonal.
		for (const progress of [0.25, 0.5, 0.75]) {
			const decl = stripsDecl('downLeft', progress);
			const front = -STRIPS_BAND / 2 + progress * (1 + STRIPS_BAND);
			// A point at diagonal distance `front` from the top-right corner.
			const u = 1 - front;
			expect(maskAlphaAt(decl, u, front)).toBeCloseTo(0.5, 2);
			expect(maskAlphaAt(decl, u - STRIPS_BAND, front + STRIPS_BAND)).toBe(0);
			expect(maskAlphaAt(decl, u + STRIPS_BAND, front - STRIPS_BAND)).toBe(1);
		}
	});

	it('plays the exit form as the entrance sweep time-reversed', () => {
		const exitCss = getEffectKeyframes('stripsOutUpLeft');
		expect(exitCss).toContain(`from { ${stripsDecl('upLeft', 1)}`);
		expect(exitCss).toContain(`to { ${stripsDecl('upLeft', 0)}`);
		const entrCss = getEffectKeyframes('stripsInUpLeft');
		expect(entrCss).toContain(`from { ${stripsDecl('upLeft', 0)}`);
	});

	it('resolves the direction from the filter token, then the COM presetSubtype codes', () => {
		expect(resolveStripsDirection('upRight', 12)).toBe('upRight');
		expect(resolveStripsDirection(undefined, 3)).toBe('upRight');
		expect(resolveStripsDirection(undefined, 6)).toBe('downRight');
		expect(resolveStripsDirection(undefined, 9)).toBe('upLeft');
		expect(resolveStripsDirection(undefined, 12)).toBe('downLeft');
		expect(resolveStripsDirection(undefined, undefined)).toBe('downLeft');
	});

	it('routes presetID 18 and the strips filter family to the same keyframes', () => {
		const filter = { family: 'strips', subtype: 'upLeft', raw: 'strips(upLeft)' };
		expect(
			resolveEffect({ presetClass: 'entr', presetId: 18, presetSubtype: 9, effectFilter: filter }),
		).toBe('stripsInUpLeft');
		expect(resolveEffect({ presetClass: 'exit', presetId: 18, presetSubtype: 6 })).toBe(
			'stripsOutDownRight',
		);
		expect(resolveFilterEffect({ presetClass: 'exit', effectFilter: filter })).toBe(
			stripsEffectName('upLeft', true),
		);
	});

	it('pre-seeds the entrance hidden state', () => {
		const style = getInitialStyleForEffect('stripsInDownLeft');
		expect(style.opacity).toBe(1);
		expect(String(style.maskImage)).toContain('to bottom left');
	});
});
