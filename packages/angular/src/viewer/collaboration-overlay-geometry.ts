/**
 * collaboration-overlay-geometry.ts: pure geometry for the collaboration
 * overlays (remote cursors + remote selection boxes).
 *
 * Kept out of the components/services so it can be unit-tested without the
 * Angular compiler (the package has no TestBed harness), matching the
 * convention used by `connector-path.ts` and the Svelte binding's
 * `collab/components/remote-selection.ts`.
 *
 * Coordinate contract: everything here is *unscaled slide space* (px). The
 * overlays are projected into the scaled slide stage, whose CSS
 * `transform: scale()` applies the on-screen scale exactly once, so no helper
 * in this module multiplies by zoom.
 */

import type { PptxElement } from 'pptx-viewer-core';

import { clampCursorPosition } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import type { RemotePresence } from './collaboration-helpers';

/** A single resolved remote selection box, in unscaled slide coordinates. */
export interface RemoteSelectionBox {
	/** Stable key (peer clientId + element id). */
	key: string;
	/** Id of the outlined element (framework-neutral e2e contract). */
	elementId: string;
	/** Peer display name, already clamped for the label chip. */
	label: string;
	/** Outline + chip colour. */
	color: string;
	/** Unscaled slide-space geometry of the selected element. */
	x: number;
	y: number;
	width: number;
	height: number;
}

/** The subset of a `DOMRect` this module needs (so tests need no real DOM). */
export interface StageRect {
	left: number;
	top: number;
	width: number;
}

/**
 * Resolve every remote peer's selection on the active slide into drawable
 * boxes. Only peers whose `activeSlideIndex` matches are considered, and only
 * selected ids that resolve to an element on the slide produce a box.
 */
export function resolveRemoteSelectionBoxes(
	presences: readonly RemotePresence[],
	elements: readonly PptxElement[],
	activeSlideIndex: number,
	formatLabel: (userName: string) => string,
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
			key: `${peer.clientId}-${peer.selectedElementId}`,
			elementId: element.id,
			label: formatLabel(peer.userName),
			color: peer.userColor,
			x: element.x,
			y: element.y,
			width: element.width,
			height: element.height,
		});
	}
	return boxes;
}

/**
 * Map a pointer's client-space position into unscaled slide coordinates,
 * clamped to the canvas.
 *
 * `rect` must be the *stage* rect (`.pptx-ng-canvas-stage`), which is already
 * post-transform: `rect.width / size.width` is therefore the live on-screen
 * scale (the auto-fit folded with the user's zoom). Measuring against the
 * `<main>` scroll host instead offsets the result by the stage origin, and
 * dividing by the user's zoom alone drops the auto-fit factor: that pairing is
 * what put remote cursors and selection boxes in the wrong place in Angular.
 */
export function clientPointToSlide(
	rect: StageRect,
	size: CanvasSize,
	clientX: number,
	clientY: number,
): { x: number; y: number } {
	const scale = size.width > 0 && rect.width > 0 ? rect.width / size.width : 1;
	return {
		x: clampCursorPosition((clientX - rect.left) / scale, 0, size.width),
		y: clampCursorPosition((clientY - rect.top) / scale, 0, size.height),
	};
}
