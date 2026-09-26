/**
 * smart-art-3d-renderer-helpers.ts: pure logic behind
 * `SmartArt3DRendererComponent`, split out so it stays unit-testable without
 * Angular's TestBed (this package's vitest setup has no Angular compiler) and
 * so the component itself stays within the repo's per-file LOC budget.
 *
 * @module angular-viewer/smart-art-3d-renderer-helpers
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';

import type { NodeEditBox } from './smart-art-inline-edit';

/** The element's SmartArt data, or `undefined` when it isn't a SmartArt element. */
export function getSmartArtData(element: PptxElement): PptxSmartArtData | undefined {
	return element.type === 'smartArt' ? element.smartArtData : undefined;
}

/** Position a node's bounding rect relative to its container, for the overlaid textarea. */
export function computeNode3DEditBox(nodeRect: DOMRect, containerRect: DOMRect): NodeEditBox {
	return {
		x: nodeRect.left - containerRect.left,
		y: nodeRect.top - containerRect.top,
		width: nodeRect.width,
		height: nodeRect.height,
	};
}
