/**
 * Spec-exact ECMA-376 / ISO-IEC-29500-1 preset geometry for the four curved
 * arrows: `curvedRightArrow`, `curvedLeftArrow`, `curvedUpArrow`, and
 * `curvedDownArrow`.
 *
 * These replace the earlier default-adjustment silhouettes (quad-Bezier
 * reductions in `preset-shape-definitions-curved-arrows-connectors.ts` and a
 * cubic-Bezier approximation in `preset-shape-definitions-arrows-refined.ts`).
 * The `avLst`, `gdLst`, `rect`, and `pathLst` below are transcribed verbatim
 * from Microsoft's authoritative `presetShapeDefinitions.xml`
 * (ISO/IEC 29500-1 §20.1.10.55), sourced from the Apache POI mirror
 * `poi/src/main/resources/org/apache/poi/sl/draw/geom/presetShapeDefinitions.xml`.
 *
 * # The one deliberate deviation: `at2` argument order
 *
 * ECMA-376 defines `at2 x y = atan2(y, x)` (see ISO/IEC 29500-1 §20.1.9.5 and
 * the companion `cat2`/`sat2` which use `atan2(z, y)`). This repository's guide
 * evaluator (`guide-formula-eval.ts`) instead computes `at2 x y = atan2(x, y)`
 * (its unit test pins `at2 1 0 -> 90deg`). To keep the evaluator untouched
 * (other shapes are authored against its convention) while still producing the
 * ECMA-correct angle, every `at2 A B` from the spec is written here as
 * `at2 B A`. That is the only edit to the canonical token stream; all other
 * operators (multiply-divide, add-subtract, add-divide, sqrt, pin) already
 * match ECMA.
 *
 * The aggregator in `preset-shape-definitions-table.ts` spreads
 * `EXACT_CURVED_ARROW_PRESET_DEFINITIONS` last so these authoritative entries
 * win over any earlier simplified/refined registrations for the same names.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// curvedRightArrow (ISO/IEC 29500-1 §20.1.10.55)
//   adj1 body thickness, adj2 head width, adj3 head length.
// ---------------------------------------------------------------------------
const curvedRightArrow: PresetShapeGeometryDefinition = {
	name: 'curvedRightArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('maxAdj2', '*/ 50000 h ss'),
		gd('a2', 'pin 0 adj2 maxAdj2'),
		gd('a1', 'pin 0 adj1 a2'),
		gd('th', '*/ ss a1 100000'),
		gd('aw', '*/ ss a2 100000'),
		gd('q1', '+/ th aw 4'),
		gd('hR', '+- hd2 0 q1'),
		gd('q7', '*/ hR 2 1'),
		gd('q8', '*/ q7 q7 1'),
		gd('q9', '*/ th th 1'),
		gd('q10', '+- q8 0 q9'),
		gd('q11', 'sqrt q10'),
		gd('idx', '*/ q11 w q7'),
		gd('maxAdj3', '*/ 100000 idx ss'),
		gd('a3', 'pin 0 adj3 maxAdj3'),
		gd('ah', '*/ ss a3 100000'),
		gd('y3', '+- hR th 0'),
		gd('q2', '*/ w w 1'),
		gd('q3', '*/ ah ah 1'),
		gd('q4', '+- q2 0 q3'),
		gd('q5', 'sqrt q4'),
		gd('dy', '*/ q5 hR w'),
		gd('y5', '+- hR dy 0'),
		gd('y7', '+- y3 dy 0'),
		gd('q6', '+- aw 0 th'),
		gd('dh', '*/ q6 1 2'),
		gd('y4', '+- y5 0 dh'),
		gd('y8', '+- y7 dh 0'),
		gd('aw2', '*/ aw 1 2'),
		gd('y6', '+- b 0 aw2'),
		gd('x1', '+- r 0 ah'),
		// Spec: swAng = at2 ah dy. Evaluator at2 is swapped, so pass (dy, ah).
		gd('swAng', 'at2 dy ah'),
		gd('stAng', '+- cd2 0 swAng'),
		gd('mswAng', '+- 0 0 swAng'),
		gd('ix', '+- r 0 idx'),
		gd('iy', '+/ hR y3 2'),
		gd('q12', '*/ th 1 2'),
		// Spec: dang2 = at2 idx q12 -> pass (q12, idx).
		gd('dang2', 'at2 q12 idx'),
		gd('swAng2', '+- dang2 0 cd4'),
		gd('swAng3', '+- cd4 dang2 0'),
		gd('stAng3', '+- cd2 0 dang2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'hR' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'cd2', swAng: 'mswAng' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'r', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y8' },
				{ kind: 'lnTo', x: 'x1', y: 'y7' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'stAng', swAng: 'swAng' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'darkenLess',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'th' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '3cd4', swAng: 'swAng2' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'stAng3', swAng: 'swAng3' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'hR' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'cd2', swAng: 'mswAng' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'r', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y8' },
				{ kind: 'lnTo', x: 'x1', y: 'y7' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'stAng', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'l', y: 'hR' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'th' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '3cd4', swAng: 'swAng2' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// curvedLeftArrow (ISO/IEC 29500-1 §20.1.10.55)
// ---------------------------------------------------------------------------
const curvedLeftArrow: PresetShapeGeometryDefinition = {
	name: 'curvedLeftArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('maxAdj2', '*/ 50000 h ss'),
		gd('a2', 'pin 0 adj2 maxAdj2'),
		gd('a1', 'pin 0 adj1 a2'),
		gd('th', '*/ ss a1 100000'),
		gd('aw', '*/ ss a2 100000'),
		gd('q1', '+/ th aw 4'),
		gd('hR', '+- hd2 0 q1'),
		gd('q7', '*/ hR 2 1'),
		gd('q8', '*/ q7 q7 1'),
		gd('q9', '*/ th th 1'),
		gd('q10', '+- q8 0 q9'),
		gd('q11', 'sqrt q10'),
		gd('idx', '*/ q11 w q7'),
		gd('maxAdj3', '*/ 100000 idx ss'),
		gd('a3', 'pin 0 adj3 maxAdj3'),
		gd('ah', '*/ ss a3 100000'),
		gd('y3', '+- hR th 0'),
		gd('q2', '*/ w w 1'),
		gd('q3', '*/ ah ah 1'),
		gd('q4', '+- q2 0 q3'),
		gd('q5', 'sqrt q4'),
		gd('dy', '*/ q5 hR w'),
		gd('y5', '+- hR dy 0'),
		gd('y7', '+- y3 dy 0'),
		gd('q6', '+- aw 0 th'),
		gd('dh', '*/ q6 1 2'),
		gd('y4', '+- y5 0 dh'),
		gd('y8', '+- y7 dh 0'),
		gd('aw2', '*/ aw 1 2'),
		gd('y6', '+- b 0 aw2'),
		gd('x1', '+- l ah 0'),
		gd('swAng', 'at2 dy ah'),
		gd('mswAng', '+- 0 0 swAng'),
		gd('ix', '+- l idx 0'),
		gd('iy', '+/ hR y3 2'),
		gd('q12', '*/ th 1 2'),
		gd('dang2', 'at2 q12 idx'),
		gd('swAng2', '+- dang2 0 swAng'),
		gd('swAng3', '+- swAng dang2 0'),
		gd('stAng3', '+- 0 0 dang2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'x1', y: 'y5' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'swAng', swAng: 'swAng2' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'stAng3', swAng: 'swAng3' },
				{ kind: 'lnTo', x: 'x1', y: 'y8' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'darkenLess',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'y3' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '0', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 't' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'y3' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '0', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 't' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: '0', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'x1', y: 'y8' },
				{ kind: 'lnTo', x: 'l', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'x1', y: 'y5' },
				{ kind: 'arcTo', wR: 'w', hR: 'hR', stAng: 'swAng', swAng: 'swAng2' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// curvedUpArrow (ISO/IEC 29500-1 §20.1.10.55)
// ---------------------------------------------------------------------------
const curvedUpArrow: PresetShapeGeometryDefinition = {
	name: 'curvedUpArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('maxAdj2', '*/ 50000 w ss'),
		gd('a2', 'pin 0 adj2 maxAdj2'),
		gd('a1', 'pin 0 adj1 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('aw', '*/ ss a2 100000'),
		gd('q1', '+/ th aw 4'),
		gd('wR', '+- wd2 0 q1'),
		gd('q7', '*/ wR 2 1'),
		gd('q8', '*/ q7 q7 1'),
		gd('q9', '*/ th th 1'),
		gd('q10', '+- q8 0 q9'),
		gd('q11', 'sqrt q10'),
		gd('idy', '*/ q11 h q7'),
		gd('maxAdj3', '*/ 100000 idy ss'),
		gd('a3', 'pin 0 adj3 maxAdj3'),
		gd('ah', '*/ ss adj3 100000'),
		gd('x3', '+- wR th 0'),
		gd('q2', '*/ h h 1'),
		gd('q3', '*/ ah ah 1'),
		gd('q4', '+- q2 0 q3'),
		gd('q5', 'sqrt q4'),
		gd('dx', '*/ q5 wR h'),
		gd('x5', '+- wR dx 0'),
		gd('x7', '+- x3 dx 0'),
		gd('q6', '+- aw 0 th'),
		gd('dh', '*/ q6 1 2'),
		gd('x4', '+- x5 0 dh'),
		gd('x8', '+- x7 dh 0'),
		gd('aw2', '*/ aw 1 2'),
		gd('x6', '+- r 0 aw2'),
		gd('y1', '+- t ah 0'),
		gd('swAng', 'at2 dx ah'),
		gd('mswAng', '+- 0 0 swAng'),
		gd('iy', '+- t idy 0'),
		gd('ix', '+/ wR x3 2'),
		gd('q12', '*/ th 1 2'),
		gd('dang2', 'at2 q12 idy'),
		gd('swAng2', '+- dang2 0 swAng'),
		gd('mswAng2', '+- 0 0 swAng2'),
		gd('stAng3', '+- cd4 0 swAng'),
		gd('swAng3', '+- swAng dang2 0'),
		gd('stAng2', '+- cd4 0 dang2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'x6', y: 't' },
				{ kind: 'lnTo', x: 'x8', y: 'y1' },
				{ kind: 'lnTo', x: 'x7', y: 'y1' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng3', swAng: 'swAng3' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng2', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'darkenLess',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'wR', y: 'b' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'th', y: 't' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd2', swAng: '-5400000' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'ix', y: 'iy' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng2', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 't' },
				{ kind: 'lnTo', x: 'x8', y: 'y1' },
				{ kind: 'lnTo', x: 'x7', y: 'y1' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng3', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'wR', y: 'b' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'th', y: 't' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd2', swAng: '-5400000' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// curvedDownArrow (ISO/IEC 29500-1 §20.1.10.55)
// ---------------------------------------------------------------------------
const curvedDownArrow: PresetShapeGeometryDefinition = {
	name: 'curvedDownArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('maxAdj2', '*/ 50000 w ss'),
		gd('a2', 'pin 0 adj2 maxAdj2'),
		gd('a1', 'pin 0 adj1 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('aw', '*/ ss a2 100000'),
		gd('q1', '+/ th aw 4'),
		gd('wR', '+- wd2 0 q1'),
		gd('q7', '*/ wR 2 1'),
		gd('q8', '*/ q7 q7 1'),
		gd('q9', '*/ th th 1'),
		gd('q10', '+- q8 0 q9'),
		gd('q11', 'sqrt q10'),
		gd('idy', '*/ q11 h q7'),
		gd('maxAdj3', '*/ 100000 idy ss'),
		gd('a3', 'pin 0 adj3 maxAdj3'),
		gd('ah', '*/ ss adj3 100000'),
		gd('x3', '+- wR th 0'),
		gd('q2', '*/ h h 1'),
		gd('q3', '*/ ah ah 1'),
		gd('q4', '+- q2 0 q3'),
		gd('q5', 'sqrt q4'),
		gd('dx', '*/ q5 wR h'),
		gd('x5', '+- wR dx 0'),
		gd('x7', '+- x3 dx 0'),
		gd('q6', '+- aw 0 th'),
		gd('dh', '*/ q6 1 2'),
		gd('x4', '+- x5 0 dh'),
		gd('x8', '+- x7 dh 0'),
		gd('aw2', '*/ aw 1 2'),
		gd('x6', '+- r 0 aw2'),
		gd('y1', '+- b 0 ah'),
		gd('swAng', 'at2 dx ah'),
		gd('mswAng', '+- 0 0 swAng'),
		gd('iy', '+- b 0 idy'),
		gd('ix', '+/ wR x3 2'),
		gd('q12', '*/ th 1 2'),
		gd('dang2', 'at2 q12 idy'),
		gd('stAng', '+- 3cd4 swAng 0'),
		gd('stAng2', '+- 3cd4 0 dang2'),
		gd('swAng2', '+- dang2 0 cd4'),
		gd('swAng3', '+- cd4 dang2 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'x6', y: 'b' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x5', y: 'y1' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng', swAng: 'mswAng' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: '3cd4', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'x8', y: 'y1' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'darkenLess',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'ix', y: 'iy' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng2', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd2', swAng: 'swAng3' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'ix', y: 'iy' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng2', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: '3cd4', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'x8', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'b' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x5', y: 'y1' },
				{ kind: 'arcTo', wR: 'wR', hR: 'h', stAng: 'stAng', swAng: 'mswAng' },
			],
		},
	],
};

/**
 * Spec-exact curved-arrow preset definitions. Spread LAST in
 * `preset-shape-definitions-table.ts` so they override the earlier simplified
 * and refined registrations for the same four shape names.
 */
export const EXACT_CURVED_ARROW_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> =
	{
		curvedRightArrow,
		curvedLeftArrow,
		curvedUpArrow,
		curvedDownArrow,
	};
