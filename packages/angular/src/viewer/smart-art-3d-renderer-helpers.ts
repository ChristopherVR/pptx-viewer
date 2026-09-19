/**
 * smart-art-3d-renderer-helpers.ts: pure logic behind
 * `SmartArt3DRendererComponent`, split out so it stays unit-testable without
 * Angular's TestBed (this package's vitest setup has no Angular compiler) and
 * so the component itself stays within the repo's per-file LOC budget.
 *
 * @module angular-viewer/smart-art-3d-renderer-helpers
 */
import type { PptxElement, PptxSmartArtData, SmartArtStyle } from 'pptx-viewer-core';

import {
	buildSmartArt3DModel,
	collectCoherent3DOffNodeIds,
	resolvePalette,
	resolveSmartArt3DLayout,
} from '../internal/shared';
import type { SmartArt3DModel } from '../internal/shared';
import type { NodeEditBox } from './smart-art-inline-edit';

/** The element's SmartArt data, or `undefined` when it isn't a SmartArt element. */
export function getSmartArtData(element: PptxElement): PptxSmartArtData | undefined {
	return element.type === 'smartArt' ? element.smartArtData : undefined;
}

/**
 * Build the pure 3D model for a SmartArt element, or `null` when there is no
 * geometry to mount (not a SmartArt element, or an empty diagram).
 */
export function buildSmartArt3DModelForElement(element: PptxElement): SmartArt3DModel | null {
	const data = getSmartArtData(element);
	if (!data || data.nodes.length === 0) {
		return null;
	}
	const style: SmartArtStyle = data.style ?? 'flat';
	const layout = resolveSmartArt3DLayout(
		data,
		data.nodes,
		{ width: Math.max(element.width, 1), height: Math.max(element.height, 1) },
		resolvePalette(data),
		style,
		element.id,
	);
	return buildSmartArt3DModel(layout, {
		background: data.chrome?.backgroundColor,
		spatial: true,
		coherent3DOffNodeIds: collectCoherent3DOffNodeIds(data.nodes),
	});
}

/**
 * Locate the topmost element bearing `data-smartart-node-id` in a
 * `document.elementsFromPoint` result (which, unlike a plain hit-test,
 * includes elements with `pointer-events: none` such as the invisible
 * overlay's SVG nodes), or `null` when none does.
 */
export function findSmartArtNodeElementAtPoint(elements: readonly Element[]): Element | null {
	for (const el of elements) {
		if (el.hasAttribute('data-smartart-node-id')) {
			return el;
		}
	}
	return null;
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
