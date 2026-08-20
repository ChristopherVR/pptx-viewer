/**
 * Practical node-count bounds per SmartArt layout category.
 *
 * Thin re-export shim over the single shared implementation in
 * `pptx-viewer-shared` (`packages/shared/src/render/smartart-node-limits.ts`).
 * The bounds table, its predicates, and the tooltip-text builder are pure,
 * framework-free decision functions consumed identically by React, Vue and
 * Angular; keep changes to the bounds table in the shared module so all three
 * bindings stay in sync.
 *
 * @module smartart-node-limits
 */
export {
	DEFAULT_BOUNDS,
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	describeSmartArtBounds,
	getSmartArtNodeBounds,
} from 'pptx-viewer-shared';
export type { SmartArtNodeBounds } from 'pptx-viewer-shared';
