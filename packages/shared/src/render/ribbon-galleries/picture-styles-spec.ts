/**
 * Types and shared building blocks of the Picture Styles catalogue
 * (`picture-styles-catalog.ts`). Values are the raw OOXML ones (EMU, 60000ths
 * of a degree, 1000ths of a percent) so a catalogue line reads exactly like
 * the XML PowerPoint writes.
 *
 * @module render/ribbon-galleries/picture-styles-spec
 */
import type { ShapeStyle } from 'pptx-viewer-core';

/** `a:ln`: width (EMU), cap, compound type, colour spec, prstDash solid, miter join. */
export interface PictureStyleLine {
	w: number;
	cap: 'sq' | 'rnd';
	cmpd?: 'thickThin';
	color: string;
	dash?: true;
	miter?: true;
}

/** `a:outerShdw` (raw attributes; colour as a colour spec). */
export interface PictureStyleOuterShadow {
	blur: number;
	dist?: number;
	dir?: number;
	sx?: number;
	sy?: number;
	kx?: number;
	ky?: number;
	algn?: NonNullable<ShapeStyle['shadowAlignment']>;
	color: string;
}

/** `a:scene3d`: camera preset, fov, camera rot [lat, lon, rev], light rig and its rev. */
export interface PictureStyleScene {
	camera: string;
	fov?: number;
	rot?: readonly [number, number, number];
	rig: string;
	rigRev?: number;
}

/** `a:sp3d` with its `a:bevelT`. */
export interface PictureStyleShape3d {
	bevelW?: number;
	bevelH: number;
	bevelPrst?: string;
	contourW?: number;
	contourClr?: string;
	material?: string;
	extrusionH?: number;
	extrusionClr?: string;
}

export interface PictureStyleSpec {
	key: string;
	label: string;
	/** `a:prstGeom/@prst` and its `a:avLst` guides. */
	geom: string;
	adj?: Readonly<Record<string, number>>;
	/** `a:solidFill` colour spec (see `gallery-color-spec.ts`), when written. */
	fill?: string;
	/** `a:ln`; `null` is `<a:ln><a:noFill/></a:ln>`. */
	line: PictureStyleLine | null;
	outer?: PictureStyleOuterShadow;
	/** `a:innerShdw` blur radius (EMU), black, no offset. */
	innerBlur?: number;
	/** `a:reflection` stA / endPos (blurRad 12700, dist 5000, dir 90deg, sy -100%, bl). */
	reflection?: { stA: number; endPos: number };
	/** `a:softEdge/@rad` (EMU). */
	softEdge?: number;
	scene?: PictureStyleScene;
	sp3d?: PictureStyleShape3d;
}

export const WHITE_MAT = '#FFFFFF shade:85000';
export const BLACK_40 = '#000000 alpha:40000';
export const TWO_PT: PictureStyleScene = {
	camera: 'orthographicFront',
	rig: 'twoPt',
	rigRev: 7200000,
};
export const TWO_PT_78: PictureStyleScene = {
	camera: 'orthographicFront',
	rig: 'twoPt',
	rigRev: 7800000,
};
export const THIN_WHITE_BEVEL: PictureStyleShape3d = {
	bevelW: 25400,
	bevelH: 19050,
	contourClr: '#FFFFFF',
};
export const MATTE_BEVEL: PictureStyleShape3d = {
	bevelW: 50800,
	bevelH: 16510,
	contourW: 6350,
	contourClr: '#C0C0C0',
};
export const METAL_SCENE = (rigRev: number): PictureStyleScene => ({
	camera: 'perspectiveFront',
	fov: 5400000,
	rig: 'threePt',
	rigRev,
});
export const METAL_3D = (extrusionClr: string): PictureStyleShape3d => ({
	bevelW: 304800,
	bevelH: 152400,
	bevelPrst: 'hardEdge',
	extrusionH: 25400,
	extrusionClr,
});
export const METAL_LINE: PictureStyleLine = { w: 190500, cap: 'rnd', color: '#C8C6BD', dash: true };
export const FRAME_SHADOW: PictureStyleOuterShadow = {
	blur: 55000,
	dist: 18000,
	dir: 5400000,
	algn: 'tl',
	color: BLACK_40,
};
export const REFLECTED_BEVEL_SCENE: PictureStyleScene = {
	camera: 'orthographicFront',
	rig: 'threePt',
	rigRev: 2700000,
};
