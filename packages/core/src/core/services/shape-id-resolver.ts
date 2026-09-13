import type { PptxElement } from '../types';

/** Resolve runtime element IDs to native shape IDs, allocating only referenced targets. */
export function createShapeIdResolver(
	elements: readonly PptxElement[],
	reservedMaxId: number = 0,
): (elementId: string) => string | undefined {
	const byId = new Map<string, PptxElement>();
	let maxId = reservedMaxId;
	const visit = (element: PptxElement): void => {
		byId.set(element.id, element);
		if (element.shapeId !== undefined) {
			const value = Number.parseInt(element.shapeId, 10);
			if (Number.isFinite(value)) {
				maxId = Math.max(maxId, value);
			}
		}
		if (element.type === 'group') {
			element.children.forEach(visit);
		}
	};
	elements.forEach(visit);
	return (elementId) => {
		const element = byId.get(elementId);
		if (!element) {
			return undefined;
		}
		if (element.shapeId === undefined) {
			maxId += 1;
			element.shapeId = String(maxId);
		}
		return element.shapeId;
	};
}
