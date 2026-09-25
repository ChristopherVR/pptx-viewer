/**
 * PowerPoint's 28 built-in Picture Styles (Picture Format > Picture Styles),
 * in the gallery's own order, as PowerPoint writes them.
 *
 * COM-VERIFIED: every entry is transcribed from the `p:pic/p:spPr` PowerPoint
 * wrote after `scripts/capture-picture-styles-com.ps1` invoked the tile
 * through UI Automation (the object model has no picture-style API). Values
 * are the raw OOXML ones (EMU, 60000ths of a degree, 1000ths of a percent),
 * so a catalogue line reads exactly like the captured XML.
 *
 * The first 16 entries are here, the rest in `picture-styles-catalog-tail.ts`.
 *
 * @module render/ribbon-galleries/picture-styles-catalog
 */
import { PICTURE_STYLES_TAIL } from './picture-styles-catalog-tail';
import type { PictureStyleSpec } from './picture-styles-spec';
import {
	BLACK_40,
	FRAME_SHADOW,
	MATTE_BEVEL,
	METAL_3D,
	METAL_SCENE,
	THIN_WHITE_BEVEL,
	TWO_PT,
	TWO_PT_78,
	WHITE_MAT,
} from './picture-styles-spec';

export const PICTURE_STYLES: readonly PictureStyleSpec[] = [
	{
		key: 'simpleFrameWhite',
		label: 'Simple Frame, White',
		geom: 'rect',
		fill: WHITE_MAT,
		line: { w: 88900, cap: 'sq', color: '#FFFFFF', miter: true },
		outer: FRAME_SHADOW,
		scene: TWO_PT,
		sp3d: THIN_WHITE_BEVEL,
	},
	{
		key: 'beveledMatteWhite',
		label: 'Beveled Matte, White',
		geom: 'rect',
		fill: WHITE_MAT,
		line: { w: 190500, cap: 'rnd', color: '#FFFFFF' },
		outer: { blur: 50000, algn: 'tl', color: '#000000 alpha:41000' },
		scene: TWO_PT_78,
		sp3d: MATTE_BEVEL,
	},
	{
		key: 'metalFrame',
		label: 'Metal Frame',
		geom: 'rect',
		line: { w: 190500, cap: 'sq', color: '#C8C6BD', dash: true, miter: true },
		outer: { blur: 254000, algn: 'bl', color: '#000000 alpha:43000' },
		scene: METAL_SCENE(2100000),
		sp3d: METAL_3D('#000000'),
	},
	{
		key: 'dropShadowRectangle',
		label: 'Drop Shadow Rectangle',
		geom: 'rect',
		line: null,
		outer: { blur: 292100, dist: 139700, dir: 2700000, algn: 'tl', color: '#333333 alpha:65000' },
	},
	{
		key: 'reflectedRoundedRectangle',
		label: 'Reflected Rounded Rectangle',
		geom: 'roundRect',
		adj: { adj: 8594 },
		fill: WHITE_MAT,
		line: null,
		reflection: { stA: 38000, endPos: 28000 },
	},
	{
		key: 'softEdgeRectangle',
		label: 'Soft Edge Rectangle',
		geom: 'rect',
		line: null,
		softEdge: 112500,
	},
	{
		key: 'doubleFrameBlack',
		label: 'Double Frame, Black',
		geom: 'rect',
		line: { w: 228600, cap: 'sq', cmpd: 'thickThin', color: '#000000', dash: true, miter: true },
		innerBlur: 76200,
	},
	{
		key: 'thickMatteBlack',
		label: 'Thick Matte, Black',
		geom: 'rect',
		fill: '#000000 shade:95000',
		line: { w: 444500, cap: 'sq', color: '#000000', miter: true },
		outer: { blur: 254000, dist: 190500, dir: 2700000, sy: 90000, algn: 'bl', color: BLACK_40 },
	},
	{
		key: 'simpleFrameBlack',
		label: 'Simple Frame, Black',
		geom: 'rect',
		line: { w: 38100, cap: 'sq', color: '#000000', dash: true, miter: true },
		outer: { blur: 50800, dist: 38100, dir: 2700000, algn: 'tl', color: '#000000 alpha:43000' },
	},
	{
		key: 'beveledOvalBlack',
		label: 'Beveled Oval, Black',
		geom: 'ellipse',
		line: { w: 63500, cap: 'rnd', color: '#333333' },
		outer: {
			blur: 381000,
			dist: 292100,
			dir: 5400000,
			sx: -80000,
			sy: -18000,
			color: '#000000 alpha:22000',
		},
		scene: { camera: 'orthographicFront', rig: 'contrasting', rigRev: 3000000 },
		sp3d: { bevelW: 95250, bevelH: 31750, contourW: 7620, contourClr: '#333333' },
	},
	{
		key: 'compoundFrameBlack',
		label: 'Compound Frame, Black',
		geom: 'rect',
		line: { w: 88900, cap: 'sq', cmpd: 'thickThin', color: '#000000', dash: true, miter: true },
		innerBlur: 76200,
	},
	{
		key: 'moderateFrameBlack',
		label: 'Moderate Frame, Black',
		geom: 'rect',
		line: { w: 127000, cap: 'sq', color: '#000000', miter: true },
		outer: { blur: 57150, dist: 50800, dir: 2700000, algn: 'tl', color: BLACK_40 },
	},
	{
		key: 'centerShadowRectangle',
		label: 'Center Shadow Rectangle',
		geom: 'rect',
		line: null,
		outer: { blur: 190500, algn: 'tl', color: '#000000 alpha:70000' },
	},
	{
		key: 'roundedDiagonalCornerWhite',
		label: 'Rounded Diagonal Corner, White',
		geom: 'round2DiagRect',
		adj: { adj1: 16667, adj2: 0 },
		line: { w: 88900, cap: 'sq', color: '#FFFFFF', miter: true },
		outer: { blur: 254000, algn: 'tl', color: '#000000 alpha:43000' },
	},
	{
		key: 'snipDiagonalCornerWhite',
		label: 'Snip Diagonal Corner, White',
		geom: 'snip2DiagRect',
		fill: WHITE_MAT,
		line: { w: 88900, cap: 'sq', color: '#FFFFFF', miter: true },
		outer: { blur: 88900, algn: 'tl', color: '#000000 alpha:45000' },
		scene: TWO_PT,
		sp3d: THIN_WHITE_BEVEL,
	},
	{
		key: 'moderateFrameWhite',
		label: 'Moderate Frame, White',
		geom: 'rect',
		fill: WHITE_MAT,
		line: { w: 190500, cap: 'sq', color: '#FFFFFF', miter: true },
		outer: FRAME_SHADOW,
		scene: TWO_PT,
		sp3d: THIN_WHITE_BEVEL,
	},
	...PICTURE_STYLES_TAIL,
];
