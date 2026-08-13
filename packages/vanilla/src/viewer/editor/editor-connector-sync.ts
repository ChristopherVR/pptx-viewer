import { applyReroutedConnectors, rerouteConnectorsForMovedElements } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';

/**
 * Keep connectors attached to their shapes.
 *
 * A connector stores `shapeStyle.connectorStart/EndConnection` (a shape id plus
 * a connection-site index), so when the shape it points at is moved or resized
 * its own geometry has to be recomputed or it visibly detaches. Shared owns
 * that maths (`rerouteConnectorsForMovedElements` / `applyReroutedConnectors`);
 * this is only the store plumbing.
 *
 * Call at gesture END, never per preview frame, and NEVER push history here:
 * the gesture already pushed one entry, and a second would make undo take two
 * presses to put the shape back.
 */
export function syncConnectorsForMovedElements(
	store: Store<ViewerState>,
	movedIds: Set<string>,
): void {
	if (movedIds.size === 0) {
		return;
	}
	const state = store.get();
	const elements = getActiveElements(state);
	const rerouted = rerouteConnectorsForMovedElements(elements, movedIds);
	if (rerouted.length === 0) {
		return;
	}
	store.set(replaceActiveElements(state, applyReroutedConnectors(elements, rerouted)));
}
