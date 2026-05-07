/**
 * ECMA-376 ST_ShapeType preset geometry definitions — rounded / snipped
 * rectangles + foldedCorner / teardrop / corner.
 *
 * This batch authors the rectangle-corner family of presets defined in
 * Microsoft's `presetShapeDefinitions.xml` (ISO/IEC 29500-1 §20.1.10.55):
 *
 *  • `round1Rect`       — 1 rounded corner (top-right). adj1 = radius/ss.
 *  • `round2SameRect`   — 2 same-side rounded corners (top). adj1 + adj2.
 *  • `round2DiagRect`   — 2 diagonal rounded corners (TL + BR). adj1 + adj2.
 *  • `snipRoundRect`    — 1 snipped (TL) + 1 rounded (TR). adj1 + adj2.
 *  • `snip1Rect`        — 1 chamfered corner (TR). adj1.
 *  • `snip2SameRect`    — 2 same-side chamfered corners (top). adj1 + adj2.
 *  • `snip2DiagRect`    — 2 diagonal chamfered corners (TR + BL). adj1 + adj2.
 *  • `foldedCorner`     — rectangle with a folded BR corner. adj1.
 *  • `teardrop`         — circle with a stretchable top-right point. adj1.
 *  • `corner`           — L-shape with adj1 (height) + adj2 (width).
 *
 * Tokens inside guide formulas and path commands are raw OOXML strings — the
 * `preset-shape-evaluator` resolves them via `guide-formula-eval`. All
 * adjustment defaults match the canonical XML.
 *
 * Aggregation into `PRESET_SHAPE_GEOMETRY_TABLE` is performed manually in
 * `preset-shape-definitions-table.ts` after batch agents return.
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
// Definitions — rounded-corner rectangles
// ---------------------------------------------------------------------------

// round1Rect — single rounded corner at the top-right. adj1 maps to the corner
// radius as a fraction of ss (50000 → max).
const round1Rect: PresetShapeGeometryDefinition = {
	name: 'round1Rect',
	avLst: { adj: 16667 },
	gdLst: [gd('a', 'pin 0 adj 50000'), gd('x2', '*/ ss a 100000'), gd('x1', '+- r 0 x2')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'arcTo', wR: 'x2', hR: 'x2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// round2SameRect — top-left + top-right rounded by adj1; bottom-left +
// bottom-right rounded by adj2 (same-side pairing).
const round2SameRect: PresetShapeGeometryDefinition = {
	name: 'round2SameRect',
	avLst: { adj1: 16667, adj2: 0 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('x2', '+- r 0 x1'),
		gd('x3', '*/ ss a2 100000'),
		gd('x4', '+- r 0 x3'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// round2DiagRect — top-left rounded by adj1, bottom-right rounded by adj2.
const round2DiagRect: PresetShapeGeometryDefinition = {
	name: 'round2DiagRect',
	avLst: { adj1: 16667, adj2: 0 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('y1', '+- b 0 x1'),
		gd('x2', '*/ ss a2 100000'),
		gd('x3', '+- r 0 x2'),
		gd('y2', '+- b 0 x2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'x2', hR: 'x2', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// snipRoundRect — top-left snipped (chamfered) by adj1, top-right rounded by
// adj2.
const snipRoundRect: PresetShapeGeometryDefinition = {
	name: 'snipRoundRect',
	avLst: { adj1: 16667, adj2: 16667 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('x2', '*/ ss a2 100000'),
		gd('x3', '+- r 0 x2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'x2', hR: 'x2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Snipped (chamfered) rectangles
// ---------------------------------------------------------------------------

// snip1Rect — single chamfered corner at top-right. adj1 = chamfer/ss.
const snip1Rect: PresetShapeGeometryDefinition = {
	name: 'snip1Rect',
	avLst: { adj: 16667 },
	gdLst: [gd('a', 'pin 0 adj 50000'), gd('x1', '*/ ss a 100000'), gd('dx1', '+- r 0 x1')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'dx1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// snip2SameRect — top-left + top-right chamfered by adj1; bottom-left +
// bottom-right chamfered by adj2.
const snip2SameRect: PresetShapeGeometryDefinition = {
	name: 'snip2SameRect',
	avLst: { adj1: 16667, adj2: 0 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('x2', '+- r 0 x1'),
		gd('x3', '*/ ss a2 100000'),
		gd('x4', '+- r 0 x3'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// snip2DiagRect — top-right chamfered by adj1, bottom-left chamfered by adj2.
const snip2DiagRect: PresetShapeGeometryDefinition = {
	name: 'snip2DiagRect',
	avLst: { adj1: 0, adj2: 16667 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('x2', '+- r 0 x1'),
		gd('x3', '*/ ss a2 100000'),
		gd('x4', '+- r 0 x3'),
		gd('y1', '+- b 0 x3'),
		gd('y2', '+- b 0 x1'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// foldedCorner / teardrop / corner
// ---------------------------------------------------------------------------

// foldedCorner — rectangle with a folded bottom-right corner. adj1 is the fold
// size as a fraction of ss (1/100000), capped at 50000. Two paths: the body
// silhouette and the small triangular fold flap (rendered with a lightened
// fill so it reads as the underside of the page).
const foldedCorner: PresetShapeGeometryDefinition = {
	name: 'foldedCorner',
	avLst: { adj: 16667 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('dy2', '*/ ss a 100000'),
		gd('dy1', '*/ dy2 1 5'),
		gd('x1', '+- r 0 dy2'),
		gd('x2', '+- x1 dy1 0'),
		gd('x3', '+- r 0 dy1'),
		gd('y2', '+- b 0 dy2'),
		gd('y1', '+- y2 dy1 0'),
		gd('y3', '+- b 0 dy1'),
	],
	rect: { l: 'l', t: 't', r: 'x3', b: 'y3' },
	pathLst: [
		// Body silhouette — full rectangle with the folded corner cut off and
		// replaced by a diagonal line from x1,b to r,y2.
		{
			fill: 'norm',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Fold flap — small triangle in the BR corner with the lighter fill.
		{
			fill: 'lighten',
			stroke: false,
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'close' },
			],
		},
		// Stroke layer (outline including the fold seam).
		{
			fill: 'none',
			stroke: true,
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
			],
		},
	],
};

// teardrop — circle with a stretchable top-right point. adj1 controls the
// horizontal/vertical extent of the point (0 = closed circle, 100000 = nominal
// teardrop, 200000 = double extension). The shape is built from three quarter
// arcs (BR → BL → TL) and two quadratic Beziers that route from the top of
// the left arc up to the stretched tip at (x1,y1) and back down to the right
// of the bottom arc, with the tip displaced from (r,t) by (a-100000)/100000.
const teardrop: PresetShapeGeometryDefinition = {
	name: 'teardrop',
	avLst: { adj: 100000 },
	gdLst: [
		gd('a', 'pin 0 adj 200000'),
		gd('dx1', '*/ wd2 a 100000'),
		gd('dy1', '*/ hd2 a 100000'),
		gd('x1', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'quadBezTo', x1: 'hc', y1: 'y1', x2: 'x1', y2: 'y1' },
				{ kind: 'quadBezTo', x1: 'x1', y1: 'vc', x2: 'r', y2: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

// corner — L-shape. adj1 = thickness of the horizontal arm as a fraction of
// h (1/100000); adj2 = thickness of the vertical arm as a fraction of w. The
// outer rectangle is the full bounding box; the inner notch is carved out of
// the top-right.
const corner: PresetShapeGeometryDefinition = {
	name: 'corner',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ w a2 100000'),
		gd('dy1', '*/ h a1 100000'),
		gd('y1', '+- b 0 dy1'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const RECTS_SNIPS_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	round1Rect,
	round2SameRect,
	round2DiagRect,
	snipRoundRect,
	snip1Rect,
	snip2SameRect,
	snip2DiagRect,
	foldedCorner,
	teardrop,
	corner,
};
