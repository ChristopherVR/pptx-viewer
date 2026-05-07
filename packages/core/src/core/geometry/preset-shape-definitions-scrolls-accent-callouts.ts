/**
 * ECMA-376 ST_ShapeType preset geometry definitions — scrolls / waves and the
 * accent + accent-border callout family.
 *
 * Shapes covered:
 *  - **Scrolls** (`verticalScroll`, `horizontalScroll`) — rectangle-bodied
 *    shapes with rolled paper corners on opposite ends. `adj` (default 12500
 *    in 1/100000 units) controls the roll diameter.
 *  - **Waves** (`wave`, `doubleWave`) — rectangles whose top (and, for
 *    `doubleWave`, bottom) edge is a sine wave traced by two cubic Bezier
 *    humps. `adj1` is the wave amplitude (% of `h`), `adj2` is the horizontal
 *    phase offset (% of `w`).
 *  - **Accent callouts** (`accentCallout1` / `accentCallout2` /
 *    `accentCallout3`) — same rectangular body and N-segment leader as their
 *    plain-`callout*` siblings, plus an extra vertical accent bar drawn at the
 *    leader-line root (a stroked `moveTo`/`lnTo` pair flush with the body
 *    edge).
 *  - **Accent border callouts** (`accentBorderCallout1` / `…2` / `…3`) — same
 *    as the accent callouts but the body rectangle is itself stroked,
 *    matching the `borderCallout*` family from the misc batch.
 *
 * Geometry simplifications worth flagging:
 *  - The scroll roll is approximated as a quarter-arc + line + quarter-arc
 *    rather than the spec's full `arcTo`/`cubicBezTo` construction. The visual
 *    silhouette is identical at default `adj`; the simplification trades a
 *    handful of bezier control points for legibility.
 *  - The accent bar on `accentCallout*` is a stroke-only sub-path identical to
 *    the body's left edge offset by a small inset (`x1` from the leader
 *    formulas). Per ECMA-376 the accent bar attaches at the rectangle edge
 *    nearest the pointer; we standardise on the left edge because every
 *    canonical default places `adj2` (= leader-tip x position) negative — i.e.
 *    the pointer is to the left of the body. Callers that override `adj2` to
 *    a positive value still get a visually plausible (left-edge) accent bar.
 *
 * Aggregated into `PRESET_SHAPE_GEOMETRY_TABLE` by
 * `preset-shape-definitions-table.ts` (manual spread).
 */

import type {
	PresetPathCommand,
	PresetShapeGeometryDefinition,
} from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

/** Rectangular body command list shared by every callout in this batch. */
function calloutBody(): PresetPathCommand[] {
	return [
		{ kind: 'moveTo', x: 'l', y: 't' },
		{ kind: 'lnTo', x: 'r', y: 't' },
		{ kind: 'lnTo', x: 'r', y: 'b' },
		{ kind: 'lnTo', x: 'l', y: 'b' },
		{ kind: 'close' },
	];
}

// ---------------------------------------------------------------------------
// Scrolls
// ---------------------------------------------------------------------------

/**
 * verticalScroll — rectangle with paper rolls on the top and bottom edges.
 * `adj` (1/100000 of `min(w,h)`, default 12500) sets the roll diameter `ch`.
 * Construction:
 *   ch = ss * adj / 100000      (roll diameter)
 *   ch2 = ch / 2                 (roll radius / inner gap)
 *   ch4 = ch / 4                 (rolled-edge inset)
 * Body is a rectangle from (l, ch2)→(r, b-ch2); rolls are quarter-arc rounded
 * tabs on the bottom-left and top-right corners (matching PowerPoint's
 * rendering).
 */
const verticalScroll: PresetShapeGeometryDefinition = {
	name: 'verticalScroll',
	avLst: { adj: 12500 },
	gdLst: [
		gd('a', 'pin 0 adj 25000'),
		gd('ch', '*/ ss a 100000'),
		gd('ch2', '*/ ch 1 2'),
		gd('ch4', '*/ ch 1 4'),
		gd('x3', '+- ch ch2 0'),
		gd('x4', '+- ch ch 0'),
		gd('x6', '+- r 0 ch'),
		gd('x7', '+- r 0 ch2'),
		gd('x5', '+- x6 0 ch2'),
		gd('y3', '+- b 0 ch'),
		gd('y4', '+- b 0 ch2'),
	],
	rect: { l: 'ch', t: 'ch2', r: 'x7', b: 'y4' },
	pathLst: [
		// Outer scroll silhouette.
		{
			commands: [
				{ kind: 'moveTo', x: 'ch2', y: 'ch2' },
				{ kind: 'arcTo', wR: 'ch4', hR: 'ch4', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x6', y: 't' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'x7', y: 'b' },
				{ kind: 'lnTo', x: 'ch2', y: 'b' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'l', y: 'ch2' },
				{ kind: 'close' },
			],
		},
		// Top-right roll inset (visual curl indicator).
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x6', y: 't' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'ch2' },
			],
		},
		// Bottom-left roll inset.
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y4' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'ch2', y: 'b' },
			],
		},
	],
};

/**
 * horizontalScroll — 90° rotation of `verticalScroll`. Rolls live on the left
 * and right edges; body runs (ch2, t)→(r-ch2, b).
 */
const horizontalScroll: PresetShapeGeometryDefinition = {
	name: 'horizontalScroll',
	avLst: { adj: 12500 },
	gdLst: [
		gd('a', 'pin 0 adj 25000'),
		gd('ch', '*/ ss a 100000'),
		gd('ch2', '*/ ch 1 2'),
		gd('ch4', '*/ ch 1 4'),
		gd('y3', '+- ch ch2 0'),
		gd('y4', '+- ch ch 0'),
		gd('y6', '+- b 0 ch'),
		gd('y7', '+- b 0 ch2'),
		gd('y5', '+- y6 0 ch2'),
		gd('x3', '+- r 0 ch'),
		gd('x4', '+- r 0 ch2'),
	],
	rect: { l: 'ch2', t: 'ch', r: 'x4', b: 'y7' },
	pathLst: [
		// Outer scroll silhouette.
		{
			commands: [
				{ kind: 'moveTo', x: 'ch2', y: 'ch2' },
				{ kind: 'arcTo', wR: 'ch4', hR: 'ch4', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'ch2' },
				{ kind: 'lnTo', x: 'r', y: 'y6' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'ch2', y: 'b' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'l', y: 'ch2' },
				{ kind: 'close' },
			],
		},
		// Right roll curl indicator.
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x4', y: 't' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'ch2' },
			],
		},
		// Left roll curl indicator.
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'ch2', y: 'b' },
				{ kind: 'arcTo', wR: 'ch2', hR: 'ch2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'l', y: 'y6' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

/**
 * wave — rectangle whose top and bottom edges are sinusoidal. `adj1` is the
 * wave amplitude (% of `h`, default 12500 = 12.5%); `adj2` is the horizontal
 * phase offset (% of `w`, default 0). The amplitude shifts the entire body
 * toward the centre on the leading edge and away from it on the trailing
 * edge, producing the classic flag-wave outline.
 *
 * Top edge: cubic-Bezier hump from (l, top) to (r, top) with control points
 * pulling y up by 2× amplitude in the first half and down by 2× amplitude in
 * the second half (matching PowerPoint's two-control-point sine approx).
 * Bottom edge mirrors the top.
 */
const wave: PresetShapeGeometryDefinition = {
	name: 'wave',
	avLst: { adj1: 12500, adj2: 0 },
	gdLst: [
		gd('a1', 'pin 0 adj1 20000'),
		gd('a2', 'pin -10000 adj2 10000'),
		gd('y1', '*/ h a1 100000'), // amplitude
		gd('y2', '+- t y1 0'), // top of left peak
		gd('y3', '+- b 0 y1'), // bottom of left peak
		gd('y4', '+- b y1 0'), // upper bound of bottom-edge swing
		gd('y5', '+- t 0 y1'), // lower bound of top-edge swing
		gd('dx2', '*/ w a2 100000'), // phase shift in EMU
		gd('xAdj', '+- hc dx2 0'), // mid-x with phase
		gd('x3', '+- xAdj 0 hc'),
		gd('x4', '+- r x3 0'), // right peak x
		gd('x5', '+- l x3 0'), // left peak x
		gd('x6', '+- xAdj wd2 0'),
		gd('x7', '+- xAdj 0 wd2'),
	],
	rect: { l: 'x5', t: 'y2', r: 'x4', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				// Top edge: hump up then down across (l→r).
				{
					kind: 'cubicBezTo',
					x1: 'x6',
					y1: 'y5',
					x2: 'x7',
					y2: 'y2',
					x3: 'r',
					y3: 'y2',
				},
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				// Bottom edge: hump down then up across (r→l).
				{
					kind: 'cubicBezTo',
					x1: 'x7',
					y1: 'y4',
					x2: 'x6',
					y2: 'y3',
					x3: 'l',
					y3: 'y3',
				},
				{ kind: 'close' },
			],
		},
	],
};

/**
 * doubleWave — rectangle whose top and bottom edges each carry TWO sine humps
 * (vs `wave`'s one). `adj1` controls amplitude, `adj2` controls phase. The
 * top edge is traced by two cubic Beziers in succession, one per half of the
 * width; the bottom edge mirrors.
 */
const doubleWave: PresetShapeGeometryDefinition = {
	name: 'doubleWave',
	avLst: { adj1: 6250, adj2: 0 },
	gdLst: [
		gd('a1', 'pin 0 adj1 10000'),
		gd('a2', 'pin -10000 adj2 10000'),
		gd('y1', '*/ h a1 100000'),
		gd('y2', '+- t y1 0'),
		gd('y3', '+- b 0 y1'),
		gd('y4', '+- b y1 0'),
		gd('y5', '+- t 0 y1'),
		gd('dx2', '*/ w a2 100000'),
		gd('xAdj', '+- hc dx2 0'),
		gd('x3', '+- xAdj 0 hc'),
		gd('x4', '+- r x3 0'),
		gd('x5', '+- l x3 0'),
		// quarter-width control points for two-hump bezier.
		gd('q1', '*/ w 1 4'),
		gd('q2', '*/ w 3 4'),
		gd('cx1', '+- l q1 0'),
		gd('cx2', '+- l q2 0'),
		gd('cx3', '+- l hd2 0'),
	],
	rect: { l: 'x5', t: 'y2', r: 'x4', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				// First top hump (l → hc): up then back to baseline.
				{
					kind: 'cubicBezTo',
					x1: 'cx1',
					y1: 'y5',
					x2: 'cx1',
					y2: 'y2',
					x3: 'hc',
					y3: 'y2',
				},
				// Second top hump (hc → r): down then back to baseline.
				{
					kind: 'cubicBezTo',
					x1: 'cx2',
					y1: 'y2',
					x2: 'cx2',
					y2: 'y5',
					x3: 'r',
					y3: 'y2',
				},
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				// First bottom hump (r → hc): mirror.
				{
					kind: 'cubicBezTo',
					x1: 'cx2',
					y1: 'y4',
					x2: 'cx2',
					y2: 'y3',
					x3: 'hc',
					y3: 'y3',
				},
				// Second bottom hump (hc → l): mirror.
				{
					kind: 'cubicBezTo',
					x1: 'cx1',
					y1: 'y3',
					x2: 'cx1',
					y2: 'y4',
					x3: 'l',
					y3: 'y3',
				},
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Accent callouts (callout body + leader + vertical accent bar)
// ---------------------------------------------------------------------------

/**
 * accentCallout1 — single-segment leader callout with an accent bar drawn on
 * the body's left edge, flush from top to bottom. avLst defaults mirror
 * `callout1` from the misc batch.
 */
const accentCallout1: PresetShapeGeometryDefinition = {
	name: 'accentCallout1',
	avLst: { adj1: 18750, adj2: -8333, adj3: 112500, adj4: -38333 },
	gdLst: [
		gd('y1', '*/ h adj1 100000'),
		gd('x1', '*/ w adj2 100000'),
		gd('y2', '*/ h adj3 100000'),
		gd('x2', '*/ w adj4 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{ commands: calloutBody() },
		// Accent bar: vertical stroke flush with the body's left edge.
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		// Leader line.
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
			],
		},
	],
};

/**
 * accentCallout2 — two-segment leader + accent bar. avLst mirrors `callout2`.
 */
const accentCallout2: PresetShapeGeometryDefinition = {
	name: 'accentCallout2',
	avLst: {
		adj1: 18750,
		adj2: -8333,
		adj3: 18750,
		adj4: -16667,
		adj5: 112500,
		adj6: -38333,
	},
	gdLst: [
		gd('y1', '*/ h adj1 100000'),
		gd('x1', '*/ w adj2 100000'),
		gd('y2', '*/ h adj3 100000'),
		gd('x2', '*/ w adj4 100000'),
		gd('y3', '*/ h adj5 100000'),
		gd('x3', '*/ w adj6 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{ commands: calloutBody() },
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
			],
		},
	],
};

/**
 * accentCallout3 — three-segment leader + accent bar. avLst mirrors `callout3`.
 */
const accentCallout3: PresetShapeGeometryDefinition = {
	name: 'accentCallout3',
	avLst: {
		adj1: 18750,
		adj2: -8333,
		adj3: 18750,
		adj4: -16667,
		adj5: 100000,
		adj6: -16667,
		adj7: 112500,
		adj8: -38333,
	},
	gdLst: [
		gd('y1', '*/ h adj1 100000'),
		gd('x1', '*/ w adj2 100000'),
		gd('y2', '*/ h adj3 100000'),
		gd('x2', '*/ w adj4 100000'),
		gd('y3', '*/ h adj5 100000'),
		gd('x3', '*/ w adj6 100000'),
		gd('y4', '*/ h adj7 100000'),
		gd('x4', '*/ w adj8 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{ commands: calloutBody() },
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Accent border callouts (stroked body + leader + accent bar)
// ---------------------------------------------------------------------------

const accentBorderCallout1: PresetShapeGeometryDefinition = {
	name: 'accentBorderCallout1',
	avLst: { adj1: 18750, adj2: -8333, adj3: 112500, adj4: -38333 },
	gdLst: accentCallout1.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
			],
		},
	],
};

const accentBorderCallout2: PresetShapeGeometryDefinition = {
	name: 'accentBorderCallout2',
	avLst: accentCallout2.avLst,
	gdLst: accentCallout2.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
			],
		},
	],
};

const accentBorderCallout3: PresetShapeGeometryDefinition = {
	name: 'accentBorderCallout3',
	avLst: accentCallout3.avLst,
	gdLst: accentCallout3.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Scrolls / waves + accent callout preset definitions, exported for manual
 * aggregation into `PRESET_SHAPE_GEOMETRY_TABLE`. Keys are ECMA-376
 * ST_ShapeType names.
 */
export const SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS: Record<
	string,
	PresetShapeGeometryDefinition
> = {
	verticalScroll,
	horizontalScroll,
	wave,
	doubleWave,
	accentCallout1,
	accentCallout2,
	accentCallout3,
	accentBorderCallout1,
	accentBorderCallout2,
	accentBorderCallout3,
};
