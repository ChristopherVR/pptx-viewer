/**
 * DrawingML preset adjustments from a layout definition's `dgm:adjLst`.
 *
 * `dgm:adj` (ECMA-376 Part 1, 21.4.3.1) addresses a preset's adjust handle
 * by 1-based index and writes its value in natural units: a FRACTION for a
 * length handle (`roundRect`'s `<dgm:adj idx="1" val="0.1"/>` is a 10%
 * corner, i.e. `adj = 10000` in the preset's own 1/100000 units) and
 * DEGREES for an angle handle (`blockArc`/`circularArrow`'s `val="90"` is
 * `5400000` in 1/60000 degree). Which one a handle is follows from the
 * preset's own default: every angle default in the preset table is a
 * 1/60000-degree value in the millions, every length default is at most a
 * few hundred thousand.
 */

import { lookupPresetShape } from '../../geometry';

const ANGLE_DEFAULT_THRESHOLD = 1_000_000;

/** `{ adj1: 10000, ... }` for `evaluatePresetShape`, or undefined when nothing is declared. */
export function presetAdjustments(
	presetName: string,
	adj: Record<number, number> | undefined,
): Record<string, number> | undefined {
	if (!adj || Object.keys(adj).length === 0) {
		return undefined;
	}
	const defaults = lookupPresetShape(presetName)?.avLst ?? {};
	const out: Record<string, number> = {};
	for (const [key, value] of Object.entries(adj)) {
		const index = Number(key);
		const name = index === 1 && 'adj' in defaults ? 'adj' : `adj${index}`;
		const isAngle = Math.abs(defaults[name] ?? 0) >= ANGLE_DEFAULT_THRESHOLD;
		out[name] = value * (isAngle ? 60000 : 100000);
	}
	return out;
}
