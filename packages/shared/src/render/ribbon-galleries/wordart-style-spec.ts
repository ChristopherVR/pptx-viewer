/**
 * The shape of a WordArt style entry (see `wordart-styles-catalog.ts`).
 *
 * @module render/ribbon-galleries/wordart-style-spec
 */

/** A solid colour spec, or a linear gradient `[[pos, colour], ...]` at `ang`. */
export type WordArtPaint =
	| string
	| { stops: ReadonlyArray<readonly [number, string]>; ang: number };

/** `[blurRad, dist, dir, colour]` of an outer or inner shadow. */
export type WordArtShadow = readonly [number, number, number, string];

export interface WordArtBody3d {
	rig: string;
	rigDir: string;
	/** `a:lightRig/a:rot/@rev`. */
	rev?: number;
	extrusionH?: number;
	contourW?: number;
	material?: string;
	bevel: { prst?: string; w: number; h: number };
	contour: string;
}

export interface WordArtStyleSpec {
	label: string;
	b?: boolean;
	spc?: number;
	caps?: boolean;
	/** `a:ln`: width (EMU), compound, fill; omitted fields were not written. */
	ln?: { w?: number; cmpd?: 'dbl'; fill?: WordArtPaint };
	fill: WordArtPaint | 'none';
	outer?: WordArtShadow;
	inner?: WordArtShadow;
	glow?: readonly [number, string];
	reflection?: { blur: number; stA: number; endPos: number; dist: number; algn?: 'bl' };
	body3d?: WordArtBody3d;
}

export const LIN = 5400000;

/** A linear gradient paint at `ang` through `stops`. */
export function grad(ang: number, ...stops: Array<readonly [number, string]>): WordArtPaint {
	return { stops, ang };
}
