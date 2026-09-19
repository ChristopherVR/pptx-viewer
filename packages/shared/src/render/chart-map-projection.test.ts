import { describe, expect, it } from 'vitest';

import { scalePathD, WORLD_REGIONS } from './chart-map-projection';

/**
 * `scalePathD`'s tokeniser used to split on whitespace/comma delimiters only,
 * so a command letter directly abutting a coordinate ("M130,160", "130,195Z":
 * exactly how every `WORLD_REGIONS` path is authored) never got isolated from
 * its neighbouring number. `parseFloat("195Z")` silently truncates to `195`
 * without ever producing a `"Z"` token, so the region's subpath was never
 * closed and the rest of the coordinate stream paired up one token late,
 * eventually running the loop out of tokens mid-pair - the SVG parser then
 * rejects the resulting `d` with "attribute d: Unexpected end of attribute",
 * once per malformed region, on every load of a regionMap chart (see
 * `chart-region-map-view.ts`, which calls `scalePathD` once per rendered
 * region).
 *
 * Every token in a well-formed `scalePathD` output is either a single command
 * letter (M/L/Z) or a `"x.xx,y.yy"` coordinate pair (two decimals, from the
 * `.toFixed(2)` call): a malformed/truncated result always contains some
 * other token shape (a bare number, a letter-glued number, or nothing after
 * the last space).
 */
function isWellFormedScaledPathD(d: string): boolean {
	if (d.length === 0) {
		return false;
	}
	const tokens = d.split(' ');
	if (tokens.length === 0) {
		return false;
	}
	if (tokens[tokens.length - 1] !== 'Z') {
		return false;
	}
	return tokens.every(
		(tok) => tok === 'M' || tok === 'L' || tok === 'Z' || /^-?\d+\.\d{2},-?\d+\.\d{2}$/u.test(tok),
	);
}

describe('scalePathD', () => {
	it('produces a well-formed, non-empty, non-truncated d for every WORLD_REGIONS outline', () => {
		for (const region of WORLD_REGIONS) {
			const scaled = scalePathD(region.path, 1, 0, 0);
			expect(scaled, `${region.code} (${region.name}): "${scaled}"`).toSatisfy(
				isWellFormedScaledPathD,
			);
		}
	});

	it('keeps compact multi-subpath syntax intact (US: two "M...Z" loops glued with no separating space)', () => {
		const us = WORLD_REGIONS.find((region) => region.code === 'US');
		expect(us).toBeDefined();
		const scaled = scalePathD(us!.path, 1, 0, 0);
		// Two subpaths: the mainland loop, then Alaska/a second landmass, each
		// opened with its own "M" and closed with its own "Z".
		expect(scaled.match(/\bM\b/gu)).toHaveLength(2);
		expect(scaled.match(/\bZ\b/gu)).toHaveLength(2);
		expect(isWellFormedScaledPathD(scaled)).toBeTruthy();
	});

	it('scales and translates every coordinate pair', () => {
		const scaled = scalePathD('M10,20 L30,40Z', 2, 5, 7);
		expect(scaled).toBe('M 25.00,47.00 L 65.00,87.00 Z');
	});

	it('round-trips a path already using spaced (non-compact) syntax', () => {
		const scaled = scalePathD('M 10,20 L 30,40 50,60 Z', 1, 0, 0);
		expect(isWellFormedScaledPathD(scaled)).toBeTruthy();
		expect(scaled).toBe('M 10.00,20.00 L 30.00,40.00 50.00,60.00 Z');
	});
});
