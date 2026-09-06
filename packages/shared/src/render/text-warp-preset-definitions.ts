/**
 * Spec-transcribed OOXML `prstTxWarp` guide formulas for the WordArt
 * "envelope" preset family (inflate/deflate/can), used by
 * `text-warp-preset-sampler.ts` to sample the real top/bottom paths instead
 * of the reconstructed sine lobes in `text-warp-envelope-curves.ts`.
 *
 * Source: `presetTextWarpDefinitions.xml`, the same `avLst`/`gdLst`/`pathLst`
 * table format ECMA-376 uses for preset *shapes* (`presetShapeDefinitions.xml`),
 * but for text warps. The file itself is not reproduced in the free ECMA-376
 * text; this transcription was sourced from LibreOffice's OOXML export table
 * (`oox/source/export/presetTextWarpDefinitions.xml` in LibreOffice/core,
 * https://github.com/LibreOffice/core), which LibreOffice uses to write
 * spec-conformant `prstTxWarp` XML when exporting its own Fontwork shapes to
 * `.pptx` - so its numbers must round-trip correctly through real PowerPoint,
 * unlike LibreOffice's IMPORT-side mapping (which discards the formulas in
 * favour of LibreOffice's own Fontwork geometry, and is what an earlier
 * investigation of this gap found and mistook for "no free source exists").
 * Guide names, formulas, and adjustment ranges below are copied verbatim.
 *
 * Each preset in `presetTextWarpDefinitions.xml` draws a `pathLst` of two or
 * more (top, bottom) path pairs: single-lobe presets (inflate/deflate/can)
 * define exactly one pair spanning the whole shape height; the two compound
 * "Deflate Inflate[ Deflate]" presets define one flat full-height pair (the
 * shape's own bounding-box edges, `y = t` and `y = b`) plus one curved pair
 * PER STACKED TEXT ROW (their own name literally lists the per-row
 * behaviour: "Deflate Inflate" = row 0 deflates, row 1 inflates). A single
 * line of WordArt text only ever occupies row 0, so this module's `top`/
 * `bottom` for a compound preset is path[0] (the flat top edge) and path[1]
 * (row 0's curve) - confirmed empirically (2026-09-06) against PowerPoint
 * COM screenshots: measuring the per-glyph ink-height ratio across a single
 * line of `textDeflateInflateDeflate` text against the row-0-pair
 * prediction gave a max ratio deviation of 0.036 (glyph height predicted to
 * within ~4% of measured, across 16 glyph positions); the alternative
 * "outermost internal pair" reading tried first (path[1] vs path[n-2],
 * skipping the flat edges but spanning every row) was off by up to 0.63 (63%),
 * i.e. clearly wrong. See `text-warp-preset-sampler.test.ts` for the fixture.
 *
 * Coordinates are guide names to be resolved (via `pptx-viewer-core`'s
 * `evaluateGuides`) against a normalised `w = h = 100000` box, matching the
 * scale PowerPoint stores `adj` values in (`textStyle.textWarpAdj` is the
 * raw, unscaled `val` from `a:avLst`), so the resolved guide values are
 * already fractions of `h` in `0..100000` and only need dividing by 100000.
 */
import type { GeometryGuide } from 'pptx-viewer-core';

/** A single curve segment of a preset's top or bottom path, `x` always spanning `l..r`. */
export type WarpCurveSegment =
	| { readonly type: 'line'; readonly startY: string; readonly endY: string }
	| {
			readonly type: 'quad';
			readonly startY: string;
			readonly ctrlY: string;
			readonly endY: string;
	  }
	| {
			readonly type: 'cubic';
			readonly startY: string;
			readonly ctrl1Y: string;
			readonly ctrl2Y: string;
			readonly endY: string;
	  }
	| {
			readonly type: 'arc';
			readonly penX: string;
			readonly penY: string;
			readonly wR: string;
			readonly hR: string;
			readonly stAng: string;
			readonly swAng: string;
	  };

/** One preset's transcribed guide list plus its top/bottom curve segments. */
export interface WarpPresetDefinition {
	readonly defaultAdj: number;
	readonly gdLst: readonly GeometryGuide[];
	readonly top: WarpCurveSegment;
	readonly bottom: WarpCurveSegment;
}

function line(startY: string, endY: string): WarpCurveSegment {
	return { type: 'line', startY, endY };
}
function quad(startY: string, ctrlY: string, endY: string): WarpCurveSegment {
	return { type: 'quad', startY, ctrlY, endY };
}
function cubic(startY: string, ctrl1Y: string, ctrl2Y: string, endY: string): WarpCurveSegment {
	return { type: 'cubic', startY, ctrl1Y, ctrl2Y, endY };
}
function arc(penY: string, wR: string, hR: string, stAng: string, swAng: string): WarpCurveSegment {
	return { type: 'arc', penX: 'l', penY, wR, hR, stAng, swAng };
}

/** Spec-transcribed definitions, keyed by `prstTxWarp` preset name. */
export const WARP_PRESET_DEFINITIONS: Readonly<Record<string, WarpPresetDefinition>> = {
	textCanDown: {
		defaultAdj: 14286,
		gdLst: [
			{ name: 'a', formula: 'pin 0 adj 33333' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'y0', formula: '+- t dy 0' },
			{ name: 'y1', formula: '+- b 0 dy' },
			{ name: 'ncd2', formula: '*/ cd2 -1 1' },
		],
		top: arc('t', 'wd2', 'dy', 'cd2', 'ncd2'),
		bottom: arc('y1', 'wd2', 'dy', 'cd2', 'ncd2'),
	},
	textCanUp: {
		defaultAdj: 85714,
		gdLst: [
			{ name: 'a', formula: 'pin 66667 adj 100000' },
			{ name: 'dy1', formula: '*/ a h 100000' },
			{ name: 'dy', formula: '+- h 0 dy1' },
			{ name: 'y0', formula: '+- t dy1 0' },
			{ name: 'y1', formula: '+- t dy 0' },
		],
		top: arc('y1', 'wd2', 'dy', 'cd2', 'cd2'),
		bottom: arc('b', 'wd2', 'dy', 'cd2', 'cd2'),
	},
	textDeflate: {
		defaultAdj: 18750,
		gdLst: [
			{ name: 'a', formula: 'pin 0 adj 37500' },
			{ name: 'dy', formula: '*/ a ss 100000' },
			{ name: 'gd0', formula: '*/ dy 4 3' },
			{ name: 'gd1', formula: '+- h 0 gd0' },
			{ name: 'adjY', formula: '+- t dy 0' },
			{ name: 'y0', formula: '+- t gd0 0' },
			{ name: 'y1', formula: '+- t gd1 0' },
			{ name: 'x0', formula: '+- l wd3 0' },
			{ name: 'x1', formula: '+- r 0 wd3' },
		],
		top: cubic('t', 'y0', 'y0', 't'),
		bottom: cubic('b', 'y1', 'y1', 'b'),
	},
	textDeflateBottom: {
		defaultAdj: 50000,
		gdLst: [
			{ name: 'a', formula: 'pin 6250 adj 100000' },
			{ name: 'dy', formula: '*/ a ss 100000' },
			{ name: 'dy2', formula: '+- h 0 dy' },
			{ name: 'y1', formula: '+- t dy 0' },
			{ name: 'cp', formula: '+- y1 0 dy2' },
		],
		top: line('t', 't'),
		bottom: quad('b', 'cp', 'b'),
	},
	textDeflateInflate: {
		defaultAdj: 35000,
		gdLst: [
			{ name: 'a', formula: 'pin 5000 adj 95000' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'del', formula: '*/ h 5 100' },
			{ name: 'dh1', formula: '*/ h 45 100' },
			{ name: 'dh2', formula: '*/ h 55 100' },
			{ name: 'yh', formula: '+- dy 0 del' },
			{ name: 'yl', formula: '+- dy del 0' },
			{ name: 'y3', formula: '+- yh yh dh1' },
			{ name: 'y4', formula: '+- yl yl dh2' },
		],
		// Row 0's pair (flat box-top edge, row 0's deflate curve); see module doc.
		top: line('t', 't'),
		bottom: quad('dh1', 'y3', 'dh1'),
	},
	textDeflateInflateDeflate: {
		defaultAdj: 25000,
		gdLst: [
			{ name: 'a', formula: 'pin 3000 adj 47000' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'del', formula: '*/ h 3 100' },
			{ name: 'ey1', formula: '*/ h 30 100' },
			{ name: 'ey2', formula: '*/ h 36 100' },
			{ name: 'ey3', formula: '*/ h 63 100' },
			{ name: 'ey4', formula: '*/ h 70 100' },
			{ name: 'by', formula: '+- b 0 dy' },
			{ name: 'yh1', formula: '+- dy 0 del' },
			{ name: 'yl1', formula: '+- dy del 0' },
			{ name: 'yh2', formula: '+- by 0 del' },
			{ name: 'yl2', formula: '+- by del 0' },
			{ name: 'y1', formula: '+- yh1 yh1 ey1' },
			{ name: 'y2', formula: '+- yl1 yl1 ey2' },
			{ name: 'y3', formula: '+- yh2 yh2 ey3' },
			{ name: 'y4', formula: '+- yl2 yl2 ey4' },
		],
		// Row 0's pair (flat box-top edge, row 0's deflate curve); see module doc.
		top: line('t', 't'),
		bottom: quad('ey1', 'y1', 'ey1'),
	},
	textDeflateTop: {
		defaultAdj: 50000,
		gdLst: [
			{ name: 'a', formula: 'pin 0 adj 93750' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'y1', formula: '+- t dy 0' },
			{ name: 'cp', formula: '+- y1 dy 0' },
		],
		top: quad('t', 'cp', 't'),
		bottom: line('b', 'b'),
	},
	textInflate: {
		defaultAdj: 18750,
		gdLst: [
			{ name: 'a', formula: 'pin 0 adj 20000' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'gd', formula: '*/ dy 1 3' },
			{ name: 'gd0', formula: '+- 0 0 gd' },
			{ name: 'gd1', formula: '+- h 0 gd0' },
			{ name: 'ty', formula: '+- t dy 0' },
			{ name: 'by', formula: '+- b 0 dy' },
			{ name: 'y0', formula: '+- t gd0 0' },
			{ name: 'y1', formula: '+- t gd1 0' },
			{ name: 'x0', formula: '+- l wd3 0' },
			{ name: 'x1', formula: '+- r 0 wd3' },
		],
		top: cubic('ty', 'y0', 'y0', 'ty'),
		bottom: cubic('by', 'y1', 'y1', 'by'),
	},
	textInflateBottom: {
		defaultAdj: 60000,
		gdLst: [
			{ name: 'a', formula: 'pin 60000 adj 100000' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'ty', formula: '+- t dy 0' },
		],
		top: line('t', 't'),
		bottom: quad('ty', 'b', 'ty'),
	},
	textInflateTop: {
		defaultAdj: 40000,
		gdLst: [
			{ name: 'a', formula: 'pin 0 adj 50000' },
			{ name: 'dy', formula: '*/ a h 100000' },
			{ name: 'ty', formula: '+- t dy 0' },
		],
		top: quad('ty', 't', 'ty'),
		bottom: line('b', 'b'),
	},
};
