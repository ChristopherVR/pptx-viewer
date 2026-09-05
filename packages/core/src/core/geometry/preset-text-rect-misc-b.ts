/**
 * Text-inset rects for basic presets, part 2: `irregularSeal1`,
 * `irregularSeal2`, `lightningBolt`, `noSmoking`, `pie`, `pieWedge`,
 * `smileyFace`, `teardrop`, `verticalScroll`, `wave` (`sun` is deliberately
 * excluded, see the comment above the gap it would otherwise fill).
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-misc-b
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const MISC_TEXT_RECTS_B: Record<string, PresetTextRectDefinition> = {
	irregularSeal1: {
		gdLst: [
			gd('x5', '*/ w 4627 21600'),
			gd('x21', '*/ w 16702 21600'),
			gd('y3', '*/ h 6320 21600'),
			gd('y9', '*/ h 13937 21600'),
		],
		rect: { l: 'x5', t: 'y3', r: 'x21', b: 'y9' },
	},

	irregularSeal2: {
		gdLst: [
			gd('x5', '*/ w 5372 21600'),
			gd('x19', '*/ w 14640 21600'),
			gd('y3', '*/ h 6382 21600'),
			gd('y17', '*/ h 15935 21600'),
		],
		rect: { l: 'x5', t: 'y3', r: 'x19', b: 'y17' },
	},

	lightningBolt: {
		gdLst: [
			gd('x4', '*/ w 8757 21600'),
			gd('x9', '*/ w 13917 21600'),
			gd('y4', '*/ h 7437 21600'),
			gd('y10', '*/ h 14277 21600'),
		],
		rect: { l: 'x4', t: 'y4', r: 'x9', b: 'y10' },
	},

	noSmoking: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	pie: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		// The source presetShapeDefinitions.xml literally has
		// `<rect l="il" t="ir" r="it" b="ib"/>` here: `t`/`r` swapped against a
		// horizontal guide (`ir`) and a vertical one (`it`) respectively, which
		// is dimensionally nonsensical (produces l > r at any box size, since
		// il < ir always) and degenerate. `noSmoking`, `smileyFace`, and
		// `teardrop` share this exact idx/idy/il/ir/it/ib guide set and all use
		// the sane `l/t/r/b -> il/it/ir/ib` order; this is corrected to match
		// them rather than transcribed verbatim, since verbatim here is
		// provably broken, not just unverified. Flagged for COM verification.
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	pieWedge: {
		gdLst: [
			gd('g1', 'cos w 13500000'),
			gd('g2', 'sin h 13500000'),
			gd('x1', '+- r g1 0'),
			gd('y1', '+- b g2 0'),
		],
		rect: { l: 'x1', t: 'y1', r: 'r', b: 'b' },
	},

	smileyFace: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	// `sun` is deliberately NOT overridden here. `preset-shape-definitions-misc.ts`
	// carries its own hand-derived `rect` (`trl`/`trt`/`trr`/`trb` - the DISC's
	// own 45deg-inscribed rectangle, not the disc's full bounds), COM-verified
	// 2026-09-05 at two aspect ratios (200x100pt: l=64.65, t=32.32, r=135.27,
	// b=67.68; 160x120pt: l=51.72, t=38.79, r=108.22, b=81.21, both within
	// 0.1% of the box), which disagrees with the raw ECMA `<rect l="x9" t="y9"
	// r="x8" b="y8"/>` (a g0/g7/g8/g9 fraction chain) this file would
	// otherwise transcribe verbatim. Since that existing value is already
	// COM-verified, this override intentionally defers to it rather than
	// silently replacing a measured fix with an unverified spec literal.

	teardrop: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	verticalScroll: {
		avLst: { adj: 12500 },
		gdLst: [
			gd('a', 'pin 0 adj 25000'),
			gd('ch', '*/ ss a 100000'),
			gd('ch2', '*/ ch 1 2'),
			gd('x6', '+- r 0 ch'),
			gd('y4', '+- b 0 ch2'),
		],
		rect: { l: 'ch', t: 'ch', r: 'x6', b: 'y4' },
	},

	wave: {
		avLst: { adj1: 12500, adj2: 0 },
		gdLst: [
			gd('a1', 'pin 0 adj1 20000'),
			gd('a2', 'pin -10000 adj2 10000'),
			gd('of2', '*/ w a2 50000'),
			gd('dx2', '?: of2 0 of2'),
			gd('x2', '+- l 0 dx2'),
			gd('dx5', '?: of2 of2 0'),
			gd('x5', '+- r 0 dx5'),
			gd('x6', '+- l dx5 0'),
			gd('x10', '+- r dx2 0'),
			gd('il', 'max x2 x6'),
			gd('ir', 'min x5 x10'),
			gd('it', '*/ h a1 50000'),
			gd('ib', '+- b 0 it'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},
};
