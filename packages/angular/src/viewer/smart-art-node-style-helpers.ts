/**
 * smart-art-node-style-helpers.ts: pure logic for per-node SmartArt style
 * editing + node-count boundary constraints in the Angular inspector.
 *
 * Two concerns, both framework-free so they unit-test in plain vitest:
 *
 *  1. **Per-node visual overrides** - fill colour, font colour, bold, italic.
 *     These wrap the core op `setSmartArtNodeStyle` (immutable; clears
 *     drawingShapes so the renderer reflows with the override). Reading the
 *     current value off `node.style` drives the inspector controls.
 *
 *  2. **Node-count bounds** - soft, per-layout min/max guards mirroring the
 *     React `smartart-node-limits.ts`, so the text-pane Add / Remove
 *     affordances can be disabled with an explanatory hint at the bounds.
 *
 * @module angular-viewer/smart-art-node-style-helpers
 *
 * `describeSmartArtBounds` accepts an optional `TranslateService` so callers
 * with access to one get translated text; callers without one (e.g. plain
 * unit tests) still get the English fallback.
 */

import type { TranslateService } from '@ngx-translate/core';
import type {
	PptxSmartArtData,
	PptxSmartArtNode,
	PptxSmartArtNodeStyle,
	SmartArtLayoutType,
} from 'pptx-viewer-core';
import { setSmartArtNodeStyle } from 'pptx-viewer-core';

// ── Per-node style overrides ────────────────────────────────────────────────

/** Read a node's current style overrides (empty object when none). */
export function nodeStyle(node: PptxSmartArtNode): PptxSmartArtNodeStyle {
	return node.style ?? {};
}

/** Whether a node has a bold override applied. */
export function nodeBold(node: PptxSmartArtNode): boolean {
	return node.style?.bold === true;
}

/** Whether a node has an italic override applied. */
export function nodeItalic(node: PptxSmartArtNode): boolean {
	return node.style?.italic === true;
}

/** A node's fill-colour override, or `undefined` when unset. */
export function nodeFillColor(node: PptxSmartArtNode): string | undefined {
	return node.style?.fillColor;
}

/** A node's font-colour override, or `undefined` when unset. */
export function nodeFontColor(node: PptxSmartArtNode): string | undefined {
	return node.style?.fontColor;
}

/**
 * Merge a partial per-node style override onto the targeted node.
 *
 * Delegates to the core immutable op; returns a new `PptxSmartArtData` (or the
 * same ref when `nodeId` matches nothing). `drawingShapes` is cleared by the op
 * so the renderer reflows and the override takes effect.
 */
export function setNodeStyle(
	data: PptxSmartArtData,
	nodeId: string,
	patch: Partial<PptxSmartArtNodeStyle>,
): PptxSmartArtData {
	return setSmartArtNodeStyle(data, nodeId, patch);
}

/** Toggle a node's bold override. */
export function toggleNodeBold(data: PptxSmartArtData, node: PptxSmartArtNode): PptxSmartArtData {
	return setNodeStyle(data, node.id, { bold: !nodeBold(node) });
}

/** Toggle a node's italic override. */
export function toggleNodeItalic(data: PptxSmartArtData, node: PptxSmartArtNode): PptxSmartArtData {
	return setNodeStyle(data, node.id, { italic: !nodeItalic(node) });
}

// ── Node-count bounds (mirror React smartart-node-limits.ts) ─────────────────

/** A min/max bound for the number of top-level nodes in a layout. */
export interface SmartArtNodeBounds {
	/** Minimum sensible number of top-level nodes. */
	readonly min: number;
	/** Maximum sensible number of top-level nodes (undefined = unbounded). */
	readonly max?: number;
}

/** Per-layout bounds table; layouts not listed fall back to {@link DEFAULT_BOUNDS}. */
const LAYOUT_BOUNDS: Partial<Record<SmartArtLayoutType, SmartArtNodeBounds>> = {
	venn: { min: 2, max: 3 },
	matrix: { min: 4, max: 4 },
	pyramid: { min: 2, max: 5 },
	funnel: { min: 2, max: 5 },
	target: { min: 2, max: 5 },
	gear: { min: 2, max: 3 },
	cycle: { min: 3 },
};

/** Fallback bounds for any layout without an explicit entry. */
export const DEFAULT_BOUNDS: SmartArtNodeBounds = { min: 1 };

/** Resolve the node-count bounds for a layout category. */
export function getSmartArtNodeBounds(layout: SmartArtLayoutType | undefined): SmartArtNodeBounds {
	if (!layout) {
		return DEFAULT_BOUNDS;
	}
	return LAYOUT_BOUNDS[layout] ?? DEFAULT_BOUNDS;
}

/** Count of top-level (parentless) nodes in a diagram. */
export function topLevelNodeCount(data: PptxSmartArtData): number {
	return (data.nodes ?? []).filter((node) => !node.parentId).length;
}

/** Whether adding another top-level node stays within the layout's max. */
export function canAddTopLevelNode(
	layout: SmartArtLayoutType | undefined,
	topLevelCount: number,
): boolean {
	const { max } = getSmartArtNodeBounds(layout);
	return max === undefined || topLevelCount < max;
}

/** Whether removing a top-level node keeps the count at or above the min. */
export function canRemoveTopLevelNode(
	layout: SmartArtLayoutType | undefined,
	topLevelCount: number,
): boolean {
	const { min } = getSmartArtNodeBounds(layout);
	return topLevelCount > min;
}

/**
 * Short, human-readable explanation of a layout's bounds for a tooltip / hint,
 * or `undefined` when the layout imposes no meaningful limit.
 */
export function describeSmartArtBounds(
	layout: SmartArtLayoutType | undefined,
	translate?: TranslateService,
): string | undefined {
	const { min, max } = getSmartArtNodeBounds(layout);
	if (min <= 1 && max === undefined) {
		return undefined;
	}
	if (max === undefined) {
		return translate
			? translate.instant('pptx.smartArt.boundsHintMin', { min })
			: `Works best with at least ${min} items.`;
	}
	if (min === max) {
		return translate
			? translate.instant('pptx.smartArt.boundsHintExact', { max })
			: `This layout uses exactly ${max} items.`;
	}
	return translate
		? translate.instant('pptx.smartArt.boundsHintRange', { min, max })
		: `Works best with ${min} to ${max} items.`;
}
