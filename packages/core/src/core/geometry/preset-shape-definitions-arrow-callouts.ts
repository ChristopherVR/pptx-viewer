/**
 * ECMA-376 ST_ShapeType preset geometry definitions — arrow callouts +
 * `leftUpArrow`.
 *
 * This batch authors the 10 arrow-callout family shapes whose geometry is
 * defined in Microsoft's `presetShapeDefinitions.xml` (ISO/IEC 29500-1
 * §20.1.10.55):
 *
 *   • `leftArrowCallout`, `rightArrowCallout`, `upArrowCallout`,
 *     `downArrowCallout`
 *   • `leftRightArrowCallout`, `upDownArrowCallout`, `quadArrowCallout`
 *   • `bentArrowCallout`, `bentUpArrowCallout`
 *   • `leftUpArrow` (L-shaped two-direction arrow combining left + up)
 *
 * Each callout shape is an arrow with a rectangular text "callout" body
 * appended to its tail. Adjustments:
 *   • adj1 = arrow-head body width as % of (h/2 or w/2 depending on orient.)
 *   • adj2 = arrow-shaft thickness as % of (h/2 or w/2)
 *   • adj3 = arrow-head length as % of (w or h)
 *   • adj4 = callout body extent as % of (w or h)
 *
 * The data layout mirrors `preset-shape-definitions-table.ts`: tokens inside
 * guide formulas and path commands are raw OOXML strings. See the evaluator
 * `preset-shape-evaluator` / `guide-formula-eval` for operator semantics.
 *
 * # Spec faithfulness
 *
 * All shapes here use the canonical Microsoft default-adjustment guide
 * formulas. Polygons honour arbitrary `adj*` overrides via the same
 * formula set Microsoft ships, with the following simplifications flagged
 * in-line:
 *
 *   • `quadArrowCallout` uses a symmetric polygon parameterised by adj1..adj5
 *     (head-body, shaft, head-length, callout-extent and text-rect adj).
 *     The full ECMA formula set chains 30+ guides — this batch authors a
 *     reduced form whose visible silhouette is identical at the spec
 *     defaults (avLst adj1..adj5 = 22500, 22500, 22500, 22500, 22500).
 *   • `bentArrowCallout` / `bentUpArrowCallout` use the same simplified
 *     polygon strategy as `bentArrow` / `bentUpArrow` in the sibling
 *     `preset-shape-definitions-arrows.ts` batch.
 *
 * # Aggregation
 *
 * The aggregator that exports `PRESET_SHAPE_GEOMETRY_TABLE` lives in
 * `preset-shape-definitions-table.ts`. Spread `ARROW_CALLOUT_PRESET_DEFINITIONS`
 * into the master record after the human-driven merge of all batch agents.
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

// ---------------------------------------------------------------------------
// Single-direction arrow callouts
// ---------------------------------------------------------------------------

// rightArrowCallout — rightward arrow with a rectangular callout body on the
// left side. avLst:
//   adj1 = head body width  (as % of h/2)         default 25000
//   adj2 = shaft thickness  (as % of h/2)         default 25000
//   adj3 = head length      (as % of w)           default 25000
//   adj4 = callout body extent (as % of w)        default 64977
const rightArrowCallout: PresetShapeGeometryDefinition = {
	name: 'rightArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('y1', '*/ hd2 a2 100000'),
		gd('y2', '*/ hd2 a1 100000'),
		gd('y3', '+- vc 0 y2'),
		gd('y4', '+- vc y2 0'),
		gd('y5', '+- vc 0 y1'),
		gd('y6', '+- vc y1 0'),
		gd('x1', '*/ w a4 100000'),
		gd('x2', '*/ w a3 100000'),
		gd('x3', '+- r 0 x2'),
	],
	rect: { l: 'l', t: 'y5', r: 'x1', b: 'y6' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y5' },
				{ kind: 'lnTo', x: 'x3', y: 'y5' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// leftArrowCallout — leftward mirror of rightArrowCallout.
const leftArrowCallout: PresetShapeGeometryDefinition = {
	name: 'leftArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('y1', '*/ hd2 a2 100000'),
		gd('y2', '*/ hd2 a1 100000'),
		gd('y3', '+- vc 0 y2'),
		gd('y4', '+- vc y2 0'),
		gd('y5', '+- vc 0 y1'),
		gd('y6', '+- vc y1 0'),
		gd('x1', '*/ w a3 100000'),
		gd('x2', '*/ w a4 100000'),
		gd('x3', '+- r 0 x2'),
	],
	rect: { l: 'x3', t: 'y5', r: 'r', b: 'y6' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'y5' },
				{ kind: 'lnTo', x: 'x3', y: 'y5' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'close' },
			],
		},
	],
};

// upArrowCallout — upward arrow with rectangular callout body below.
//   adj1 = head body width as % of w/2,   default 25000
//   adj2 = shaft thickness as % of w/2,   default 25000
//   adj3 = head length     as % of h,     default 25000
//   adj4 = callout extent  as % of h,     default 64977
const upArrowCallout: PresetShapeGeometryDefinition = {
	name: 'upArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('x1', '*/ wd2 a2 100000'),
		gd('x2', '*/ wd2 a1 100000'),
		gd('x3', '+- hc 0 x2'),
		gd('x4', '+- hc x2 0'),
		gd('x5', '+- hc 0 x1'),
		gd('x6', '+- hc x1 0'),
		gd('y1', '*/ h a3 100000'),
		gd('y2', '*/ h a4 100000'),
		gd('y3', '+- b 0 y2'),
	],
	rect: { l: 'x5', t: 'y3', r: 'x6', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'x5', y: 'y3' },
				{ kind: 'lnTo', x: 'x5', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// downArrowCallout — downward arrow with rectangular callout body above.
const downArrowCallout: PresetShapeGeometryDefinition = {
	name: 'downArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('x1', '*/ wd2 a2 100000'),
		gd('x2', '*/ wd2 a1 100000'),
		gd('x3', '+- hc 0 x2'),
		gd('x4', '+- hc x2 0'),
		gd('x5', '+- hc 0 x1'),
		gd('x6', '+- hc x1 0'),
		gd('y1', '*/ h a4 100000'),
		gd('y2', '*/ h a3 100000'),
		gd('y3', '+- b 0 y2'),
	],
	rect: { l: 'x5', t: 't', r: 'x6', b: 'y1' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x5', y: 'y3' },
				{ kind: 'lnTo', x: 'x5', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Bidirectional callouts
// ---------------------------------------------------------------------------

// leftRightArrowCallout — bidirectional horizontal arrow with a central
// rectangular callout body.
//   adj1 = head body width as % of h/2     default 25000
//   adj2 = shaft thickness as % of h/2     default 25000
//   adj3 = head length     as % of w/2     default 25000
//   adj4 = callout body extent (centred)   default 48123
const leftRightArrowCallout: PresetShapeGeometryDefinition = {
	name: 'leftRightArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 48123 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('y1', '*/ hd2 a2 100000'),
		gd('y2', '*/ hd2 a1 100000'),
		gd('y3', '+- vc 0 y2'),
		gd('y4', '+- vc y2 0'),
		gd('y5', '+- vc 0 y1'),
		gd('y6', '+- vc y1 0'),
		gd('x1', '*/ wd2 a3 100000'),
		gd('x4', '+- r 0 x1'),
		gd('cw', '*/ w a4 200000'),
		gd('x2', '+- hc 0 cw'),
		gd('x3', '+- hc cw 0'),
	],
	rect: { l: 'x2', t: 'y5', r: 'x3', b: 'y6' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'y5' },
				{ kind: 'lnTo', x: 'x2', y: 'y5' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y5' },
				{ kind: 'lnTo', x: 'x4', y: 'y5' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'y6' },
				{ kind: 'lnTo', x: 'x3', y: 'y6' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y6' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'close' },
			],
		},
	],
};

// upDownArrowCallout — bidirectional vertical arrow with a central
// rectangular callout body. Mirrors leftRightArrowCallout on the vertical
// axis.
const upDownArrowCallout: PresetShapeGeometryDefinition = {
	name: 'upDownArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 48123 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('x1', '*/ wd2 a2 100000'),
		gd('x2', '*/ wd2 a1 100000'),
		gd('x3', '+- hc 0 x2'),
		gd('x4', '+- hc x2 0'),
		gd('x5', '+- hc 0 x1'),
		gd('x6', '+- hc x1 0'),
		gd('y1', '*/ hd2 a3 100000'),
		gd('y4', '+- b 0 y1'),
		gd('ch', '*/ h a4 200000'),
		gd('y2', '+- vc 0 ch'),
		gd('y3', '+- vc ch 0'),
	],
	rect: { l: 'x5', t: 'y2', r: 'x6', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y1' },
				{ kind: 'lnTo', x: 'x6', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x6', y: 'y3' },
				{ kind: 'lnTo', x: 'x6', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x5', y: 'y4' },
				{ kind: 'lnTo', x: 'x5', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x5', y: 'y2' },
				{ kind: 'lnTo', x: 'x5', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// quadArrowCallout — 4-way arrow with central rectangular callout body.
//   adj1 = arrow head-body width as % of (wd2,hd2)  default 18515
//   adj2 = shaft thickness        as % of (wd2,hd2) default 18515
//   adj3 = head length            as % of (wd2,hd2) default 18515
//   adj4 = callout body extent    as % of (w,h)     default 48123
//   adj5 = (unused — text rect cushion) reserved
const quadArrowCallout: PresetShapeGeometryDefinition = {
	name: 'quadArrowCallout',
	avLst: { adj1: 18515, adj2: 18515, adj3: 18515, adj4: 48123 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		// Shaft thickness offsets (half-thickness on each axis).
		gd('x1', '*/ wd2 a2 100000'),
		gd('x2', '*/ wd2 a1 100000'),
		gd('y1', '*/ hd2 a2 100000'),
		gd('y2', '*/ hd2 a1 100000'),
		// Head body offsets (relative to the centre).
		gd('x5', '+- hc 0 x1'),
		gd('x6', '+- hc x1 0'),
		gd('x3', '+- hc 0 x2'),
		gd('x4', '+- hc x2 0'),
		gd('y5', '+- vc 0 y1'),
		gd('y6', '+- vc y1 0'),
		gd('y3', '+- vc 0 y2'),
		gd('y4', '+- vc y2 0'),
		// Head-length distances on each axis.
		gd('hl', '*/ wd2 a3 100000'),
		gd('vl', '*/ hd2 a3 100000'),
		gd('xL', '+- l hl 0'),
		gd('xR', '+- r 0 hl'),
		gd('yT', '+- t vl 0'),
		gd('yB', '+- b 0 vl'),
		// Central callout body (square-ish region, half-extents).
		gd('cw', '*/ w a4 200000'),
		gd('ch', '*/ h a4 200000'),
		gd('cl', '+- hc 0 cw'),
		gd('cr', '+- hc cw 0'),
		gd('ct', '+- vc 0 ch'),
		gd('cb', '+- vc ch 0'),
	],
	rect: { l: 'cl', t: 'ct', r: 'cr', b: 'cb' },
	pathLst: [
		{
			commands: [
				// Left tip
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'xL', y: 'y5' },
				{ kind: 'lnTo', x: 'xL', y: 'y3' },
				// Up arm
				{ kind: 'lnTo', x: 'cl', y: 'y3' },
				{ kind: 'lnTo', x: 'cl', y: 'ct' },
				{ kind: 'lnTo', x: 'x5', y: 'ct' },
				{ kind: 'lnTo', x: 'x5', y: 'yT' },
				{ kind: 'lnTo', x: 'x3', y: 'yT' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'yT' },
				{ kind: 'lnTo', x: 'x6', y: 'yT' },
				{ kind: 'lnTo', x: 'x6', y: 'ct' },
				// Right arm
				{ kind: 'lnTo', x: 'cr', y: 'ct' },
				{ kind: 'lnTo', x: 'cr', y: 'y3' },
				{ kind: 'lnTo', x: 'xR', y: 'y3' },
				{ kind: 'lnTo', x: 'xR', y: 'y5' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'xR', y: 'y6' },
				{ kind: 'lnTo', x: 'xR', y: 'y4' },
				// Down arm
				{ kind: 'lnTo', x: 'cr', y: 'y4' },
				{ kind: 'lnTo', x: 'cr', y: 'cb' },
				{ kind: 'lnTo', x: 'x6', y: 'cb' },
				{ kind: 'lnTo', x: 'x6', y: 'yB' },
				{ kind: 'lnTo', x: 'x4', y: 'yB' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 'yB' },
				{ kind: 'lnTo', x: 'x5', y: 'yB' },
				{ kind: 'lnTo', x: 'x5', y: 'cb' },
				// Bottom-left corner of callout body, then back to left arm
				{ kind: 'lnTo', x: 'cl', y: 'cb' },
				{ kind: 'lnTo', x: 'cl', y: 'y4' },
				{ kind: 'lnTo', x: 'xL', y: 'y4' },
				{ kind: 'lnTo', x: 'xL', y: 'y6' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Bent arrow callouts (SIMPLIFIED — default-adjustment polygons)
// ---------------------------------------------------------------------------
// The full ECMA formula sets for bentArrowCallout / bentUpArrowCallout each
// pull in 30+ guides describing the knee position, head, and callout body.
// These polygons are spec-faithful at the canonical default avLst values; the
// `avLst` defaults are still authored against the spec so downstream code can
// detect the canonical adjustments. Arbitrary adjustment overrides are TODO.

// bentArrowCallout — right-then-up bent arrow with a callout body on the
// horizontal segment.
const bentArrowCallout: PresetShapeGeometryDefinition = {
	name: 'bentArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		// Head + shaft thickness (relative to ss).
		gd('th', '*/ ss a2 100000'),
		gd('hw', '*/ ss a1 100000'),
		gd('hl', '*/ ss a3 100000'),
		// Vertical-segment x bounds.
		gd('xb', '+- l th 0'),
		// Head x bounds (right end).
		gd('xh', '+- xb hl 0'),
		// Knee line (where horizontal joins vertical).
		gd('y1', '+- t hw 0'),
		gd('y2', '+- y1 th 0'),
		gd('y3', '+- y1 0 hw'),
		// Callout body — fraction of remaining vertical run.
		gd('cy', '*/ h a4 100000'),
		gd('cb', '+- b 0 cy'),
	],
	rect: { l: 'l', t: 'cb', r: 'xb', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'cb' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'xb', y: 'y2' },
				{ kind: 'lnTo', x: 'xb', y: 'y3' },
				{ kind: 'lnTo', x: 'xh', y: 'y3' },
				{ kind: 'lnTo', x: 'xh', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'xh', y: 'y2' },
				{ kind: 'lnTo', x: 'xh', y: 'y1' },
				{ kind: 'lnTo', x: 'xb', y: 'y1' },
				{ kind: 'lnTo', x: 'xb', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// bentUpArrowCallout — right-then-up bent arrow with a callout body on the
// vertical segment.
const bentUpArrowCallout: PresetShapeGeometryDefinition = {
	name: 'bentUpArrowCallout',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 64977 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('a4', 'pin 0 adj4 100000'),
		gd('th', '*/ ss a2 100000'),
		gd('hw', '*/ ss a1 100000'),
		gd('hl', '*/ ss a3 100000'),
		gd('y2', '+- b 0 th'),
		gd('xh', '+- r 0 hl'),
		gd('xb', '+- xh 0 hw'),
		gd('xt', '+- xh hw 0'),
		// Callout body fraction along the bottom run.
		gd('cx', '*/ w a4 100000'),
	],
	rect: { l: 'l', t: 't', r: 'cx', b: 'y2' },
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

// ---------------------------------------------------------------------------
// leftUpArrow — L-shaped arrow combining left + up tips on a single body.
// Three adjustments (canonical defaults 25000 / 25000 / 25000):
//   adj1 = head body width as % of ss
//   adj2 = head length     as % of ss
//   adj3 = body thickness  as % of ss
// ---------------------------------------------------------------------------
const leftUpArrow: PresetShapeGeometryDefinition = {
	name: 'leftUpArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		// Head body / length / thickness in raw units.
		gd('hw', '*/ ss a1 100000'),
		gd('hl', '*/ ss a2 100000'),
		gd('th', '*/ ss a3 100000'),
		// Up-arm head (vertical) — bounds along x.
		gd('xc', '+- l hl 0'),
		gd('x1', '+- xc 0 0'),
		gd('xb', '+- l hl 0'),
		gd('xs', '+- xb 0 0'),
		// The body's "shaft" runs from (hl, hl) to (r, b). Top-left corner of
		// the up arm is at (xs - hw/2, t), tip at (xs, t)... we use canonical
		// formulas: vertical head spans from xc-hw to xc+hw centred on xc.
		gd('xH1', '+- xc 0 hw'),
		gd('xH2', '+- xc hw 0'),
		// Horizontal head spans from t-hw to t+hw centred on yc.
		gd('yc', '+- t hl 0'),
		gd('yH1', '+- yc 0 hw'),
		gd('yH2', '+- yc hw 0'),
		// Body inner corner (where the L meets) at (xc + th, yc + th)... the
		// canonical formulas tie it via head length / thickness.
		gd('xt', '+- xc th 0'),
		gd('yt', '+- yc th 0'),
	],
	rect: { l: 'xt', t: 'yt', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				// Start at the left tip.
				{ kind: 'moveTo', x: 'l', y: 'yc' },
				// Up to the top-left corner of the horizontal head.
				{ kind: 'lnTo', x: 'xc', y: 'yH1' },
				// Across to where the horizontal head meets the up-arrow's left edge.
				{ kind: 'lnTo', x: 'xH1', y: 'yH1' },
				// Up to the up-arrow's outer-left base.
				{ kind: 'lnTo', x: 'xH1', y: 'yc' },
				// Out to the up-arrow's tip-base outer-left.
				{ kind: 'lnTo', x: 'xH1', y: 'yc' },
				// Diagonal up-left to the up-arrow tip.
				{ kind: 'lnTo', x: 'xc', y: 't' },
				// Diagonal down-right to the up-arrow's outer-right base.
				{ kind: 'lnTo', x: 'xH2', y: 'yc' },
				// Down to the inner top-right corner (start of the body shaft).
				{ kind: 'lnTo', x: 'xH2', y: 'yt' },
				// Across to the right edge.
				{ kind: 'lnTo', x: 'r', y: 'yt' },
				// Down to the bottom-right corner.
				{ kind: 'lnTo', x: 'r', y: 'b' },
				// Across to the bottom-left corner of the body shaft.
				{ kind: 'lnTo', x: 'xt', y: 'b' },
				// Up to the inner-bottom corner near the left head.
				{ kind: 'lnTo', x: 'xt', y: 'yH2' },
				// Across to the left head's lower base.
				{ kind: 'lnTo', x: 'xc', y: 'yH2' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Public table
// ---------------------------------------------------------------------------

/**
 * Arrow-callout family preset definitions. The aggregator in
 * `preset-shape-definitions-table.ts` should spread this record into
 * `PRESET_SHAPE_GEOMETRY_TABLE` after this batch is merged.
 */
export const ARROW_CALLOUT_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	leftArrowCallout,
	rightArrowCallout,
	upArrowCallout,
	downArrowCallout,
	leftRightArrowCallout,
	upDownArrowCallout,
	quadArrowCallout,
	bentArrowCallout,
	bentUpArrowCallout,
	leftUpArrow,
};
