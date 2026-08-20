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
 * `demote` / `promote` / `reorder` are re-exported under the `*Node` names
 * this composable has always used, since `useSmartArtEditing` defines its own
 * (differently-shaped) `demote` / `promote` API methods and would otherwise
 * shadow the shared imports.
 *
 * @module smartart-node-pane-handlers
 */
export {
	addSiblingAfter,
	classifyExtraConnections,
	countTopLevel,
	demote as demoteNode,
	extraConnectionCount,
	promote as promoteNode,
	removeEmptyNode,
	reorder as reorderNode,
	siblingCount,
	siblingIndex,
} from 'pptx-viewer-shared';
export type { NodePaneKeyResult } from 'pptx-viewer-shared';
