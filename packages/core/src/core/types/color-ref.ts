/**
 * Theme colour references: the typed counterpart of `<a:schemeClr>`.
 *
 * A colour picked from the theme palette is remembered as a scheme slot plus
 * PowerPoint's luminance variants rather than as the sRGB it currently
 * resolves to, so a later theme change re-colours the shape (and a saved file
 * keeps `<a:schemeClr>` instead of a canonical `<a:srgbClr>`).
 *
 * @module types/color-ref
 */

/**
 * The scheme slot names `a:schemeClr/@val` accepts (ECMA-376 `ST_SchemeColorIndex`).
 * `bg1`/`tx1`/`bg2`/`tx2` are the colour-map aliases a slide resolves through
 * `p:clrMap`; `phClr` is the placeholder colour used inside a theme's style
 * matrix and is never chosen from a picker.
 */
export type PptxThemeColorSchemeName =
	| 'dk1'
	| 'lt1'
	| 'dk2'
	| 'lt2'
	| 'accent1'
	| 'accent2'
	| 'accent3'
	| 'accent4'
	| 'accent5'
	| 'accent6'
	| 'hlink'
	| 'folHlink'
	| 'bg1'
	| 'tx1'
	| 'bg2'
	| 'tx2'
	| 'phClr';

/** The ten palette columns PowerPoint's "Theme Colors" grid shows, in order. */
export const THEME_COLOR_PALETTE_COLUMNS: readonly PptxThemeColorSchemeName[] = [
	'bg1',
	'tx1',
	'bg2',
	'tx2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
];

/**
 * A theme colour choice. Every transform is a 0..1 fraction of the OOXML
 * percentage (`lumMod val="20000"` is `lumMod: 0.2`), matching how the parser
 * reads them, and is applied in the order `a:schemeClr` children are written:
 * `tint`, `shade`, `lumMod`, `lumOff`, `alpha`.
 */
export interface PptxThemeColorRef {
	scheme: PptxThemeColorSchemeName;
	/** `a:lumMod`: multiply HSL luminance (PowerPoint's "Lighter/Darker" rows). */
	lumMod?: number;
	/** `a:lumOff`: add to HSL luminance after `lumMod` ("Lighter N%" rows). */
	lumOff?: number;
	/** `a:tint`: blend towards white. */
	tint?: number;
	/** `a:shade`: blend towards black. */
	shade?: number;
	/** `a:alpha`: opacity fraction (1 = opaque). */
	alpha?: number;
}
