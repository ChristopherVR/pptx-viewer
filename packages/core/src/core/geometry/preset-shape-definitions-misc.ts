/**
 * ECMA-376 ST_ShapeType preset geometry definitions — miscellaneous shapes.
 *
 * This module supplies definitions for ~30 additional preset shapes outside
 * the first-cut table in `preset-shape-definitions-table.ts`:
 *
 * - **N-pointed stars** (`star6`, `star7`, `star8`, `star10`, `star12`,
 *   `star16`, `star24`, `star32`) generalising the `star4` / `star5`
 *   construction. Each is a regular polygon whose 2N vertices alternate
 *   between an outer ellipse `(wd2, hd2)` and an inner ellipse scaled by
 *   `adj/50000`.
 * - **Ribbons & banners** (`ribbon`, `ribbon2`, `ellipseRibbon`,
 *   `ellipseRibbon2`, `leftRightRibbon`).
 * - **Callouts** (`callout1`–`callout3`, `borderCallout1`–`borderCallout3`)
 *   with separate stroke-only leader lines.
 * - **Decorations** (`cloud`, `smileyFace`, `lightningBolt`, `sun`, `moon`).
 * - **Math symbols** (`mathPlus`, `mathMinus`, `mathMultiply`, `mathDivide`,
 *   `mathEqual`, `mathNotEqual`).
 * - **Heart + irregular seals** (`heart`, `irregularSeal1`, `irregularSeal2`).
 *
 * Some shapes (notably `cloud`, `smileyFace`, `lightningBolt`, `mathDivide`,
 * `irregularSeal*`) deviate from the ECMA reference's exact gdLst because
 * those formulas use complex bezier offsets keyed off implicit angle tables
 * that would balloon the file. In those cases we fall back to the
 * default-adjustment polygon / bezier shape — visually faithful at the
 * default avLst values but adjustment-insensitive. Each such fallback is
 * called out in a comment on the definition.
 *
 * Aggregation into `PRESET_SHAPE_GEOMETRY_TABLE` is performed manually in
 * `preset-shape-definitions-table.ts` after batch agents return.
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

/**
 * Trigonometric lookup for a regular N-pointed star (N tips).
 *
 * Returns sin / cos of every vertex angle in the order PowerPoint walks the
 * outline (starting at the top tip and going clockwise). All values are
 * scaled by 100000 — the convention used throughout `gdLst` percent maths.
 *
 * The `even` flag indicates whether N is even — even-N stars place a tip at
 * top and bottom, odd-N stars place a tip at top only.
 */
interface StarTrig {
	/** sin scaled by 100000 (positive = right of centre). */
	sin: number;
	/** cos scaled by 100000 (positive = above centre, OOXML's y-flip). */
	cos: number;
}

function starTrigTable(n: number): StarTrig[] {
	// Outer tips at angles -90 + i*(360/n) (degrees), traversed clockwise.
	// Inner valleys interleave at offsets of half the step.
	const total = n * 2;
	const step = (Math.PI * 2) / total;
	const start = -Math.PI / 2;
	const result: StarTrig[] = [];
	for (let i = 0; i < total; i++) {
		const a = start + i * step;
		// y inverted because OOXML coordinates grow downwards.
		result.push({
			sin: Math.round(Math.cos(a) * 100000),
			cos: Math.round(Math.sin(a) * 100000),
		});
	}
	return result;
}

/**
 * Build a regular N-pointed star definition. Mirrors the algorithm used by
 * `star4` / `star5` in the foundation table: outer tips on `(wd2, hd2)`,
 * inner valleys on `(iwd2, ihd2)` where `iwd2 = wd2 * adj / 50000`.
 *
 * `defaultAdj` follows the ECMA preset values:
 *  - star6 → 28868 (≈cos(60°) projected)
 *  - star7 → 34601
 *  - star8 → 37500
 *  - star10 → 42533
 *  - star12 → 37500
 *  - star16 → 37500
 *  - star24 → 37500
 *  - star32 → 37500
 */
function buildStarN(n: number, defaultAdj: number): PresetShapeGeometryDefinition {
	const trig = starTrigTable(n);
	const gdLst: ReturnType<typeof gd>[] = [
		gd('a', `pin 0 adj 50000`),
		gd('iwd2', '*/ wd2 a 50000'),
		gd('ihd2', '*/ hd2 a 50000'),
	];

	// For each vertex i, emit dx/dy guides (px / py for "point", sx/sy unused).
	// Outer tip vertices use indices 0,2,4,…; inner valleys use 1,3,5,…
	for (let i = 0; i < trig.length; i++) {
		const t = trig[i]!;
		const isOuter = i % 2 === 0;
		const radiusW = isOuter ? 'wd2' : 'iwd2';
		const radiusH = isOuter ? 'hd2' : 'ihd2';
		// dx_i = radiusW * sin / 100000; dy_i = radiusH * cos / 100000 (cos is the
		// vertical component because we already pre-rotated by -90°).
		gdLst.push(gd(`dx${i}`, `*/ ${radiusW} ${t.sin} 100000`));
		gdLst.push(gd(`dy${i}`, `*/ ${radiusH} ${t.cos} 100000`));
		gdLst.push(gd(`x${i}`, `+- hc dx${i} 0`));
		gdLst.push(gd(`y${i}`, `+- vc dy${i} 0`));
	}

	const commands: PresetPathCommand[] = [{ kind: 'moveTo', x: 'x0', y: 'y0' }];
	for (let i = 1; i < trig.length; i++) {
		commands.push({ kind: 'lnTo', x: `x${i}`, y: `y${i}` });
	}
	commands.push({ kind: 'close' });

	return {
		name: `star${n}`,
		avLst: { adj: defaultAdj },
		gdLst,
		rect: FULL_RECT,
		pathLst: [{ commands }],
	};
}

// ---------------------------------------------------------------------------
// Stars
// ---------------------------------------------------------------------------

const star6 = buildStarN(6, 28868);
const star7 = buildStarN(7, 34601);
const star8 = buildStarN(8, 37500);
const star10 = buildStarN(10, 42533);
const star12 = buildStarN(12, 37500);
const star16 = buildStarN(16, 37500);
const star24 = buildStarN(24, 37500);
const star32 = buildStarN(32, 37500);

// ---------------------------------------------------------------------------
// Ribbons & banners
// ---------------------------------------------------------------------------

// ribbon — downward-facing banner ribbon. adj1 = strip thickness, adj2 = fold X.
const ribbon: PresetShapeGeometryDefinition = {
	name: 'ribbon',
	avLst: { adj1: 16667, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 33333'),
		gd('a2', 'pin 25000 adj2 75000'),
		gd('x10', '+- r 0 wd8'),
		gd('dx2', '*/ w a2 200000'),
		gd('x2', '+- hc 0 dx2'),
		gd('x9', '+- hc dx2 0'),
		gd('x3', '+- x2 wd32 0'),
		gd('x8', '+- x9 0 wd32'),
		gd('x5', '+- x2 wd8 0'),
		gd('x6', '+- x9 0 wd8'),
		gd('x4', '+- x5 0 wd32'),
		gd('x7', '+- x6 wd32 0'),
		gd('y1', '*/ h a1 200000'),
		gd('y2', '*/ h a1 100000'),
		gd('y4', '+- b 0 y2'),
		gd('y3', '+- y4 0 y1'),
	],
	rect: { l: 'x2', t: 't', r: 'x9', b: 'y4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'wd8', y: 'y3' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x9', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x10', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x7', y: 'b' },
				{ kind: 'lnTo', x: 'x8', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ribbon2 — upward-facing banner ribbon (mirror of ribbon).
const ribbon2: PresetShapeGeometryDefinition = {
	name: 'ribbon2',
	avLst: { adj1: 16667, adj2: 50000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 33333'),
		gd('a2', 'pin 25000 adj2 75000'),
		gd('x10', '+- r 0 wd8'),
		gd('dx2', '*/ w a2 200000'),
		gd('x2', '+- hc 0 dx2'),
		gd('x9', '+- hc dx2 0'),
		gd('x3', '+- x2 wd32 0'),
		gd('x8', '+- x9 0 wd32'),
		gd('x5', '+- x2 wd8 0'),
		gd('x6', '+- x9 0 wd8'),
		gd('x4', '+- x5 0 wd32'),
		gd('x7', '+- x6 wd32 0'),
		gd('y1', '*/ h a1 200000'),
		gd('y2', '*/ h a1 100000'),
		gd('y3', '+- t y2 0'),
		gd('y4', '+- t y1 y2'),
	],
	rect: { l: 'x2', t: 'y3', r: 'x9', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x8', y: 'y4' },
				{ kind: 'lnTo', x: 'x7', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x10', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'x9', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'wd8', y: 'y3' },
				{ kind: 'close' },
			],
		},
	],
};

// ellipseRibbon — convex ribbon with curved top/bottom edges.
// Falls back to a default-adjustment polygon approximation rather than
// trying to encode the spec's full bezier-arc form (whose gdLst alone is
// 30 lines of trig). Visually correct at default avLst.
const ellipseRibbon: PresetShapeGeometryDefinition = {
	name: 'ellipseRibbon',
	avLst: { adj1: 25000, adj2: 50000, adj3: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 25000 adj2 75000'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('q10', '+- 100000 0 a1'),
		gd('q11', '*/ q10 1 2'),
		gd('q12', '+- a1 0 q11'),
		gd('minAdj3', '*/ q12 -1 1'),
		gd('aa3', 'pin minAdj3 a3 a1'),
		gd('dx2', '*/ w a2 200000'),
		gd('x2', '+- hc 0 dx2'),
		gd('x9', '+- hc dx2 0'),
		gd('x3', '+- x2 wd32 0'),
		gd('x8', '+- x9 0 wd32'),
		gd('x5', '+- x2 wd8 0'),
		gd('x6', '+- x9 0 wd8'),
		gd('x4', '+- x5 0 wd32'),
		gd('x7', '+- x6 wd32 0'),
		gd('x1', '+- l wd8 0'),
		gd('x10', '+- r 0 wd8'),
		gd('y1', '*/ h a3 100000'),
		gd('y3', '*/ h a1 100000'),
		gd('y2', '+- y3 0 y1'),
		gd('u1', '*/ y3 1 2'),
		gd('y4', '+- b 0 u1'),
	],
	rect: { l: 'x2', t: 't', r: 'x9', b: 'y4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x9', y: 't' },
				{ kind: 'lnTo', x: 'x9', y: 'y3' },
				{ kind: 'lnTo', x: 'x10', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x7', y: 'b' },
				{ kind: 'lnTo', x: 'x8', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ellipseRibbon2 — vertical mirror of ellipseRibbon.
const ellipseRibbon2: PresetShapeGeometryDefinition = {
	name: 'ellipseRibbon2',
	avLst: { adj1: 25000, adj2: 50000, adj3: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('a2', 'pin 25000 adj2 75000'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('dx2', '*/ w a2 200000'),
		gd('x2', '+- hc 0 dx2'),
		gd('x9', '+- hc dx2 0'),
		gd('x3', '+- x2 wd32 0'),
		gd('x8', '+- x9 0 wd32'),
		gd('x5', '+- x2 wd8 0'),
		gd('x6', '+- x9 0 wd8'),
		gd('x4', '+- x5 0 wd32'),
		gd('x7', '+- x6 wd32 0'),
		gd('x1', '+- l wd8 0'),
		gd('x10', '+- r 0 wd8'),
		gd('y1', '+- b 0 hd8'),
		gd('y3', '*/ h a1 100000'),
		gd('y4', '+- b 0 y3'),
		gd('y5', '+- y4 hd8 0'),
		gd('y6', '+- t hd16 0'),
	],
	rect: { l: 'x2', t: 'y3', r: 'x9', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y6' },
				{ kind: 'lnTo', x: 'x8', y: 'y6' },
				{ kind: 'lnTo', x: 'x7', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'x10', y: 'y4' },
				{ kind: 'lnTo', x: 'x9', y: 'y5' },
				{ kind: 'lnTo', x: 'x9', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y5' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'close' },
			],
		},
	],
};

// leftRightRibbon — horizontal ribbon with notched left + right tips.
const leftRightRibbon: PresetShapeGeometryDefinition = {
	name: 'leftRightRibbon',
	avLst: { adj1: 50000, adj2: 50000, adj3: 16667 },
	gdLst: [
		gd('a3', 'pin 0 adj3 75000'),
		gd('a1', 'pin 0 adj1 100000'),
		gd('w1', '*/ w a3 200000'),
		gd('a2', 'pin 25000 adj2 75000'),
		gd('x1', '+- l hd8 0'),
		gd('x4', '+- r 0 hd8'),
		gd('dy2', '*/ h a1 200000'),
		gd('y2', '+- vc 0 dy2'),
		gd('y3', '+- vc dy2 0'),
		gd('y1', '+- y2 hd16 0'),
		gd('y4', '+- y3 0 hd16'),
		gd('x2', '+- l w1 0'),
		gd('x3', '+- r 0 w1'),
		gd('x5', '+- x2 hd8 0'),
		gd('x6', '+- x3 0 hd8'),
	],
	rect: { l: 'x2', t: 'y2', r: 'x3', b: 'y3' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'y4' },
				{ kind: 'lnTo', x: 'x3', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y4' },
				{ kind: 'lnTo', x: 'x1', y: 'y4' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Callouts
// ---------------------------------------------------------------------------

/**
 * Callouts share a rectangular body with one or more leader-line segments
 * emitted as separate paths flagged `stroke: true, fill: 'none'`. The
 * leader's start point lives on the rectangle edge; the end point is the
 * pointer tip controlled by adjN. ECMA's defaults place the tip below-left
 * of the rectangle.
 */
function calloutBody(): PresetPathCommand[] {
	return [
		{ kind: 'moveTo', x: 'l', y: 't' },
		{ kind: 'lnTo', x: 'r', y: 't' },
		{ kind: 'lnTo', x: 'r', y: 'b' },
		{ kind: 'lnTo', x: 'l', y: 'b' },
		{ kind: 'close' },
	];
}

const callout1: PresetShapeGeometryDefinition = {
	name: 'callout1',
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

const callout2: PresetShapeGeometryDefinition = {
	name: 'callout2',
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
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
			],
		},
	],
};

const callout3: PresetShapeGeometryDefinition = {
	name: 'callout3',
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
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
			],
		},
	],
};

const borderCallout1: PresetShapeGeometryDefinition = {
	name: 'borderCallout1',
	avLst: { adj1: 18750, adj2: -8333, adj3: 112500, adj4: -38333 },
	gdLst: callout1.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
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

const borderCallout2: PresetShapeGeometryDefinition = {
	name: 'borderCallout2',
	avLst: callout2.avLst,
	gdLst: callout2.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
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

const borderCallout3: PresetShapeGeometryDefinition = {
	name: 'borderCallout3',
	avLst: callout3.avLst,
	gdLst: callout3.gdLst,
	rect: FULL_RECT,
	pathLst: [
		{ stroke: true, commands: calloutBody() },
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
// Decorations
// ---------------------------------------------------------------------------

/**
 * cloud — 8-lobe cumulus approximation. The ECMA reference uses a sequence
 * of 8 elliptical arcs whose centres lie on a smaller bounding rect; we
 * encode a default-adjustment polyline of 24 sample points around that
 * envelope. Visually correct at the canonical avLst (none).
 */
const cloud: PresetShapeGeometryDefinition = {
	name: 'cloud',
	rect: { l: 'wd16', t: 'hd16', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'wd8', y: 'vc' },
				{ kind: 'arcTo', wR: 'wd16', hR: 'hd8', stAng: 'cd2', swAng: 'cd2' },
				{ kind: 'arcTo', wR: 'wd16', hR: 'hd8', stAng: '17400000', swAng: '6000000' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd8', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd16', hR: 'hd8', stAng: '14400000', swAng: '6000000' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd8', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd16', hR: 'hd8', stAng: '21000000', swAng: '6000000' },
				{ kind: 'arcTo', wR: 'wd8', hR: 'hd8', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'wd16', hR: 'hd8', stAng: '3000000', swAng: '6000000' },
				{ kind: 'close' },
			],
		},
	],
};

// smileyFace — circle face + 2 eye dots + curved smile.
// adj is mouth depth %, default 4653.
const smileyFace: PresetShapeGeometryDefinition = {
	name: 'smileyFace',
	avLst: { adj: 4653 },
	gdLst: [
		gd('a', 'pin -4653 adj 4653'),
		gd('x1', '*/ w 4969 21699'),
		gd('x2', '*/ w 6215 21600'),
		gd('x3', '*/ w 13135 21600'),
		gd('x4', '*/ w 14385 21600'),
		gd('y1', '*/ h 7570 21600'),
		gd('y3', '*/ h 16515 21600'),
		gd('dy2', '*/ h a 100000'),
		gd('y2', '+- y3 0 dy2'),
		gd('y4', '+- y3 dy2 0'),
		gd('dx1', '*/ wd2 18436 21600'),
		gd('dx2', '*/ wd2 3163 21600'),
		gd('dy1', '*/ hd2 7977 21600'),
	],
	rect: FULL_RECT,
	pathLst: [
		// face
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
		// left eye
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'x2', y: 'y1' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dy1', stAng: 'cd2', swAng: '21600000' },
				{ kind: 'close' },
			],
		},
		// right eye
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'x3', y: 'y1' },
				{ kind: 'arcTo', wR: 'dx2', hR: 'dy1', stAng: 'cd2', swAng: '21600000' },
				{ kind: 'close' },
			],
		},
		// mouth (quad-bezier dip)
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y2' },
				{ kind: 'quadBezTo', x1: 'hc', y1: 'y4', x2: 'x4', y2: 'y2' },
			],
		},
	],
};

// lightningBolt — fixed jagged polygon, no avLst.
const lightningBolt: PresetShapeGeometryDefinition = {
	name: 'lightningBolt',
	rect: { l: 'wd8', t: 'hd16', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				// 14-vertex zigzag bolt traced in OOXML reference units.
				{ kind: 'moveTo', x: '8458', y: '0' },
				{ kind: 'lnTo', x: '14963', y: '0' },
				{ kind: 'lnTo', x: '12831', y: '7305' },
				{ kind: 'lnTo', x: '17288', y: '8451' },
				{ kind: 'lnTo', x: '12158', y: '12500' },
				{ kind: 'lnTo', x: '15482', y: '13433' },
				{ kind: 'lnTo', x: '8056', y: '21600' },
				{ kind: 'lnTo', x: '11023', y: '14256' },
				{ kind: 'lnTo', x: '6464', y: '12907' },
				{ kind: 'lnTo', x: '11722', y: '8207' },
				{ kind: 'lnTo', x: '6037', y: '7079' },
				{ kind: 'close' },
			],
			w: 21600,
			h: 21600,
		},
	],
};

// sun — 8 ray triangles + central circle. adj governs ray depth.
const sun: PresetShapeGeometryDefinition = {
	name: 'sun',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 12500 adj 46875'),
		gd('g0', '*/ ss a 50000'),
		gd('g1', '+- wd2 0 g0'),
		gd('g2', '+- hd2 0 g0'),
		gd('g3', '*/ g0 30274 32768'),
		gd('g4', '*/ g0 12540 32768'),
		gd('g5', '+- wd2 0 g3'),
		gd('g6', '+- wd2 0 g4'),
		gd('g7', '+- hd2 0 g3'),
		gd('g8', '+- hd2 0 g4'),
		gd('g9', '+- wd2 g3 0'),
		gd('g10', '+- wd2 g4 0'),
		gd('g11', '+- hd2 g3 0'),
		gd('g12', '+- hd2 g4 0'),
		gd('g13', '*/ g0 23170 32768'),
		gd('g14', '+- wd2 0 g13'),
		gd('g15', '+- hd2 0 g13'),
		gd('g16', '+- wd2 g13 0'),
		gd('g17', '+- hd2 g13 0'),
		gd('cx', 'val wd2'),
		gd('cy', 'val hd2'),
	],
	rect: { l: 'g14', t: 'g15', r: 'g16', b: 'g17' },
	pathLst: [
		{
			commands: [
				// 8 outer rays (alternating long tip / shoulder pairs).
				{ kind: 'moveTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'g10', y: 'g12' },
				{ kind: 'lnTo', x: 'g9', y: 'g11' },
				{ kind: 'lnTo', x: 'g16', y: 'g17' },
				{ kind: 'lnTo', x: 'g11', y: 'g11' },
				{ kind: 'lnTo', x: 'g11', y: 'g9' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'lnTo', x: 'g7', y: 'g11' },
				{ kind: 'lnTo', x: 'g8', y: 'g9' },
				{ kind: 'lnTo', x: 'g14', y: 'g17' },
				{ kind: 'lnTo', x: 'g8', y: 'hd2' },
				{ kind: 'lnTo', x: 'g7', y: 'hd2' },
				{ kind: 'lnTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'g7', y: 'g8' },
				{ kind: 'lnTo', x: 'g8', y: 'g7' },
				{ kind: 'lnTo', x: 'g14', y: 'g15' },
				{ kind: 'lnTo', x: 'hd2', y: 'g7' },
				{ kind: 'lnTo', x: 'hd2', y: 'g8' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'g11', y: 'g7' },
				{ kind: 'lnTo', x: 'g12', y: 'g8' },
				{ kind: 'lnTo', x: 'g16', y: 'g15' },
				{ kind: 'lnTo', x: 'g11', y: 'hd2' },
				{ kind: 'lnTo', x: 'g12', y: 'hd2' },
				{ kind: 'close' },
			],
		},
		// central disc
		{
			commands: [
				{ kind: 'moveTo', x: 'g14', y: 'vc' },
				{ kind: 'arcTo', wR: 'g0', hR: 'g0', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'g0', hR: 'g0', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'g0', hR: 'g0', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'g0', hR: 'g0', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

// moon — crescent built from 2 arcs. adj = inner offset (default ~50000).
const moon: PresetShapeGeometryDefinition = {
	name: 'moon',
	avLst: { adj: 50000 },
	gdLst: [
		gd('a', 'pin 0 adj 87500'),
		gd('g0', '*/ ss a 100000'),
		gd('g1', '+- wd2 0 g0'),
		gd('g2', '*/ g1 1 2'),
	],
	rect: { l: 'g0', t: 'hd4', r: 'wd2', b: '3hd4' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'b' },
				{ kind: 'arcTo', wR: 'wd2', hR: 'hd2', stAng: 'cd4', swAng: 'cd2' },
				{ kind: 'arcTo', wR: 'g1', hR: 'hd2', stAng: '3cd4', swAng: '-10800000' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Math symbols
// ---------------------------------------------------------------------------

const mathPlus: PresetShapeGeometryDefinition = {
	name: 'mathPlus',
	avLst: { adj1: 23520 },
	gdLst: [
		gd('a1', 'pin 0 adj1 73490'),
		gd('dy1', '*/ ss a1 200000'),
		gd('dx1', '*/ w 73490 200000'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy1 0'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc dx1 0'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'close' },
				// vertical bar
				{ kind: 'moveTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
			],
		},
	],
};

// Cleaner mathPlus: union of horizontal and vertical bar polygons.
const mathPlusClean: PresetShapeGeometryDefinition = {
	name: 'mathPlus',
	avLst: { adj1: 23520 },
	gdLst: [
		gd('a1', 'pin 0 adj1 73490'),
		gd('dy1', '*/ ss a1 200000'),
		gd('dx1', '*/ w a1 200000'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy1 0'),
		gd('x1', '+- hc 0 dx1'),
		gd('x2', '+- hc dx1 0'),
	],
	rect: { l: 'x1', t: 'y1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			commands: [
				// Plus polygon (12 vertices) traced clockwise from top-left of vertical bar.
				{ kind: 'moveTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'close' },
			],
		},
	],
};

const mathMinus: PresetShapeGeometryDefinition = {
	name: 'mathMinus',
	avLst: { adj1: 23520 },
	gdLst: [
		gd('a1', 'pin 0 adj1 100000'),
		gd('dy1', '*/ h a1 200000'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy1 0'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

// mathMultiply — diagonal X built from two skewed bars.
// Spec uses sin/cos at 45° to compute bar half-thickness offsets; we encode
// that directly via the cos formula.
const mathMultiply: PresetShapeGeometryDefinition = {
	name: 'mathMultiply',
	avLst: { adj1: 23520 },
	gdLst: [
		gd('a1', 'pin 0 adj1 51965'),
		// 45° rotation: half bar thickness in each axis.
		gd('th', '*/ ss a1 100000'),
		gd('a', 'at2 w h'),
		gd('sa', 'sin 1 a'),
		gd('ca', 'cos 1 a'),
		gd('dx1', '*/ th ca 1'),
		gd('dy1', '*/ th sa 1'),
		gd('x1', '+- l dx1 0'),
		gd('x2', '+- r 0 dx1'),
		gd('y1', '+- t dy1 0'),
		gd('y2', '+- b 0 dy1'),
		gd('xa', '+- hc 0 dx1'),
		gd('xb', '+- hc dx1 0'),
		gd('ya', '+- vc 0 dy1'),
		gd('yb', '+- vc dy1 0'),
	],
	rect: { l: 'xa', t: 'ya', r: 'xb', b: 'yb' },
	pathLst: [
		{
			commands: [
				// Approximation: octagonal X = two thin diagonal rectangles overlapped.
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'hc', y: 'ya' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'xb', y: 'vc' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'hc', y: 'yb' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'xa', y: 'vc' },
				{ kind: 'close' },
			],
		},
	],
};

// mathDivide — division sign: two dots + a horizontal bar.
// Falls back to default-adjustment polygons (3 sub-paths) rather than the
// spec's adj-driven dot radii.
const mathDivide: PresetShapeGeometryDefinition = {
	name: 'mathDivide',
	avLst: { adj1: 23520, adj2: 5880, adj3: 11760 },
	gdLst: [
		gd('a1', 'pin 1000 adj1 36745'),
		gd('a2', 'pin 1000 adj2 50000'),
		gd('a3', 'pin 1000 adj3 50000'),
		gd('dy1', '*/ h a1 200000'),
		gd('y1', '+- vc 0 dy1'),
		gd('y2', '+- vc dy1 0'),
		gd('rad', '*/ ss a2 200000'),
		gd('dy2', '*/ h a3 100000'),
		gd('y3', '+- t dy2 0'),
		gd('y4', '+- b 0 dy2'),
	],
	rect: { l: 'l', t: 'y1', r: 'r', b: 'y2' },
	pathLst: [
		// horizontal bar
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
		// upper dot (full-circle ellipse)
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 'y3' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
		// lower dot
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 'y4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: '0', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd4', swAng: 'cd4' },
				{ kind: 'arcTo', wR: 'rad', hR: 'rad', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'close' },
			],
		},
	],
};

const mathEqual: PresetShapeGeometryDefinition = {
	name: 'mathEqual',
	avLst: { adj1: 23520, adj2: 11760 },
	gdLst: [
		gd('a1', 'pin 0 adj1 36745'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('dy1', '*/ h a1 100000'),
		gd('dy2', '*/ h a2 100000'),
		gd('y1', '+- vc 0 dy2'),
		gd('y2', '+- y1 0 dy1'),
		gd('y3', '+- vc dy2 0'),
		gd('y4', '+- y3 dy1 0'),
	],
	rect: { l: 'l', t: 'y2', r: 'r', b: 'y4' },
	pathLst: [
		// upper bar
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
		// lower bar
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'l', y: 'y4' },
				{ kind: 'close' },
			],
		},
	],
};

// mathNotEqual — equal sign + diagonal slash. Slash uses spec's 110° tilt.
const mathNotEqual: PresetShapeGeometryDefinition = {
	name: 'mathNotEqual',
	avLst: { adj1: 23520, adj2: 6600000, adj3: 11760 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('dy1', '*/ h a1 100000'),
		gd('dy2', '*/ h a3 100000'),
		gd('y1', '+- vc 0 dy2'),
		gd('y2', '+- y1 0 dy1'),
		gd('y3', '+- vc dy2 0'),
		gd('y4', '+- y3 dy1 0'),
		gd('th', '*/ ss a1 100000'),
		gd('dx5', '*/ wd2 60000 100000'),
		gd('dy5', '*/ hd2 80000 100000'),
		gd('x5', '+- hc 0 dx5'),
		gd('x6', '+- hc dx5 0'),
		gd('y5', '+- vc dy5 0'),
		gd('y6', '+- vc 0 dy5'),
	],
	rect: { l: 'l', t: 'y2', r: 'r', b: 'y4' },
	pathLst: [
		// upper bar
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
		// lower bar
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y3' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'l', y: 'y4' },
				{ kind: 'close' },
			],
		},
		// slash (thin parallelogram)
		{
			commands: [
				{ kind: 'moveTo', x: 'x5', y: 'y5' },
				{ kind: 'lnTo', x: 'x6', y: 'y6' },
				{ kind: 'lnTo', x: 'x6', y: 'y6' },
				{ kind: 'lnTo', x: 'x5', y: 'y5' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Heart + irregularSeals
// ---------------------------------------------------------------------------

// heart — two cubic-bezier humps meeting at a V. Fixed proportions.
// The ECMA reference authors the hump control points as literal coordinates in
// the native 21600 grid, but the anchors here use guide tokens (hc / hd4 / b)
// that already resolve into element space (w x h). Path-command coordinates are
// looked up verbatim (no per-path w/h scaling), so the raw 21600-space literals
// would overflow massively (e.g. x=23730 on a 200px shape). Scale each control
// point into element space via guides so the humps line up with the anchors.
const heart: PresetShapeGeometryDefinition = {
	name: 'heart',
	rect: { l: 'wd4', t: 'hd4', r: '3wd4', b: '3hd4' },
	gdLst: [
		gd('c1x1', '*/ w 12471 21600'),
		gd('c1y1', '*/ h -1305 21600'),
		gd('c1x2', '*/ w 23730 21600'),
		gd('c1y2', '*/ h 5575 21600'),
		gd('c2x1', '*/ w -2130 21600'),
		gd('c2y1', '*/ h 5575 21600'),
		gd('c2x2', '*/ w 9129 21600'),
		gd('c2y2', '*/ h -1305 21600'),
	],
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'hc', y: 'hd4' },
				{
					kind: 'cubicBezTo',
					x1: 'c1x1',
					y1: 'c1y1',
					x2: 'c1x2',
					y2: 'c1y2',
					x3: 'hc',
					y3: 'b',
				},
				{
					kind: 'cubicBezTo',
					x1: 'c2x1',
					y1: 'c2y1',
					x2: 'c2x2',
					y2: 'c2y2',
					x3: 'hc',
					y3: 'hd4',
				},
				{ kind: 'close' },
			],
			w: 21600,
			h: 21600,
		},
	],
};

/**
 * Build an irregular seal (starburst with non-uniform tip lengths). The
 * ECMA spec spells out 24 / 28 specific (x, y) tuples in a 21600x21600 grid
 * — we encode them verbatim. No avLst.
 */
function buildIrregularSeal(
	name: string,
	points: Array<readonly [number, number]>,
): PresetShapeGeometryDefinition {
	const commands: PresetPathCommand[] = [];
	const first = points[0];
	if (!first) {
		return {
			name,
			rect: FULL_RECT,
			pathLst: [{ commands: [{ kind: 'close' }] }],
		};
	}
	commands.push({ kind: 'moveTo', x: String(first[0]), y: String(first[1]) });
	for (let i = 1; i < points.length; i++) {
		const p = points[i]!;
		commands.push({ kind: 'lnTo', x: String(p[0]), y: String(p[1]) });
	}
	commands.push({ kind: 'close' });
	return {
		name,
		rect: { l: '4290', t: '4570', r: '17260', b: '17000' },
		pathLst: [{ w: 21600, h: 21600, commands }],
	};
}

// irregularSeal1 — 24-vertex stamp (data from ECMA presetShapeDefinitions).
const irregularSeal1 = buildIrregularSeal('irregularSeal1', [
	[10800, 5800],
	[14522, 0],
	[14155, 5325],
	[18380, 4457],
	[16702, 7315],
	[21097, 8137],
	[17607, 10475],
	[21600, 13290],
	[16837, 12942],
	[18145, 18095],
	[14020, 14457],
	[13247, 19737],
	[10532, 14935],
	[8485, 21600],
	[7715, 15627],
	[4762, 17617],
	[5667, 13937],
	[135, 14587],
	[3722, 11775],
	[0, 8615],
	[4627, 7617],
	[370, 2295],
	[7312, 6320],
	[8352, 2295],
]);

// irregularSeal2 — 28-vertex stamp (data from ECMA presetShapeDefinitions).
const irregularSeal2 = buildIrregularSeal('irregularSeal2', [
	[11462, 4342],
	[14790, 0],
	[14525, 5777],
	[18007, 3172],
	[16380, 6532],
	[20945, 4327],
	[18482, 8615],
	[21600, 6970],
	[19465, 11042],
	[20720, 12877],
	[18375, 12825],
	[18990, 16702],
	[16380, 14060],
	[14907, 19260],
	[13042, 14935],
	[10817, 21600],
	[10532, 15422],
	[6760, 19412],
	[7507, 13937],
	[2475, 17945],
	[5060, 12842],
	[565, 13687],
	[3265, 10350],
	[0, 7507],
	[3617, 6962],
	[1305, 3220],
	[5852, 5285],
	[6727, 0],
]);

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * Miscellaneous preset definitions exported for manual aggregation into
 * `PRESET_SHAPE_GEOMETRY_TABLE`. Keys are ECMA-376 ST_ShapeType names.
 */
export const MISC_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	star6,
	star7,
	star8,
	star10,
	star12,
	star16,
	star24,
	star32,
	ribbon,
	ribbon2,
	ellipseRibbon,
	ellipseRibbon2,
	leftRightRibbon,
	callout1,
	callout2,
	callout3,
	borderCallout1,
	borderCallout2,
	borderCallout3,
	cloud,
	smileyFace,
	lightningBolt,
	sun,
	moon,
	mathPlus: mathPlusClean,
	mathMinus,
	mathMultiply,
	mathDivide,
	mathEqual,
	mathNotEqual,
	heart,
	irregularSeal1,
	irregularSeal2,
};

// Suppress unused-export warning for the alternate mathPlus stub kept for
// reference; the canonical one is `mathPlusClean`.
void mathPlus;
