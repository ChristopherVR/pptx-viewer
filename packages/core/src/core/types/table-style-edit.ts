/**
 * Types for editing an existing `ppt/tableStyles.xml` (`a:tblStyleLst`)
 * natively: per-section patches, table-background fill references, and the
 * `a:tblPr`-own effect chain.
 *
 * Split out of `table.ts` (which is already large) so new table-STYLE-EDIT
 * types have a home that does not keep growing the parse-model file.
 *
 * @module pptx-types/table-style-edit
 */
import type { XmlObject } from './common';
import type { ParsedTableStyleFill } from './table';

/**
 * A `a:fillRef`/`a:lnRef`/`a:effectRef`-style style-matrix reference: an
 * index into the theme's format scheme (`a:fmtScheme/a:fillStyleLst`, 1-based
 * per ECMA-376 §20.1.4.1.12) plus an optional colour transform child.
 *
 * Distinct from an already-resolved {@link ParsedTableStyleFill}: a fill ref
 * points AT a theme style-matrix entry rather than carrying a colour choice
 * directly, though the two commonly appear together (`<a:fillRef idx="2">
 * <a:schemeClr val="accent1"/></a:fillRef>`).
 *
 * @example
 * ```ts
 * const ref: ParsedTableFillRef = { idx: 2, color: { schemeColor: 'accent1' } };
 * // => satisfies ParsedTableFillRef
 * ```
 */
export interface ParsedTableFillRef {
	/** 1-based index into the theme format scheme's fill style list. */
	idx: number;
	/** Colour transform child (`a:schemeClr`/`a:srgbClr`) applied to the referenced style. */
	color?: ParsedTableStyleFill;
}

/**
 * One leaf (or `effectDag`-wrapped) node of an `a:effectLst`/`a:effectDag`
 * effect chain, kept mostly opaque: {@link kind} names the OOXML element so a
 * consumer can recognise common effects (`outerShdw`, `glow`, `softEdge`,
 * `reflection`, `blur`, `innerShdw`, `prstShdw`, `fillOverlay`, `alphaModFix`,
 * `alphaInv`, `grayscl`, `biLevel`, `duotone`, `hsl`, `lum`, `tint`) without
 * this module re-deriving the full shape-effect taxonomy already modelled on
 * `ShapeStyle`; {@link xml} preserves the node verbatim for lossless re-emit.
 *
 * @example
 * ```ts
 * const effect: ParsedTableStyleEffect = {
 *   kind: 'outerShdw',
 *   xml: { '@_blurRad': '40000', '@_dist': '20000', '@_dir': '5400000' },
 * };
 * // => satisfies ParsedTableStyleEffect
 * ```
 */
export interface ParsedTableStyleEffect {
	/** The OOXML element's local name, e.g. `outerShdw`, `glow`, `softEdge`. */
	kind: string;
	/** Verbatim XML node (attributes + children) for lossless round-trip. */
	xml: XmlObject;
}

/**
 * A patch to apply to ONE `CT_TableStyle` section (`a:wholeTbl`, `a:band1H`,
 * `a:firstRow`, a corner cell, ...) when editing an existing table style.
 * Every field is independently optional: an absent field leaves that facet
 * of the section untouched, `null` (currently only supported for
 * {@link fill}/{@link text}/{@link borders}/{@link cell3D} at the top level)
 * is not accepted here (delete a whole style with
 * `deleteTableStyleFromMap` / `tableStylesToDelete` instead of clearing every
 * facet of every section).
 *
 * @example
 * ```ts
 * const patch: TableStyleSectionPatch = {
 *   fill: { schemeColor: 'accent2', tint: 40000 },
 *   text: { bold: true },
 * };
 * // => satisfies TableStyleSectionPatch
 * ```
 */
export interface TableStyleSectionPatch {
	fill?: import('./table').ParsedTableStyleFill;
	text?: import('./table').ParsedTableStyleText;
	borders?: import('./table').ParsedTableStyleBorders;
	cell3D?: import('./table').PptxTableCell3D;
}

/**
 * Options for creating a brand-new `a:tblStyle` entry with
 * `createTableStyleEntry` (`packages/core/.../table-style-editor.ts`).
 *
 * @example
 * ```ts
 * const opts: CreateTableStyleOptions = { styleName: 'My Custom Style' };
 * // => satisfies CreateTableStyleOptions
 * ```
 */
export interface CreateTableStyleOptions {
	/** Display name for the new style (`a:tblStyle/@styleName`). */
	styleName: string;
	/**
	 * An existing entry to deep-clone section-by-section as the starting
	 * point (all fill/text/border/cell3D/background sections), with a fresh
	 * `styleId` substituted in. Omit for a blank style with no sections.
	 */
	basedOn?: import('./table').ParsedTableStyleEntry;
	/**
	 * Explicit style GUID (braced, e.g. `{...}`). When omitted a new GUID is
	 * generated (`globalThis.crypto.randomUUID()` when available).
	 */
	styleId?: string;
}
