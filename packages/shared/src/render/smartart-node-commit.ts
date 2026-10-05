/**
 * The element patch an on-canvas SmartArt node edit commits (framework-agnostic).
 *
 * Both the 2D renderer and the 3D view's input layer edit a node's text or
 * fill the same way: apply the core op, then rebuild the drawing shapes if a
 * structural edit cleared them. Doing that in one place keeps the 3D view from
 * committing a different result than the 2D one for the same gesture.
 *
 * @module smartart-node-commit
 */
import type { PptxElement, PptxSmartArtData } from 'pptx-viewer-core';
import { setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';

import { resolvePalette } from './smartart-drawing';
import { shouldCommitSmartArtNodeText } from './smartart-inline-edit';
import { rebuildDrawingShapesIfCleared } from './smartart-reflow-to-shapes';

/** `next` with its cleared drawing shapes rebuilt for `element`. */
function reflowed(element: PptxElement, next: PptxSmartArtData): PptxSmartArtData {
	return rebuildDrawingShapesIfCleared(
		next,
		next.layout,
		resolvePalette(next),
		next.style ?? 'flat',
		element.id,
		{ width: element.width, height: element.height },
	);
}

/** `smartArtData` after setting a node's text, or `null` when nothing changed. */
export function commitSmartArtNodeText(
	element: PptxElement,
	nodeId: string,
	text: string,
): PptxSmartArtData | null {
	if (element.type !== 'smartArt' || !element.smartArtData) {
		return null;
	}
	const data = element.smartArtData;
	if (!shouldCommitSmartArtNodeText(data, nodeId, text)) {
		return null;
	}
	return reflowed(element, updateSmartArtNodeText(data, nodeId, text));
}

/** `smartArtData` after setting a node's fill colour, or `null` when nothing changed. */
export function commitSmartArtNodeFill(
	element: PptxElement,
	nodeId: string,
	fill: string,
): PptxSmartArtData | null {
	if (element.type !== 'smartArt' || !element.smartArtData) {
		return null;
	}
	const data = element.smartArtData;
	const next = setSmartArtNodeStyle(data, nodeId, { fillColor: fill });
	return next === data ? null : reflowed(element, next);
}
