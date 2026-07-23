import type { PptxElement } from 'pptx-viewer-core';
import type { SanitizedPresence } from 'pptx-viewer-shared';

/**
 * remote-selection.ts: pure resolution logic for `RemoteSelectionOverlay`.
 * Kept in a plain `.ts` module (not inside the SFC) per repo convention:
 * SFCs stay thin presentation, logic lives in lintable TypeScript files.
 */

/** A single resolved remote selection box, in unscaled slide coordinates. */
export interface RemoteSelectionBox {
	/** Stable key (peer clientId + element id). */
	key: string;
	/** Peer display name shown in the label chip. */
	userName: string;
	/** Outline + chip colour. */
	color: string;
	/** Unscaled slide-space geometry of the selected element. */
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Resolve every remote peer's selection on the active slide into drawable
 * boxes. Only peers whose `activeSlideIndex` matches the current slide are
 * considered, and only selected ids that resolve to an element on the slide
 * produce a box.
 */
export function resolveRemoteSelectionBoxes(
	presences: readonly SanitizedPresence[],
	elements: readonly PptxElement[],
	activeSlideIndex: number,
): RemoteSelectionBox[] {
	const elementById = new Map<string, PptxElement>();
	for (const element of elements) {
		elementById.set(element.id, element);
	}
	const boxes: RemoteSelectionBox[] = [];
	for (const peer of presences) {
		if (peer.activeSlideIndex !== activeSlideIndex || !peer.selectedElementId) {
			continue;
		}
		const element = elementById.get(peer.selectedElementId);
		if (!element) {
			continue;
		}
		boxes.push({
			key: `${peer.clientId}-${element.id}`,
			userName: peer.userName,
			color: peer.userColor,
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		});
	}
	return boxes;
}
