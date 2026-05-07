/**
 * ECMA-376 ST_ShapeType preset geometry definitions — curved connectors
 * (`curvedConnector2`/`3`/`4`/`5`) and bracket / brace primitives
 * (`leftBracket`, `rightBracket`, `leftBrace`, `rightBrace`, `bracketPair`,
 * `bracePair`).
 *
 * Connectors are stroke-only paths (`fill: 'none'`, `stroke: true`) that draw
 * smooth cubic-bezier curves between their endpoints. The number of explicit
 * adjustment values matches the count of intermediate control points along
 * the curve (none, one, two, three) — so `curvedConnector2` is a fixed
 * S-curve while `curvedConnector5` exposes three midpoint adjustments.
 *
 * Brackets and braces are SOLID closed outlines, not stroked-only forms.
 * They are drawn by tracing a thin rounded-corner shape that visually reads
 * as a `[`, `]`, `{` or `}`. Each shape uses one or two adjustment values:
 *
 *   leftBracket / rightBracket — adj1: corner radius (1/100000 of ss)
 *   leftBrace   / rightBrace   — adj1: middle pinch position (vertical %)
 *                                 adj2: corner radius (1/100000 of ss)
 *   bracketPair                 — adj1: corner radius (shared)
 *   bracePair                   — adj1: corner radius (shared)
 *
 * All formulas use only the documented operators implemented in
 * `guide-formula-eval` (17 ops: +-, mul-div, pin, val, abs, sin, cos, at2,
 * etc.) and the standard implicit guides published by `guide-formula-api`
 * (l, t, r, b, hc, vc, wd2, hd2, ss, cd2, cd4, 3cd4, etc.).
 *
 * Aggregation into `PRESET_SHAPE_GEOMETRY_TABLE` is performed manually in
 * `preset-shape-definitions-table.ts` once batch agents return.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// Curved connectors
// ---------------------------------------------------------------------------

/**
 * curvedConnector2 — single cubic bezier with no adjustments.
 *
 * The endpoints are the bounding box corners (`l,t` → `r,b`); the two control
 * points are placed midway in each axis to give the canonical S-curve. This
 * matches the ECMA reference `<presetShapeDefinition name="curvedConnector2">`
 * which has an empty `avLst` and a single sub-path with one cubicBezTo.
 */
const curvedConnector2: PresetShapeGeometryDefinition = {
	name: 'curvedConnector2',
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{
					kind: 'cubicBezTo',
					x1: 'hc',
					y1: 't',
					x2: 'r',
					y2: 'vc',
					x3: 'r',
					y3: 'b',
				},
			],
		},
	],
};

/**
 * curvedConnector3 — two cubic beziers joined at the midpoint.
 *
 * Single adjustment `adj1` (default 50000, range 0..100000) controls the
 * horizontal split position of the midpoint as a fraction of the bounding
 * width. Each half is a smooth cubic with control points placed at quarter
 * intervals so the joined curve has C1 continuity at the midpoint.
 */
const curvedConnector3: PresetShapeGeometryDefinition = {
	name: 'curvedConnector3',
	avLst: { adj1: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		// Midpoint x: hc shifted by (a1 - 50000) * w / 100000 → simply a1 * w / 100000.
		gd('x2', '*/ w a1 100000'),
		// Bezier control offsets: half-distance horizontally to keep slope smooth.
		gd('x1', '*/ x2 1 2'),
		gd('x4', '+- r 0 x2'),
		gd('x5', '*/ x4 1 2'),
		gd('x6', '+- x2 x5 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{
					kind: 'cubicBezTo',
					x1: 'x1',
					y1: 't',
					x2: 'x2',
					y2: 'vc',
					x3: 'x2',
					y3: 'vc',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x2',
					y1: 'vc',
					x2: 'x6',
					y2: 'b',
					x3: 'r',
					y3: 'b',
				},
			],
		},
	],
};

/**
 * curvedConnector4 — three cubic beziers with two midpoint adjustments.
 *
 * `adj1` and `adj2` control horizontal split positions of the two interior
 * waypoints (in 1/100000 of width). Defaults: 50000 / 50000.
 */
const curvedConnector4: PresetShapeGeometryDefinition = {
	name: 'curvedConnector4',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x2', '*/ w a1 100000'),
		gd('x4', '*/ w a2 100000'),
		gd('y2', '*/ h 33333 100000'),
		gd('y4', '*/ h 66667 100000'),
		gd('x1', '*/ x2 1 2'),
		gd('x3', '*/ x4 1 2'),
		gd('x5', '+- r 0 x4'),
		gd('x6', '*/ x5 1 2'),
		gd('x7', '+- x4 x6 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{
					kind: 'cubicBezTo',
					x1: 'x1',
					y1: 't',
					x2: 'x2',
					y2: 'y2',
					x3: 'x2',
					y3: 'y2',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x2',
					y1: 'y2',
					x2: 'x3',
					y2: 'vc',
					x3: 'x4',
					y3: 'y4',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x4',
					y1: 'y4',
					x2: 'x7',
					y2: 'b',
					x3: 'r',
					y3: 'b',
				},
			],
		},
	],
};

/**
 * curvedConnector5 — four cubic beziers chained through three adjustable
 * waypoints. `adj1`, `adj2`, `adj3` are each a horizontal position in
 * 1/100000 of width; defaults 50000 / 50000 / 50000.
 */
const curvedConnector5: PresetShapeGeometryDefinition = {
	name: 'curvedConnector5',
	avLst: { adj1: 50000, adj2: 50000, adj3: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('x2', '*/ w a1 100000'),
		gd('x4', '*/ w a2 100000'),
		gd('x6', '*/ w a3 100000'),
		gd('y2', '*/ h 25000 100000'),
		gd('y4', '*/ h 50000 100000'),
		gd('y6', '*/ h 75000 100000'),
		gd('x1', '*/ x2 1 2'),
		gd('x3', '*/ x4 1 2'),
		gd('x5', '*/ x6 1 2'),
		gd('x7', '+- r 0 x6'),
		gd('x8', '*/ x7 1 2'),
		gd('x9', '+- x6 x8 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{
					kind: 'cubicBezTo',
					x1: 'x1',
					y1: 't',
					x2: 'x2',
					y2: 'y2',
					x3: 'x2',
					y3: 'y2',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x2',
					y1: 'y2',
					x2: 'x3',
					y2: 'y4',
					x3: 'x4',
					y3: 'y4',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x4',
					y1: 'y4',
					x2: 'x5',
					y2: 'y6',
					x3: 'x6',
					y3: 'y6',
				},
				{
					kind: 'cubicBezTo',
					x1: 'x6',
					y1: 'y6',
					x2: 'x9',
					y2: 'b',
					x3: 'r',
					y3: 'b',
				},
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Brackets and braces
// ---------------------------------------------------------------------------

/**
 * leftBracket — solid `[` outline. Single adj1 = corner radius
 * (1/100000 of `ss`, default 8333 ≈ 1/12). The shape is a thin closed
 * polygon: trace down the inner edge then back up the outer edge.
 *
 * Coordinate plan (one-pixel-wide stroke is up to the consumer):
 *   - corner radius `r1 = ss * a1 / 100000`
 *   - top arc from (r1, t) curving up-left to (l, t+r1)
 *   - bottom arc from (l, b-r1) curving down-right to (r1, b)
 *
 * The path is closed; the resulting shape encloses no fillable area, but
 * keeping it closed lets it pick up `fill="norm"` styling consistent with
 * how PowerPoint paints the bracket as a thin filled glyph.
 */
const leftBracket: PresetShapeGeometryDefinition = {
	name: 'leftBracket',
	avLst: { adj: 8333 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('r1', '*/ ss a 100000'),
		gd('y1', '+- t r1 0'),
		gd('y2', '+- b 0 r1'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'y2' },
	pathLst: [
		{
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r1', y: 't' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: 'cd2', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

/**
 * rightBracket — solid `]` outline (mirror of leftBracket).
 */
const rightBracket: PresetShapeGeometryDefinition = {
	name: 'rightBracket',
	avLst: { adj: 8333 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('r1', '*/ ss a 100000'),
		gd('x1', '+- r 0 r1'),
		gd('y1', '+- t r1 0'),
		gd('y2', '+- b 0 r1'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'y2' },
	pathLst: [
		{
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
	],
};

/**
 * leftBrace — solid `{` outline.
 *
 * Two adjustment values:
 *   adj1 — vertical position of the centre pinch (1/100000 of height).
 *          Default 50000 (centred).
 *   adj2 — corner radius (1/100000 of ss). Default 8333.
 *
 * The path traces six rounded-corner arcs to form the classic curly brace.
 */
const leftBrace: PresetShapeGeometryDefinition = {
	name: 'leftBrace',
	avLst: { adj1: 8333, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('q1', '*/ ss a1 100000'),
		gd('q2', '+- 100000 0 a2'),
		gd('q3', '*/ q2 1 2'),
		gd('y1', '*/ h q3 100000'),
		gd('y3', '+- b 0 y1'),
		gd('y2', '+- y1 q1 0'),
		gd('y4', '+- y3 0 q1'),
	],
	rect: { l: 'r', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'q1', y: 't' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '0', swAng: '-5400000' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd2', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'q1', y: 'b' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'close' },
			],
		},
	],
};

/**
 * rightBrace — solid `}` outline (horizontal mirror of leftBrace).
 */
const rightBrace: PresetShapeGeometryDefinition = {
	name: 'rightBrace',
	avLst: { adj1: 8333, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('q1', '*/ ss a1 100000'),
		gd('q2', '+- 100000 0 a2'),
		gd('q3', '*/ q2 1 2'),
		gd('y1', '*/ h q3 100000'),
		gd('y3', '+- b 0 y1'),
		gd('y2', '+- y1 q1 0'),
		gd('y4', '+- y3 0 q1'),
		gd('x1', '+- r 0 q1'),
	],
	rect: { l: 'l', t: 't', r: 'l', b: 'b' },
	pathLst: [
		{
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

/**
 * bracketPair — matched `[ ]` pair drawn as two rounded-corner sub-paths.
 * Single adj = corner radius shared by both. Default 16667.
 */
const bracketPair: PresetShapeGeometryDefinition = {
	name: 'bracketPair',
	avLst: { adj: 16667 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('r1', '*/ ss a 100000'),
		gd('x1', '+- l r1 0'),
		gd('x2', '+- r 0 r1'),
		gd('y1', '+- t r1 0'),
		gd('y2', '+- b 0 r1'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			stroke: true,
			commands: [
				// Left bracket
				{ kind: 'moveTo', x: 'x1', y: 't' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: 'cd2', swAng: '-5400000' },
				// Move to right bracket starting point
				{ kind: 'moveTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'r1', hR: 'r1', stAng: '0', swAng: 'cd4' },
			],
		},
	],
};

/**
 * bracePair — matched `{ }` pair drawn as two sub-paths sharing one
 * corner-radius adjustment. Default adj = 8333.
 */
const bracePair: PresetShapeGeometryDefinition = {
	name: 'bracePair',
	avLst: { adj: 8333 },
	gdLst: [
		gd('a', 'pin 0 adj 25000'),
		gd('q1', '*/ ss a 100000'),
		gd('q2', '*/ h 1 2'),
		gd('y1', '+- vc 0 q1'),
		gd('y2', '+- vc q1 0'),
		gd('x2', '+- l q1 0'),
		gd('x3', '+- r 0 q1'),
		gd('y3', '+- t q1 0'),
		gd('y4', '+- b 0 q1'),
	],
	rect: { l: 'x2', t: 'y3', r: 'x3', b: 'y4' },
	pathLst: [
		{
			stroke: true,
			commands: [
				// Left brace
				{ kind: 'moveTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '0', swAng: '-5400000' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'l', y: 'y4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd2', swAng: '-5400000' },
				// Right brace
				{ kind: 'moveTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'arcTo', wR: 'q1', hR: 'q1', stAng: '0', swAng: 'cd4' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Connector + bracket preset definitions exported for manual aggregation
 * into `PRESET_SHAPE_GEOMETRY_TABLE`. Keys are ECMA-376 ST_ShapeType names.
 */
export const CONNECTORS_BRACKETS_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> =
	{
		curvedConnector2,
		curvedConnector3,
		curvedConnector4,
		curvedConnector5,
		leftBracket,
		rightBracket,
		leftBrace,
		rightBrace,
		bracketPair,
		bracePair,
	};
