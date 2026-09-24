/**
 * DOM-driving implementations of the three "format object" context-menu
 * commands (Edit Text, Save as Picture, and the inspector-focus trio: Edit
 * Alt Text / Size and Position / Format Shape) that `element-context-menu-commands.ts`
 * routes to. Split out from that file because these three need direct DOM
 * lookups (the mounted element node, `requestAnimationFrame` scheduling)
 * that the rest of the command table does not.
 *
 * @module ui/context-menu-format-actions
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { InspectorSectionAnchor, RasterStrategyOptions } from 'pptx-viewer-shared';
import {
	buildRasterPictureElement,
	elementPictureFilename,
	rasterizeElementToDataUrl,
	saveElementAsPicture,
	scrollInspectorSectionIntoView,
} from 'pptx-viewer-shared';

import { findActiveElement } from '../editor/editor-active-elements';
import { renderToCanvas } from '../export/render-to-canvas';
import type { Store, ViewerState } from '../state';

/** The mounted DOM node for `elementId`, or null when it is not on screen. */
function findElementNode(doc: Document, elementId: string): HTMLElement | null {
	return doc.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);
}

/**
 * "Edit Text": same effect as double-clicking the element. The stage's
 * `dblclick` listener is delegated (bound on the stage wrapper, not per
 * element), so dispatching a bubbling synthetic `dblclick` on the element's
 * own node reaches it exactly like a real double-click, with no separate
 * "start editing" entry point to keep in sync.
 */
export function startEditingElement(doc: Document, elementId: string): void {
	const node = findElementNode(doc, elementId);
	node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
}

/** The binding's `html2canvasFallback` driver, scoped to one element node. */
function html2canvasFallbackFor(node: HTMLElement): RasterStrategyOptions['html2canvasFallback'] {
	return (sourceRect, outputSize) =>
		renderToCanvas(node, {
			scale: outputSize.width / (sourceRect.width || 1),
			x: sourceRect.x,
			y: sourceRect.y,
			width: sourceRect.width,
			height: sourceRect.height,
			useCORS: true,
			allowTaint: true,
			backgroundColor: null,
			logging: false,
		});
}

/**
 * "Save as Picture": rasterise the right-clicked element's own DOM node and
 * download it, reusing the shared raster/download pipeline every export
 * button already goes through (`rasterize-slide.ts`'s off-screen variant
 * mounts a whole slide, which is unnecessary here: the element is already
 * on screen).
 */
export function saveElementAsPictureById(
	doc: Document,
	store: Store<ViewerState>,
	elementId: string,
): void {
	const node = findElementNode(doc, elementId);
	if (!node) {
		return;
	}
	const rect = node.getBoundingClientRect();
	const width = rect.width || node.offsetWidth;
	const height = rect.height || node.offsetHeight;
	const element = findActiveElement(store.get(), elementId);
	void saveElementAsPicture(
		node,
		width,
		height,
		doc,
		elementPictureFilename(element?.name, 'Picture'),
		{ scale: 2, html2canvasFallback: html2canvasFallbackFor(node) },
	);
}

/**
 * Paste Special / Paste Options's "Picture" format: rasterise the already-
 * mounted node for `elementId` and build the resulting picture element, or
 * `null` when the node is not on screen (e.g. the toolbar outlived a slide
 * change). Shares the same rasterize pipeline `saveElementAsPictureById` uses.
 */
export async function rasterizePastedElementAsPicture(
	doc: Document,
	elementId: string,
	sourceClone: PptxElement,
): Promise<PptxElement | null> {
	const node = findElementNode(doc, elementId);
	if (!node) {
		return null;
	}
	const rect = node.getBoundingClientRect();
	const width = rect.width || node.offsetWidth;
	const height = rect.height || node.offsetHeight;
	const dataUrl = await rasterizeElementToDataUrl(node, width, height, doc, {
		scale: 2,
		html2canvasFallback: html2canvasFallbackFor(node),
	});
	return buildRasterPictureElement(sourceClone, dataUrl);
}

/**
 * "Edit Alt Text" / "Size and Position" / "Format Shape": open the inspector
 * (it may be collapsed, e.g. on a narrow viewport) and, once it has had a
 * chance to render, scroll the matching section into view. Two frames: one
 * for the store update to reach the inspector's re-render, one for layout to
 * settle, before `scrollIntoView` can find the tagged section.
 */
export function focusInspectorSection(
	doc: Document,
	store: Store<ViewerState>,
	anchor: InspectorSectionAnchor,
): void {
	store.set({ inspectorOpen: true });
	requestAnimationFrame(() => {
		requestAnimationFrame(() => scrollInspectorSectionIntoView(doc, anchor));
	});
}
