/**
 * SmartArt DiagramML interpreter - small constraint-lookup helpers shared by
 * the hierarchy orientation/generation-gap modules.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `findByReference`/`resolveAspectRatio`, alongside the fallback constant
 * both consume. Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import type { ConstraintIndex } from './smartart-constraint-solver';
import { resolveConstraint } from './smartart-constraint-solver';
import { findCompositeDescendant } from './smartart-hierarchy-composite-child';

/** COM-verified "Hierarchy" fallback (`h:w`, absent any declared aspect - see `resolveAspectRatio`). */
export const DEFAULT_ASPECT_RATIO = 0.667;

/**
 * A constraint search that only cares about `type`/`referenceType`/`factor` -
 * broader than `findConstraint` (which cannot filter by `referenceType`).
 * Exported for `smartart-hierarchy-generation-gap.ts` too.
 *
 * `preferredName` (SESSION 29): when given, a match whose own `forName`
 * equals it wins over a plain document-order first match - see
 * `resolveAspectRatio`'s own doc comment for why a layoutDef with more than
 * one named item template (`horizontal-multi-level-hierarchy--hier5.pptx`'s
 * own `LevelOneTextNode`/`LevelTwoTextNode`) needs this: a blind first-match
 * silently picks whichever item happens to be declared FIRST in the
 * `hierChild`'s own constrLst, which is the one-off ROOT template here, not
 * the template the vast majority of rendered nodes actually use.
 */
export function findByReference(
	constraints: PptxSmartArtLayoutNode['constraints'],
	type: string,
	referenceType: string,
	preferredName?: string,
): number | undefined {
	const list = constraints ?? [];
	const matches = (c: (typeof list)[number]): boolean =>
		c.type === type && c.referenceType === referenceType && typeof c.factor === 'number';
	if (preferredName !== undefined) {
		const named = list.find((c) => matches(c) && c.forName === preferredName);
		if (named) {
			return named.factor;
		}
	}
	return list.find(matches)?.factor;
}

/**
 * The item's own `h:w` (non-transposed) ratio, read directly from whichever
 * of the two equivalent declarations is present: `h` referencing `w` (a
 * fact IS the ratio - "Hierarchy"'s own shape) or `w` referencing `h` (a
 * fact is the ratio's RECIPROCAL - "Horizontal Hierarchy"'s shape, e.g.
 * `w=2*h` means `h:w=0.5`). Falls back to `DEFAULT_ASPECT_RATIO` when
 * neither is declared (matches every layout examined that omits it).
 *
 * `preferredName` (SESSION 29, optional): the resolved item template's own
 * name (`findHierarchyItemName`/`resolveHierarchyItemNode`) - see
 * `findByReference`'s own doc comment. `undefined` for every caller/fixture
 * with only one named item template keeps this byte-identical to a plain
 * first-match search.
 *
 * Split into `findDirectAspectRatio` (SESSION 38, `undefined` when nothing
 * direct is declared) plus this function's own `DEFAULT_ASPECT_RATIO`
 * fallback, so a caller that has a SECOND, more general fallback of its own
 * (`resolveIndexedAspectRatio` below) can tell "nothing direct declared"
 * apart from "the diagram genuinely declares 0.667" before reaching for it.
 */
export function findDirectAspectRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	preferredName?: string,
): number | undefined {
	const hRefW = findByReference(constraints, 'h', 'w', preferredName);
	if (hRefW !== undefined && hRefW > 0) {
		return hRefW;
	}
	const wRefH = findByReference(constraints, 'w', 'h', preferredName);
	if (wRefH !== undefined && wRefH > 0) {
		return 1 / wRefH;
	}
	return undefined;
}

export function resolveAspectRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	preferredName?: string,
): number {
	return findDirectAspectRatio(constraints, preferredName) ?? DEFAULT_ASPECT_RATIO;
}

/**
 * SESSION 38: when neither `h:w` nor `w:h` is declared as a direct
 * cross-reference (`findDirectAspectRatio` returns `undefined`), some
 * hierarchy layouts instead declare the WRAPPING `composite` node's own
 * `w`/`h` as two INDEPENDENT references (each relative to its own enclosing
 * scope, never to each other) - e.g. `titled-picture-accent-list--
 * hier5.pptx`'s own `rootComposite`: `<dgm:constr type="w" for="des"
 * forName="rootComposite" refType="w" fact="4"/>`, `<dgm:constr type="h"
 * for="des" forName="rootComposite" refType="h"/>` (no `fact`, i.e. `1`) -
 * neither is a cross-type (`h`-references-`w` or vice versa) declaration, so
 * `findDirectAspectRatio`'s own targeted search never matches either one,
 * but the general constraint-chain walker (`resolveConstraint`) resolves
 * BOTH independently against `rootComposite`'s own role (`w -> 4`, `h -> 1`
 * here, both ultimately bottoming out at the implicit whole-diagram unit box
 * `w=h=1`) and their ratio (`1/4 = 0.25`) is the composite's real declared
 * aspect - COM-verified close to the cached drawing's own item box (SESSION
 * 36/38, see `smartart-track-r-successor.md`).
 *
 * `undefined` when `algorithmNode` declares no `composite` descendant at all
 * (e.g. the transposed "Horizontal Hierarchy" family, which never wraps one
 * - see `smartart-hierarchy-composite-child.ts`'s own module doc comment),
 * or that node's own `w`/`h` do not both resolve to a positive number -
 * callers keep falling back to `DEFAULT_ASPECT_RATIO` in either case,
 * unchanged from before this fallback existed.
 */
export function resolveIndexedAspectRatio(
	algorithmNode: PptxSmartArtLayoutNode | undefined,
	index: ConstraintIndex,
): number | undefined {
	const compositeNode = findCompositeDescendant(algorithmNode);
	if (!compositeNode?.name) {
		return undefined;
	}
	const w = resolveConstraint(index, compositeNode.name, 'w');
	const h = resolveConstraint(index, compositeNode.name, 'h');
	if (w === undefined || h === undefined || !(w > 0) || !(h > 0)) {
		return undefined;
	}
	return h / w;
}
