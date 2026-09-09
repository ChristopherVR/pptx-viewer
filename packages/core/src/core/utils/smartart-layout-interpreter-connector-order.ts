/**
 * SmartArt DiagramML interpreter - `dgm:cxn`-derived connector labels and
 * child order.
 *
 * Split out of `smartart-layout-interpreter.ts` (the repo's per-file line
 * budget): two small, pure lookups built from the data model's `dgm:cxn`
 * connections, consumed by `runArrangement` there and by `arrangeHierarchy`.
 * Pure TypeScript - no framework code, no DOM.
 */

import type { PptxSmartArtConnection } from '../types';

/** Build `${parentId}>${childId} -> label` from labelled `parOf` connections. */
export function buildConnectorLabels(
	connections: PptxSmartArtConnection[] | undefined,
): Map<string, string> | undefined {
	if (!connections || connections.length === 0) {
		return undefined;
	}
	const labels = new Map<string, string>();
	for (const connection of connections) {
		if (!connection.label) {
			continue;
		}
		const isParentChildEdge = !connection.type || connection.type === 'parOf';
		if (isParentChildEdge) {
			labels.set(`${connection.sourceId}>${connection.destId}`, connection.label);
		}
	}
	return labels.size > 0 ? labels : undefined;
}

/**
 * Build `childId -> srcOrd` from `parOf` connections. `arrangeHierarchy`'s
 * flat `nodes` array is in `dgm:ptLst` declaration order, which is NOT
 * necessarily left-to-right sibling order - the `dgm:cxn`'s own `srcOrd`
 * (`PptxSmartArtConnection.srcOrd`) is (COM-verified against
 * `hierarchy--hier8.pptx`: 5 siblings' `ptLst` order does not match their
 * cached left-to-right rendering order, but sorting by `srcOrd` reproduces
 * it exactly). See `arrangeHierarchy`'s own doc comment for how this is used.
 */
export function buildChildOrder(
	connections: PptxSmartArtConnection[] | undefined,
): Map<string, number> | undefined {
	if (!connections || connections.length === 0) {
		return undefined;
	}
	const order = new Map<string, number>();
	for (const connection of connections) {
		const isParentChildEdge = !connection.type || connection.type === 'parOf';
		if (isParentChildEdge && typeof connection.srcOrd === 'number') {
			order.set(connection.destId, connection.srcOrd);
		}
	}
	return order.size > 0 ? order : undefined;
}
