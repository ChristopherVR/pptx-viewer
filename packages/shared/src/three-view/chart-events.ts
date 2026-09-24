/**
 * Maps `<pptx-three-view>`'s chart events onto a binding's chart-part
 * selection and value-commit paths, the SAME ones its 2D SVG mark interaction
 * uses, so the chart inspector and undo history react to a 3D mark exactly
 * as they do to a 2D one.
 *
 * Each binding supplies a {@link Chart3DSelectionBridge} (its own selection
 * store and update path) and forwards the element's events to
 * {@link handleThreeViewChartEvent}; everything that decides what a click or
 * drag means lives here.
 *
 * @module three-view/chart-events
 */
import type { PptxChartData } from 'pptx-viewer-core';

import { withChartPointValue } from '../render/chart-interaction';
import type { ChartPartRef } from '../render/chart-view-model';
import type { ThreeViewDragDetail, ThreeViewState } from './types';

/** DOM event names `<pptx-three-view>` dispatches. */
export const THREE_VIEW_EVENTS = {
	state: 'pptx-three-state',
	select: 'pptx-three-select',
	drag: 'pptx-three-drag',
} as const;

/** `detail` of a `pptx-three-select` event. */
export interface ThreeViewSelectDetail {
	part: ChartPartRef | null;
}

/** `detail` of a `pptx-three-state` event. */
export interface ThreeViewStateDetail {
	state: ThreeViewState;
}

/** A binding's chart selection + commit path, as seen by one chart element. */
export interface Chart3DSelectionBridge {
	/** The chart element's id (selection scope). */
	elementId: string;
	/** The committed chart data a value drag is applied to. */
	chartData: PptxChartData | undefined;
	/** `false` on read-only mounts (thumbnails, sorter, presenter): they never touch the selection. */
	canSelect: boolean;
	/** Id of the element the current chart-part selection belongs to, or `null`. */
	selectedElementId: string | null;
	setSelection: (selection: { elementId: string; part: ChartPartRef } | null) => void;
	/** Live value for the on-canvas drag badge; `null` clears it. */
	setDragValue?: (value: number | null) => void;
	/** Commit new chart data through the history-tracked update path; omit when not editable. */
	commitChartData?: (next: PptxChartData) => void;
}

/** Apply a 3D mark selection (or a click on empty space) to the binding's selection. */
export function applyChart3DSelect(
	bridge: Chart3DSelectionBridge,
	part: ChartPartRef | null,
): void {
	if (!bridge.canSelect) {
		return;
	}
	if (part) {
		bridge.setSelection({ elementId: bridge.elementId, part });
	} else if (bridge.selectedElementId === bridge.elementId) {
		bridge.setSelection(null);
	}
}

/** Apply a 3D value drag: `move` drives the badge only, `commit` writes the data once. */
export function applyChart3DDrag(
	bridge: Chart3DSelectionBridge,
	detail: ThreeViewDragDetail,
): void {
	if (!bridge.canSelect) {
		return;
	}
	if (detail.phase === 'move') {
		bridge.setDragValue?.(detail.value);
		return;
	}
	bridge.setDragValue?.(null);
	const { part, value } = detail;
	if (!bridge.commitChartData || !bridge.chartData || part.pointIndex === undefined) {
		return;
	}
	bridge.commitChartData(
		withChartPointValue(bridge.chartData, part.seriesIndex, part.pointIndex, value),
	);
}

function detailOf<T>(event: Event): T | null {
	const detail = (event as CustomEvent<T>).detail;
	return detail && typeof detail === 'object' ? detail : null;
}

/**
 * Route one `pptx-three-select` / `pptx-three-drag` event to the bridge.
 * Returns `true` when the event was a chart event (and was handled).
 */
export function handleThreeViewChartEvent(event: Event, bridge: Chart3DSelectionBridge): boolean {
	if (event.type === THREE_VIEW_EVENTS.select) {
		const detail = detailOf<ThreeViewSelectDetail>(event);
		applyChart3DSelect(bridge, detail?.part ?? null);
		return true;
	}
	if (event.type === THREE_VIEW_EVENTS.drag) {
		const detail = detailOf<ThreeViewDragDetail>(event);
		if (detail) {
			applyChart3DDrag(bridge, detail);
		}
		return true;
	}
	return false;
}

/** The state carried by a `pptx-three-state` event, or `null` for any other event. */
export function threeViewStateOf(event: Event): ThreeViewState | null {
	if (event.type !== THREE_VIEW_EVENTS.state) {
		return null;
	}
	return detailOf<ThreeViewStateDetail>(event)?.state ?? null;
}
