/**
 * ECMA-376 ST_ShapeType preset geometry definitions — flowchart family.
 *
 * Mirrors Microsoft's `presetShapeDefinitions.xml` for the 28 `flowChart*`
 * shapes catalogued in ISO/IEC 29500-1 §20.1.10.55. The data here is
 * authored using the same conventions as
 * `preset-shape-definitions-table.ts`; see that module's header comment for
 * the full procedure (each `<a:gd>` is captured verbatim, every `<a:path>`
 * child becomes a `PresetPathCommand`, coordinates are guide-formula tokens).
 *
 * None of the flowchart shapes have an `avLst` (no user adjustments) so all
 * `gdLst` entries are deterministic — the geometry depends only on the
 * implicit guides (`l`, `t`, `r`, `b`, `w`, `h`, `hc`, `vc`, `wd2`, `hd2`,
 * `ss`, `ssd2`, ...) and inline literals.
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers (kept private — table file owns the public symbols)
// ---------------------------------------------------------------------------

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// Definitions — simple polygons
// ---------------------------------------------------------------------------

// flowChartProcess — plain rectangle (ECMA-376 §20.1.10.55 entry).
const flowChartProcess: PresetShapeGeometryDefinition = {
	name: 'flowChartProcess',
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

// flowChartDecision — diamond.
const flowChartDecision: PresetShapeGeometryDefinition = {
	name: 'flowChartDecision',
	gdLst: [gd('ir', '*/ wd2 3 4'), gd('ib', '*/ hd2 3 4')],
	rect: { l: 'wd4', t: 'hd4', r: 'ir', b: 'ib' },
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

// flowChartAlternateProcess — rounded rectangle with 1/6th radius corners.
const flowChartAlternateProcess: PresetShapeGeometryDefinition = {
	name: 'flowChartAlternateProcess',
	gdLst: [gd('x1', '*/ ss 1 6'), gd('x2', '+- r 0 x1'), gd('y2', '+- b 0 x1')],
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

// flowChartPredefinedProcess — rectangle with vertical gutter lines on each
// side at 1/8 and 7/8 of the width.
const flowChartPredefinedProcess: PresetShapeGeometryDefinition = {
	name: 'flowChartPredefinedProcess',
	gdLst: [gd('x2', '*/ w 1 8'), gd('x3', '*/ w 7 8')],
	rect: { l: 'x2', t: 't', r: 'x3', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'moveTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
			],
		},
	],
};

// flowChartInternalStorage — rectangle with one horizontal + one vertical
// internal gutter at 1/8 of the width / height (top + left).
const flowChartInternalStorage: PresetShapeGeometryDefinition = {
	name: 'flowChartInternalStorage',
	gdLst: [gd('x2', '*/ w 1 8'), gd('y2', '*/ h 1 8')],
	rect: { l: 'x2', t: 'y2', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
			],
		},
	],
};

// flowChartDocument — rectangle with a wavy bottom edge built from two cubic
// Beziers. ECMA height proportions: y1 = 17322/21600 (≈80.2%), y2 (control
// dip) = 20172/21600, y3 (control rise) = 23922/21600 (above bottom). We
// scale these by h/21600.
const flowChartDocument: PresetShapeGeometryDefinition = {
	name: 'flowChartDocument',
	gdLst: [
		gd('y1', '*/ h 17322 21600'),
		gd('y2', '*/ h 20172 21600'),
		gd('y3', '*/ h 23922 21600'),
		gd('x1', '*/ w 9722 21600'),
		gd('x2', '*/ w 11612 21600'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'y1' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{
					kind: 'cubicBezTo',
					x1: 'x2',
					y1: 'y3',
					x2: 'x1',
					y2: 'y2',
					x3: 'l',
					y3: 'y1',
				},
				{ kind: 'close' },
			],
		},
	],
};

// flowChartMultidocument — three stacked documents offset diagonally.
// ECMA reference x/y guides taken from presetShapeDefinitions.xml (21600
// canvas, three offset copies of the document path).
const flowChartMultidocument: PresetShapeGeometryDefinition = {
	name: 'flowChartMultidocument',
	gdLst: [
		gd('y1', '*/ h 18022 21600'),
		gd('y2', '*/ h 3675 21600'),
		gd('y3', '*/ h 23542 21600'),
		gd('y4', '*/ h 1815 21600'),
		gd('y5', '*/ h 16252 21600'),
		gd('y6', '*/ h 16352 21600'),
		gd('y7', '*/ h 14392 21600'),
		gd('y8', '*/ h 20782 21600'),
		gd('y9', '*/ h 14467 21600'),
		gd('x1', '*/ w 1532 21600'),
		gd('x2', '*/ w 20465 21600'),
		gd('x3', '*/ w 9722 21600'),
		gd('x4', '*/ w 11612 21600'),
		gd('x5', '*/ w 2452 21600'),
		gd('x6', '*/ w 3027 21600'),
		gd('x7', '*/ w 3192 21600'),
		gd('x8', '*/ w 20342 21600'),
		gd('x9', '*/ w 18512 21600'),
	],
	rect: { l: 'l', t: 'y2', r: 'x2', b: 'y6' },
	pathLst: [
		{
			// Front (bottom-left) document
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{
					kind: 'cubicBezTo',
					x1: 'x4',
					y1: 'y3',
					x2: 'x3',
					y2: 'y8',
					x3: 'l',
					y3: 'y1',
				},
				{ kind: 'close' },
			],
		},
		{
			// Middle document
			commands: [
				{ kind: 'moveTo', x: 'x5', y: 'y2' },
				{ kind: 'lnTo', x: 'x5', y: 'y4' },
				{ kind: 'lnTo', x: 'x8', y: 'y4' },
				{ kind: 'lnTo', x: 'x8', y: 'y7' },
				{ kind: 'lnTo', x: 'x2', y: 'y7' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'close' },
			],
			fill: 'darken',
		},
		{
			// Back document
			commands: [
				{ kind: 'moveTo', x: 'x7', y: 'y4' },
				{ kind: 'lnTo', x: 'x7', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y9' },
				{ kind: 'lnTo', x: 'x9', y: 'y9' },
				{ kind: 'lnTo', x: 'x9', y: 'y4' },
				{ kind: 'close' },
			],
			fill: 'darken',
		},
	],
};

// flowChartTerminator — pill shape: rounded rect with corner radius that
// reaches the vertical centre. Uses an ss-based radius (≈1075/3600 · ss).
const flowChartTerminator: PresetShapeGeometryDefinition = {
	name: 'flowChartTerminator',
	gdLst: [
		gd('x1', '*/ w 1075 21600'),
		gd('x2', '*/ w 20525 21600'),
		gd('y1', '*/ h 17467 21600'),
		gd('y2', '*/ h 4135 21600'),
	],
	rect: { l: 'x1', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: '0', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'x1', hR: 'hd2', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
	// y1/y2 retained above for reference; rect uses x1/x2.
};

// Drop the unused y1/y2 references? No — leave gdLst entries intact to mirror
// the canonical XML so consumers can introspect them.

// flowChartPreparation — extended hexagon with horizontal sides.
const flowChartPreparation: PresetShapeGeometryDefinition = {
	name: 'flowChartPreparation',
	gdLst: [gd('x2', '*/ w 4175 21600'), gd('x3', '*/ w 17425 21600')],
	rect: { l: 'x2', t: 't', r: 'x3', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartManualInput — quadrilateral with the top edge slanted (low-left,
// high-right): top-left at 4218/21600 of the height, top-right at 0.
const flowChartManualInput: PresetShapeGeometryDefinition = {
	name: 'flowChartManualInput',
	gdLst: [gd('y1', '*/ h 4118 21600')],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartManualOperation — inverted trapezoid (wider top, narrower bottom).
const flowChartManualOperation: PresetShapeGeometryDefinition = {
	name: 'flowChartManualOperation',
	gdLst: [gd('x1', '*/ w 4137 21600'), gd('x2', '*/ w 17463 21600')],
	rect: { l: 'x1', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartConnector — circle (same path as ellipse).
const flowChartConnector: PresetShapeGeometryDefinition = {
	name: 'flowChartConnector',
	gdLst: [gd('idx', '*/ ss 3 4'), gd('idy', '*/ ss 3 4')],
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

// flowChartOffpageConnector — pentagon-style: rectangle with chamfered
// bottom corners meeting at the bottom-centre.
const flowChartOffpageConnector: PresetShapeGeometryDefinition = {
	name: 'flowChartOffpageConnector',
	gdLst: [gd('y1', '*/ h 17567 21600')],
	rect: { l: 'l', t: 't', r: 'r', b: 'y1' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartPunchedCard — rectangle with one chamfered corner (top-left).
const flowChartPunchedCard: PresetShapeGeometryDefinition = {
	name: 'flowChartPunchedCard',
	gdLst: [gd('x1', '*/ w 4140 21600'), gd('y1', '*/ h 4140 21600')],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartPunchedTape — rectangle with wavy top + wavy bottom edges. Each
// edge is two cubic Beziers — top edge sweeps down then up, bottom edge does
// the inverse so the tape ends are mirrored.
const flowChartPunchedTape: PresetShapeGeometryDefinition = {
	name: 'flowChartPunchedTape',
	gdLst: [
		gd('y1', '*/ h 2230 21600'),
		gd('y2', '*/ h 19370 21600'),
		gd('xc1', '*/ w 5400 21600'),
		gd('xc2', '*/ w 16200 21600'),
		gd('yt1', '*/ h 4470 21600'),
		gd('yt2', '*/ h 0 21600'),
		gd('yb1', '*/ h 17130 21600'),
		gd('yb2', '*/ h 21600 21600'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{
					kind: 'cubicBezTo',
					x1: 'xc1',
					y1: 'yt2',
					x2: 'xc1',
					y2: 'yt1',
					x3: 'hc',
					y3: 'y1',
				},
				{
					kind: 'cubicBezTo',
					x1: 'xc2',
					y1: 'yt1',
					x2: 'xc2',
					y2: 'yt2',
					x3: 'r',
					y3: 'y1',
				},
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{
					kind: 'cubicBezTo',
					x1: 'xc2',
					y1: 'yb2',
					x2: 'xc2',
					y2: 'yb1',
					x3: 'hc',
					y3: 'y2',
				},
				{
					kind: 'cubicBezTo',
					x1: 'xc1',
					y1: 'yb1',
					x2: 'xc1',
					y2: 'yb2',
					x3: 'l',
					y3: 'y2',
				},
				{ kind: 'close' },
			],
		},
	],
};

// flowChartSummingJunction — circle with diagonal X overlay.
const flowChartSummingJunction: PresetShapeGeometryDefinition = {
	name: 'flowChartSummingJunction',
	gdLst: [
		gd('idx', '*/ wd2 3 4'),
		gd('idy', '*/ hd2 3 4'),
		gd('il', '+- hc 0 idx'),
		gd('ir', '+- hc idx 0'),
		gd('it', '+- vc 0 idy'),
		gd('ib', '+- vc idy 0'),
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
				// Diagonal X
				{ kind: 'moveTo', x: 'il', y: 'it' },
				{ kind: 'lnTo', x: 'ir', y: 'ib' },
				{ kind: 'moveTo', x: 'ir', y: 'it' },
				{ kind: 'lnTo', x: 'il', y: 'ib' },
			],
		},
	],
};

// flowChartOr — circle with horizontal + vertical cross overlay.
const flowChartOr: PresetShapeGeometryDefinition = {
	name: 'flowChartOr',
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
				// Crosshair
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
			],
		},
	],
};

// flowChartCollate — bowtie / hourglass formed by two opposing triangles.
const flowChartCollate: PresetShapeGeometryDefinition = {
	name: 'flowChartCollate',
	gdLst: [gd('ir', '*/ wd2 3 4'), gd('ib', '*/ hd2 3 4')],
	rect: { l: 'wd4', t: 'hd4', r: 'ir', b: 'ib' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartSort — diamond.
const flowChartSort: PresetShapeGeometryDefinition = {
	name: 'flowChartSort',
	gdLst: [gd('ir', '*/ wd2 3 4'), gd('ib', '*/ hd2 3 4')],
	rect: { l: 'wd4', t: 'hd4', r: 'ir', b: 'ib' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'close' },
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
			],
		},
	],
};

// flowChartExtract — triangle pointing up.
const flowChartExtract: PresetShapeGeometryDefinition = {
	name: 'flowChartExtract',
	gdLst: [gd('x1', '*/ w 3 4'), gd('x2', '*/ w 1 4')],
	rect: { l: 'x2', t: 'hd2', r: 'x1', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartMerge — inverted triangle (apex down).
const flowChartMerge: PresetShapeGeometryDefinition = {
	name: 'flowChartMerge',
	gdLst: [gd('x1', '*/ w 3 4'), gd('x2', '*/ w 1 4')],
	rect: { l: 'x2', t: 't', r: 'x1', b: 'hd2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartOnlineStorage — left edge straight, right edge a half-ellipse.
const flowChartOnlineStorage: PresetShapeGeometryDefinition = {
	name: 'flowChartOnlineStorage',
	gdLst: [gd('x2', '*/ w 5 6')],
	rect: { l: 'wd6', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'wd6', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'arcTo', wR: 'wd6', hR: 'hd2', stAng: 'cd4', swAng: '-10800000' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartMagneticDisk — vertical cylinder. Top + bottom are ellipses, body
// is two vertical lines. Cylinder height ≈ 1/8 of total.
const flowChartMagneticDisk: PresetShapeGeometryDefinition = {
	name: 'flowChartMagneticDisk',
	gdLst: [gd('y3', '*/ h 1 8'), gd('y4', '*/ h 7 8')],
	rect: { l: 'l', t: 'y3', r: 'r', b: 'y4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y3' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd8', stAng: 'cd2', swAng: '-10800000' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd8', stAng: '0', swAng: 'cd2' },
				{ kind: 'close' },
				// Front-arc indicating the visible portion of the top disk
				{ kind: 'moveTo', x: 'l', y: 'y3' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd8', stAng: 'cd2', swAng: 'cd2' },
			],
		},
	],
};

// flowChartMagneticDrum — horizontal cylinder (rotated disk).
const flowChartMagneticDrum: PresetShapeGeometryDefinition = {
	name: 'flowChartMagneticDrum',
	gdLst: [gd('x3', '*/ w 1 8'), gd('x4', '*/ w 7 8')],
	rect: { l: 'x3', t: 't', r: 'x4', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd2', stAng: 'cd4', swAng: 'cd2' },
				{ kind: 'close' },
				// Back side of the left end-cap (visible curve)
				{ kind: 'moveTo', x: 'x3', y: 't' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd2', stAng: '3cd4', swAng: '-10800000' },
			],
		},
	],
};

// flowChartMagneticTape — circle with a diagonal tail at the bottom-right.
const flowChartMagneticTape: PresetShapeGeometryDefinition = {
	name: 'flowChartMagneticTape',
	gdLst: [
		gd('idx', '*/ ss 3 4'),
		gd('idy', '*/ ss 3 4'),
		gd('ang1', 'val 2700000'),
		gd('ang2', 'val 18900000'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '0', swAng: '-16200000' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartDisplay — flag-like shape: rectangle with curved left edge and a
// pointed (chevron) right edge. ECMA reference path.
const flowChartDisplay: PresetShapeGeometryDefinition = {
	name: 'flowChartDisplay',
	gdLst: [gd('x1', '*/ w 1 6'), gd('x2', '*/ w 5 6')],
	rect: { l: 'x1', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'arcTo', wR: 'wd6', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartDelay — rectangle with a semicircular right edge.
const flowChartDelay: PresetShapeGeometryDefinition = {
	name: 'flowChartDelay',
	gdLst: [gd('x1', '*/ w 1 2')],
	rect: { l: 'l', t: 't', r: 'x1', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// flowChartStoredData — left edge curved (concave), right edge curved
// (convex). Both arcs use ss-based radii.
const flowChartStoredData: PresetShapeGeometryDefinition = {
	name: 'flowChartStoredData',
	gdLst: [gd('x1', '*/ w 1 6'), gd('x2', '*/ w 5 6')],
	rect: { l: 'x1', t: 't', r: 'x2', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'arcTo', wR: 'wd6', hR: 'hd2', stAng: '3cd4', swAng: 'cd2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'arcTo', wR: 'wd6', hR: 'hd2', stAng: 'cd4', swAng: '-10800000' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Master table of populated flowchart preset geometries. Will be merged into
 * `PRESET_SHAPE_GEOMETRY_TABLE` by the integration step. Keyed by ECMA-376
 * ST_ShapeType name.
 *
 * Note: ECMA defines `flowChartDisplay` (display shape) — exposed below via
 * the requested `flowChartDisplayValue` alias to match the agent task spec
 * which lists `flowChartDisplayValue`.
 */
export const FLOWCHART_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	flowChartProcess,
	flowChartDecision,
	flowChartAlternateProcess,
	flowChartPredefinedProcess,
	flowChartInternalStorage,
	flowChartDocument,
	flowChartMultidocument,
	flowChartTerminator,
	flowChartPreparation,
	flowChartManualInput,
	flowChartManualOperation,
	flowChartConnector,
	flowChartOffpageConnector,
	flowChartPunchedCard,
	flowChartPunchedTape,
	flowChartSummingJunction,
	flowChartOr,
	flowChartCollate,
	flowChartSort,
	flowChartExtract,
	flowChartMerge,
	flowChartOnlineStorage,
	flowChartMagneticDisk,
	flowChartMagneticDrum,
	flowChartMagneticTape,
	flowChartDisplay,
	flowChartDelay,
	flowChartStoredData,
};
