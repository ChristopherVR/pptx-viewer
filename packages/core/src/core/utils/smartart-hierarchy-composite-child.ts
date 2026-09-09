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
}

/** Depth-first search for a descendant `dgm:layoutNode` whose own algorithm is `composite` (the structural signal, not a name convention). */
function findCompositeDescendant(
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
	const widthConstr = constraints.find(
		(c) =>
			c.type === 'w' &&
			c.for === 'ch' &&
			c.forName === child.name &&
			c.referenceType === 'w' &&
			c.referenceForName === undefined &&
			typeof c.factor === 'number',
	);
	const heightConstr = constraints.find(
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
	if (
		!widthConstr ||
		!heightConstr ||
		widthConstr.factor === undefined ||
		widthConstr.factor <= 0
	) {
		return undefined;
	}
	return {
		aspectRatio: heightConstr.factor as number,
		widthFactor: widthConstr.factor,
		offsetXRatio: (leftConstr?.factor as number | undefined) ?? 0,
	};
}
