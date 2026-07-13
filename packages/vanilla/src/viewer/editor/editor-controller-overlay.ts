import type { PptxElement } from 'pptx-viewer-core';
import { selectionBounds } from 'pptx-viewer-shared';

import type { OverlayBox } from './selection-overlay';

/** Resolve the overlay box for a single or collective selection. */
export function selectionOverlayBox(elements: readonly PptxElement[]): OverlayBox | null {
	if (elements.length === 0) {
		return null;
	}
	if (elements.length > 1) {
		const bounds = selectionBounds(elements);
		return bounds ? { ...bounds, rotation: bounds.rotation ?? 0 } : null;
	}
	const element = elements[0];
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		rotation: element.rotation ?? 0,
	};
}
