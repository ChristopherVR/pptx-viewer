import type { PptxElement } from 'pptx-viewer-core';
import {
	computeMarqueeHitIds,
	isAdditiveSelectionPress,
	mergeAdditiveSelection,
} from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

/**
 * Rubber-band (marquee) selection for the Vue canvas.
 *
 * Vue was the only binding with no band at all: dragging across empty canvas
 * did nothing, so the only way to select two elements was Shift-clicking them
 * one at a time, and every multi-selection command (Group, Align, Distribute)
 * was that much harder to reach. The hit-test and the additive merge are the
 * shared ones (`computeMarqueeHitIds` / `mergeAdditiveSelection`), so Vue picks
 * exactly what the other four pick for the same drag.
 *
 * Coordinates are slide-space, which is what the overlay inside the scaled
 * stage renders and what the element geometry is stored in. The scale is
 * measured from the stage's own box rather than taken from the zoom state: the
 * stage is scaled by a CSS transform, so its rendered width over its authored
 * width is the true factor even when a fit-scale is folded into the zoom.
 */

/** The band, in slide-space pixels. Null when no drag is in progress. */
export interface MarqueeRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface UseMarqueeSelectionInput {
	/** Elements the band may select (already filtered for interactivity). */
	getSelectableElements: () => PptxElement[];
	/** Authored slide size, the clamp for a drag that leaves the stage. */
	getCanvasSize: () => { width: number; height: number };
	selectedElementIds: Ref<string[]>;
}

export interface UseMarqueeSelectionResult {
	marquee: Ref<MarqueeRect | null>;
	/**
	 * Start a band at `event`. Returns false when the press did not land on the
	 * slide stage (the caller then treats it as a plain empty-canvas click).
	 */
	beginMarquee: (event: PointerEvent) => boolean;
	/** Tear down any in-flight drag; for component unmount. */
	cancelMarquee: () => void;
}

/** The stage box the press landed in, or null when it landed outside one. */
function stageBoxFor(event: PointerEvent): DOMRect | null {
	const target = event.target as HTMLElement | null;
	const stage = target?.closest('[aria-roledescription="slide"]') as HTMLElement | null;
	const rect = stage?.getBoundingClientRect();
	return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

export function useMarqueeSelection(input: UseMarqueeSelectionInput): UseMarqueeSelectionResult {
	const { getSelectableElements, getCanvasSize, selectedElementIds } = input;
	const marquee = ref<MarqueeRect | null>(null);

	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let baseSelectionIds: string[] = [];
	let additive = false;

	function detach(): void {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onUp);
		pointerId = null;
		marquee.value = null;
	}

	function cancelMarquee(): void {
		if (pointerId !== null) {
			detach();
		}
	}

	/** Clamp a client point into slide space using the live stage box. */
	function slidePoint(event: PointerEvent, box: DOMRect): { x: number; y: number } {
		const size = getCanvasSize();
		const scale = box.width / Math.max(size.width, 1);
		return {
			x: Math.max(0, Math.min(size.width, (event.clientX - box.left) / scale)),
			y: Math.max(0, Math.min(size.height, (event.clientY - box.top) / scale)),
		};
	}

	let stageBox: DOMRect | null = null;

	function onMove(event: PointerEvent): void {
		if (pointerId !== event.pointerId || !stageBox) {
			return;
		}
		const point = slidePoint(event, stageBox);
		marquee.value = {
			x: Math.min(startX, point.x),
			y: Math.min(startY, point.y),
			width: Math.abs(point.x - startX),
			height: Math.abs(point.y - startY),
		};
	}

	function onUp(event: PointerEvent): void {
		if (pointerId !== event.pointerId || !stageBox) {
			return;
		}
		const point = slidePoint(event, stageBox);
		const hits = computeMarqueeHitIds(
			{ startX, startY, currentX: point.x, currentY: point.y },
			getSelectableElements(),
		);
		detach();
		// A click-sized band is a click on empty canvas: clear, do not select.
		selectedElementIds.value = additive ? mergeAdditiveSelection(baseSelectionIds, hits) : hits;
	}

	function beginMarquee(event: PointerEvent): boolean {
		const box = stageBoxFor(event);
		if (!box) {
			return false;
		}
		stageBox = box;
		const point = slidePoint(event, box);
		startX = point.x;
		startY = point.y;
		pointerId = event.pointerId;
		additive = isAdditiveSelectionPress(event);
		baseSelectionIds = additive ? [...selectedElementIds.value] : [];
		marquee.value = { x: startX, y: startY, width: 0, height: 0 };
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		return true;
	}

	return { marquee, beginMarquee, cancelMarquee };
}
