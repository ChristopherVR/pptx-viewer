import type { PptxElement } from 'pptx-viewer-core';
import { selectionBounds } from 'pptx-viewer-shared';
import type { InteractionBox, SnapSibling } from 'pptx-viewer-shared';

import type { OverlayBox } from './types';

export function elementInteractionBox(
	elements: readonly PptxElement[],
	id: string,
): InteractionBox | undefined {
	const element = elements.find((candidate) => candidate.id === id);
	return element ? elementOverlayBox(element) : undefined;
}

export function elementOverlayBox(element: PptxElement): OverlayBox {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation ?? 0,
	};
}

export function selectionOverlayBox(elements: readonly PptxElement[]): OverlayBox | null {
	if (elements.length === 1) {
		return elementOverlayBox(elements[0]);
	}
	const bounds = selectionBounds(elements);
	return bounds ? { ...bounds, rotation: 0 } : null;
}

export function siblingBoxes(elements: readonly PptxElement[]): SnapSibling[] {
	return elements.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }));
}
