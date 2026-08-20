/**
 * Pure keyboard / reorder handlers for the SmartArt text pane.
 *
 * Thin re-export shim over the single shared implementation in
 * `pptx-viewer-shared` (`packages/shared/src/render/smartart-node-pane-handlers.ts`).
 * All functions delegate to the core editing ops (which rewire connections and
 * clear drawing shapes) and are pure, framework-free decision functions
 * consumed identically by React and Vue; keep changes to this behaviour in the
 * shared module so both bindings stay in sync.
 *
 * @module smartart-node-pane-handlers
 */
export {
	addSiblingAfter,
	classifyExtraConnections,
	countTopLevel,
	demote,
	extraConnectionCount,
	promote,
	removeEmptyNode,
	reorder,
	siblingCount,
	siblingIndex,
} from 'pptx-viewer-shared';
export type { NodePaneKeyResult } from 'pptx-viewer-shared';
