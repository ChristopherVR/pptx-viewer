/**
 * smart-art-3d-renderer-helpers.ts: pure logic behind
 * `SmartArt3DRendererComponent`, split out so it stays unit-testable without
 * Angular's TestBed (this package's vitest setup has no Angular compiler) and
 * so the component itself stays within the repo's per-file LOC budget.
 *
 * @module angular-viewer/smart-art-3d-renderer-helpers
 */
import type {
	PptxElement,
	PptxSmartArtData,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';

import { buildSmartArt3DModel, computeSmartArtElementLayout } from '../internal/shared';
import type { SmartArt3DModel } from '../internal/shared';
import type { NodeEditBox } from './smart-art-inline-edit';

const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

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
	const ctFills = data.colorTransform?.fillColors;
	const palette =
		ctFills && ctFills.length > 0
			? ctFills
			: (PALETTES[data.colorScheme ?? 'colorful1'] ?? PALETTES.colorful1);
	const style: SmartArtStyle = data.style ?? 'flat';
	const layout = computeSmartArtElementLayout(
		data,
		data.nodes,
		{ width: Math.max(element.width, 1), height: Math.max(element.height, 1) },
		palette,
		style,
		element.id,
	);
	return buildSmartArt3DModel(layout, {
		background: data.chrome?.backgroundColor,
		spatial: true,
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
