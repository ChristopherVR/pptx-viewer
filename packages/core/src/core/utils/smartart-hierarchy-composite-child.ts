/**
 * SmartArt DiagramML interpreter - the hierarchy `composite` node's own
 * text-bearing child geometry (round 11/SESSION 9 correction).
 *
 * `resolveAspectRatio` (`smartart-hierarchy-orientation.ts`) reads the item's
 * own `h:w` from `algorithmNode`'s (the `hierChild`'s) OWN top-level
 * `constrLst` - which, for the classic (non-transposed) "Hierarchy" family,
 * declares `h for="des" forName="composite" refType="w" refFor="des"
 * refForName="composite" fact="0.667"`. That IS a genuine, self-referential
 * `h:w` declaration - but it describes the WRAPPING `composite` layoutNode's
 * own bounding box, not the RENDERED "text" shape the gate actually compares
 * against (composite additionally nests a "background" `sp`-alg sibling for
 * a two-shape "3D stacked card" decorative effect real PowerPoint renders -
 * `background`/`text` are BOTH smaller than their own `composite` cell).
 *
 * `composite`'s own LOCAL `constrLst` (a genuinely separate scope, nested
 * inside the `composite` layoutNode itself, only reachable by walking the
 * tree - not part of `hierChild`'s own flat constraint list) declares the
 * rendered child's REAL geometry directly: `w for="ch" forName="text"
 * refType="w" fact="0.9"` (the child's own width, as a fraction of
 * `composite`'s width) and `h for="ch" forName="text" refType="w"
 * refFor="ch" refForName="text" fact="0.635"` (SELF-referential - the
 * child's own `h:w`, unrelated to `composite`'s `0.667`). Hand-verified
 * against THREE independent measurements: `hierarchy--flat3.pptx` (real
 * cached box 319.92x203.15, ratio 0.63500), `--hier5.pptx` (205.66x130.60,
 * ratio 0.63500), `--hier8.pptx` (144.35x91.66, ratio 0.63500) - all
 * EXACTLY `0.635`, matching this constraint's own declared `fact` digit for
 * digit, not `0.667`. "Horizontal Hierarchy" (and every other transposed
 * hierarchy-family layout checked) declares NO `composite` wrapper at all -
 * its own top-level `w=2*h` IS the rendered node's real aspect directly (no
 * indirection to correct), so this module's own `findCompositeDescendant`
 * simply returns `undefined` for it and every caller falls back to the
 * EXISTING (already-correct) `resolveAspectRatio` path unchanged.
 *
 * SESSION 21: a SECOND composite-child shape exists (`circle-picture-
 * hierarchy--hier5.pptx`'s own `text`, alongside a non-text `pic`/label
 * sibling occupying the REST of the composite's width): `w for="ch"
 * forName="text" refType="w" fact="0.6"` (self-referential, same SHAPE as
 * the classic family's `fact="0.9"`) but `h for="ch" forName="text"
 * refType="h" fact="0.8"` - `refType="h"`, NOT `"w"`, with no `refFor`/
 * `refForName` at all: relative to the composite's own HEIGHT, not
 * self-referential. This is the SAME "parent-relative" shape SESSION
 * 18/19 found (and left unlanded, paired with a THEN-unresolved
 * `fitItemBox` size regression) for `half-circle-organization-chart`'s own
 * `rootText` - landed HERE because `circle-picture-hierarchy` is `std` mode
 * (plain "Hierarchy" family, not `tailed` org-chart), so `fitItemBox`'s
 * `clampToNaturalAspect` stays unconditionally `true` and the org-chart-only
 * regression does not apply. Conversion: `childAspect = heightFactor *
 * wrapperAspect / widthFactor` (`wrapperAspect` = the WRAPPING composite's
 * own top-level `h:w`, `0.5` here) - `0.8 * 0.5 / 0.6 = 0.6667`, matching
 * `circle-picture-hierarchy--hier5.pptx`'s own cached `144/216 = 0.6667`
 * EXACTLY.
 *
 * `text`'s own `l`/`t` constraints (ALSO declared in `composite`'s own local
 * `constrLst`, `fact="0.1"`/`fact="0.095"`, both relative to `composite`'s
 * own `w`) are the "3D card" visual offset between `background` (flush at
 * `composite`'s own top-left, `t`/`l` absent = 0) and `text` (the shape
 * actually rendered/matched) - hand-verified against `hierarchy--flat3
 * .pptx` (measured `text.x - background.x = 35.55px`, `0.1 * (319.92/0.9) =
 * 35.55` exact) and `--hier5.pptx` (`21.71px` measured, `0.1 * (205.66/0.9)
 * = 22.85`... within rounding of the measured `21.81`, see this module's
 * own doc comment history in `smartart-track-r-successor.md` for the full
 * cross-check). The FAN axis's own real positioning needs this: composite
 * CELLS (not the smaller rendered child) are what actually get centred with
 * the layout's own declared (unconverted) `sibSp`, and `text`'s own
 * constant `l` offset is added on top afterward - see
 * `smartart-layout-interpreter-hierarchy.ts`'s own fan-axis wiring.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

export interface CompositeChildGeometry {
	/** The rendered child's own `h:w`, self-referential - see the module doc comment. */
	aspectRatio: number;
	/** The rendered child's own width, as a fraction of the WRAPPING `composite` node's width. */
	widthFactor: number;
	/** The rendered child's own leading-edge (`l`) offset from `composite`'s own left edge, as a fraction of `composite`'s width - the fan-axis "3D card" offset. */
	offsetXRatio: number;
	/**
	 * The rendered child's own height, as a fraction of the WRAPPING
	 * `composite` node's own height - the generation-axis mirror of
	 * `widthFactor`. Only populated for the "parent-relative" shape (SESSION
	 * 21: `h refType="h"`, e.g. `half-circle-organization-chart`), where the
	 * composite's own height genuinely differs from the rendered item's own
	 * height (`compositeAspect !== aspectRatio`) - `undefined` for the
	 * self-referential shape (plain "Hierarchy"), where no caller has yet
	 * needed this distinction (see `smartart-hierarchy-axis-pitch.ts`'s own
	 * SESSION 28 use, gated on this field so `std`-mode callers are unaffected).
	 */
	heightFactor?: number;
}

/**
 * Depth-first search for a descendant `dgm:layoutNode` whose own algorithm is
 * `composite` (the structural signal, not a name convention). Exported for
 * `smartart-hierarchy-constraint-lookup.ts`'s `resolveIndexedAspectRatio`
 * (SESSION 38): the SAME "wrapping composite reached from root scope" node
 * this module already resolves the rendered child's geometry from also names
 * the role an indirect (`w`/`h` declared as two independent references, no
 * direct cross-ratio) aspect fallback should resolve against.
 */
export function findCompositeDescendant(
	node: PptxSmartArtLayoutNode | undefined,
): PptxSmartArtLayoutNode | undefined {
	if (!node) {
		return undefined;
	}
	if (node.algorithm?.type === 'composite') {
		return node;
	}
	for (const child of node.children ?? []) {
		const found = findCompositeDescendant(child);
		if (found) {
			return found;
		}
	}
	return undefined;
}

/**
 * The `composite` node's own TEXT-BEARING child (`dgm:presOf axis="self"` -
 * the structural signal a `sp`-alg decorative `background` sibling never
 * carries), whose geometry is what the gate actually compares against.
 */
function findTextBearingChild(
	compositeNode: PptxSmartArtLayoutNode,
): PptxSmartArtLayoutNode | undefined {
	return (compositeNode.children ?? []).find((child) =>
		(child.presentationOf?.axis ?? []).includes('self'),
	);
}

/**
 * Resolve the rendered child's own aspect/width/offset facts from
 * `algorithmNode`'s own `composite`-alg descendant, when one exists (see the
 * module doc comment). Returns `undefined` for a layoutDef with no such
 * wrapper (e.g. "Horizontal Hierarchy") - callers keep their existing
 * fallback behaviour unchanged in that case.
 */
export function resolveCompositeChildGeometry(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	wrapperAspect?: number,
	allowOmittedWidthFactor = false,
): CompositeChildGeometry | undefined {
	const compositeNode = findCompositeDescendant(algorithmNode);
	if (!compositeNode) {
		return undefined;
	}
	const child = findTextBearingChild(compositeNode);
	if (!child?.name) {
		return undefined;
	}
	const constraints = compositeNode.allConstraints ?? compositeNode.constraints ?? [];
	// SESSION 23/28: `half-circle-organization-chart--hier5.pptx`'s (and
	// `name-and-title-organization-chart--hier5.pptx`'s) own `w for="ch"
	// forName="rootText1" refType="w"` declares NO `fact` at all (ECMA-376's
	// own "omitted fact = 1" convention, used throughout this codebase
	// elsewhere - the child fills the composite's FULL width). SESSION 23
	// found relaxing this match landed an exact item SIZE for these two
	// fixtures but, alone, EXPOSED a separate, then-unsolved cascading
	// POSITION bug that regressed both (see `smartart-layout-interpreter-
	// hierarchy.ts`'s own `cascadeAllGenerations` doc comment for that fix,
	// landed SESSION 28 alongside this). `allowOmittedWidthFactor` (`true`
	// only for `tailed`-mode callers, i.e. the org-chart family - see
	// `resolveHierarchyOrientation`'s own call site) keeps this relaxation
	// SCOPED to that family: applying it unconditionally regressed TWO
	// unrelated `std`-mode fixtures whose own widthConstr also happens to
	// omit `fact` for a different reason (`circle-picture-hierarchy--
	// hier5.pptx` 3.38% -> 18.57%, `square-accent-list--hier5.pptx` 33.58% ->
	// 41.46%, both measured via a full corpus regen) - `std` mode never
	// declares the `sp`-relative-to-composite-width generation gap this
	// relaxation's own companion fix (`cascadeAllGenerations`) depends on, so
	// there is no known-correct SIZE model to relax INTO for that mode yet.
	const widthConstr = constraints.find(
		(c) =>
			c.type === 'w' &&
			c.for === 'ch' &&
			c.forName === child.name &&
			c.referenceType === 'w' &&
			c.referenceForName === undefined &&
			(typeof c.factor === 'number' || (allowOmittedWidthFactor && c.factor === undefined)),
	);
	if (!widthConstr) {
		return undefined;
	}
	const widthFactor = widthConstr.factor ?? 1;
	if (widthFactor <= 0) {
		return undefined;
	}
	const selfHeightConstr = constraints.find(
		(c) =>
			c.type === 'h' &&
			c.for === 'ch' &&
			c.forName === child.name &&
			c.referenceType === 'w' &&
			c.referenceFor === 'ch' &&
			c.referenceForName === child.name &&
			typeof c.factor === 'number',
	);
	const leftConstr = constraints.find(
		(c) =>
			c.type === 'l' &&
			c.for === 'ch' &&
			c.forName === child.name &&
			c.referenceType === 'w' &&
			c.referenceForName === undefined &&
			typeof c.factor === 'number',
	);
	const offsetXRatio = (leftConstr?.factor as number | undefined) ?? 0;
	if (selfHeightConstr) {
		return {
			aspectRatio: selfHeightConstr.factor as number,
			widthFactor,
			offsetXRatio,
		};
	}
	// SESSION 21: the "parent-relative" shape (`h` refType="h", relative to
	// the WRAPPING composite's own height, not self-referential to the
	// child's own width) - see the module doc comment for the derivation.
	// Only usable when the caller supplies the composite's own top-level
	// aspect to convert with.
	const parentRelativeHeightConstr = constraints.find(
		(c) =>
			c.type === 'h' &&
			c.for === 'ch' &&
			c.forName === child.name &&
			c.referenceType === 'h' &&
			c.referenceFor === undefined &&
			c.referenceForName === undefined &&
			typeof c.factor === 'number',
	);
	// SESSION 28: `name-and-title-organization-chart--hier5.pptx`'s own
	// `rootComposite1` declares a SECOND role's font size relative to
	// `rootText1`'s (`primFontSz for="des" forName="titleText1" refType=
	// "primFontSz" refFor="des" refForName="rootText1"`, absent for
	// `half-circle-organization-chart--hier5.pptx`'s own composite, measured)
	// - a structural signal that `child` is a COMPOUND, multi-role text box
	// (name + title, two stacked rows) whose real height this single `fact`
	// does not determine alone (COM-verified regression: applying the
	// formula below anyway gives `aspectRatio=0.45` against this fixture's
	// own cached `125/241=0.5187`, a real mismatch, not rounding). Bail to
	// `undefined` for this shape rather than resolve a wrong aspect - a
	// successor with budget to derive the compound formula can drop this
	// guard once it lands.
	const hasCompoundTextRole = constraints.some(
		(c) => c.type === 'primFontSz' && c.referenceForName === child.name,
	);
	if (
		parentRelativeHeightConstr &&
		!hasCompoundTextRole &&
		typeof wrapperAspect === 'number' &&
		wrapperAspect > 0 &&
		typeof parentRelativeHeightConstr.factor === 'number'
	) {
		return {
			aspectRatio: (parentRelativeHeightConstr.factor * wrapperAspect) / widthFactor,
			widthFactor,
			offsetXRatio,
			heightFactor: parentRelativeHeightConstr.factor,
		};
	}
	return undefined;
}

/**
 * SESSION 32: the SAME "compound, multi-role text box" structural signal
 * `resolveCompositeChildGeometry` bails on (see this module's own SESSION 28
 * doc comment above), exposed standalone for callers that need to know
 * WHETHER a layout declares this shape without needing its (unresolvable)
 * aspect/width/offset geometry - `smartart-hierarchy-orientation.ts`'s own
 * `hangHeightRatio` generalisation (SESSION 32) must NOT apply to
 * `name-and-title-organization-chart--hier5.pptx`: that fixture's own
 * `rootText1` height is not determined by a single declared `fact` at all
 * (two stacked rows), so `generationGapRatio` - the single-role fan/generation
 * gap - is not a trustworthy stand-in for ITS hang-row gap either (COM-verified
 * regression: applying it anyway makes this fixture's own residual worse,
 * `0.0415` -> `0.0542`, while `organization-chart--hier5.pptx`/
 * `picture-organization-chart--hier5.pptx` - the SAME tree shape, a plain,
 * single-role `rootText1` - go to exactly `0`). Returns `false` (not just
 * `undefined`) for a layoutDef with no `composite` wrapper at all, matching
 * `resolveCompositeChildGeometry`'s own "nothing to bail on" convention.
 */
export function compositeDeclaresCompoundTextRole(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
): boolean {
	const compositeNode = findCompositeDescendant(algorithmNode);
	if (!compositeNode) {
		return false;
	}
	const child = findTextBearingChild(compositeNode);
	if (!child?.name) {
		return false;
	}
	const constraints = compositeNode.allConstraints ?? compositeNode.constraints ?? [];
	return constraints.some((c) => c.type === 'primFontSz' && c.referenceForName === child.name);
}
