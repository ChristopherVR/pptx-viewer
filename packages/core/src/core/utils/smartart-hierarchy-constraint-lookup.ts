/**
 * SmartArt DiagramML interpreter - small constraint-lookup helpers shared by
 * the hierarchy orientation/generation-gap modules.
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `findByReference`/`resolveAspectRatio`, alongside the fallback constant
 * both consume. Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';

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
 */
export function resolveAspectRatio(
	constraints: PptxSmartArtLayoutNode['constraints'],
	preferredName?: string,
): number {
	const hRefW = findByReference(constraints, 'h', 'w', preferredName);
	if (hRefW !== undefined && hRefW > 0) {
		return hRefW;
	}
	const wRefH = findByReference(constraints, 'w', 'h', preferredName);
	if (wRefH !== undefined && wRefH > 0) {
		return 1 / wRefH;
	}
	return DEFAULT_ASPECT_RATIO;
}
