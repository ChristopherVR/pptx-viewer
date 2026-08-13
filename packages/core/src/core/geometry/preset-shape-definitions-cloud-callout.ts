/**
 * ECMA-376 ST_ShapeType preset geometry for `cloudCallout`.
 *
 * `cloudCallout` is a real `ST_ShapeType` member (ISO/IEC 29500-1 section
 * 20.1.10.55) that was missing from `PRESET_SHAPE_GEOMETRY_TABLE`, so it
 * degraded to the adjustment-blind polygon in `preset-shape-clip-paths.ts`.
 * This module transcribes the canonical `presetShapeDefinitions.xml` entry
 * verbatim:
 *
 *   - `adj1` / `adj2` place the callout tail target relative to the centre
 *     (defaults -20833 / 62500, i.e. below and to the left);
 *   - the first sub-path is the cloud body, an eleven-arc chain authored in
 *     the legacy 43200x43200 drawing grid (the evaluator maps that space onto
 *     the shape box via `PresetPath.w` / `PresetPath.h`);
 *   - three single-arc sub-paths draw the shrinking tail bubbles, positioned
 *     by the `g*` guide chain in SHAPE space (no path space declared);
 *   - the final `fill="none"` sub-path is the scalloped outline overlay.
 *
 * The guide chain exercises `cat2` / `sat2` / `mod` / `at2`, all of which
 * follow the ECMA operand order in `guide-formula-eval.ts`.
 *
 * Aggregated into `PRESET_SHAPE_GEOMETRY_TABLE` by
 * `preset-shape-definitions-table.ts`.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const cloudCallout: PresetShapeGeometryDefinition = {
	name: 'cloudCallout',
	avLst: { adj1: -20833, adj2: 62500 },
	gdLst: [
		gd('dxPos', '*/ w adj1 100000'),
		gd('dyPos', '*/ h adj2 100000'),
		gd('xPos', '+- hc dxPos 0'),
		gd('yPos', '+- vc dyPos 0'),
		gd('ht', 'cat2 hd2 dxPos dyPos'),
		gd('wt', 'sat2 wd2 dxPos dyPos'),
		gd('g2', 'cat2 wd2 ht wt'),
		gd('g3', 'sat2 hd2 ht wt'),
		gd('g4', '+- hc g2 0'),
		gd('g5', '+- vc g3 0'),
		gd('g6', '+- g4 0 xPos'),
		gd('g7', '+- g5 0 yPos'),
		gd('g8', 'mod g6 g7 0'),
		gd('g9', '*/ ss 6600 21600'),
		gd('g10', '+- g8 0 g9'),
		gd('g11', '*/ g10 1 3'),
		gd('g12', '*/ ss 1800 21600'),
		gd('g13', '+- g11 g12 0'),
		gd('g14', '*/ g13 g6 g8'),
		gd('g15', '*/ g13 g7 g8'),
		gd('g16', '+- g14 xPos 0'),
		gd('g17', '+- g15 yPos 0'),
		gd('g18', '*/ ss 4800 21600'),
		gd('g19', '*/ g11 2 1'),
		gd('g20', '+- g18 g19 0'),
		gd('g21', '*/ g20 g6 g8'),
		gd('g22', '*/ g20 g7 g8'),
		gd('g23', '+- g21 xPos 0'),
		gd('g24', '+- g22 yPos 0'),
		gd('g25', '*/ ss 1200 21600'),
		gd('g26', '*/ ss 600 21600'),
		gd('x23', '+- xPos g26 0'),
		gd('x24', '+- g16 g25 0'),
		gd('x25', '+- g23 g12 0'),
		gd('il', '*/ w 2977 21600'),
		gd('it', '*/ h 3262 21600'),
		gd('ir', '*/ w 17087 21600'),
		gd('ib', '*/ h 17337 21600'),
		gd('g27', '*/ w 67 21600'),
		gd('g28', '*/ h 21577 21600'),
		gd('g29', '*/ w 21582 21600'),
		gd('g30', '*/ h 1235 21600'),
		gd('pang', 'at2 dxPos dyPos'),
	],
	rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	pathLst: [
		{
			w: 43200,
			h: 43200,
			commands: [
				{ kind: 'moveTo', x: '3900', y: '14370' },
				{ kind: 'arcTo', wR: '6753', hR: '9190', stAng: '-11429249', swAng: '7426832' },
				{ kind: 'arcTo', wR: '5333', hR: '7267', stAng: '-8646143', swAng: '5396714' },
				{ kind: 'arcTo', wR: '4365', hR: '5945', stAng: '-8748475', swAng: '5983381' },
				{ kind: 'arcTo', wR: '4857', hR: '6595', stAng: '-7859164', swAng: '7034504' },
				{ kind: 'arcTo', wR: '5333', hR: '7273', stAng: '-4722533', swAng: '6541615' },
				{ kind: 'arcTo', wR: '6775', hR: '9220', stAng: '-2776035', swAng: '7816140' },
				{ kind: 'arcTo', wR: '5785', hR: '7867', stAng: '37501', swAng: '6842000' },
				{ kind: 'arcTo', wR: '6752', hR: '9215', stAng: '1347096', swAng: '6910353' },
				{ kind: 'arcTo', wR: '7720', hR: '10543', stAng: '3974558', swAng: '4542661' },
				{ kind: 'arcTo', wR: '4360', hR: '5918', stAng: '-16496525', swAng: '8804134' },
				{ kind: 'arcTo', wR: '4345', hR: '5945', stAng: '-14809710', swAng: '9151131' },
				{ kind: 'close' },
			],
		},
		{
			commands: [
				{ kind: 'moveTo', x: 'x23', y: 'yPos' },
				{ kind: 'arcTo', wR: 'g26', hR: 'g26', stAng: '0', swAng: '21600000' },
				{ kind: 'close' },
			],
		},
		{
			commands: [
				{ kind: 'moveTo', x: 'x24', y: 'g17' },
				{ kind: 'arcTo', wR: 'g25', hR: 'g25', stAng: '0', swAng: '21600000' },
				{ kind: 'close' },
			],
		},
		{
			commands: [
				{ kind: 'moveTo', x: 'x25', y: 'g24' },
				{ kind: 'arcTo', wR: 'g12', hR: 'g12', stAng: '0', swAng: '21600000' },
				{ kind: 'close' },
			],
		},
		{
			w: 43200,
			h: 43200,
			fill: 'none',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: '4693', y: '26177' },
				{ kind: 'arcTo', wR: '4345', hR: '5945', stAng: '5204520', swAng: '1585770' },
				{ kind: 'moveTo', x: '6928', y: '34899' },
				{ kind: 'arcTo', wR: '4360', hR: '5918', stAng: '4416628', swAng: '686848' },
				{ kind: 'moveTo', x: '16478', y: '39090' },
				{ kind: 'arcTo', wR: '6752', hR: '9215', stAng: '8257449', swAng: '844866' },
				{ kind: 'moveTo', x: '28827', y: '34751' },
				{ kind: 'arcTo', wR: '6752', hR: '9215', stAng: '387196', swAng: '959901' },
				{ kind: 'moveTo', x: '34129', y: '22954' },
				{ kind: 'arcTo', wR: '5785', hR: '7867', stAng: '-4217541', swAng: '4255042' },
				{ kind: 'moveTo', x: '41798', y: '15354' },
				{ kind: 'arcTo', wR: '5333', hR: '7273', stAng: '1819082', swAng: '1665090' },
				{ kind: 'moveTo', x: '38324', y: '5426' },
				{ kind: 'arcTo', wR: '4857', hR: '6595', stAng: '-824660', swAng: '891534' },
				{ kind: 'moveTo', x: '29078', y: '3952' },
				{ kind: 'arcTo', wR: '4857', hR: '6595', stAng: '-8950887', swAng: '1091722' },
				{ kind: 'moveTo', x: '22141', y: '4720' },
				{ kind: 'arcTo', wR: '4365', hR: '5945', stAng: '-9809656', swAng: '1061181' },
				{ kind: 'moveTo', x: '14000', y: '5192' },
				{ kind: 'arcTo', wR: '6753', hR: '9190', stAng: '-4002417', swAng: '739161' },
				{ kind: 'moveTo', x: '4127', y: '15789' },
				{ kind: 'arcTo', wR: '6753', hR: '9190', stAng: '9459261', swAng: '711490' },
			],
		},
	],
};

/** `cloudCallout` preset definition, keyed by its ECMA-376 ST_ShapeType name. */
export const CLOUD_CALLOUT_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	cloudCallout,
};
