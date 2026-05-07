/**
 * ECMA-376 ST_ShapeType preset geometry definitions — tabs, gears, and
 * miscellaneous decoration shapes.
 *
 * This batch authors 10 additional shapes whose geometry is defined in
 * Microsoft's `presetShapeDefinitions.xml` (ISO/IEC 29500-1 §20.1.10.55):
 *
 * Tabs (no `avLst`)
 *  • `cornerTabs`   – rectangle with four small inset rectangular tabs at the
 *    corners (used as a decorative frame).
 *  • `squareTabs`   – rectangle with four small inset rectangular tabs centred
 *    on each side.
 *  • `diamondTabs`  – diamond with small rectangular tabs at each of its four
 *    points.
 *
 * Decorations / functions
 *  • `diagStripe`   – rectangle with a diagonal stripe; `adj1` controls the
 *    stripe position along the anti-diagonal (default 50000 = stripe runs
 *    from corner to corner).
 *  • `plus`         – plus sign (cross). `adj1` is the stroke thickness as a
 *    fraction of `ss` / 2 (default 25000).
 *  • `gear6`        – six-toothed gear; `adj1` is the tooth depth as a
 *    fraction of `ss / 2` (default 15000).
 *  • `gear9`        – nine-toothed gear; same adjust semantics as `gear6`
 *    (default 10000 — teeth are smaller because there are more of them).
 *  • `funnel`       – V-shape narrowing downward; no `avLst`.
 *  • `mathFunction` – math function notation glyph. The ECMA reference does
 *    not enumerate this preset; we emit a stylised cursive-`f` silhouette as
 *    a SIMPLIFIED default-only polygon (see in-source comment).
 *  • `nonIsoscelesTrapezoid` – trapezoid whose top edge is offset; `adj1`
 *    controls the skew of the top edge (default 50000 → isosceles).
 *
 * The `gd` helper, FULL_RECT constant, and overall structure mirror
 * `preset-shape-definitions-table.ts`. Tokens inside guide formulas and path
 * commands are raw OOXML strings — the `preset-shape-evaluator` pipes them
 * through `guide-formula-eval`.
 *
 * Aggregation into `PRESET_SHAPE_GEOMETRY_TABLE` is performed in
 * `preset-shape-definitions-table.ts`.
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
// Tabs (no avLst)
// ---------------------------------------------------------------------------

// cornerTabs — rectangle with a small rectangular tab inset at each corner.
// Tab size is fixed by the spec at 1/8 of width and height.
const cornerTabs: PresetShapeGeometryDefinition = {
	name: 'cornerTabs',
	gdLst: [gd('x1', '*/ w 1 8'), gd('x2', '+- r 0 x1'), gd('y1', '*/ h 1 8'), gd('y2', '+- b 0 y1')],
	rect: FULL_RECT,
	pathLst: [
		// Outer frame.
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Top-left tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'close' },
			],
		},
		// Top-right tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'close' },
			],
		},
		// Bottom-right tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Bottom-left tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// squareTabs — rectangle with one small rectangular tab centred on each of
// the four sides. Tab thickness is fixed at 1/16 of the relevant dimension.
const squareTabs: PresetShapeGeometryDefinition = {
	name: 'squareTabs',
	gdLst: [
		// Tab half-width / half-height in shape coords.
		gd('thw', '*/ w 1 16'),
		gd('thh', '*/ h 1 16'),
		// Centred tab spans on each axis.
		gd('xa', '+- hc 0 thw'),
		gd('xb', '+- hc thw 0'),
		gd('ya', '+- vc 0 thh'),
		gd('yb', '+- vc thh 0'),
		// Inset edges for the right and bottom tabs.
		gd('rt', '+- r 0 thw'),
		gd('bt', '+- b 0 thh'),
	],
	rect: FULL_RECT,
	pathLst: [
		// Outer frame.
		{
			fill: 'none',
			stroke: true,
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Top tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'xa', y: 't' },
				{ kind: 'lnTo', x: 'xb', y: 't' },
				{ kind: 'lnTo', x: 'xb', y: 'thh' },
				{ kind: 'lnTo', x: 'xa', y: 'thh' },
				{ kind: 'close' },
			],
		},
		// Right tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'ya' },
				{ kind: 'lnTo', x: 'r', y: 'yb' },
				{ kind: 'lnTo', x: 'rt', y: 'yb' },
				{ kind: 'lnTo', x: 'rt', y: 'ya' },
				{ kind: 'close' },
			],
		},
		// Bottom tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'xa', y: 'b' },
				{ kind: 'lnTo', x: 'xb', y: 'b' },
				{ kind: 'lnTo', x: 'xb', y: 'bt' },
				{ kind: 'lnTo', x: 'xa', y: 'bt' },
				{ kind: 'close' },
			],
		},
		// Left tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'ya' },
				{ kind: 'lnTo', x: 'l', y: 'yb' },
				{ kind: 'lnTo', x: 'thw', y: 'yb' },
				{ kind: 'lnTo', x: 'thw', y: 'ya' },
				{ kind: 'close' },
			],
		},
	],
};

// diamondTabs — diamond with a small rectangular tab at each of the four
// points. The diamond touches the bounding box midpoints; tabs straddle the
// outer apex edge by 1/16 of the relevant dimension on each side.
const diamondTabs: PresetShapeGeometryDefinition = {
	name: 'diamondTabs',
	gdLst: [
		gd('thw', '*/ w 1 16'),
		gd('thh', '*/ h 1 16'),
		gd('xa', '+- hc 0 thw'),
		gd('xb', '+- hc thw 0'),
		gd('ya', '+- vc 0 thh'),
		gd('yb', '+- vc thh 0'),
		gd('lt', '+- l thw 0'),
		gd('rt', '+- r 0 thw'),
		gd('tt', '+- t thh 0'),
		gd('bt', '+- b 0 thh'),
	],
	rect: { l: 'xa', t: 'ya', r: 'xb', b: 'yb' },
	pathLst: [
		// Diamond body.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'vc' },
				{ kind: 'lnTo', x: 'hc', y: 'b' },
				{ kind: 'close' },
			],
		},
		// Top tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'xa', y: 't' },
				{ kind: 'lnTo', x: 'xb', y: 't' },
				{ kind: 'lnTo', x: 'xb', y: 'tt' },
				{ kind: 'lnTo', x: 'xa', y: 'tt' },
				{ kind: 'close' },
			],
		},
		// Right tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'r', y: 'ya' },
				{ kind: 'lnTo', x: 'r', y: 'yb' },
				{ kind: 'lnTo', x: 'rt', y: 'yb' },
				{ kind: 'lnTo', x: 'rt', y: 'ya' },
				{ kind: 'close' },
			],
		},
		// Bottom tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'xa', y: 'b' },
				{ kind: 'lnTo', x: 'xb', y: 'b' },
				{ kind: 'lnTo', x: 'xb', y: 'bt' },
				{ kind: 'lnTo', x: 'xa', y: 'bt' },
				{ kind: 'close' },
			],
		},
		// Left tab.
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'ya' },
				{ kind: 'lnTo', x: 'l', y: 'yb' },
				{ kind: 'lnTo', x: 'lt', y: 'yb' },
				{ kind: 'lnTo', x: 'lt', y: 'ya' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Decorations / functions
// ---------------------------------------------------------------------------

// diagStripe — rectangle with a single diagonal band running from the
// top-right region to the bottom-left. `adj1` (default 50000) is the stripe
// position as a fraction of the shape size: the stripe meets the top edge at
// `(adj1 * w / 100000)` from the left, and the left edge at the same fraction
// of the height.
const diagStripe: PresetShapeGeometryDefinition = {
	name: 'diagStripe',
	avLst: { adj: 50000 },
	gdLst: [gd('a', 'pin 0 adj 100000'), gd('x2', '*/ w a 100000'), gd('y2', '*/ h a 100000')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'l', y: 't' },
				{ kind: 'close' },
			],
		},
	],
};

// plus — twelve-vertex plus / cross sign. `adj1` is the arm thickness as a
// fraction of `ss` (default 25000 → 25 % of the shorter side).
const plus: PresetShapeGeometryDefinition = {
	name: 'plus',
	avLst: { adj: 25000 },
	gdLst: [
		gd('a', 'pin 0 adj 50000'),
		gd('x1', '*/ ss a 100000'),
		gd('x2', '+- r 0 x1'),
		gd('y2', '+- b 0 x1'),
	],
	rect: { l: 'x1', t: 'x1', r: 'x2', b: 'y2' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 'x1' },
				{ kind: 'lnTo', x: 'x1', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'lnTo', x: 'x2', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'x1' },
				{ kind: 'lnTo', x: 'r', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Gears
// ---------------------------------------------------------------------------

/**
 * Build an N-toothed gear definition. Outer tooth tips lie on the bounding
 * ellipse `(wd2, hd2)`; inner valleys lie on `((1 - adj/50000) * wd2, …)`
 * giving a tooth depth proportional to `adj` (1/100000 of `ss / 2`).
 *
 * The trig table is precomputed so the gdLst stores numeric literals (avoids
 * the evaluator's lack of fractional-angle constants for non-cardinal
 * orientations). Each tooth contributes 4 vertices: outer-leading,
 * outer-trailing, valley-leading, valley-trailing.
 */
function buildGearN(n: number, defaultAdj: number): PresetShapeGeometryDefinition {
	// 4N vertices around the gear: each tooth = [out-start, out-end, valley-end].
	// For simplicity we model the tooth as a trapezoid whose top sits on the
	// outer ellipse at angles ±halfTooth, and whose feet touch the inner
	// (valley) ellipse at the same angles offset by halfTooth on each side.
	const total = n * 4;
	const step = (Math.PI * 2) / total;
	// Start angle: place the first tooth's leading edge at -90° so a tooth
	// points straight up. Use a quarter-step offset so the tooth straddles
	// the vertical axis symmetrically.
	const start = -Math.PI / 2 - step / 2;
	interface V {
		sin: number;
		cos: number;
	}
	const verts: V[] = [];
	for (let i = 0; i < total; i++) {
		const a = start + i * step;
		verts.push({
			// sin of polar angle is the x component (right is +); cos is y (down +
			// in OOXML). Match conventions used by buildStarN in the misc batch.
			sin: Math.round(Math.cos(a) * 100000),
			cos: Math.round(Math.sin(a) * 100000),
		});
	}
	const gdLst: ReturnType<typeof gd>[] = [
		gd('a', `pin 0 adj 50000`),
		gd('iwd2', '*/ wd2 a 50000'),
		gd('ihd2', '*/ hd2 a 50000'),
		// Inner radii: outer minus tooth depth.
		gd('owd2', 'val wd2'),
		gd('ohd2', 'val hd2'),
		gd('inwd2', '+- wd2 0 iwd2'),
		gd('inhd2', '+- hd2 0 ihd2'),
	];
	const commands: PresetShapeGeometryDefinition['pathLst'][number]['commands'] = [];
	// Walk the vertices: every 4 vertices form one tooth (top-left, top-right,
	// valley-right, valley-left of the next tooth). Outer (tooth top) points
	// use `wd2/hd2`; valley points use `inwd2/inhd2`.
	for (let i = 0; i < total; i++) {
		const v = verts[i]!;
		const isOuter = i % 4 === 0 || i % 4 === 1;
		const rxName = `r${i}x`;
		const ryName = `r${i}y`;
		const wd = isOuter ? 'wd2' : 'inwd2';
		const hd = isOuter ? 'hd2' : 'inhd2';
		gdLst.push(gd(rxName, `*/ ${wd} ${v.sin} 100000`), gd(ryName, `*/ ${hd} ${v.cos} 100000`));
		const xVar = `gx${i}`;
		const yVar = `gy${i}`;
		gdLst.push(gd(xVar, `+- hc ${rxName} 0`), gd(yVar, `+- vc ${ryName} 0`));
		if (i === 0) {
			commands.push({ kind: 'moveTo', x: xVar, y: yVar });
		} else {
			commands.push({ kind: 'lnTo', x: xVar, y: yVar });
		}
	}
	commands.push({ kind: 'close' });
	return {
		name: `gear${n}`,
		avLst: { adj: defaultAdj },
		gdLst,
		rect: FULL_RECT,
		pathLst: [{ commands }],
	};
}

const gear6 = buildGearN(6, 15000);
const gear9 = buildGearN(9, 10000);

// ---------------------------------------------------------------------------
// Funnel + math function + non-isosceles trapezoid
// ---------------------------------------------------------------------------

// funnel — a V-shape that narrows to a column at the bottom. The top of the
// funnel spans the full width; sides converge to a stem 1/5 of the width
// centred on `hc`, starting at 40 % of the height.
const funnel: PresetShapeGeometryDefinition = {
	name: 'funnel',
	gdLst: [gd('xn', '*/ w 40 100'), gd('xx', '*/ w 60 100'), gd('ym', '*/ h 40 100')],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 't' },
				{ kind: 'lnTo', x: 'xx', y: 'ym' },
				{ kind: 'lnTo', x: 'xx', y: 'b' },
				{ kind: 'lnTo', x: 'xn', y: 'b' },
				{ kind: 'lnTo', x: 'xn', y: 'ym' },
				{ kind: 'close' },
			],
		},
	],
};

// mathFunction — SIMPLIFIED. The ECMA reference does not define a
// `mathFunction` preset with closed-form geometry; PowerPoint renders this
// shape via a glyph table. We emit a stylised cursive-`f` silhouette using a
// fixed polygon so the shape has *some* visual identity at the default
// adjustment. No `avLst` is exposed.
const mathFunction: PresetShapeGeometryDefinition = {
	name: 'mathFunction',
	gdLst: [
		gd('x1', '*/ w 30 100'),
		gd('x2', '*/ w 55 100'),
		gd('x3', '*/ w 70 100'),
		gd('x4', '*/ w 85 100'),
		gd('y1', '*/ h 25 100'),
		gd('y2', '*/ h 50 100'),
		gd('y3', '*/ h 75 100'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				// Cursive-f silhouette: top hook, descending stem, bottom hook,
				// horizontal cross-bar at the midline.
				{ kind: 'moveTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'x3', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x4', y: 'y2' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'x2', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x1', y: 'y3' },
				{ kind: 'lnTo', x: 'x1', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'l', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x2', y: 't' },
				{ kind: 'close' },
			],
		},
	],
};

// nonIsoscelesTrapezoid — trapezoid whose top edge is offset to the right
// (or left, for adj < 50000). `adj1` (default 50000 → isosceles) controls
// where the top-left corner sits as a fraction of the width; the top-right
// sits an equal fraction in from the right edge so the top edge length is
// half the bottom edge length at adj=50000.
const nonIsoscelesTrapezoid: PresetShapeGeometryDefinition = {
	name: 'nonIsoscelesTrapezoid',
	avLst: { adj: 50000 },
	gdLst: [
		gd('a', 'pin 0 adj 100000'),
		// Top-left vertex at `adj * w / 200000` from the left.
		gd('x1', '*/ w a 200000'),
		// Top-right vertex at the same offset in from the right; produces an
		// isosceles trapezoid when adj==50000 and a skewed one otherwise.
		gd('x2', '+- r 0 x1'),
		// Slight horizontal offset that shifts the top edge for visual
		// asymmetry — mirrors PowerPoint's default rendering, which biases the
		// top edge slightly to one side at adj1==50000.
		gd('dx', '*/ w 5 100'),
		gd('x3', '+- x1 0 dx'),
		gd('x4', '+- x2 0 dx'),
		gd('xt', '*/ x3 1 2'),
		gd('xtb', '+- r 0 xt'),
	],
	rect: { l: 'xt', t: 't', r: 'xtb', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

export const TABS_DECORATIONS_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	cornerTabs,
	squareTabs,
	diamondTabs,
	diagStripe,
	plus,
	gear6,
	gear9,
	funnel,
	mathFunction,
	nonIsoscelesTrapezoid,
};
