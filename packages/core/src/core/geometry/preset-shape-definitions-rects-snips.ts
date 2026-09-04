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
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x2', '*/ ss a 100000'),
		gd('x1', '+- r 0 x2'),
		// COM-measured at 200x100pt: only the affected corner's edge (`r`) gets
		// inset by the fillet's 45deg touch point (`x2 * (1 - cos45deg)`, same
		// factor as `roundRect`); `t`/`l`/`b` stay full (PowerPoint does NOT
		// also inset the top edge here, unlike `round2SameRect` below, where
		// two corners share the top edge).
		gd('il', '*/ x2 29289 100000'),
	],
	rect: { l: 'l', t: 't', r: '+- r 0 il', b: 'b' },
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
		// COM-measured at 200x100pt: both top corners share the top edge, so
		// `l`/`t`/`r` all inset by the `adj1` corner's fillet factor (same
		// `(1 - cos45deg)` as `roundRect`); `b` stays full (the bottom corners,
		// governed by `adj2`, default to square and were not covered by a
		// second measurement, so `b` is left un-inset rather than guessed).
		gd('il', '*/ x1 29289 100000'),
	],
	rect: { l: 'il', t: 'il', r: '+- r 0 il', b: 'b' },
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
		// COM-measured at 200x100pt: the two rounded corners are DIAGONALLY
		// opposite (top-left via `adj1`, bottom-right via `adj2`), so every edge
		// borders one of them - PowerPoint insets ALL FOUR edges by the LARGER
		// of the two corners' fillet factors (`(1 - cos45deg)`, same as
		// `roundRect`), not just the two edges nominally adjacent to each
		// corner. At the default (`adj2 = 0`) this reduces to the `adj1` inset,
		// which is what was measured; `max` keeps it correct if `adj2` grows
		// past `adj1`.
		gd('il1', '*/ x1 29289 100000'),
		gd('il2', '*/ x2 29289 100000'),
		gd('il', 'max il1 il2'),
	],
	rect: { l: 'il', t: 'il', r: '+- r 0 il', b: '+- b 0 il' },
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
		// COM-measured at 200x100pt: `l`/`t` inset by the SNIPPED top-left
		// corner's fillet factor (`x1 * (1 - cos45deg)`, the same factor as a
		// ROUNDED corner elsewhere in this family - not the chamfer's own tight
		// `leg/2` value, so this is a COM-measured fact rather than a re-derived
		// one). `r` insets by the ROUNDED top-right corner's `radius/2`
		// (`x2 * 0.5` - the mathematically tight value for a fillet's 45deg
		// touch point measured from BOTH adjacent edges, halved since only one
		// edge, `r`, carries it here). `b` stays full (bottom corners square).
		gd('ilTL', '*/ x1 29289 100000'),
		gd('ilTR', '*/ x2 1 2'),
	],
	rect: { l: 'ilTL', t: 'ilTL', r: '+- r 0 ilTR', b: 'b' },
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
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('dx1', '+- r 0 x1'),
		// COM-measured at 200x100pt: `t`/`r` (the two edges adjacent to the
		// snipped top-right corner) inset by exactly HALF the chamfer leg
		// (`x1/2`) - the mathematically tight value: a rectangle corner at
		// `(r - d, t + d)` clears the chamfer line `(dx1,t)-(r,x1)` exactly when
		// `2d = x1`. `l`/`b` stay full (unaffected corners).
		gd('ins', '*/ x1 1 2'),
	],
	rect: { l: 'l', t: 'ins', r: '+- r 0 ins', b: 'b' },
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
		// COM-measured at 200x100pt: both top corners chamfered by `adj1` share
		// the top edge, so `l`/`t`/`r` all inset by the tight chamfer value
		// (`x1/2`, see `snip1Rect`); `b` stays full (bottom corners, governed by
		// `adj2`, default to square).
		gd('ins', '*/ x1 1 2'),
	],
	rect: { l: 'ins', t: 'ins', r: '+- r 0 ins', b: 'b' },
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
		// COM-measured at 200x100pt: same diagonal-pair pattern as
		// `round2DiagRect` (see its comment) - the two chamfered corners
		// (top-right via `adj1`, bottom-left via `adj2`) are diagonally
		// opposite, so every edge borders one of them and PowerPoint insets ALL
		// FOUR edges by the LARGER corner's tight chamfer value (`leg/2`).
		gd('ins1', '*/ x1 1 2'),
		gd('ins2', '*/ x3 1 2'),
		gd('ins', 'max ins1 ins2'),
	],
	rect: { l: 'ins', t: 'ins', r: '+- r 0 ins', b: '+- b 0 ins' },
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
//
// Both Bezier CONTROL points sit on the frame edges - (x2, t) then (r, y2),
// the midpoints between each arc end and the tip - so the corner bulges
// outwards through (r, t). Controls placed inside the frame instead scoop the
// corner inwards, turning each petal into a circle with a bite out of it and
// leaving a star-shaped hole where a ring of them should meet.
const teardrop: PresetShapeGeometryDefinition = {
	name: 'teardrop',
	avLst: { adj: 100000 },
	gdLst: [
		gd('a', 'pin 0 adj 200000'),
		gd('dx1', '*/ wd2 a 100000'),
		gd('dy1', '*/ hd2 a 100000'),
		gd('x1', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
		gd('x2', '+/ hc x1 2'),
		gd('y2', '+/ vc y1 2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				// `x1`/`y1` here are the CONTROL point, `x2`/`y2` the endpoint; the
				// guides keep the spec's own names, hence `x1: 'x2'`.
				{ kind: 'quadBezTo', x1: 'x2', y1: 't', x2: 'x1', y2: 'y1' },
				{ kind: 'quadBezTo', x1: 'r', y1: 'y2', x2: 'r', y2: 'vc' },
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
