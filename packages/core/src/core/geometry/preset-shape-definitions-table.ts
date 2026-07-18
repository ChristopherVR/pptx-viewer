/**
 * ECMA-376 ST_ShapeType preset geometry definitions table.
 *
 * Each entry encodes the canonical `presetShapeDefinitions.xml` data shipped by
 * Microsoft as part of the DrawingML reference implementation
 * (ISO/IEC 29500-1 §20.1.10.55 / §20.1.9 series): the default adjustment list
 * (`avLst`), the ordered guide list (`gdLst`), the text rectangle (`rect`), and
 * the path commands (`pathLst`) — all expressed using OOXML guide-formula
 * tokens, ready to be evaluated by `guide-formula-eval`.
 *
 * Naming note: the existing barrel already exports a `PresetShapeDefinition`
 * type (shape-picker metadata) and a `PRESET_SHAPE_DEFINITIONS` constant. To
 * avoid colliding with those public symbols, this module exports its analogues
 * as `PresetShapeGeometryDefinition` / `PRESET_SHAPE_GEOMETRY_TABLE`.
 *
 * # Adding a new preset
 *
 * 1. Open `presetShapeDefinitions.xml` (Microsoft Open Specifications) and
 *    locate the `<presetShapeDefinition name="..." />` block.
 * 2. Copy the `avLst` defaults into `avLst` here (each `a:gd` `name`/`val`).
 * 3. Copy each `a:gd` from `gdLst` into the `gdLst` array verbatim — the
 *    `formula` field is the entire `@_fmla` string (operator first, operands
 *    after) and `args` is the formula split by whitespace minus the operator.
 *    Both are stored to keep the data introspectable; the evaluator uses the
 *    `formula` string directly via `parseFormula`.
 * 4. Copy `<rect>` attributes into the `rect` field as raw token strings
 *    (e.g. `'l'`, `'t'`, `'r'`, `'b'`).
 * 5. Copy each `a:path` into a `pathLst` entry, translating its child commands
 *    into the `commands` discriminated union. All coordinate / radius / angle
 *    arguments are raw token strings — they will be resolved against the guide
 *    context by the evaluator.
 *
 * Only 30 high-impact presets are populated for the first cut. Additional
 * presets are tracked as future work; until they ship, the legacy
 * polygon-based clip-path table in `preset-shape-paths.ts` remains the
 * fallback for unknown names.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Batch shape additions authored by parallel agents — aggregated into
// PRESET_SHAPE_GEOMETRY_TABLE below. Each batch file owns its own shape group
// and is independently testable.
import { ACTION_BUTTON_PRESET_DEFINITIONS } from './preset-shape-definitions-action-buttons';
import { ARROW_CALLOUT_PRESET_DEFINITIONS } from './preset-shape-definitions-arrow-callouts';
import { ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-arrows';
import { REFINED_ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-arrows-refined';
import { CONNECTORS_BRACKETS_PRESET_DEFINITIONS } from './preset-shape-definitions-connectors-brackets';
import { CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS } from './preset-shape-definitions-curved-arrows-connectors';
import { EXACT_CURVED_ARROW_PRESET_DEFINITIONS } from './preset-shape-definitions-curved-arrows-exact';
import { FLOWCHART_PRESET_DEFINITIONS } from './preset-shape-definitions-flowchart';
import { MISC_PRESET_DEFINITIONS } from './preset-shape-definitions-misc';
import { RECTS_SNIPS_PRESET_DEFINITIONS } from './preset-shape-definitions-rects-snips';
import { SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS } from './preset-shape-definitions-scrolls-accent-callouts';
import { TABS_DECORATIONS_PRESET_DEFINITIONS } from './preset-shape-definitions-tabs-decorations';

/**
 * A single command inside a preset path. Coordinates / radii / angles are
 * stored as raw OOXML guide tokens (numeric literal strings or guide names)
 * and resolved at evaluation time.
 */
export type PresetPathCommand =
	| { kind: 'moveTo'; x: string; y: string }
	| { kind: 'lnTo'; x: string; y: string }
	| { kind: 'arcTo'; wR: string; hR: string; stAng: string; swAng: string }
	| { kind: 'quadBezTo'; x1: string; y1: string; x2: string; y2: string }
	| {
			kind: 'cubicBezTo';
			x1: string;
			y1: string;
			x2: string;
			y2: string;
			x3: string;
			y3: string;
	  }
	| { kind: 'close' };

/** A single sub-path, mirroring `<a:path>` in OOXML. */
export interface PresetPath {
	/** Coordinate-space width (`@_w`); defaults to the shape width if absent. */
	w?: number;
	/** Coordinate-space height (`@_h`); defaults to the shape height if absent. */
	h?: number;
	/** `@_fill` attribute (`'none' | 'norm' | 'lighten' | ...`). */
	fill?: string;
	/** `@_stroke` attribute. */
	stroke?: boolean;
	/** `@_extrusionOk` attribute. */
	extrusionOk?: boolean;
	/** Ordered command list. */
	commands: PresetPathCommand[];
}

/** A complete preset geometry (`<presetShapeDefinition>` payload). */
export interface PresetShapeGeometryDefinition {
	/** ECMA-376 ST_ShapeType name, e.g. `"roundRect"`, `"blockArc"`. */
	name: string;
	/** `avLst` defaults, e.g. `{ adj1: 16667 }`. */
	avLst?: Record<string, number>;
	/** `gdLst` formula list (ordered). */
	gdLst?: Array<{ name: string; formula: string; args: string[] }>;
	/** Text-bounds rectangle expressed as guide-formula tokens. */
	rect?: { l: string; t: string; r: string; b: string };
	/** `pathLst` — at least one path. */
	pathLst: PresetPath[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a `gdLst` entry from the canonical `<a:gd name="..." fmla="..." />`
 * tokens. Splits the formula to also expose its argument list so the data
 * stays introspectable for tooling/tests.
 */
function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

/** Default text rectangle equal to the shape bounds. */
const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const rect: PresetShapeGeometryDefinition = {
	name: 'rect',
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// roundRect — single-adj rounded rectangle.
// adj1 maps to the corner radius as a fraction of min(w,h)/2 (50000 → full half).
const roundRect: PresetShapeGeometryDefinition = {
	name: 'roundRect',
	avLst: { adj: 16667 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y2', '+- b 0 x1'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'x1', hR: 'x1', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

const ellipse: PresetShapeGeometryDefinition = {
	name: 'ellipse',
	gdLst: [gd('idx', '*/ ss 3 4'), gd('idy', '*/ ls 3 4')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

const triangle: PresetShapeGeometryDefinition = {
	name: 'triangle',
	avLst: { adj: 50000 },
	gdLst: [gd('a', 'pin 0 adj 100000'), gd('x1', '*/ w a 100000')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

const rtTriangle: PresetShapeGeometryDefinition = {
	name: 'rtTriangle',
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

const parallelogram: PresetShapeGeometryDefinition = {
	name: 'parallelogram',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		gd('x1', '*/ w a 200000'),
		gd('x2', '+- w 0 x1'),
		gd('x3', '*/ w a 100000'),
		gd('x4', '+- r 0 x3'),
		gd('x5', '*/ x3 1 2'),
		gd('x6', '+- r 0 x5'),
	],
	rect: { l: 'x5', t: 't', r: 'x6', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

const trapezoid: PresetShapeGeometryDefinition = {
	name: 'trapezoid',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		gd('x1', '*/ w a 200000'),
		gd('x2', '+- r 0 x1'),
		gd('x3', '*/ x1 1 2'),
		gd('x4', '+- r 0 x3'),
	],
	rect: { l: 'x3', t: 't', r: 'x4', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

const diamond: PresetShapeGeometryDefinition = {
	name: 'diamond',
	gdLst: [gd('ir', '*/ wd2 1 2'), gd('it', '*/ hd2 1 2')],
	rect: { l: 'ir', t: 'it', r: 'wd2', b: 'hd2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// Regular n-gon helper — emits a closed polygon centered at (hc,vc) with
// vertices on the bounding ellipse (wd2, hd2). Angle 0 (right) for even sides,
// or -90deg for upward-pointing odd-sided shapes (pentagon, heptagon, etc).
const pentagon: PresetShapeGeometryDefinition = {
	name: 'pentagon',
	gdLst: [
		gd('hf', 'val 105146'),
		gd('vf', 'val 110557'),
		gd('swd2', '*/ wd2 hf 100000'),
		gd('shd2', '*/ hd2 vf 100000'),
		gd('dx1', '*/ swd2 95106 100000'),
		gd('dx2', '*/ swd2 58779 100000'),
		gd('dy1', '*/ shd2 80902 100000'),
		gd('dy2', '*/ shd2 30902 100000'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc 0 dx2'),
		gd('x3', '+- hc dx2 0'),
		gd('x4', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy2 0'),
		gd('ir', '*/ y2 dx1 dy1'),
		gd('ib', '+- b 0 ir'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x4', b: 'ib' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

const hexagon: PresetShapeGeometryDefinition = {
	name: 'hexagon',
	avLst: { adj: 25000, vf: 115470 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		gd('shd2', '*/ hd2 vf 100000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y1', '+- vc 0 shd2'),
		gd('y2', '+- vc shd2 0'),
		gd('q1', '*/ shd2 115470 100000'),
		gd('ir', '+- x1 0 q1'),
		gd('il', '+- x1 q1 0'),
	],
	rect: { l: 'il', t: 'y1', r: 'ir', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

const heptagon: PresetShapeGeometryDefinition = {
	name: 'heptagon',
	gdLst: [
		gd('hf', 'val 102572'),
		gd('vf', 'val 105210'),
		gd('swd2', '*/ wd2 hf 100000'),
		gd('shd2', '*/ hd2 vf 100000'),
		gd('dx1', '*/ swd2 97493 100000'),
		gd('dx2', '*/ swd2 78183 100000'),
		gd('dx3', '*/ swd2 43388 100000'),
		gd('dy1', '*/ shd2 62349 100000'),
		gd('dy2', '*/ shd2 22252 100000'),
		gd('dy3', '*/ shd2 90097 100000'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc 0 dx2'),
		gd('x3', '+- hc 0 dx3'),
		gd('x4', '+- hc dx3 0'),
		gd('x5', '+- hc dx2 0'),
		gd('x6', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy2 0'),
		gd('y3', '+- vc dy3 0'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x6', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'x6', y: 'y1' },
				{ kind: 'lnTo', x: 'x5', y: 'y2' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

const octagon: PresetShapeGeometryDefinition = {
	name: 'octagon',
	avLst: { adj: 29289 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y2', '+- b 0 x1'),
		gd('il', '*/ x1 1 2'),
		gd('it', '*/ x1 1 2'),
		gd('ir', '+- r 0 il'),
		gd('ib', '+- b 0 it'),
	],
	rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

const decagon: PresetShapeGeometryDefinition = {
	name: 'decagon',
	avLst: { vf: 105146 },
	gdLst: [
		gd('shd2', '*/ hd2 vf 100000'),
		gd('dx1', '*/ wd2 95106 100000'),
		gd('dx2', '*/ wd2 58779 100000'),
		gd('dy1', '*/ shd2 80902 100000'),
		gd('dy2', '*/ shd2 30902 100000'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc 0 dx2'),
		gd('x3', '+- hc dx2 0'),
		gd('x4', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc 0 dy2'),
		gd('y3', '+- vc dy2 0'),
		gd('y4', '+- vc dy1 0'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x4', b: 'y4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

const dodecagon: PresetShapeGeometryDefinition = {
	name: 'dodecagon',
	gdLst: [
		gd('dx1', '*/ wd2 86603 100000'),
		gd('dx2', '*/ wd2 50000 100000'),
		gd('dy1', '*/ hd2 86603 100000'),
		gd('dy2', '*/ hd2 50000 100000'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc 0 dx2'),
		gd('x3', '+- hc dx2 0'),
		gd('x4', '+- hc dx1 0'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc 0 dy2'),
		gd('y3', '+- vc dy2 0'),
		gd('y4', '+- vc dy1 0'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x4', b: 'y4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

// pie / pieWedge / chord / arc / donut / noSmoking / blockArc share the same
// circular-cut machinery: stAng / endAng pairs into wd2,hd2 ellipses.
const pie: PresetShapeGeometryDefinition = {
	name: 'pie',
	avLst: { adj1: 0, adj2: 16200000 },
	gdLst: [
		gd('stAng', 'pin 0 adj1 21599999'),
		gd('endAng', 'pin 0 adj2 21599999'),
		gd('swAng', '+- endAng 0 stAng'),
		gd('swAng2', '?: swAng swAng +- 21600000 swAng 0'),
		gd('stx', 'cos wd2 stAng'),
		gd('sty', 'sin hd2 stAng'),
		gd('x1', '+- hc stx 0'),
		gd('y1', '+- vc sty 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'stAng', swAng: 'swAng2' },
				{ kind: 'close' },
			],
		},
	],
};

const pieWedge: PresetShapeGeometryDefinition = {
	name: 'pieWedge',
	gdLst: [
		gd('g1', 'cos wd2 13500000'),
		gd('g2', 'sin hd2 13500000'),
		gd('x1', '+- hc g1 0'),
		gd('y1', '+- vc g2 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

const chord: PresetShapeGeometryDefinition = {
	name: 'chord',
	avLst: { adj1: 2700000, adj2: 13500000 },
	gdLst: [
		gd('stAng', 'pin 0 adj1 21599999'),
		gd('endAng', 'pin 0 adj2 21599999'),
		gd('swAng', '+- endAng 0 stAng'),
		gd('swAng2', '?: swAng swAng +- 21600000 swAng 0'),
		gd('stx', 'cos wd2 stAng'),
		gd('sty', 'sin hd2 stAng'),
		gd('x1', '+- hc stx 0'),
		gd('y1', '+- vc sty 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'stAng', swAng: 'swAng2' },
				{ kind: 'close' },
			],
		},
	],
};

const arc: PresetShapeGeometryDefinition = {
	name: 'arc',
	avLst: { adj1: 16200000, adj2: 0 },
	gdLst: [
		gd('stAng', 'pin 0 adj1 21599999'),
		gd('endAng', 'pin 0 adj2 21599999'),
		gd('swAng', '+- endAng 0 stAng'),
		gd('swAng2', '?: swAng swAng +- 21600000 swAng 0'),
		gd('stx', 'cos wd2 stAng'),
		gd('sty', 'sin hd2 stAng'),
		gd('x1', '+- hc stx 0'),
		gd('y1', '+- vc sty 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			stroke: true,
			fill: 'none',
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'stAng', swAng: 'swAng2' },
			],
		},
	],
};

const donut: PresetShapeGeometryDefinition = {
	name: 'donut',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('dr', '*/ ss a 100000'),
		gd('iwd2', '+- wd2 0 dr'),
		gd('ihd2', '+- hd2 0 dr'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'dr', y: 'vc' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: 'cd2', swAng: '-5400000' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: 'cd4', swAng: '-5400000' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: '0', swAng: '-5400000' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'close' },
			],
		},
	],
};

const noSmoking: PresetShapeGeometryDefinition = {
	name: 'noSmoking',
	avLst: { adj: 18750 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('dr', '*/ ss a 100000'),
		gd('iwd2', '+- wd2 0 dr'),
		gd('ihd2', '+- hd2 0 dr'),
		gd('ang', 'at2 iwd2 ihd2'),
		gd('ca', 'cos iwd2 ang'),
		gd('sa', 'sin ihd2 ang'),
		gd('x1', '+- hc 0 ca'),
		gd('x2', '+- hc ca 0'),
		gd('y1', '+- vc 0 sa'),
		gd('y2', '+- vc sa 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// blockArc — adj1 = start angle (60000ths), adj2 = end angle, adj3 = thickness
// (1/100000 of ss). Default: 10800000 / 0 / 25000 → top half-ring.
const blockArc: PresetShapeGeometryDefinition = {
	name: 'blockArc',
	avLst: { adj1: 10800000, adj2: 0, adj3: 25000 },
	gdLst: [
		gd('stAng', 'pin 0 adj1 21599999'),
		gd('endAng', 'pin 0 adj2 21599999'),
		gd('thh', 'pin 0 adj3 50000'),
		gd('th', '*/ ss thh 100000'),
		gd('thw', '*/ wd2 thh 100000'),
		gd('thh2', '*/ hd2 thh 100000'),
		gd('iwd2', '+- wd2 0 thw'),
		gd('ihd2', '+- hd2 0 thh2'),
		gd('swAng', '+- endAng 0 stAng'),
		gd('swAng2', '?: swAng swAng +- 21600000 swAng 0'),
		gd('mswAng', '+- 0 0 swAng2'),
		gd('stx', 'cos wd2 stAng'),
		gd('sty', 'sin hd2 stAng'),
		gd('x1', '+- hc stx 0'),
		gd('y1', '+- vc sty 0'),
		gd('istx', 'cos iwd2 endAng'),
		gd('isty', 'sin ihd2 endAng'),
		gd('ix1', '+- hc istx 0'),
		gd('iy1', '+- vc isty 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'stAng', swAng: 'swAng2' },
				{ kind: 'lnTo', x: 'ix1', y: 'iy1' },
				{ kind: 'arcTo', wR: 'iwd2', hR: 'ihd2', stAng: 'endAng', swAng: 'mswAng' },
				{ kind: 'close' },
			],
		},
	],
};

// Arrow shapes — adj1 = head body width %, adj2 = head length %.
const rightArrow: PresetShapeGeometryDefinition = {
	name: 'rightArrow',
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
	],
	rect: { l: 'l', t: 'y2', r: 'x3', b: 'y3' },
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
				{ kind: 'close' },
			],
		},
	],
};

const leftArrow: PresetShapeGeometryDefinition = {
	name: 'leftArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('y1', '*/ hd2 a1 100000'),
		gd('y2', '+- vc 0 y1'),
		gd('y3', '+- vc y1 0'),
		gd('x1', '*/ w a2 100000'),
		gd('dx2', '*/ hd2 x1 wd2'),
		gd('x2', '+- l dx2 0'),
	],
	rect: { l: 'x2', t: 'y2', r: 'r', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

const upArrow: PresetShapeGeometryDefinition = {
	name: 'upArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ wd2 a1 100000'),
		gd('x2', '+- hc 0 x1'),
		gd('x3', '+- hc x1 0'),
		gd('y2', '*/ h a2 100000'),
		gd('dy2', '*/ wd2 y2 hd2'),
		gd('y1', '+- t dy2 0'),
	],
	rect: { l: 'x2', t: 'y1', r: 'x3', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

const downArrow: PresetShapeGeometryDefinition = {
	name: 'downArrow',
	avLst: { adj1: 50000, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 0 adj2 100000'),
		gd('x1', '*/ wd2 a1 100000'),
		gd('x2', '+- hc 0 x1'),
		gd('x3', '+- hc x1 0'),
		gd('y1', '*/ h a2 100000'),
		gd('y2', '+- b 0 y1'),
		gd('dy2', '*/ wd2 y1 hd2'),
		gd('y3', '+- b 0 dy2'),
	],
	rect: { l: 'x2', t: 't', r: 'x3', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// Wedge callouts — adj1 / adj2 are the pointer tip position in 1/100000 of
// (w,h) measured from the centre. Defaults differ per shape.
const wedgeRectCallout: PresetShapeGeometryDefinition = {
	name: 'wedgeRectCallout',
	avLst: { adj1: -20833, adj2: 62500 },
	gdLst: [
		gd('dxPos', '*/ w adj1 100000'),
		gd('dyPos', '*/ h adj2 100000'),
		gd('xPos', '+- hc dxPos 0'),
		gd('yPos', '+- vc dyPos 0'),
		gd('dx', '+- xPos 0 hc'),
		gd('dy', '+- yPos 0 vc'),
		gd('dq', '*/ dxPos h w'),
		gd('ady', 'abs dy'),
		gd('adq', 'abs dq'),
		gd('xg1', '?: dxPos 7 2'),
		gd('xg2', '?: dxPos 10 5'),
		gd('x1', '*/ w xg1 12'),
		gd('x2', '*/ w xg2 12'),
		gd('yg1', '?: dyPos 7 2'),
		gd('yg2', '?: dyPos 10 5'),
		gd('y1', '*/ h yg1 12'),
		gd('y2', '*/ h yg2 12'),
		gd('t1', '?: dxPos l xPos'),
		gd('xl', '?: ady adq t1 l'),
		gd('t2', '?: dyPos yPos t'),
		gd('yt', '?: ady adq t t2'),
		gd('t3', '?: dxPos xPos r'),
		gd('xr', '?: ady adq t3 r'),
		gd('t4', '?: dyPos b yPos'),
		gd('yb', '?: ady adq b t4'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'xl', y: 'yt' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'xr', y: 'yt' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'xl', y: 'yb' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'xr', y: 'yb' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

const wedgeRoundRectCallout: PresetShapeGeometryDefinition = {
	name: 'wedgeRoundRectCallout',
	avLst: { adj1: -20833, adj2: 62500, adj3: 16667 },
	gdLst: [
		gd('dxPos', '*/ w adj1 100000'),
		gd('dyPos', '*/ h adj2 100000'),
		gd('xPos', '+- hc dxPos 0'),
		gd('yPos', '+- vc dyPos 0'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('rad', '*/ ss a3 100000'),
		gd('x1', '+- l rad 0'),
		gd('x2', '+- r 0 rad'),
		gd('y1', '+- t rad 0'),
		gd('y2', '+- b 0 rad'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'xPos', y: 'b' },
				{ kind: 'lnTo', x: 'xPos', y: 'yPos' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

const wedgeEllipseCallout: PresetShapeGeometryDefinition = {
	name: 'wedgeEllipseCallout',
	avLst: { adj1: -20833, adj2: 62500 },
	gdLst: [
		gd('dxPos', '*/ w adj1 100000'),
		gd('dyPos', '*/ h adj2 100000'),
		gd('xPos', '+- hc dxPos 0'),
		gd('yPos', '+- vc dyPos 0'),
		gd('sdx', '*/ dxPos hd2 wd2'),
		gd('sdy', 'val dyPos'),
		gd('pang', 'at2 sdx sdy'),
		gd('stAng', '+- pang 660000 0'),
		gd('enAng', '+- pang 0 660000'),
		gd('dx1', 'cos wd2 stAng'),
		gd('dy1', 'sin hd2 stAng'),
		gd('x1', '+- hc dx1 0'),
		gd('y1', '+- vc dy1 0'),
		gd('dx2', 'cos wd2 enAng'),
		gd('dy2', 'sin hd2 enAng'),
		gd('x2', '+- hc dx2 0'),
		gd('y2', '+- vc dy2 0'),
		gd('stAng1', 'at2 dx1 dy1'),
		gd('enAngFinal', 'at2 dx2 dy2'),
		gd('swAng1', '+- enAngFinal 0 stAng1'),
		gd('swAng', '?: swAng1 swAng1 +- swAng1 21600000 0'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'stAng1', swAng: 'swAng' },
				{ kind: 'lnTo', x: 'xPos', y: 'yPos' },
				{ kind: 'close' },
			],
		},
	],
};

// 4-point and 5-point stars. ECMA preset uses fixed proportions; star4/star5
// have no avLst (their inner radius is encoded in the geometry).
const star4: PresetShapeGeometryDefinition = {
	name: 'star4',
	avLst: { adj: 12500 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('iwd2', '*/ wd2 a 50000'),
		gd('ihd2', '*/ hd2 a 50000'),
		gd('sdx', '*/ iwd2 92388 100000'),
		gd('sdy', '*/ ihd2 92388 100000'),
		gd('sx1', '+- hc 0 sdx'),
		gd('sx2', '+- hc sdx 0'),
		gd('sy1', '+- vc 0 sdy'),
		gd('sy2', '+- vc sdy 0'),
		gd('yAdj', '+- vc 0 ihd2'),
	],
	rect: { l: 'sx1', t: 'sy1', r: 'sx2', b: 'sy2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'sx1', y: 'sy1' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'sx2', y: 'sy1' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'sx2', y: 'sy2' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'sx1', y: 'sy2' },
				{ kind: 'close' },
			],
		},
	],
};

const star5: PresetShapeGeometryDefinition = {
	name: 'star5',
	avLst: { adj: 19098, hf: 105146, vf: 110557 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('swd2', '*/ wd2 hf 100000'),
		gd('shd2', '*/ hd2 vf 100000'),
		gd('svc', '*/ vc vf 100000'),
		gd('dx1', '*/ swd2 95106 100000'),
		gd('dx2', '*/ swd2 58779 100000'),
		gd('dy1', '*/ shd2 80902 100000'),
		gd('dy2', '*/ shd2 30902 100000'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc 0 dx2'),
		gd('x3', '+- hc dx2 0'),
		gd('x4', '+- hc dx1 0'),
		gd('y1', '+- svc 0 dy1'),
		gd('y2', '+- svc 0 dy2'),
		gd('iwd2', '*/ swd2 a 50000'),
		gd('ihd2', '*/ shd2 a 50000'),
		gd('sdx1', '*/ iwd2 95106 100000'),
		gd('sdx2', '*/ iwd2 58779 100000'),
		gd('sdy1', '*/ ihd2 80902 100000'),
		gd('sdy2', '*/ ihd2 30902 100000'),
		gd('sx1', '+- hc 0 sdx1'),
		gd('sx2', '+- hc 0 sdx2'),
		gd('sx3', '+- hc sdx2 0'),
		gd('sx4', '+- hc sdx1 0'),
		gd('sy1', '+- svc 0 sdy1'),
		gd('sy2', '+- svc 0 sdy2'),
		gd('sy3', '+- svc ihd2 0'),
		gd('yc', '+- svc 0 ihd2'),
	],
	rect: { l: 'sx1', t: 'y1', r: 'sx4', b: 'sy3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'sx2', y: 'sy2' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'sx3', y: 'sy2' },
				{ kind: 'lnTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'sx4', y: 'sy3' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'hc', y: 'sy3' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'sx1', y: 'sy3' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

/**
 * Master table of populated preset geometries. Keyed by ECMA-376 ST_ShapeType
 * name (camelCase). Lookups are case-sensitive; callers should normalise
 * unknown casings (e.g. `'roundrect'` → `'roundRect'`) before consulting it.
 *
 * Inline definitions for ~30 shapes live above. Additional batches authored
 * by parallel agents are imported from sibling files and spread last so they
 * cannot accidentally shadow the inline canonical shapes.
 */
export const PRESET_SHAPE_GEOMETRY_TABLE: Record<string, PresetShapeGeometryDefinition> = {
	rect,
	roundRect,
	ellipse,
	triangle,
	rtTriangle,
	parallelogram,
	trapezoid,
	diamond,
	pentagon,
	hexagon,
	heptagon,
	octagon,
	decagon,
	dodecagon,
	pie,
	pieWedge,
	chord,
	arc,
	donut,
	noSmoking,
	blockArc,
	rightArrow,
	leftArrow,
	upArrow,
	downArrow,
	wedgeRectCallout,
	wedgeRoundRectCallout,
	wedgeEllipseCallout,
	star4,
	star5,
	...ARROW_PRESET_DEFINITIONS,
	...FLOWCHART_PRESET_DEFINITIONS,
	...MISC_PRESET_DEFINITIONS,
	...ARROW_CALLOUT_PRESET_DEFINITIONS,
	...CURVED_ARROWS_CONNECTORS_PRESET_DEFINITIONS,
	...CONNECTORS_BRACKETS_PRESET_DEFINITIONS,
	...RECTS_SNIPS_PRESET_DEFINITIONS,
	...TABS_DECORATIONS_PRESET_DEFINITIONS,
	...SCROLLS_ACCENT_CALLOUTS_PRESET_DEFINITIONS,
	...ACTION_BUTTON_PRESET_DEFINITIONS,
	// Refined arrows MUST come last so its full-spec versions override the
	// simplified entries from ARROW_PRESET_DEFINITIONS.
	...REFINED_ARROW_PRESET_DEFINITIONS,
	// Spec-exact curved arrows override BOTH the simplified connector-batch
	// entries and the refined curvedRightArrow approximation.
	...EXACT_CURVED_ARROW_PRESET_DEFINITIONS,
};
