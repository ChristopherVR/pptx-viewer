import type { ChartPptxElement, PptxChartData } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { formatAxisValue, withChartPointValue } from 'pptx-viewer-shared';

/**
 * chart-3d-interaction (Svelte): the runes-state counterpart of the 2D
 * `ChartDragController` (`chart-drag.svelte.ts`) for the five interactive
 * three.js chart scenes (bar3D/line3D/area3D/pie3D/surface3D).
 *
 * Unlike the 2D SVG projector, a 3D scene's OWN pointer state machine
 * (`pptx-viewer-shared`'s `attachChart3DPointerInteraction`) owns
 * click/drag hit-testing and paints its own mesh-material highlight; this
 * controller only:
 *  - tracks the resulting selection + live drag value as Svelte state, so the
 *    view can render a drag-value badge exactly like the 2D chart's, and
 *  - funnels a COMMITTED value drag through `withChartPointValue` and the
 *    SAME `onchartpointcommit` path 2D on-canvas dragging already uses, so
 *    the same chart inspector reacts to a 3D mark exactly like a 2D one.
 *
 * One extra wrinkle 2D does not have: every element-data change disposes the
 * previous scene and mounts a brand new one (`Bar3DChartView`'s `mountScene`
 * effect), which throws away the mesh highlight along with the old meshes.
 * `syncSelection` re-applies the tracked selection onto a freshly mounted
 * handle so a selection made before a commit survives the remount it causes.
 *
 * The shared scene only paints its OWN highlight on a plain click (`onSelect`
 * fired from `attachChart3DPointerInteraction`'s pointerup), never while a
 * value drag is in progress, so `onValueDragPreview`/`onValueDragCommit` push
 * the highlight onto the live handle themselves via `getHandle`.
 */
export interface Chart3DSelectableHandle {
	setSelectedPart: (part: ChartPartRef | null) => void;
}

export class Chart3DInteractionController<THandle extends Chart3DSelectableHandle> {
	/** The mark last selected (by click or drag), or null when nothing is selected. */
	selectedPart = $state<ChartPartRef | null>(null);
	/** Formatted value for the floating mid-drag badge, or null when idle. */
	dragLabel = $state<string | null>(null);

	#element: () => ChartPptxElement;
	#commit: (elementId: string, chartData: PptxChartData) => void;
	#getHandle: () => THandle | undefined;

	constructor(input: {
		element: () => ChartPptxElement;
		commit: (elementId: string, chartData: PptxChartData) => void;
		getHandle: () => THandle | undefined;
	}) {
		this.#element = input.element;
		this.#commit = input.commit;
		this.#getHandle = input.getHandle;
	}

	/**
	 * `interaction.onSelect`: the scene already painted its own highlight
	 * before calling this, so this only tracks the state for `syncSelection`
	 * to re-apply across a remount.
	 */
	onSelect = (part: ChartPartRef | null): void => {
		this.selectedPart = part;
	};

	/**
	 * `interaction.onValueDragPreview`: live, uncommitted value while the user
	 * drags a mark. Never reaches `onchartpointcommit` (one drag is one undo
	 * step, matching 2D); only updates the local badge + highlight.
	 */
	onValueDragPreview = (part: ChartPartRef, value: number): void => {
		this.selectedPart = part;
		this.dragLabel = formatAxisValue(value);
		this.#getHandle()?.setSelectedPart(part);
	};

	/** `interaction.onValueDragCommit`: commits the final dragged value once, on release. */
	onValueDragCommit = (part: ChartPartRef, value: number): void => {
		this.selectedPart = part;
		this.dragLabel = null;
		this.#getHandle()?.setSelectedPart(part);
		const element = this.#element();
		if (element.type !== 'chart' || !element.chartData || part.pointIndex === undefined) {
			return;
		}
		this.#commit(
			element.id,
			withChartPointValue(element.chartData, part.seriesIndex, part.pointIndex, value),
		);
	};

	/**
	 * Re-apply the tracked selection onto a freshly mounted handle. Call this
	 * once a scene mount resolves successfully.
	 */
	syncSelection(handle: THandle | undefined): void {
		handle?.setSelectedPart(this.selectedPart);
	}
}
