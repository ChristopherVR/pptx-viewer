/**
 * ECMA-376 ST_ShapeType preset geometry definitions — curved arrows + bent
 * connectors batch.
 *
 * This batch authors 10 additional shapes whose geometry is defined in
 * Microsoft's `presetShapeDefinitions.xml` (ISO/IEC 29500-1 §20.1.10.55):
 *
 * Curved arrows (filled silhouettes — `fill: 'norm'`)
 *  • `curvedDownArrow`, `curvedLeftArrow`, `curvedUpArrow`
 *
 * Lines (filled silhouettes are not applicable; stroke-only paths)
 *  • `line`        — straight horizontal stroke (top-left → bottom-right)
 *  • `lineInv`     — inverse diagonal stroke (top-right → bottom-left)
 *
 * Connectors (stroke-only polylines, `fill: 'none'`)
 *  • `straightConnector1` — single segment (l/t → r/b)
 *  • `bentConnector2`     — right-angle, 2 segments
 *  • `bentConnector3`     — right-angle, 3 segments, 1 adjustment
 *  • `bentConnector4`     — right-angle, 4 segments, 2 adjustments
 *  • `bentConnector5`     — right-angle, 5 segments, 3 adjustments
 *
 * # Notes on faithfulness
 *
 * The spec XML for `curvedDownArrow`, `curvedLeftArrow`, and `curvedUpArrow`
 * is symmetrical with `curvedRightArrow`, which the existing arrows batch
 * marks as `SIMPLIFIED:` (a faithful default-adjustment silhouette using
 * quad-Bézier curves for the arc body, plus a triangular arrow head). Those
 * three shapes here use the same reduction strategy — visually correct at the
 * spec-default avLst values but not yet honouring arbitrary adjustment
 * overrides. Future work can replace them with the full guide-formula sets
 * once the evaluator covers all of `quadBezTo`'s control-point math.
 *
 * Connectors carry `fill: 'none', stroke: true` on every path. The path
 * commands describe the polyline that PowerPoint draws between the connector
 * endpoints; the bend positions are controlled by the `adjN` adjustment list
 * exactly as documented in §20.1.9.10–20.1.9.13.
 *
 * # Adding to the master table
 *
 * The aggregator that exports `PRESET_SHAPE_GEOMETRY_TABLE` lives in
 * `preset-shape-definitions-table.ts`. Spread
 * `CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS` into the master record after
 * the human-driven merge of all batch agents.
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
// Curved arrows
// ---------------------------------------------------------------------------

// curvedDownArrow — quad-Bézier curved arrow pointing down. Mirrors the
// `curvedRightArrow` reduction in `preset-shape-definitions-arrows.ts`,
// rotated 90° (the arc travels along the X axis and the head points down).
//   adj1 — body thickness as a fraction of ss.
//   adj2 — horizontal centre of the arrow head along the body (fraction of w).
//   adj3 — head length as a fraction of h (the bottom-aligned head depth).
// SIMPLIFIED.
const curvedDownArrow: PresetShapeGeometryDefinition = {
	name: 'curvedDownArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('hl', '*/ h a3 100000'),
		gd('y1', '+- b 0 hl'),
		gd('x1', '*/ w a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 't' },
				{
					kind: 'quadBezTo',
					x1: 'l',
					y1: 'vc',
					x2: 'x1',
					y2: 'y1',
				},
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{
					kind: 'quadBezTo',
					x1: 'r',
					y1: 'vc',
					x2: 'r',
					y2: 't',
				},
				{ kind: 'close' },
			],
		},
	],
};

// curvedLeftArrow — quad-Bézier curved arrow pointing left. Mirrors
// `curvedRightArrow`, rotated 180°.
//   adj1 — body thickness as a fraction of ss.
//   adj2 — vertical centre of the arrow head along the body (fraction of h).
//   adj3 — head length as a fraction of w (the left-aligned head depth).
// SIMPLIFIED.
const curvedLeftArrow: PresetShapeGeometryDefinition = {
	name: 'curvedLeftArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('hl', '*/ w a3 100000'),
		gd('x1', '+- l 0 0'),
		gd('x2', '*/ w a3 100000'),
		gd('y1', '*/ h a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'b' },
				{
					kind: 'quadBezTo',
					x1: 'hc',
					y1: 't',
					x2: 'x2',
					y2: 'y1',
				},
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{
					kind: 'quadBezTo',
					x1: 'hc',
					y1: 'b',
					x2: 'r',
					y2: 'b',
				},
				{ kind: 'close' },
			],
		},
	],
};

// curvedUpArrow — quad-Bézier curved arrow pointing up. Mirrors
// `curvedRightArrow`, rotated -90° (head points up, arc along X axis).
//   adj1 — body thickness as a fraction of ss.
//   adj2 — horizontal centre of the arrow head along the body (fraction of w).
//   adj3 — head length as a fraction of h (the top-aligned head depth).
// SIMPLIFIED.
const curvedUpArrow: PresetShapeGeometryDefinition = {
	name: 'curvedUpArrow',
	avLst: { adj1: 25000, adj2: 50000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('hl', '*/ h a3 100000'),
		gd('y1', '*/ h a3 100000'),
		gd('x1', '*/ w a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'norm',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{
					kind: 'quadBezTo',
					x1: 'r',
					y1: 'vc',
					x2: 'x1',
					y2: 'y1',
				},
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{
					kind: 'quadBezTo',
					x1: 'l',
					y1: 'vc',
					x2: 'l',
					y2: 'b',
				},
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Lines
// ---------------------------------------------------------------------------

// line — straight stroke from the top-left corner to the bottom-right corner.
// Per §20.1.9.40 the canonical `line` preset is a single segment between the
// two opposite corners of the bounding box. Stroke-only.
const line: PresetShapeGeometryDefinition = {
	name: 'line',
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// lineInv — inverse straight stroke (top-right → bottom-left). Mirrors `line`
// across the vertical axis.
const lineInv: PresetShapeGeometryDefinition = {
	name: 'lineInv',
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

// straightConnector1 — single straight segment between the bounding-box
// corners (§20.1.9.10). Identical geometry to `line` but registered under the
// connector preset name so OOXML <cxnSp> shapes resolve correctly.
const straightConnector1: PresetShapeGeometryDefinition = {
	name: 'straightConnector1',
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// bentConnector2 — right-angle connector with 2 segments. The bend always
// occurs at (r, t) so the path travels horizontally then vertically (or vice-
// versa depending on orientation). No adjustments per §20.1.9.11.
const bentConnector2: PresetShapeGeometryDefinition = {
	name: 'bentConnector2',
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// bentConnector3 — right-angle connector with 3 segments. Spec §20.1.9.12:
// adj1 controls the X position (as a fraction of w / 100000) of the central
// vertical segment. The path runs (l,t) → (x1,t) → (x1,b) → (r,b).
const bentConnector3: PresetShapeGeometryDefinition = {
	name: 'bentConnector3',
	avLst: { adj1: 50000 },
	gdLst: [gd('a1', 'pin 0 adj1 100000'), gd('x1', '*/ w a1 100000')],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// bentConnector4 — right-angle connector with 4 segments. Spec §20.1.9.13:
// adj1 controls the X position of the first vertical bend (fraction of w),
// adj2 controls the Y position of the second horizontal bend (fraction of h).
// Path: (l,t) → (x1,t) → (x1,y1) → (r,y1) → (r,b).
const bentConnector4: PresetShapeGeometryDefinition = {
	name: 'bentConnector4',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ w a1 100000'),
		gd('y1', '*/ h a2 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// bentConnector5 — right-angle connector with 5 segments. Spec §20.1.9.14:
// adj1 (X1, fraction of w), adj2 (Y1, fraction of h), adj3 (X2, fraction of
// w). Path: (l,t) → (x1,t) → (x1,y1) → (x2,y1) → (x2,b) → (r,b).
const bentConnector5: PresetShapeGeometryDefinition = {
	name: 'bentConnector5',
	avLst: { adj1: 50000, adj2: 50000, adj3: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('a3', 'pin 0 adj3 100000'),
		gd('x1', '*/ w a1 100000'),
		gd('y1', '*/ h a2 100000'),
		gd('x2', '*/ w a3 100000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Public table
// ---------------------------------------------------------------------------

/**
 * Curved arrow + connector preset definitions. The aggregator in
 * `preset-shape-definitions-table.ts` should spread this record into
 * `PRESET_SHAPE_GEOMETRY_TABLE` once all batch authors have merged.
 */
export const CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS: Record<
	string,
	PresetShapeGeometryDefinition
> = {
	curvedDownArrow,
	curvedLeftArrow,
	curvedUpArrow,
	line,
	lineInv,
	straightConnector1,
	bentConnector2,
	bentConnector3,
	bentConnector4,
	bentConnector5,
};
