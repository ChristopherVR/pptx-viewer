/**
 * ECMA-376 ST_ShapeType preset geometry definitions — arrows + 3D primitives.
 *
 * This batch authors ~25 additional shapes whose geometry is defined in
 * Microsoft's `presetShapeDefinitions.xml` (ISO/IEC 29500-1 §20.1.10.55):
 *
 * Containers / 3-D primitives
 *  • `bevel`, `can`, `cube`, `cylinder`
 *  • `frame`, `halfFrame`, `plaque`, `plaqueTabs`
 *
 * Arrow variants
 *  • Bidirectional: `leftRightArrow`, `upDownArrow`, `leftRightUpArrow`,
 *    `quadArrow`
 *  • Bent / U-turn: `bentArrow`, `bentUpArrow`, `uturnArrow`
 *  • Decorated: `stripedRightArrow`, `notchedRightArrow`
 *  • Block-direction: `homePlate`, `chevron`, `pentArrow` (5-sided arrow)
 *  • Curved / circular: `circularArrow`, `leftCircularArrow`,
 *    `leftRightCircularArrow`, `swooshArrow`, `curvedRightArrow`
 *
 * The data layout mirrors `preset-shape-definitions-table.ts`. Every entry is
 * keyed by its ECMA-376 ST_ShapeType name (camelCase). Tokens inside guide
 * formulas and path commands are raw OOXML strings — the `preset-shape-
 * evaluator` pipes them through `guide-formula-eval` (operators `val`, `abs`,
 * `sqrt`, `+-`, `*\/`, `+/`, `?:`, `min`, `max`, `mod`, `pin`, `sin`, `cos`,
 * `tan`, `atan`, `at2`, `cat2`, `sat2`).
 *
 * # Spec-faithful where the formulas are tractable
 *
 * Most shapes here use the canonical Microsoft formula set. A handful of
 * shapes whose XML pulls in 50+ guides (notably `swooshArrow`,
 * `circularArrow`, `leftCircularArrow`, `leftRightCircularArrow`,
 * `curvedRightArrow`, `bentArrow`, `bentUpArrow`, `uturnArrow`) are reduced
 * to a faithful default-adjustment polygon / Bézier silhouette that is
 * visually correct at the spec-default avLst values. They do not yet honour
 * arbitrary adjustment overrides — those reductions are flagged as
 * `SIMPLIFIED:` in the in-source comments so future work can replace them
 * with the full formula set.
 *
 * # Adding to the master table
 *
 * The aggregator that exports `PRESET_SHAPE_GEOMETRY_TABLE` lives in
 * `preset-shape-definitions-table.ts`. Spread `ARROW_PRESET_DEFINITIONS` into
 * the master record after the human-driven merge of all batch agents.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a `gdLst` entry from the canonical `<a:gd name="..." fmla="..." />`
 * tokens. Splits the formula to also expose its argument list so the data
 * stays introspectable for tooling/tests (mirrors the helper in
 * `preset-shape-definitions-table.ts`).
 */
function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

/** Default text rectangle equal to the shape bounds. */
const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// Containers / 3-D primitives
// ---------------------------------------------------------------------------

// bevel — square inset bezel. adj1 is the bezel inset as a fraction of ss
// (1/100000); default 12500. Spec models the bezel as four trapezoids, but a
// single outer + inner rectangle pair is enough to drive a CSS clip / SVG
// outline at viewer scale, with diagonal cuts to hint at the bevel facets.
const bevel: PresetShapeGeometryDefinition = {
	name: 'bevel',
	avLst: { adj: 12500 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y2', '+- b 0 x1'),
	],
	rect: { l: 'x1', t: 'x1', r: 'x2', b: 'y2' },
	pathLst: [
		// Outer rectangle.
		{
			fill: 'norm',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Inner rectangle (the bezel "well").
		{
			fill: 'darken',
			stroke: false,
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'x1' },
				{ kind: 'lnTo', x: 'x2', y: 'x1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'close' },
			],
		},
		// Diagonals so a stroked outline reads as a beveled rectangle.
		{
			stroke: true,
			fill: 'none',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'x1' },
				{ kind: 'moveTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 'x1' },
				{ kind: 'moveTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
			],
		},
	],
};

// can — vertical cylinder seen front-on (often used for "database" symbol).
// adj1 is the lid height as a fraction of h (1/100000); default 25000.
const can: PresetShapeGeometryDefinition = {
	name: 'can',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('y1', '*/ h a 200000'),
		gd('y2', '+- y1 y1 0'),
		gd('y3', '+- b 0 y1'),
	],
	rect: { l: 'l', t: 'y2', r: 'r', b: 'y3' },
	pathLst: [
		// Body silhouette: lid arc at top, mirror at bottom.
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: 'cd2', swAng: '-10800000' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: '0', swAng: 'cd2' },
				{ kind: 'close' },
			],
		},
		// Lid ellipse (dashed in the spec but solid here for clip simplicity).
		{
			fill: 'darken',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: 'cd2', swAng: 'cd2' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: '0', swAng: 'cd2' },
				{ kind: 'close' },
			],
		},
	],
};

// cube — isometric cube with three visible faces. No avLst (faces sized to a
// quarter of the shorter side). The simplified spec-equivalent silhouette is
// a hexagon with two interior edges that fan out from the front-top-left
// vertex.
const cube: PresetShapeGeometryDefinition = {
	name: 'cube',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		gd('y1', '*/ ss a 100000'),
		gd('y4', '+- b 0 y1'),
		gd('x4', '+- r 0 y1'),
	],
	rect: { l: 'l', t: 'y1', r: 'x4', b: 'b' },
	pathLst: [
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'y1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Internal silhouette edges (top + right faces).
		{
			fill: 'darkenLess',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'close' },
			],
		},
		{
			fill: 'darken',
			stroke: false,
			commands: [
				{ kind: 'moveTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'close' },
			],
		},
	],
};

// cylinder — horizontal pipe seen end-on. adj1 = cap depth (default 25000).
// The OOXML spec name is `flowChartMagneticDisk` for the side variant; the
// generic `cylinder` ST_ShapeType is rare but defined as a horizontal can.
const cylinder: PresetShapeGeometryDefinition = {
	name: 'cylinder',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ w a 200000'),
		gd('x2', '+- x1 x1 0'),
		gd('x3', '+- r 0 x1'),
	],
	rect: { l: 'x2', t: 't', r: 'x3', b: 'b' },
	pathLst: [
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: 'cd4', swAng: 'cd2' },
				{ kind: 'close' },
			],
		},
	],
};

// frame — picture frame: outer rect with rectangular hole. adj1 is the
// border width as a fraction of ss/2, default 12500.
const frame: PresetShapeGeometryDefinition = {
	name: 'frame',
	avLst: { adj1: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('x1', '*/ ss a1 100000'),
		gd('x4', '+- r 0 x1'),
		gd('y4', '+- b 0 x1'),
	],
	rect: { l: 'x1', t: 'x1', r: 'x4', b: 'y4' },
	pathLst: [
		// Outer rectangle.
		{
			fill: 'norm',
			extrusionOk: false,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
				// Inner rectangle (reverse-wound to cut the hole via even-odd).
				{ kind: 'moveTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 'x1' },
				{ kind: 'close' },
			],
		},
	],
};

// halfFrame — open L-shaped frame (two perpendicular bars meeting at the
// top-left corner). adj1 = vertical thickness, adj2 = horizontal thickness.
const halfFrame: PresetShapeGeometryDefinition = {
	name: 'halfFrame',
	avLst: { adj1: 33333, adj2: 33333 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ w a2 100000'),
		gd('y1', '*/ h a1 100000'),
		gd('dx2', '*/ y1 w h'),
		gd('x2', '+- x1 0 dx2'),
		gd('dy2', '*/ x1 h w'),
		gd('y2', '+- y1 0 dy2'),
	],
	rect: { l: 'l', t: 't', r: 'x1', b: 'y1' },
	pathLst: [
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// plaque — square with four arc-rounded inward corners. adj1 = corner radius
// as a fraction of ss (default 16667).
const plaque: PresetShapeGeometryDefinition = {
	name: 'plaque',
	avLst: { adj: 16667 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y2', '+- b 0 x1'),
	],
	rect: { l: 'x1', t: 'x1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd2', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: '0', swAng: '-5400000' },
				{ kind: 'close' },
			],
		},
	],
};

// plaqueTabs — rectangle with concave-arc tabs at the four corners (a
// "ribbon" feel). The spec's full guide list is large; this is the canonical
// reduced form using a single corner radius.
const plaqueTabs: PresetShapeGeometryDefinition = {
	name: 'plaqueTabs',
	gdLst: [
		gd('md', 'min w h'),
		gd('dx2', '*/ md 1 5'),
		gd('y2', '+- b 0 dx2'),
		gd('x2', '+- r 0 dx2'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		// Outer rectangle.
		{
			fill: 'norm',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'dx2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'dx2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'dx2' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'dx2', y: 't' },
				{ kind: 'close' },
			],
		},
		// Decorative tab arcs (no fill, just an outline cue).
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'dx2' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dx2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'moveTo', x: 'r', y: 'dx2' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dx2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dx2', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'moveTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dx2', stAng: '0', swAng: 'cd4' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Bidirectional / multi-directional arrows
// ---------------------------------------------------------------------------

// leftRightArrow — horizontal double-headed arrow.
//   adj1 = body half-thickness as % of hd2 (default 50000).
//   adj2 = head length as % of (w/2) (default 50000).
const leftRightArrow: PresetShapeGeometryDefinition = {
	name: 'leftRightArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('y1', '*/ hd2 a1 100000'),
		gd('y2', '+- vc 0 y1'),
		gd('y3', '+- vc y1 0'),
		gd('x2', '*/ wd2 a2 100000'),
		gd('x1', '+- l x2 0'),
		gd('x3', '+- r 0 x2'),
	],
	rect: { l: 'x1', t: 'y2', r: 'x3', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// upDownArrow — vertical double-headed arrow.
//   adj1 = body half-thickness as % of wd2 (default 50000).
//   adj2 = head length as % of (h/2) (default 50000).
const upDownArrow: PresetShapeGeometryDefinition = {
	name: 'upDownArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ wd2 a1 100000'),
		gd('x2', '+- hc 0 x1'),
		gd('x3', '+- hc x1 0'),
		gd('y2', '*/ hd2 a2 100000'),
		gd('y1', '+- t y2 0'),
		gd('y3', '+- b 0 y2'),
	],
	rect: { l: 'x2', t: 'y1', r: 'x3', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// leftRightUpArrow — three-headed arrow (left, right, up).
//   adj1 = body half-thickness, adj2 = head body width, adj3 = head length.
const leftRightUpArrow: PresetShapeGeometryDefinition = {
	name: 'leftRightUpArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('y1', '*/ hd2 a1 100000'),
		gd('y2', '+- b 0 y1'),
		gd('y3', '+- b 0 a1'),
		gd('hx', '*/ wd2 a2 100000'),
		gd('x1', '+- hc 0 hx'),
		gd('x2', '+- hc hx 0'),
		gd('hl', '*/ wd2 a3 100000'),
		gd('xl', '+- l hl 0'),
		gd('xr', '+- r 0 hl'),
		gd('yh', '+- y1 0 0'),
		gd('uy', '*/ h a3 100000'),
		gd('up', '+- t uy 0'),
	],
	rect: { l: 'xl', t: 'up', r: 'xr', b: 'y2' },
	pathLst: [
		{
			commands: [
				// Left tip
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'xl', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				// Up arrow
				{ kind: 'lnTo', x: 'x1', y: 'up' },
				{ kind: 'lnTo', x: 'l', y: 'up' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'up' },
				{ kind: 'lnTo', x: 'x2', y: 'up' },
				// Down to right body
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'xr', y: 'y1' },
				{ kind: 'lnTo', x: 'xr', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'xr', y: 'b' },
				{ kind: 'lnTo', x: 'xr', y: 'y2' },
				{ kind: 'lnTo', x: 'xl', y: 'y2' },
				{ kind: 'lnTo', x: 'xl', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// quadArrow — 4-headed arrow (N/S/E/W). Symmetric defaults.
const quadArrow: PresetShapeGeometryDefinition = {
	name: 'quadArrow',
	avLst: { adj1: 22500, adj2: 22500, adj3: 22500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('hx', '*/ wd2 a2 100000'),
		gd('hy', '*/ hd2 a2 100000'),
		gd('bx1', '+- hc 0 hx'),
		gd('bx2', '+- hc hx 0'),
		gd('by1', '+- vc 0 hy'),
		gd('by2', '+- vc hy 0'),
		gd('hl', '*/ wd2 a3 100000'),
		gd('vl', '*/ hd2 a3 100000'),
		gd('lh', '+- l hl 0'),
		gd('rh', '+- r 0 hl'),
		gd('th', '+- t vl 0'),
		gd('bh', '+- b 0 vl'),
		gd('hw', '*/ wd2 a1 100000'),
		gd('hh', '*/ hd2 a1 100000'),
		gd('hl1', '+- hc 0 hw'),
		gd('hl2', '+- hc hw 0'),
		gd('vt1', '+- vc 0 hh'),
		gd('vt2', '+- vc hh 0'),
	],
	rect: { l: 'lh', t: 'th', r: 'rh', b: 'bh' },
	pathLst: [
		{
			commands: [
				// Left tip
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'lh', y: 'vt1' },
				{ kind: 'lnTo', x: 'hl1', y: 'vt1' },
				// Up arm
				{ kind: 'lnTo', x: 'hl1', y: 'th' },
				{ kind: 'lnTo', x: 'bx1', y: 'th' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'bx2', y: 'th' },
				{ kind: 'lnTo', x: 'hl2', y: 'th' },
				// Right tip body
				{ kind: 'lnTo', x: 'hl2', y: 'vt1' },
				{ kind: 'lnTo', x: 'rh', y: 'vt1' },
				{ kind: 'lnTo', x: 'rh', y: 'vt2' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				// Note: arms close around centre. Use vt2 for bottom band.
				{ kind: 'lnTo', x: 'rh', y: 'vt2' },
				{ kind: 'lnTo', x: 'hl2', y: 'vt2' },
				// Down arm
				{ kind: 'lnTo', x: 'hl2', y: 'bh' },
				{ kind: 'lnTo', x: 'bx2', y: 'bh' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'bx1', y: 'bh' },
				{ kind: 'lnTo', x: 'hl1', y: 'bh' },
				{ kind: 'lnTo', x: 'hl1', y: 'vt2' },
				{ kind: 'lnTo', x: 'lh', y: 'vt2' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Bent / U-turn arrows
// ---------------------------------------------------------------------------
// SUPERSEDED: bentArrow, bentUpArrow, and uturnArrow now have verbatim
// ISO/IEC 29500-1 transcriptions in `preset-shape-definitions-arrows-refined.ts`
// (spread after this batch in the aggregator), so they honour arbitrary
// adjustment overrides. The default-adjustment polygons kept below are dead
// entries retained only as a documented fallback silhouette.

// bentArrow — L-shaped right-then-up arrow. Defaults: 25000 / 25000 / 25000 /
// 43750 (body width, head width, head length, knee position).
const bentArrow: PresetShapeGeometryDefinition = {
	name: 'bentArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 43750 },
	gdLst: [
		gd('bw', '*/ ss adj1 100000'),
		gd('hw', '*/ ss adj2 100000'),
		gd('hl', '*/ ss adj3 100000'),
		gd('xb', '+- l bw 0'),
		gd('xh', '+- xb hl 0'),
		gd('y2', '+- b 0 bw'),
		gd('y1', '+- y2 0 hw'),
		gd('y3', '+- y2 hw 0'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				// Vertical body up to knee
				{ kind: 'lnTo', x: 'l', y: 'hl' },
				{ kind: 'lnTo', x: 'xb', y: 'hl' },
				{ kind: 'lnTo', x: 'xb', y: 'y1' },
				{ kind: 'lnTo', x: 'xh', y: 'y1' },
				{ kind: 'lnTo', x: 'xh', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'xh', y: 'b' },
				{ kind: 'lnTo', x: 'xh', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'close' },
			],
		},
	],
};

// bentUpArrow — L-shape pointing up after running right.
// SUPERSEDED: see the exact transcription in the refined arrows module.
const bentUpArrow: PresetShapeGeometryDefinition = {
	name: 'bentUpArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000 },
	gdLst: [
		gd('bw', '*/ ss adj1 100000'),
		gd('hw', '*/ ss adj2 100000'),
		gd('hl', '*/ ss adj3 100000'),
		gd('y2', '+- b 0 bw'),
		gd('xh', '+- r 0 hl'),
		gd('xb', '+- xh 0 hw'),
		gd('xt', '+- xh hw 0'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'xb', y: 'y2' },
				{ kind: 'lnTo', x: 'xb', y: 'hl' },
				{ kind: 'lnTo', x: 'l', y: 'hl' },
				{ kind: 'lnTo', x: 'xh', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'hl' },
				{ kind: 'lnTo', x: 'xt', y: 'hl' },
				{ kind: 'lnTo', x: 'xt', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// uturnArrow — U-shape that loops over the top and comes back down.
// SUPERSEDED: see the exact transcription in the refined arrows module.
const uturnArrow: PresetShapeGeometryDefinition = {
	name: 'uturnArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 43750, adj5: 75000 },
	gdLst: [
		gd('bw', '*/ ss adj1 100000'),
		gd('hw', '*/ ss adj2 100000'),
		gd('hl', '*/ ss adj3 100000'),
		gd('x1', '+- l bw 0'),
		gd('x2', '+- r 0 bw'),
		gd('x3', '+- x2 0 hw'),
		gd('x4', '+- x2 hw 0'),
		gd('y1', '*/ h adj4 100000'),
		gd('y2', '+- y1 hw 0'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: 'cd2', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'y1', stAng: '0', swAng: '-10800000' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Decorated rightward arrows
// ---------------------------------------------------------------------------

// stripedRightArrow — right arrow with three short stripes on the tail.
// adj1 = body half-thickness, adj2 = head length.
const stripedRightArrow: PresetShapeGeometryDefinition = {
	name: 'stripedRightArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('y1', '*/ hd2 a1 100000'),
		gd('y2', '+- vc 0 y1'),
		gd('y3', '+- vc y1 0'),
		gd('x2', '*/ ss 1 32'),
		gd('x3', '*/ ss 2 32'),
		gd('x4', '*/ ss 5 32'),
		gd('x5', '*/ w a2 100000'),
		gd('x6', '+- r 0 x5'),
		gd('dx', '*/ hd2 x5 wd2'),
		gd('x7', '+- x6 dx 0'),
	],
	rect: { l: 'x4', t: 'y2', r: 'x7', b: 'y3' },
	pathLst: [
		// Stripes (3 vertical bars).
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'x3', y: 'y2' },
				{ kind: 'lnTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'close' },
				// Body + head
				{ kind: 'moveTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'x6', y: 'y2' },
				{ kind: 'lnTo', x: 'x6', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x6', y: 'b' },
				{ kind: 'lnTo', x: 'x6', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'close' },
			],
		},
	],
};

// notchedRightArrow — right arrow with a triangular notch cut from the tail.
const notchedRightArrow: PresetShapeGeometryDefinition = {
	name: 'notchedRightArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('y1', '*/ hd2 a1 100000'),
		gd('y2', '+- vc 0 y1'),
		gd('y3', '+- vc y1 0'),
		gd('x2', '*/ w a2 100000'),
		gd('x1', '+- r 0 x2'),
		gd('dx2', '*/ hd2 x2 wd2'),
		gd('x3', '+- x1 dx2 0'),
		gd('nx', '*/ y1 1 1'),
	],
	rect: { l: 'nx', t: 'y2', r: 'x3', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'nx', y: 'vc' },
				{ kind: 'close' },
			],
		},
	],
};

// homePlate — 5-sided pentagon (rectangle with one pointed end).
//   adj1 = arrow point length as a fraction of w (default 50000).
const homePlate: PresetShapeGeometryDefinition = {
	name: 'homePlate',
	avLst: { adj: 50000 },
	gdLst: [gd('a', 'pin 0 adj 100000'), gd('x1', '*/ w a 100000')],
	rect: { l: 'l', t: 't', r: 'x1', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// chevron — rightward chevron with notched tail. adj1 = notch depth (default
// 50000 = halfway).
const chevron: PresetShapeGeometryDefinition = {
	name: 'chevron',
	avLst: { adj: 50000 },
	gdLst: [gd('a', 'pin 0 adj 100000'), gd('x1', '*/ w a 100000'), gd('x2', '+- r 0 x1')],
	rect: { l: 'l', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'vc' },
				{ kind: 'close' },
			],
		},
	],
};

// pentArrow — 5-sided arrow (the canonical "ribbon" arrow with two notches at
// the tail). ECMA-376 lists this as `pentArrow` in some samples; it's not in
// every revision of the spec but Microsoft's runtime ships a definition that
// equals a pentagon-shaped arrow tip — a rectangle with a triangular tail
// notch. SIMPLIFIED to that canonical silhouette.
const pentArrow: PresetShapeGeometryDefinition = {
	name: 'pentArrow',
	avLst: { adj: 50000 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		gd('x1', '*/ w a 200000'),
		gd('x2', '+- r 0 x1'),
		gd('y1', '*/ h 25000 100000'),
		gd('y2', '+- b 0 y1'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'vc' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Curved / circular arrows  (SIMPLIFIED — default-adjustment silhouettes)
// ---------------------------------------------------------------------------
// The full circularArrow / leftCircularArrow / leftRightCircularArrow /
// swooshArrow / curvedRightArrow definitions in `presetShapeDefinitions.xml`
// each pull in 30-50 guides (start/end angles, head width/length, body
// thickness, all expressed via at2/cat2/sat2 to find tangent points). For
// this batch we ship default-adjustment silhouettes that are visually
// correct at the stock avLst values but do not yet honour arbitrary
// overrides — the `avLst` defaults are still authored against the spec so
// downstream code can detect the canonical adjustments.

// circularArrow — 270deg arc with an arrow head at the end.
const circularArrow: PresetShapeGeometryDefinition = {
	name: 'circularArrow',
	avLst: {
		adj1: 12500, // body half-thickness as fraction of ss/2
		adj2: 1142319, // start angle (60000ths of a degree)
		adj3: 20457681, // end angle
		adj4: 10800000, // head angle
		adj5: 12500, // head body width
	},
	gdLst: [gd('th', '*/ ss adj1 100000'), gd('iwd2', '+- wd2 0 th'), gd('ihd2', '+- hd2 0 th')],
	rect: FULL_RECT,
	pathLst: [
		// Outer ring (counter-clockwise 3/4 turn) + arrow head.
		// SIMPLIFIED: traces a fixed default sweep from cd2 to 3cd4-cd8.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: '16200000' },
				{ kind: 'lnTo', x: 'r', y: 'hd2' },
				{ kind: 'lnTo', x: 'hc', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 'th' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: '3cd4', swAng: '-16200000' },
				{ kind: 'close' },
			],
		},
	],
};

// leftCircularArrow — mirror of circularArrow.
const leftCircularArrow: PresetShapeGeometryDefinition = {
	name: 'leftCircularArrow',
	avLst: { adj1: 12500, adj2: 18900000, adj3: 1142319, adj4: 10800000, adj5: 12500 },
	gdLst: [gd('th', '*/ ss adj1 100000'), gd('iwd2', '+- wd2 0 th'), gd('ihd2', '+- hd2 0 th')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: '-16200000' },
				{ kind: 'lnTo', x: 'l', y: 'hd2' },
				{ kind: 'lnTo', x: 'hc', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 'th' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: '3cd4', swAng: '16200000' },
				{ kind: 'close' },
			],
		},
	],
};

// leftRightCircularArrow — circular arrow with heads on both ends of the arc.
// SIMPLIFIED.
const leftRightCircularArrow: PresetShapeGeometryDefinition = {
	name: 'leftRightCircularArrow',
	avLst: { adj1: 12500, adj2: 1142319, adj3: 20457681, adj4: 10800000, adj5: 12500 },
	gdLst: [gd('th', '*/ ss adj1 100000'), gd('iwd2', '+- wd2 0 th'), gd('ihd2', '+- hd2 0 th')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: '16200000' },
				{ kind: 'lnTo', x: 'hc', y: 'vc' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: '3cd4', swAng: '-16200000' },
				{ kind: 'close' },
			],
		},
	],
};

// swooshArrow — diagonal swooping arrow drawn with a single quad bezier.
// SIMPLIFIED: default-adjustment silhouette (the spec uses a 30-guide
// formula set to derive the bezier control point from adj1/adj2).
const swooshArrow: PresetShapeGeometryDefinition = {
	name: 'swooshArrow',
	avLst: { adj1: 25000, adj2: 16667 },
	gdLst: [
		gd('a1', 'pin 0 adj1 75000'),
		gd('a2', 'pin 0 adj2 33333'),
		gd('ad1', '*/ h a1 100000'),
		gd('ad2', '*/ ss a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{
					kind: 'quadBezTo',
					x1: 'hc',
					y1: 'b',
					x2: 'r',
					y2: 'ad1',
				},
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'ad2', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// curvedRightArrow — quad-bezier curved arrow pointing right.
// SUPERSEDED: the active definition is the spec-exact transcription in
// `preset-shape-definitions-curved-arrows-exact.ts` (spread later in the
// master table). This entry is retained only for batch-history continuity.
const curvedRightArrow: PresetShapeGeometryDefinition = {
	name: 'curvedRightArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('hl', '*/ w a3 100000'),
		gd('x1', '+- r 0 hl'),
		gd('y1', '*/ h a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{
					kind: 'quadBezTo',
					x1: 'hc',
					y1: 't',
					x2: 'x1',
					y2: 'y1',
				},
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{
					kind: 'quadBezTo',
					x1: 'hc',
					y1: 'b',
					x2: 'l',
					y2: 'b',
				},
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Public table
// ---------------------------------------------------------------------------

/**
 * Arrow + 3-D primitive preset definitions. The aggregator in
 * `preset-shape-definitions-table.ts` should spread this record into
 * `PRESET_SHAPE_GEOMETRY_TABLE` after this batch is merged.
 */
export const ARROW_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	bevel,
	can,
	cube,
	cylinder,
	frame,
	halfFrame,
	plaque,
	plaqueTabs,
	leftRightArrow,
	upDownArrow,
	leftRightUpArrow,
	quadArrow,
	bentArrow,
	bentUpArrow,
	uturnArrow,
	stripedRightArrow,
	notchedRightArrow,
	homePlate,
	chevron,
	pentArrow,
	circularArrow,
	leftCircularArrow,
	leftRightCircularArrow,
	swooshArrow,
	curvedRightArrow,
};
