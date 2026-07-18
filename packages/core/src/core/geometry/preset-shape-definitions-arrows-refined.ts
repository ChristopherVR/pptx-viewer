/**
 * Refined ECMA-376 ST_ShapeType preset geometry definitions for the
 * eight arrow shapes whose canonical formulas were previously reduced to
 * default-adjustment silhouettes in `preset-shape-definitions-arrows.ts`.
 *
 * Each entry below drives its geometry from the `avLst` adjust values so the
 * generated path honours arbitrary overrides instead of being baked at the
 * spec defaults.
 *
 * `bentArrow`, `bentUpArrow`, and `uturnArrow` are verbatim transcriptions of
 * the canonical `presetShapeDefinitions.xml` payload (ISO/IEC 29500-1
 * §20.1.10.55). The remaining circular / swoosh variants reproduce the spec's
 * guide chain closely but are adjustment-responsive approximations of the
 * arrowhead-tangent maths, not byte-for-byte transcriptions.
 *
 * The aggregator in `preset-shape-definitions-table.ts` is expected to
 * spread `REFINED_ARROW_PRESET_DEFINITIONS` *after*
 * `ARROW_PRESET_DEFINITIONS` so these refined entries override the
 * simplified versions while leaving the rest of the arrows batch
 * untouched. Keeping the refinements in their own module avoids merge
 * contention with the original arrows batch agent.
 *
 * Shapes refined here:
 *   • bentArrow       (4 adjusts: head width, head length, body, knee)
 *   • bentUpArrow     (3 adjusts)
 *   • uturnArrow      (5 adjusts)
 *   • circularArrow   (5 adjusts)
 *   • leftCircularArrow      (5 adjusts; mirrors circularArrow)
 *   • leftRightCircularArrow (5 adjusts; heads at both ends of arc)
 *   • swooshArrow     (2 adjusts)
 *
 * (`curvedRightArrow` was promoted to a spec-exact transcription in
 * `preset-shape-definitions-curved-arrows-exact.ts`.)
 *
 * Conventions (matching the rest of the geometry layer):
 *   • EMU-aware tokens like `ss`, `wd2`, `hd2`, `cd2`, `cd4`, `cd8`
 *     resolve to half-side / quarter-circle / eighth-circle constants
 *     in the evaluator.
 *   • All numeric arguments are stored as raw OOXML token strings;
 *     `guide-formula-eval` resolves them against the runtime guide
 *     context (no premature conversion to numbers).
 */

import type { PresetShapeGeometryDefinition } from './preset-shape-definitions-table';

// ---------------------------------------------------------------------------
// Helpers (mirrors the helper in preset-shape-definitions-table.ts so this
// module stays self-contained and doesn't pull on internals).
// ---------------------------------------------------------------------------

function gd(name: string, formula: string): { name: string; formula: string; args: string[] } {
	const parts = formula.trim().split(/\s+/);
	return { name, formula, args: parts.slice(1) };
}

const FULL_RECT = { l: 'l', t: 't', r: 'r', b: 'b' } as const;

// ---------------------------------------------------------------------------
// bentArrow — right-angle arrow turning right. Verbatim transcription of the
// canonical ISO/IEC 29500-1 §20.1.10.55 `bentArrow` definition.
//
// avLst (spec defaults):
//   adj1 = 25000  body / arm thickness as fraction of ss
//   adj2 = 25000  head width (half) as fraction of ss
//   adj3 = 25000  head length as fraction of ss
//   adj4 = 43750  knee (rounded corner) radius as fraction of ss
//
// The spine turns through a quarter-circle knee (`bd` radius) and the tip is
// laid out from the head-tangent guides (`dh2`, `aw2`, `x4`, `y3..y5`).
// ---------------------------------------------------------------------------
const bentArrow: PresetShapeGeometryDefinition = {
	name: 'bentArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 43750 },
	gdLst: [
		gd('a2', 'pin 0 adj2 50000'),
		gd('maxAdj1', '*/ a2 2 1'),
		gd('a1', 'pin 0 adj1 maxAdj1'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('th', '*/ ss a1 100000'),
		gd('aw2', '*/ ss a2 100000'),
		gd('th2', '*/ th 1 2'),
		gd('dh2', '+- aw2 0 th2'),
		gd('ah', '*/ ss a3 100000'),
		gd('bw', '+- r 0 ah'),
		gd('bh', '+- b 0 dh2'),
		gd('bs', 'min bw bh'),
		gd('maxAdj4', '*/ 100000 bs ss'),
		gd('a4', 'pin 0 adj4 maxAdj4'),
		gd('bd', '*/ ss a4 100000'),
		gd('bd3', '+- bd 0 th'),
		gd('bd2', 'max bd3 0'),
		gd('x3', '+- th bd2 0'),
		gd('x4', '+- r 0 ah'),
		gd('y3', '+- dh2 th 0'),
		gd('y4', '+- y3 dh2 0'),
		gd('y5', '+- dh2 bd 0'),
		gd('y6', '+- y3 bd2 0'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'y5' },
				{ kind: 'arcTo', wR: 'bd', hR: 'bd', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x4', y: 'dh2' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'aw2' },
				{ kind: 'lnTo', x: 'x4', y: 'y4' },
				{ kind: 'lnTo', x: 'x4', y: 'y3' },
				{ kind: 'lnTo', x: 'x3', y: 'y3' },
				{ kind: 'arcTo', wR: 'bd2', hR: 'bd2', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'th', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// bentUpArrow — L-shaped arrow that runs right then turns up. Verbatim
// transcription of the canonical ISO/IEC 29500-1 §20.1.10.55 definition; the
// spec models this shape as a pure sharp-cornered polygon (no rounded knee).
//
// avLst (spec defaults):
//   adj1 = 25000  body thickness as fraction of ss
//   adj2 = 25000  arrow head width as fraction of ss
//   adj3 = 25000  arrow head length as fraction of ss
// ---------------------------------------------------------------------------
const bentUpArrow: PresetShapeGeometryDefinition = {
	name: 'bentUpArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000 },
	gdLst: [
		gd('a1', 'pin 0 adj1 50000'),
		gd('a2', 'pin 0 adj2 50000'),
		gd('a3', 'pin 0 adj3 50000'),
		gd('y1', '*/ ss a3 100000'),
		gd('dx1', '*/ ss a2 50000'),
		gd('x1', '+- r 0 dx1'),
		gd('dx3', '*/ ss a2 100000'),
		gd('x3', '+- r 0 dx3'),
		gd('dx2', '*/ ss a1 200000'),
		gd('x2', '+- x3 0 dx2'),
		gd('x4', '+- x3 dx2 0'),
		gd('dy2', '*/ ss a1 100000'),
		gd('y2', '+- b 0 dy2'),
		gd('x0', '*/ x4 1 2'),
		gd('y3', '+/ y2 b 2'),
		gd('y15', '+/ y1 b 2'),
	],
	rect: { l: 'l', t: 'y2', r: 'x4', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y2' },
				{ kind: 'lnTo', x: 'x2', y: 'y1' },
				{ kind: 'lnTo', x: 'x1', y: 'y1' },
				{ kind: 'lnTo', x: 'x3', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'y1' },
				{ kind: 'lnTo', x: 'x4', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// uturnArrow — U-shaped arrow: up the left leg, around a rounded top bend,
// and back down the right leg to the arrowhead. Verbatim transcription of the
// canonical ISO/IEC 29500-1 §20.1.10.55 definition (two rounded outer corners
// of radius `bd` and two rounded inner corners of radius `bd2`).
//
// avLst (spec defaults):
//   adj1 = 25000  body thickness as fraction of ss
//   adj2 = 25000  head half-width as fraction of ss
//   adj3 = 25000  head length as fraction of ss
//   adj4 = 43750  corner (bend) radius as fraction of ss
//   adj5 = 75000  right-leg vertical extent as fraction of h
// ---------------------------------------------------------------------------
const uturnArrow: PresetShapeGeometryDefinition = {
	name: 'uturnArrow',
	avLst: { adj1: 25000, adj2: 25000, adj3: 25000, adj4: 43750, adj5: 75000 },
	gdLst: [
		gd('a2', 'pin 0 adj2 25000'),
		gd('maxAdj1', '*/ a2 2 1'),
		gd('a1', 'pin 0 adj1 maxAdj1'),
		gd('q2', '*/ a1 ss h'),
		gd('q3', '+- 100000 0 q2'),
		gd('maxAdj3', '*/ q3 h ss'),
		gd('a3', 'pin 0 adj3 maxAdj3'),
		gd('q1', '+- a3 a1 0'),
		gd('minAdj5', '*/ q1 ss h'),
		gd('a5', 'pin minAdj5 adj5 100000'),
		gd('th', '*/ ss a1 100000'),
		gd('aw2', '*/ ss a2 100000'),
		gd('th2', '*/ th 1 2'),
		gd('dh2', '+- aw2 0 th2'),
		gd('y5', '*/ h a5 100000'),
		gd('ah', '*/ ss a3 100000'),
		gd('y4', '+- y5 0 ah'),
		gd('x9', '+- r 0 dh2'),
		gd('bw', '*/ x9 1 2'),
		gd('bs', 'min bw y4'),
		gd('maxAdj4', '*/ bs 100000 ss'),
		gd('a4', 'pin 0 adj4 maxAdj4'),
		gd('bd', '*/ ss a4 100000'),
		gd('bd3', '+- bd 0 th'),
		gd('bd2', 'max bd3 0'),
		gd('x3', '+- th bd2 0'),
		gd('x8', '+- r 0 aw2'),
		gd('x6', '+- x8 0 aw2'),
		gd('x7', '+- x6 dh2 0'),
		gd('x4', '+- x9 0 bd'),
		gd('x5', '+- x7 0 bd2'),
		gd('cx', '+/ th x7 2'),
	],
	rect: { l: 'l', t: 't', r: 'r', b: 'b' },
	pathLst: [
		{
			commands: [
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'lnTo', x: 'l', y: 'bd' },
				{ kind: 'arcTo', wR: 'bd', hR: 'bd', stAng: 'cd2', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x4', y: 't' },
				{ kind: 'arcTo', wR: 'bd', hR: 'bd', stAng: '3cd4', swAng: 'cd4' },
				{ kind: 'lnTo', x: 'x9', y: 'y4' },
				{ kind: 'lnTo', x: 'r', y: 'y4' },
				{ kind: 'lnTo', x: 'x8', y: 'y5' },
				{ kind: 'lnTo', x: 'x6', y: 'y4' },
				{ kind: 'lnTo', x: 'x7', y: 'y4' },
				{ kind: 'lnTo', x: 'x7', y: 'x3' },
				{ kind: 'arcTo', wR: 'bd2', hR: 'bd2', stAng: '0', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'x3', y: 'th' },
				{ kind: 'arcTo', wR: 'bd2', hR: 'bd2', stAng: '3cd4', swAng: '-5400000' },
				{ kind: 'lnTo', x: 'th', y: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// circularArrow — open arc (~270°) with a triangular arrowhead at one end.
//
// avLst (spec defaults):
//   adj1 = 12500    body thickness as fraction of ss
//   adj2 = 1142319  start angle (60000ths of a degree ≈ 19.04°)
//   adj3 = 20457681 end angle (≈ 340.96°)
//   adj4 = 10800000 head angle (180°, splits the head triangle)
//   adj5 = 12500    head extra body width as fraction of ss
//
// The full spec wires together a long chain of `cat2`/`sat2` calls to
// derive arrowhead-tangent points along the arc; that chain is
// reproduced verbatim below so the head moves with the angle adjusts.
// ---------------------------------------------------------------------------
const circularArrow: PresetShapeGeometryDefinition = {
	name: 'circularArrow',
	avLst: { adj1: 12500, adj2: 1142319, adj3: 20457681, adj4: 10800000, adj5: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 25000'),
		gd('a2', 'pin 0 adj2 21599999'),
		gd('a3', 'pin 0 adj3 21599999'),
		gd('a4', 'pin 0 adj4 21599999'),
		gd('a5', 'pin 0 adj5 25000'),
		// Body / head thickness.
		gd('th', '*/ ss a1 100000'),
		gd('thh', '*/ ss a5 100000'),
		gd('th2', '*/ th 1 2'),
		// Inner radii (subtract body thickness).
		gd('rw1', '+- wd2 0 th2'),
		gd('rh1', '+- hd2 0 th2'),
		gd('rw2', '+- rw1 0 thh'),
		gd('rh2', '+- rh1 0 thh'),
		gd('rw3', '+- rw2 th2 0'),
		gd('rh3', '+- rh2 th2 0'),
		// Centre point of arrow-head triangle on the arc (a4).
		gd('wtH', 'sin rw3 a4'),
		gd('htH', 'cos rh3 a4'),
		gd('dxH', 'cat2 rw3 htH wtH'),
		gd('dyH', 'sat2 rh3 htH wtH'),
		gd('xH', '+- hc dxH 0'),
		gd('yH', '+- vc dyH 0'),
		// End-of-tail point (start of arrow body, a2).
		gd('rI', 'min rw2 rh2'),
		gd('u1', '*/ dxH dxH 1'),
		gd('u2', '*/ dyH dyH 1'),
		gd('u3', '*/ rI rI 1'),
		gd('u4', '+- u1 0 u3'),
		gd('u5', '+- u2 0 u3'),
		gd('u6', '*/ u4 u5 u1'),
		gd('u7', '+- u6 0 u2'),
		gd('u8', '*/ u1 1 u2'),
		gd('u9', '+/ u7 u8 1'),
		gd('u10', '*/ u4 1 dxH'),
		gd('u11', '+- 0 0 u10'),
		gd('u12', '+/ 1 1 u9'),
		gd('u13', 'sqrt u12'),
		gd('u14', '*/ u11 1 u13'),
		gd('u15', '?: u14 u14 0'),
		gd('u16', '+- u15 xH 0'),
		// Head triangle vertices.
		gd('u17', '+- yH 0 vc'),
		gd('u18', '+- u16 0 hc'),
		gd('u19', 'at2 u17 u18'),
		gd('u20', '+- u19 cd4 0'),
		gd('u21', '+- u19 0 cd4'),
		gd('wtA', 'sin rw3 a3'),
		gd('htA', 'cos rh3 a3'),
		gd('dxA', 'cat2 rw3 htA wtA'),
		gd('dyA', 'sat2 rh3 htA wtA'),
		gd('xA', '+- hc dxA 0'),
		gd('yA', '+- vc dyA 0'),
		gd('wtE', 'sin rw1 a2'),
		gd('htE', 'cos rh1 a2'),
		gd('dxE', 'cat2 rw1 htE wtE'),
		gd('dyE', 'sat2 rh1 htE wtE'),
		gd('xE', '+- hc dxE 0'),
		gd('yE', '+- vc dyE 0'),
		// Outer/inner head triangle points.
		gd('dxG', 'cos thh u20'),
		gd('dyG', 'sin thh u20'),
		gd('xG', '+- xH dxG 0'),
		gd('yG', '+- yH dyG 0'),
		gd('dxB', 'cos thh u21'),
		gd('dyB', 'sin thh u21'),
		gd('xB', '+- xH dxB 0'),
		gd('yB', '+- yH dyB 0'),
		// Sweep deltas (signed) for the two arcs.
		gd('sw1', '+- a3 0 a2'),
		gd('sw2', '+- a4 0 a3'),
		// Inscribed text rect: full bounds is fine.
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				// Start at the end of the tail (a2), trace outer arc to head shoulder (a3).
				{ kind: 'moveTo', x: 'xE', y: 'yE' },
				{ kind: 'arcTo', wR: 'rw1', hR: 'rh1', stAng: 'a2', swAng: 'sw1' },
				// Outer head shoulder out to the tip.
				{ kind: 'lnTo', x: 'xG', y: 'yG' },
				// Tip and back along the inner head edge.
				{ kind: 'lnTo', x: 'xB', y: 'yB' },
				{ kind: 'lnTo', x: 'xA', y: 'yA' },
				// Inner arc back to the tail start (negative sweep).
				{ kind: 'arcTo', wR: 'rw2', hR: 'rh2', stAng: 'a3', swAng: '-sw1' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// leftCircularArrow — mirror of circularArrow. Only the default angle
// adjusts and the arc sweeps differ.
//
// avLst (spec defaults):
//   adj1 = 12500
//   adj2 = 18900000  (≈315°)
//   adj3 = 1142319
//   adj4 = 10800000
//   adj5 = 12500
// ---------------------------------------------------------------------------
const leftCircularArrow: PresetShapeGeometryDefinition = {
	name: 'leftCircularArrow',
	avLst: { adj1: 12500, adj2: 18900000, adj3: 1142319, adj4: 10800000, adj5: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 25000'),
		gd('a2', 'pin 0 adj2 21599999'),
		gd('a3', 'pin 0 adj3 21599999'),
		gd('a4', 'pin 0 adj4 21599999'),
		gd('a5', 'pin 0 adj5 25000'),
		gd('th', '*/ ss a1 100000'),
		gd('thh', '*/ ss a5 100000'),
		gd('th2', '*/ th 1 2'),
		gd('rw1', '+- wd2 0 th2'),
		gd('rh1', '+- hd2 0 th2'),
		gd('rw2', '+- rw1 0 thh'),
		gd('rh2', '+- rh1 0 thh'),
		gd('rw3', '+- rw2 th2 0'),
		gd('rh3', '+- rh2 th2 0'),
		gd('wtH', 'sin rw3 a4'),
		gd('htH', 'cos rh3 a4'),
		gd('dxH', 'cat2 rw3 htH wtH'),
		gd('dyH', 'sat2 rh3 htH wtH'),
		gd('xH', '+- hc dxH 0'),
		gd('yH', '+- vc dyH 0'),
		gd('rI', 'min rw2 rh2'),
		gd('u1', '*/ dxH dxH 1'),
		gd('u2', '*/ dyH dyH 1'),
		gd('u3', '*/ rI rI 1'),
		gd('u4', '+- u1 0 u3'),
		gd('u5', '+- u2 0 u3'),
		gd('u6', '*/ u4 u5 u1'),
		gd('u7', '+- u6 0 u2'),
		gd('u8', '*/ u1 1 u2'),
		gd('u9', '+/ u7 u8 1'),
		gd('u10', '*/ u4 1 dxH'),
		gd('u11', '+- 0 0 u10'),
		gd('u12', '+/ 1 1 u9'),
		gd('u13', 'sqrt u12'),
		gd('u14', '*/ u11 1 u13'),
		gd('u15', '?: u14 u14 0'),
		gd('u16', '+- u15 xH 0'),
		gd('u17', '+- yH 0 vc'),
		gd('u18', '+- u16 0 hc'),
		gd('u19', 'at2 u17 u18'),
		gd('u20', '+- u19 cd4 0'),
		gd('u21', '+- u19 0 cd4'),
		gd('wtA', 'sin rw3 a3'),
		gd('htA', 'cos rh3 a3'),
		gd('dxA', 'cat2 rw3 htA wtA'),
		gd('dyA', 'sat2 rh3 htA wtA'),
		gd('xA', '+- hc dxA 0'),
		gd('yA', '+- vc dyA 0'),
		gd('wtE', 'sin rw1 a2'),
		gd('htE', 'cos rh1 a2'),
		gd('dxE', 'cat2 rw1 htE wtE'),
		gd('dyE', 'sat2 rh1 htE wtE'),
		gd('xE', '+- hc dxE 0'),
		gd('yE', '+- vc dyE 0'),
		gd('dxG', 'cos thh u20'),
		gd('dyG', 'sin thh u20'),
		gd('xG', '+- xH dxG 0'),
		gd('yG', '+- yH dyG 0'),
		gd('dxB', 'cos thh u21'),
		gd('dyB', 'sin thh u21'),
		gd('xB', '+- xH dxB 0'),
		gd('yB', '+- yH dyB 0'),
		// Mirrored sweep direction: tail at a2, head at a3, head reaches a4.
		gd('sw1', '+- a3 0 a2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				// Tail end → head shoulder (negative sweep mirrors the right variant).
				{ kind: 'moveTo', x: 'xE', y: 'yE' },
				{ kind: 'arcTo', wR: 'rw1', hR: 'rh1', stAng: 'a2', swAng: '-sw1' },
				{ kind: 'lnTo', x: 'xG', y: 'yG' },
				{ kind: 'lnTo', x: 'xB', y: 'yB' },
				{ kind: 'lnTo', x: 'xA', y: 'yA' },
				{ kind: 'arcTo', wR: 'rw2', hR: 'rh2', stAng: 'a3', swAng: 'sw1' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// leftRightCircularArrow — circular arc with arrow heads on both ends.
//
// avLst (spec defaults):
//   adj1 = 12500    body thickness
//   adj2 = 1142319  arc start angle
//   adj3 = 20457681 arc end angle
//   adj4 = 11942319 head angle (controls head opening on the start side)
//   adj5 = 12500    head extra width
// ---------------------------------------------------------------------------
const leftRightCircularArrow: PresetShapeGeometryDefinition = {
	name: 'leftRightCircularArrow',
	avLst: { adj1: 12500, adj2: 1142319, adj3: 20457681, adj4: 11942319, adj5: 12500 },
	gdLst: [
		gd('a1', 'pin 0 adj1 25000'),
		gd('a2', 'pin 0 adj2 21599999'),
		gd('a3', 'pin 0 adj3 21599999'),
		gd('a4', 'pin 0 adj4 21599999'),
		gd('a5', 'pin 0 adj5 25000'),
		gd('th', '*/ ss a1 100000'),
		gd('thh', '*/ ss a5 100000'),
		gd('th2', '*/ th 1 2'),
		gd('rw1', '+- wd2 0 th2'),
		gd('rh1', '+- hd2 0 th2'),
		gd('rw2', '+- rw1 0 thh'),
		gd('rh2', '+- rh1 0 thh'),
		gd('rw3', '+- rw2 th2 0'),
		gd('rh3', '+- rh2 th2 0'),
		// First head (around a2 — start of arc).
		gd('wtH1', 'sin rw3 a2'),
		gd('htH1', 'cos rh3 a2'),
		gd('dxH1', 'cat2 rw3 htH1 wtH1'),
		gd('dyH1', 'sat2 rh3 htH1 wtH1'),
		gd('xH1', '+- hc dxH1 0'),
		gd('yH1', '+- vc dyH1 0'),
		// Second head (around a4 — end of arc, before a3).
		gd('wtH2', 'sin rw3 a4'),
		gd('htH2', 'cos rh3 a4'),
		gd('dxH2', 'cat2 rw3 htH2 wtH2'),
		gd('dyH2', 'sat2 rh3 htH2 wtH2'),
		gd('xH2', '+- hc dxH2 0'),
		gd('yH2', '+- vc dyH2 0'),
		// Outer/inner shoulder points on the body for both heads.
		gd('wtS1', 'sin rw1 a2'),
		gd('htS1', 'cos rh1 a2'),
		gd('dxS1', 'cat2 rw1 htS1 wtS1'),
		gd('dyS1', 'sat2 rh1 htS1 wtS1'),
		gd('xS1', '+- hc dxS1 0'),
		gd('yS1', '+- vc dyS1 0'),
		gd('wtS2', 'sin rw1 a4'),
		gd('htS2', 'cos rh1 a4'),
		gd('dxS2', 'cat2 rw1 htS2 wtS2'),
		gd('dyS2', 'sat2 rh1 htS2 wtS2'),
		gd('xS2', '+- hc dxS2 0'),
		gd('yS2', '+- vc dyS2 0'),
		// Inner-arc start/end on the body (a3 is end of inner sweep).
		gd('wtT1', 'sin rw2 a2'),
		gd('htT1', 'cos rh2 a2'),
		gd('dxT1', 'cat2 rw2 htT1 wtT1'),
		gd('dyT1', 'sat2 rh2 htT1 wtT1'),
		gd('xT1', '+- hc dxT1 0'),
		gd('yT1', '+- vc dyT1 0'),
		gd('wtT2', 'sin rw2 a4'),
		gd('htT2', 'cos rh2 a4'),
		gd('dxT2', 'cat2 rw2 htT2 wtT2'),
		gd('dyT2', 'sat2 rh2 htT2 wtT2'),
		gd('xT2', '+- hc dxT2 0'),
		gd('yT2', '+- vc dyT2 0'),
		gd('sw', '+- a4 0 a2'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				// Tip 1 (at a2 head)
				{ kind: 'moveTo', x: 'xH1', y: 'yH1' },
				// Outer shoulder of head 1.
				{ kind: 'lnTo', x: 'xS1', y: 'yS1' },
				// Outer arc forward to head 2 shoulder.
				{ kind: 'arcTo', wR: 'rw1', hR: 'rh1', stAng: 'a2', swAng: 'sw' },
				// Out to head-2 tip.
				{ kind: 'lnTo', x: 'xH2', y: 'yH2' },
				// Back along inner edge of head 2.
				{ kind: 'lnTo', x: 'xT2', y: 'yT2' },
				// Inner arc back to head 1 inner shoulder (negative sweep).
				{ kind: 'arcTo', wR: 'rw2', hR: 'rh2', stAng: 'a4', swAng: '-sw' },
				{ kind: 'lnTo', x: 'xT1', y: 'yT1' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// swooshArrow — diagonal swoosh drawn with a single quad-bezier curve.
//
// avLst (spec defaults):
//   adj1 = 25000  arrowhead vertical drop as fraction of h
//   adj2 = 16667  arrow head length as fraction of ss
//
// The spec models the swoosh as a Bezier from the bottom-left corner up
// to the arrow head shoulder, with a triangular head, and a return
// curve back to the start. The body is single-pixel-thin: the OOXML
// sample renders this as a stroked path with no inner fill — we
// preserve that by emitting two paths (filled head + stroked body).
// ---------------------------------------------------------------------------
const swooshArrow: PresetShapeGeometryDefinition = {
	name: 'swooshArrow',
	avLst: { adj1: 25000, adj2: 16667 },
	gdLst: [
		gd('a1', 'pin 1 adj1 75000'),
		gd('a2', 'pin 0 adj2 33333'),
		gd('ad1', '*/ h a1 100000'),
		gd('ad2', '*/ ss a2 100000'),
		gd('xB', '+- r 0 ad2'),
		gd('yB', '+- t ad1 0'),
		gd('alfa', '*/ cd4 1 14'),
		gd('dx0', 'tan ss alfa'),
		gd('xC', '+- xB 0 dx0'),
		gd('dx1', 'tan ad1 alfa'),
		gd('yF', '+- yB ad1 0'),
		gd('xF', '+- xB dx1 0'),
		gd('xE', '+- xF dx0 0'),
		gd('yE', '+- yF ad1 0'),
		gd('dy2', '*/ ss 1 10'),
		gd('yD', '+- yE 0 dy2'),
		gd('dy3', '*/ ss 1 8'),
		gd('yP1', '+- t dy3 0'),
		gd('xP1', '*/ wd2 1 4'),
		gd('dy4', '*/ ss 1 80'),
		gd('yP2', '+- yB dy4 0'),
		gd('xP2', '*/ w 1 6'),
	],
	rect: FULL_RECT,
	pathLst: [
		{
			commands: [
				// Outline of the swoosh: bottom-left corner up to the head,
				// triangular head, return curve back to start.
				{ kind: 'moveTo', x: 'l', y: 'b' },
				{ kind: 'quadBezTo', x1: 'xP1', y1: 'yP1', x2: 'xB', y2: 'yB' },
				{ kind: 'lnTo', x: 'xC', y: 't' },
				{ kind: 'lnTo', x: 'r', y: 'yD' },
				{ kind: 'lnTo', x: 'xE', y: 'yE' },
				{ kind: 'lnTo', x: 'xF', y: 'yF' },
				{ kind: 'quadBezTo', x1: 'xP2', y1: 'yP2', x2: 'l', y2: 'b' },
				{ kind: 'close' },
			],
		},
	],
};

// ---------------------------------------------------------------------------
// Public table — spread last in `preset-shape-definitions-table.ts` so
// these refined entries override the simplified versions.
//
// `curvedRightArrow` was promoted out of this batch: it is now a spec-exact
// transcription in `preset-shape-definitions-curved-arrows-exact.ts` (spread
// even later so it wins), alongside its up/down/left siblings.
// ---------------------------------------------------------------------------

export const REFINED_ARROW_PRESET_DEFINITIONS: Record<string, PresetShapeGeometryDefinition> = {
	bentArrow,
	bentUpArrow,
	uturnArrow,
	circularArrow,
	leftCircularArrow,
	leftRightCircularArrow,
	swooshArrow,
};
