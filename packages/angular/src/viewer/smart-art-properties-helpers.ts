/**
 * smart-art-properties-helpers.ts: pure logic for the Angular SmartArt inspector.
 *
 * The presentational `SmartArtPropertiesComponent` is intentionally thin: every
 * mutation it performs is delegated to one of the pure functions below, which in
 * turn wrap the framework-agnostic SmartArt editing operations re-exported from
 * `editor-insert.ts` (sourced from `pptx-viewer-core`). Keeping this logic out of
 * the component lets it be unit-tested in plain vitest (the Angular package's
 * vitest setup has no Angular compiler, so TestBed component tests are not
 * available).
 *
 * Mirrors the React inspector:
 *   packages/react/src/viewer/components/inspector/SmartArtPropertiesPanel.tsx
 *   packages/react/src/viewer/components/inspector/SmartArtLayoutSwitcher.tsx
 *
 * @module angular-viewer/smart-art-properties-helpers
 *
 * `addSubItem` accepts an optional `TranslateService` so callers with access
 * to one get a translated sub-item label; callers without one (e.g. plain
 * unit tests) still get the English fallback.
 */

import type { TranslateService } from '@ngx-translate/core';
import type {
	PptxSmartArtData,
	PptxSmartArtNode,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';

import {
	addSmartArtNodeAsChild,
	demoteSmartArtNode,
	promoteSmartArtNode,
	removeSmartArtNode,
	reorderSmartArtNode,
	switchSmartArtLayout,
	updateSmartArtNodeText,
} from './editor-insert';

// ── Option constants (mirror the React panel) ───────────────────────────────

/** Selectable colour schemes, in display order. */
export const SMART_ART_COLOR_SCHEMES: readonly SmartArtColorScheme[] = [
	'colorful1',
	'colorful2',
	'colorful3',
	'monochromatic1',
	'monochromatic2',
] as const;

/** Selectable style intensities, in display order. */
export const SMART_ART_STYLE_OPTIONS: readonly SmartArtStyle[] = [
	'flat',
	'moderate',
	'intense',
] as const;

/** Default colour scheme used when the data has none set. */
export const DEFAULT_COLOR_SCHEME: SmartArtColorScheme = 'colorful1';

/** Default style used when the data has none set. */
export const DEFAULT_STYLE: SmartArtStyle = 'flat';

/** Default resolved layout used when the data has none set. */
export const DEFAULT_LAYOUT: SmartArtLayoutType = 'list';

/** Default label for a newly added sub-item (matches the React panel). */
export const SUB_ITEM_LABEL = 'Sub-item';

// ── Read helpers ─────────────────────────────────────────────────────────────

/** The diagram's nodes, or an empty array when none are present. */
export function smartArtNodes(data: PptxSmartArtData): readonly PptxSmartArtNode[] {
	return data.nodes ?? [];
}

/** Whether a node has a parent (is a child / sub-item). */
export function isChildNode(node: PptxSmartArtNode): boolean {
	return Boolean(node.parentId);
}

/** Current colour scheme, falling back to the default. */
export function currentColorScheme(data: PptxSmartArtData): SmartArtColorScheme {
	return data.colorScheme ?? DEFAULT_COLOR_SCHEME;
}

/** Current style intensity, falling back to the default. */
export function currentStyle(data: PptxSmartArtData): SmartArtStyle {
	return data.style ?? DEFAULT_STYLE;
}

/** Current resolved layout, falling back to the default. */
export function currentLayout(data: PptxSmartArtData): SmartArtLayoutType {
	return data.resolvedLayoutType ?? DEFAULT_LAYOUT;
}

// ── Mutation helpers (all return new immutable PptxSmartArtData) ──────────────

/** Update a single node's text. */
export function setNodeText(
	data: PptxSmartArtData,
	nodeId: string,
	text: string,
): PptxSmartArtData {
	return updateSmartArtNodeText(data, nodeId, text);
}

/** Append a new top-level item. */
export function addItem(data: PptxSmartArtData): PptxSmartArtData {
	return addSmartArtNodeAsChild(data);
}

/** Add a sub-item beneath the given parent node. */
export function addSubItem(
	data: PptxSmartArtData,
	parentId: string,
	translate?: TranslateService,
): PptxSmartArtData {
	const label = translate ? translate.instant('pptx.smartart.subItemShort') : SUB_ITEM_LABEL;
	return addSmartArtNodeAsChild(data, parentId, label);
}

/** Remove a node by id (no-op when it would empty the diagram). */
export function removeNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	if (smartArtNodes(data).length <= 1) {
		return data;
	}
	return removeSmartArtNode(data, nodeId);
}

/** Promote a node up one level in the hierarchy. */
export function promoteNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	return promoteSmartArtNode(data, nodeId);
}

/** Demote a node beneath its preceding sibling. */
export function demoteNode(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	return demoteSmartArtNode(data, nodeId);
}

/** Move a node up among its siblings. */
export function moveNodeUp(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	return reorderSmartArtNode(data, nodeId, -1);
}

/** Move a node down among its siblings. */
export function moveNodeDown(data: PptxSmartArtData, nodeId: string): PptxSmartArtData {
	return reorderSmartArtNode(data, nodeId, 1);
}

/** Apply a new colour scheme; clears stale drawing shapes for reflow. */
export function setColorScheme(
	data: PptxSmartArtData,
	scheme: SmartArtColorScheme,
): PptxSmartArtData {
	return { ...data, colorScheme: scheme, drawingShapes: undefined };
}

/** Apply a new style intensity; clears stale drawing shapes for reflow. */
export function setStyle(data: PptxSmartArtData, style: SmartArtStyle): PptxSmartArtData {
	return { ...data, style, drawingShapes: undefined };
}

/**
 * Switch the diagram to a new layout, preserving node data and connections.
 * Returns the original data unchanged when the target equals the current layout.
 */
export function setLayout(data: PptxSmartArtData, layout: SmartArtLayoutType): PptxSmartArtData {
	if (currentLayout(data) === layout) {
		return data;
	}
	return switchSmartArtLayout(data, layout);
}
