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
 *  2. **Node-count bounds** - soft, per-layout min/max guards. The table,
 *     `getSmartArtNodeBounds`, `canAddTopLevelNode` and `canRemoveTopLevelNode`
 *     are re-exported from the single shared implementation in
 *     `pptx-viewer-shared` (`packages/shared/src/render/smartart-node-limits.ts`),
 *     which also backs the React and Vue bindings. `describeSmartArtBounds`
 *     stays a thin Angular wrapper: it takes the shared function's neutral
 *     English text and, when a `TranslateService` is supplied, swaps in the
 *     translated string keyed off the same bounds, so the shared module never
 *     takes an i18n dependency.
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

import {
	describeSmartArtBounds as describeSmartArtBoundsNeutral,
	getSmartArtNodeBounds,
} from '../internal/shared';

export {
	DEFAULT_BOUNDS,
	canAddTopLevelNode,
	canRemoveTopLevelNode,
	getSmartArtNodeBounds,
} from '../internal/shared';
export type { SmartArtNodeBounds } from '../internal/shared';

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

// ── Node-count bounds (re-exported from pptx-viewer-shared) ────────────────
// See the module doc comment: the table, `getSmartArtNodeBounds`,
// `canAddTopLevelNode` and `canRemoveTopLevelNode` are re-exported above,
// unmodified, from the single shared implementation. Only
// `describeSmartArtBounds` stays defined here, as a thin wrapper that applies
// this binding's `TranslateService` on top of the shared neutral text.

/** Count of top-level (parentless) nodes in a diagram. */
export function topLevelNodeCount(data: PptxSmartArtData): number {
	return (data.nodes ?? []).filter((node) => !node.parentId).length;
}

/**
 * Short, human-readable explanation of a layout's bounds for a tooltip / hint,
 * or `undefined` when the layout imposes no meaningful limit.
 *
 * Delegates the neutral English text to the shared implementation; when a
 * `TranslateService` is supplied, swaps in the translated string for the same
 * bounds instead.
 */
export function describeSmartArtBounds(
	layout: SmartArtLayoutType | undefined,
	translate?: TranslateService,
): string | undefined {
	const { min, max } = getSmartArtNodeBounds(layout);
	if (!translate) {
		return describeSmartArtBoundsNeutral(layout);
	}
	if (min <= 1 && max === undefined) {
		return undefined;
	}
	if (max === undefined) {
		return translate.instant('pptx.smartArt.boundsHintMin', { min });
	}
	if (min === max) {
		return translate.instant('pptx.smartArt.boundsHintExact', { max });
	}
	return translate.instant('pptx.smartArt.boundsHintRange', { min, max });
}
