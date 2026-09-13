import type { PptxElement, XmlObject } from '../types';
import { xmlChild } from '../utils/xml-access';
import { reorderObjectKeys } from '../utils/xml-reorder';
import { createShapeIdResolver } from './shape-id-resolver';

/**
 * Assign missing native identities before any shape is serialized, then map
 * runtime references without changing the canvas model's connector bindings.
 * Allocating only targets lets an earlier unreferenced shape take their IDs.
 */
export function resolveConnectorShapeIds(
	elements: readonly PptxElement[],
	reservedMaxId: number,
): Map<string, string> {
	const resolve = createShapeIdResolver(elements, reservedMaxId);
	const result = new Map<string, string>();
	const visit = (element: PptxElement): void => {
		const nativeId = resolve(element.id);
		if (nativeId !== undefined) {
			result.set(element.id, nativeId);
		}
		if (element.type === 'group') {
			element.children.forEach(visit);
		}
	};
	elements.forEach(visit);
	return result;
}

/** Update only represented connector bindings, leaving unknown native endpoint data alone. */
export function applyConnectorShapeIds(
	shape: XmlObject,
	element: PptxElement,
	nativeIds: ReadonlyMap<string, string>,
): void {
	if (element.type !== 'connector' || !element.shapeStyle) {
		return;
	}
	const nv = xmlChild(shape, 'p:nvCxnSpPr');
	if (!nv) {
		return;
	}
	const connections = xmlChild(nv, 'p:cNvCxnSpPr') ?? {};
	for (const [tag, reference] of [
		['a:stCxn', element.shapeStyle.connectorStartConnection],
		['a:endCxn', element.shapeStyle.connectorEndConnection],
	] as const) {
		if (!reference?.shapeId) {
			continue;
		}
		const nativeId =
			nativeIds.get(reference.shapeId) ??
			(/^\d+$/.test(reference.shapeId) ? reference.shapeId : undefined);
		if (nativeId === undefined) {
			// Do not replace an authored endpoint with an unresolved runtime ID.
			// Newly fabricated connectors have no native endpoint to preserve.
			if (!element.rawXml) {
				delete connections[tag];
			}
			continue;
		}
		connections[tag] = {
			...xmlChild(connections, tag),
			'@_id': nativeId,
			'@_idx': String(reference.connectionSiteIndex ?? 0),
		};
	}
	if (Object.keys(connections).length > 0) {
		nv['p:cNvCxnSpPr'] = reorderObjectKeys(connections, [
			'a:cxnSpLocks',
			'a:stCxn',
			'a:endCxn',
			'a:extLst',
		]);
	}
}
