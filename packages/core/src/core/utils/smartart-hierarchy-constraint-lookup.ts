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

/** A constraint search that only cares about `type`/`referenceType`/`factor` - broader than `findConstraint` (which cannot filter by `referenceType`). Exported for `smartart-hierarchy-generation-gap.ts` too. */
export function findByReference(
	constraints: PptxSmartArtLayoutNode['constraints'],
	type: string,
	referenceType: string,
): number | undefined {
	const match = (constraints ?? []).find(
		(c) => c.type === type && c.referenceType === referenceType && typeof c.factor === 'number',
	);
	return match?.factor;
}

/**
 * The item's own `h:w` (non-transposed) ratio, read directly from whichever
 * of the two equivalent declarations is present: `h` referencing `w` (a
 * fact IS the ratio - "Hierarchy"'s own shape) or `w` referencing `h` (a
 * fact is the ratio's RECIPROCAL - "Horizontal Hierarchy"'s shape, e.g.
 * `w=2*h` means `h:w=0.5`). Falls back to `DEFAULT_ASPECT_RATIO` when
 * neither is declared (matches every layout examined that omits it).
 */
export function resolveAspectRatio(constraints: PptxSmartArtLayoutNode['constraints']): number {
	const hRefW = findByReference(constraints, 'h', 'w');
	if (hRefW !== undefined && hRefW > 0) {
		return hRefW;
	}
	const wRefH = findByReference(constraints, 'w', 'h');
	if (wRefH !== undefined && wRefH > 0) {
		return 1 / wRefH;
	}
	return DEFAULT_ASPECT_RATIO;
}
