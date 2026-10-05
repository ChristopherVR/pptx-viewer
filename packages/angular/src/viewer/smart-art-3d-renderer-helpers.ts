/**
 * smart-art-3d-renderer-helpers.ts: pure logic behind
 * `SmartArt3DRendererComponent`, split out so it stays unit-testable without
 * Angular's TestBed (this package's vitest setup has no Angular compiler) and
 * so the component itself stays within the repo's per-file LOC budget.
 *
 * @module angular-viewer/smart-art-3d-renderer-helpers
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';

import type { InlineEditRect } from '../internal/shared';
import type { NodeEditBox } from './smart-art-inline-edit';

/** The element's SmartArt data, or `undefined` when it isn't a SmartArt element. */
export function getSmartArtData(element: PptxElement): PptxSmartArtData | undefined {
	return element.type === 'smartArt' ? element.smartArtData : undefined;
}

/** A node's rect in the diagram's own SVG coordinates, as the overlaid textarea's box. */
export function toNode3DEditBox(rect: InlineEditRect): NodeEditBox {
	return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

/** Approximate rendered size of the swatch bar (6 swatches + padding/border). */
const STYLE_BAR_WIDTH = 168;
const STYLE_BAR_HEIGHT = 40;

/** The swatch bar's position above the hovered node, kept inside the container. */
export function computeNode3DStyleBarStyle(
	rect: InlineEditRect | null,
	container: { clientWidth: number; clientHeight: number } | undefined,
): Record<string, string> | null {
	if (!rect || !container) {
		return null;
	}
	const maxLeft = Math.max(0, container.clientWidth - STYLE_BAR_WIDTH);
	const maxTop = Math.max(0, container.clientHeight - STYLE_BAR_HEIGHT);
	return {
		position: 'absolute',
		left: `${Math.min(maxLeft, Math.max(0, rect.left + rect.width - STYLE_BAR_WIDTH))}px`,
		top: `${Math.min(maxTop, Math.max(0, rect.top - 22))}px`,
		'z-index': '25',
	};
}
