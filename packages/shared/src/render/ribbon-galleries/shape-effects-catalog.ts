/**
 * PowerPoint's Shape Effects menu (Shape Format > Shape Effects, and Picture
 * Format > Picture Effects), as PowerPoint itself writes each entry.
 *
 * Ground truth: `scripts/capture-effects-gallery-com.ps1` applies every
 * entry through COM on a fresh deck and saves it; the values below are that
 * capture's `a:effectLst` / `a:scene3d` / `a:sp3d`, verbatim (EMU, 60000ths
 * of a degree, 1000ths of a percent):
 *
 * - Shadow: `Shape.Shadow.Type = msoShadow21..43` (21-29 Outer, 30-38 Inner,
 *   39-43 Perspective, in the gallery's reading order).
 * - Reflection: `Shape.Reflection.Type = msoReflectionType1..9`.
 * - Glow: `Glow.Radius` 5/8/11/18 pt, `Glow.Color.ObjectThemeColor` Accent
 *   1-6, `Glow.Transparency = 0.6`: `<a:schemeClr val="accentN"><a:alpha
 *   val="40000"/>`.
 * - Soft Edges: `Shape.SoftEdge.Type = msoSoftEdgeType1..6`.
 * - Bevel: `ThreeD.BevelTopType = msoBevel*`: a bare `<a:bevelT prst>` (no
 *   w/h, so the 6 pt default) plus an `orthographicFront` / `threePt` scene.
 * - 3-D Rotation: `ThreeD.SetPresetCamera(n)` writes `a:camera/@prst` and a
 *   `threePt` / `t` light rig. The camera NAMES are COM-verified; which
 *   presets PowerPoint's gallery groups under Parallel / Perspective / Oblique
 *   is transcribed from the menu, not from an API.
 *
 * @module render/ribbon-galleries/shape-effects-catalog
 */

type Align = 'tl' | 't' | 'tr' | 'l' | 'ctr' | 'r' | 'bl' | 'b' | 'br';

/** One outer/inner/perspective shadow preset. */
export interface ShadowPresetSpec {
	key: string;
	label: string;
	kind: 'outer' | 'inner';
	blurEmu: number;
	distEmu: number;
	/** 60000ths of a degree. */
	dir: number;
	/** `a:alpha/@val` on the black `a:prstClr`; undefined = opaque. */
	alpha?: number;
	sx?: number;
	sy?: number;
	kx?: number;
	algn?: Align;
}

function outer(key: string, label: string, dir: number, algn?: Align): ShadowPresetSpec {
	return { key, label, kind: 'outer', blurEmu: 50800, distEmu: 38100, dir, alpha: 40000, algn };
}

function inner(key: string, label: string, dir: number): ShadowPresetSpec {
	return { key, label, kind: 'inner', blurEmu: 63500, distEmu: 50800, dir, alpha: 50000 };
}

export const SHADOW_OUTER_PRESETS: readonly ShadowPresetSpec[] = [
	outer('offsetBottomRight', 'Offset: Bottom Right', 2700000, 'tl'),
	outer('offsetBottom', 'Offset: Bottom', 5400000, 't'),
	outer('offsetBottomLeft', 'Offset: Bottom Left', 8100000, 'tr'),
	outer('offsetRight', 'Offset: Right', 0, 'l'),
	{
		key: 'offsetCenter',
		label: 'Offset: Center',
		kind: 'outer',
		blurEmu: 63500,
		distEmu: 0,
		dir: 0,
		alpha: 40000,
		sx: 102000,
		sy: 102000,
		algn: 'ctr',
	},
	outer('offsetLeft', 'Offset: Left', 10800000, 'r'),
	outer('offsetTopRight', 'Offset: Top Right', 18900000, 'bl'),
	outer('offsetTop', 'Offset: Top', 16200000),
	outer('offsetTopLeft', 'Offset: Top Left', 13500000, 'br'),
];

export const SHADOW_INNER_PRESETS: readonly ShadowPresetSpec[] = [
	inner('insideTopLeft', 'Inside: Top Left', 13500000),
	inner('insideTop', 'Inside: Top', 16200000),
	inner('insideTopRight', 'Inside: Top Right', 18900000),
	inner('insideLeft', 'Inside: Left', 10800000),
	{
		key: 'insideCenter',
		label: 'Inside: Center',
		kind: 'inner',
		blurEmu: 114300,
		distEmu: 0,
		dir: 0,
	},
	inner('insideRight', 'Inside: Right', 0),
	inner('insideBottomLeft', 'Inside: Bottom Left', 8100000),
	inner('insideBottom', 'Inside: Bottom', 5400000),
	inner('insideBottomRight', 'Inside: Bottom Right', 2700000),
];

/** Perspective shadows: `[blur, dist, dir, alpha, sx, sy, kx, algn]`. */
function perspective(
	key: string,
	label: string,
	[blurEmu, distEmu, dir, alpha, sx, sy, kx, algn]: [
		number,
		number,
		number,
		number,
		number | undefined,
		number,
		number | undefined,
		Align | undefined,
	],
): ShadowPresetSpec {
	return { key, label, kind: 'outer', blurEmu, distEmu, dir, alpha, sx, sy, kx, algn };
}

export const SHADOW_PERSPECTIVE_PRESETS: readonly ShadowPresetSpec[] = [
	perspective('perspectiveUpperLeft', 'Perspective: Upper Left', [
		76200,
		0,
		13500000,
		20000,
		undefined,
		23000,
		1200000,
		'br',
	]),
	perspective('perspectiveUpperRight', 'Perspective: Upper Right', [
		76200,
		0,
		18900000,
		20000,
		undefined,
		23000,
		-1200000,
		'bl',
	]),
	perspective('perspectiveBelow', 'Perspective: Below', [
		152400,
		317500,
		5400000,
		15000,
		90000,
		-19000,
		undefined,
		undefined,
	]),
	perspective('perspectiveLowerLeft', 'Perspective: Lower Left', [
		76200,
		12700,
		8100000,
		20000,
		undefined,
		-23000,
		800400,
		'br',
	]),
	perspective('perspectiveLowerRight', 'Perspective: Lower Right', [
		76200,
		12700,
		2700000,
		20000,
		undefined,
		-23000,
		-800400,
		'bl',
	]),
];

/** `a:reflection` presets (all share blurRad 6350, dir 90deg, sy -100%, algn bl). */
export interface ReflectionPresetSpec {
	key: string;
	label: string;
	stA: number;
	endA: number;
	endPos: number;
	distEmu: number;
}

function reflection(
	key: string,
	label: string,
	stA: number,
	endA: number,
	endPos: number,
	distEmu: number,
): ReflectionPresetSpec {
	return { key, label, stA, endA, endPos, distEmu };
}

export const REFLECTION_PRESETS: readonly ReflectionPresetSpec[] = [
	reflection('tightTouching', 'Tight Reflection: Touching', 52000, 300, 35000, 0),
	reflection('halfTouching', 'Half Reflection: Touching', 50000, 300, 55000, 0),
	reflection('fullTouching', 'Full Reflection: Touching', 50000, 300, 90000, 0),
	reflection('tight4pt', 'Tight Reflection: 4 pt offset', 50000, 300, 38500, 50800),
	reflection('half4pt', 'Half Reflection: 4 pt offset', 50000, 300, 55500, 50800),
	reflection('full4pt', 'Full Reflection: 4 pt offset', 50000, 300, 90000, 50800),
	reflection('tight8pt', 'Tight Reflection: 8 pt offset', 50000, 275, 40000, 101600),
	reflection('half8pt', 'Half Reflection: 8 pt offset', 50000, 300, 55500, 101600),
	reflection('full8pt', 'Full Reflection: 8 pt offset', 50000, 295, 92000, 101600),
];

export const REFLECTION_BLUR_EMU = 6350;

/** Glow Variations: 4 sizes (rows) x Accent 1-6 (columns), alpha 40%. */
export const GLOW_SIZES_PT: readonly number[] = [5, 8, 11, 18];
export const GLOW_ACCENTS = [
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
] as const;
export const GLOW_ALPHA = 40000;

/** Soft Edge Variations, in points (`a:softEdge/@rad` = pt x 12700). */
export const SOFT_EDGE_SIZES_PT: readonly number[] = [1, 2.5, 5, 10, 25, 50];

/** The 12 bevel presets in the gallery's 4 x 3 order. */
export const BEVEL_PRESETS: ReadonlyArray<{ preset: string; label: string }> = [
	{ preset: 'circle', label: 'Circle' },
	{ preset: 'relaxedInset', label: 'Relaxed Inset' },
	{ preset: 'cross', label: 'Cross' },
	{ preset: 'coolSlant', label: 'Cool Slant' },
	{ preset: 'angle', label: 'Angle' },
	{ preset: 'softRound', label: 'Soft Round' },
	{ preset: 'convex', label: 'Convex' },
	{ preset: 'slope', label: 'Slope' },
	{ preset: 'divot', label: 'Divot' },
	{ preset: 'riblet', label: 'Riblet' },
	{ preset: 'hardEdge', label: 'Hard Edge' },
	{ preset: 'artDeco', label: 'Art Deco' },
];

/** 3-D Rotation groups: camera preset -> PowerPoint's tooltip. */
export const ROTATION_GROUPS: ReadonlyArray<{
	key: 'parallel' | 'perspective' | 'oblique';
	label: string;
	cameras: ReadonlyArray<{ preset: string; label: string }>;
}> = [
	{
		key: 'parallel',
		label: 'Parallel',
		cameras: [
			{ preset: 'isometricLeftDown', label: 'Isometric: Left Down' },
			{ preset: 'isometricRightUp', label: 'Isometric: Right Up' },
			{ preset: 'isometricTopUp', label: 'Isometric: Top Up' },
			{ preset: 'isometricBottomDown', label: 'Isometric: Bottom Down' },
			{ preset: 'isometricOffAxis1Left', label: 'Off Axis 1: Left' },
			{ preset: 'isometricOffAxis1Right', label: 'Off Axis 1: Right' },
			{ preset: 'isometricOffAxis1Top', label: 'Off Axis 1: Top' },
			{ preset: 'isometricOffAxis2Left', label: 'Off Axis 2: Left' },
			{ preset: 'isometricOffAxis2Right', label: 'Off Axis 2: Right' },
			{ preset: 'isometricOffAxis2Top', label: 'Off Axis 2: Top' },
		],
	},
	{
		key: 'perspective',
		label: 'Perspective',
		cameras: [
			{ preset: 'perspectiveFront', label: 'Perspective: Front' },
			{ preset: 'perspectiveLeft', label: 'Perspective: Left' },
			{ preset: 'perspectiveRight', label: 'Perspective: Right' },
			{ preset: 'perspectiveBelow', label: 'Perspective: Below' },
			{ preset: 'perspectiveAbove', label: 'Perspective: Above' },
			{ preset: 'perspectiveAboveLeftFacing', label: 'Perspective: Above, Facing Left' },
			{ preset: 'perspectiveAboveRightFacing', label: 'Perspective: Above, Facing Right' },
			{ preset: 'perspectiveContrastingLeftFacing', label: 'Perspective: Contrasting Left' },
			{ preset: 'perspectiveContrastingRightFacing', label: 'Perspective: Contrasting Right' },
			{ preset: 'perspectiveHeroicExtremeLeftFacing', label: 'Perspective: Heroic Extreme Left' },
			{ preset: 'perspectiveHeroicExtremeRightFacing', label: 'Perspective: Heroic Extreme Right' },
			{ preset: 'perspectiveRelaxed', label: 'Perspective: Relaxed' },
			{ preset: 'perspectiveRelaxedModerately', label: 'Perspective: Relaxed Moderately' },
		],
	},
	{
		key: 'oblique',
		label: 'Oblique',
		cameras: [
			{ preset: 'obliqueTopLeft', label: 'Oblique: Top Left' },
			{ preset: 'obliqueTopRight', label: 'Oblique: Top Right' },
			{ preset: 'obliqueBottomLeft', label: 'Oblique: Bottom Left' },
			{ preset: 'obliqueBottomRight', label: 'Oblique: Bottom Right' },
		],
	},
];

/** The scene PowerPoint writes around a bevel / camera pick. */
export const DEFAULT_SCENE_LIGHT_RIG = { lightRigType: 'threePt', lightRigDirection: 't' } as const;
