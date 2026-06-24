/**
 * SmartArt editing utilities.
 *
 * Provides add/remove/reorder operations on SmartArt data-model nodes
 * with automatic reflow of the in-memory diagram structure.
 *
 * All mutation functions return a new `PptxSmartArtData` object (immutable)
 * and clear `drawingShapes` so that the renderer falls back to the
 * algorithmic layout engine, which automatically reflows positions.
 *
 * This module re-exports from focused sub-modules:
 * - `smartart-editing-node-ops` - Node CRUD, reorder, promote, demote
 * - `smartart-editing-reflow` - Reflow dispatcher and basic layouts
 * - `smartart-editing-reflow-layouts` - Specialised reflow layout algorithms
 *
 * @module smartart-editing
 */

// ── Node operations ──────────────────────────────────────────────────────

export {
	resetSmartArtEditCounter,
	addSmartArtNode,
	removeSmartArtNode,
	updateSmartArtNodeText,
	reorderSmartArtNode,
	promoteSmartArtNode,
	demoteSmartArtNode,
	addSmartArtNodeAsChild,
	reorderSmartArtNodeToIndex,
} from './smartart-editing-node-ops';

export { setSmartArtNodeStyle } from './smartart-editing-node-style';

// ── Layout reflow ────────────────────────────────────────────────────────

export {
	reflowSmartArtLayout,
	resolveLayoutCategory,
	type ReflowedNodePosition,
} from './smartart-editing-reflow';

// ── Individual reflow layouts (re-exported for direct access) ────────────

export {
	reflowCycle,
	reflowMatrix,
	reflowPyramid,
	reflowFunnel,
	reflowTarget,
	reflowGear,
	reflowVenn,
	reflowTimeline,
	reflowRelationship,
	reflowChevron,
	reflowBending,
} from './smartart-editing-reflow-layouts';
