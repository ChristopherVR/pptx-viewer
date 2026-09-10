/**
 * SmartArt DiagramML interpreter - the TRANSPOSED branch of
 * `resolveHierarchyOrientation` ("Horizontal Hierarchy" and its siblings).
 *
 * Split out of `smartart-hierarchy-orientation.ts` (the file-size budget):
 * `buildTransposedOrientation`, the `HierarchyOrientation` this construct
 * resolves to - see that module's own doc comment for the declarative
 * signal deciding whether a hierarchy takes this branch at all.
 *
 * Pure geometry/constraint reading; no framework code.
 */

import type { PptxSmartArtLayoutNode } from '../types';
import { DEFAULT_ASPECT_RATIO, resolveAspectRatio } from './smartart-hierarchy-constraint-lookup';
import { resolveGenerationGapRatio } from './smartart-hierarchy-generation-gap';
import type { HierarchyOrientation } from './smartart-hierarchy-orientation-types';

/**
 * The fan axis's own size is `h`; the stacking axis is `w`, and the item's
 * cross-axis (logical "cross") size comes from `w:h` resolved as a ratio TO
 * `h` (i.e. `w = aspectRatio * h`), which `resolveAspectRatio` already gives
 * as `h:w` - inverted here so callers always multiply the fan-axis size to
 * get the cross size.
 */
export function buildTransposedOrientation(
	constraints: PptxSmartArtLayoutNode['constraints'],
	itemShapeName: string | undefined,
	sibSpRatio: number,
): HierarchyOrientation {
	const hToW = resolveAspectRatio(constraints, itemShapeName);
	return {
		transposed: true,
		sibSpRatio,
		aspectRatio: hToW > 0 ? 1 / hToW : 1 / DEFAULT_ASPECT_RATIO,
		generationGapRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
		// A transposed hierarchy declares no `composite` wrapper (see below),
		// so there is no cell-vs-item distinction to make: identical to
		// `generationGapRatio` above. `computeHierarchyAxisPitches` never
		// actually reads this field when `transposed` (see its own doc
		// comment), so the exact value here is inert either way.
		compositeGenerationGapRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
		// See `OUTER_MARGIN_X_RATIO`'s doc comment (`smartart-hierarchy-
		// orientation.ts`): a transposed hierarchy needs no outer margin at
		// all on either axis, COM-verified.
		marginXRatio: 0,
		marginYRatio: 0,
		// A transposed hierarchy declares no `composite` wrapper (see
		// `smartart-hierarchy-composite-child.ts`'s own module doc comment) -
		// nothing to correct or offset from, and no parent-relative shape to
		// chain through either.
		compositeChainHeightRatio: undefined,
		// SESSION 25 already substituted `generationGapRatio` for the
		// transposed case (see `HierarchyOrientation.hangHeightRatio`'s own
		// SESSION 32 doc comment) - no compound-role guard needed here, no
		// transposed fixture in the corpus declares that shape.
		hangHeightRatio: resolveGenerationGapRatio(constraints, 'w', hToW),
		cardOffsetXRatio: 0,
	};
}
