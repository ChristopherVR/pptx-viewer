/**
 * SmartArt DiagramML interpreter - the `HierarchyOrientation` descriptor.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * the interface itself, alongside its own field-by-field doc comments.
 * `resolveHierarchyOrientation` (that module) is the only producer; every
 * other consumer imports the type from here or the re-export there.
 *
 * Pure types; no runtime code.
 */
export interface HierarchyOrientation {
	/** True when the fan axis is Y (siblings stack vertically) and generations stack along X. */
	transposed: boolean;
	sibSpRatio: number;
	/** `h:w` when `!transposed`; the axes are swapped inside `arrangeHierarchy` when `transposed`, so this is always the ratio to apply to the FAN-axis size to get the CROSS-axis size in "logical" (post-swap) space. */
	aspectRatio: number;
	/** Generation-to-generation gap the DECLARED `sp` fact, no `composite`-cell correction applied - see `smartart-hierarchy-generation-gap.ts`. Used by `fitItemBox` to SIZE the item; that solve already matched cached geometry with this raw value, see the call site's own comment. */
	generationGapRatio: number;
	/** The SAME gap, `composite`-cell-corrected (mirrors `compositeWidthFactor`'s own cell-vs-item split on the fan axis) - used by `computeHierarchyAxisPitches` to POSITION composite cells, the ones actually centred/pitched. Identical to `generationGapRatio` whenever no `composite` wrapper is declared (every `tailed`/`transposed` layout checked). */
	compositeGenerationGapRatio: number;
	/**
	 * SESSION 32: the per-hang-row gap ratio a `tailed` hierarchy's SIZING
	 * (`fitItemBox`) and POSITIONING (`smartart-hierarchy-standard.ts`'s own
	 * hang transition, `smartart-hierarchy-axis-pitch.ts`'s own `fanHeight`
	 * reservation - all three MUST move together, see their own SESSION 32 doc
	 * comments) use for the gap between the last fanned generation and the
	 * first hanging row. Normally identical to `generationGapRatio` (COM-
	 * verified: `organization-chart--hier5.pptx`'s own raw `dsp:sp` offsets
	 * show the SAME gap ratio governs both the fan->fan AND fan->hang
	 * transitions) - `undefined` only for the rare "compound, multi-role text
	 * box" shape (`smartart-hierarchy-composite-child.ts`'s own
	 * `compositeDeclaresCompoundTextRole`, e.g. `name-and-title-organization-
	 * chart`), where `generationGapRatio` is not a trustworthy stand-in
	 * (COM-verified regression otherwise), so callers fall back to the fixed
	 * `HANG_HEIGHT_RATIO` measured constant instead.
	 */
	hangHeightRatio: number | undefined;
	/** Outer margin (fraction of the effective box) on the FAN axis - see `OUTER_MARGIN_X_RATIO`'s doc comment: 0 when `transposed`. */
	marginXRatio: number;
	/** Outer margin (fraction of the effective box) on the GENERATION axis - see `OUTER_MARGIN_X_RATIO`'s doc comment: 0 when `transposed`. */
	marginYRatio: number;
	/**
	 * The rendered item's own width as a fraction of the WRAPPING `composite`
	 * cell's width, when the layout declares one (`smartart-hierarchy-
	 * composite-child.ts`'s own `widthFactor`) - `undefined` for a layoutDef
	 * with no such wrapper (e.g. "Horizontal Hierarchy"). The FAN axis needs
	 * to centre `composite` CELLS (not the smaller rendered item) using the
	 * layout's own unconverted `sibSpRatio` - see `smartart-layout-
	 * interpreter-hierarchy.ts`'s own fan-axis wiring.
	 */
	compositeWidthFactor?: number;
	/**
	 * The generation-axis mirror of `compositeWidthFactor` - the rendered
	 * item's own height as a fraction of the WRAPPING `composite` cell's own
	 * height, when the layout's own "parent-relative" shape declares one
	 * (`smartart-hierarchy-composite-child.ts`'s own `heightFactor`, SESSION
	 * 28) - `undefined` otherwise (including the self-referential composite
	 * shape, where no caller has yet needed the distinction).
	 */
	compositeHeightFactor?: number;
	/**
	 * SESSION 32: the rendered item's TRUE height, as a ratio of `fitItemBox`'s
	 * own `widthFit` (the WRAPPING `composite` cell's width, un-shrunk - see
	 * `fitItemBox`'s own doc comment on `compositeChainHeightRatio`), for the
	 * "parent-relative" composite-child shape only (`compositeHeightFactor`
	 * defined - e.g. `circle-picture-hierarchy`): `compositeAspect *
	 * compositeHeightFactor` (`composite.h = compositeW * compositeAspect`,
	 * `renderedItem.h = composite.h * compositeHeightFactor`). `undefined`
	 * whenever `compositeHeightFactor` is (every other layout, including the
	 * self-referential composite shape - "Hierarchy" itself), so `fitItemBox`
	 * keeps its existing `heightFit`-clamped sizing for every other caller.
	 */
	compositeChainHeightRatio?: number;
	/**
	 * The rendered item's own constant "3D card" offset from its `composite`
	 * cell's own leading edge, as a fraction of the `composite` cell's width
	 * - 0 when no `composite` wrapper is declared (nothing to offset from).
	 */
	cardOffsetXRatio: number;
}
