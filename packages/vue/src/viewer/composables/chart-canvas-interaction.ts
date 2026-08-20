/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import { findChartPartTarget, formatAxisValue, withChartTitle } from 'pptx-viewer-shared';
import type { ChartPartRef, ChartViewModel } from 'pptx-viewer-shared';
import type { ComputedRef, Ref } from 'vue';
import { computed, onMounted, onUnmounted, onUpdated, ref, shallowRef, watch } from 'vue';

import type { ActiveValueDrag } from './chart-canvas-interaction-support';
import {
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartValueDrag,
	ensureInteractionStyles,
} from './chart-canvas-interaction-support';
import { injectChartCanvasEdit } from './chart-part-selection';

/**
 * chart-canvas-interaction (Vue): direct on-canvas chart editing, the Vue port
 * of React's `ChartElementView`. When a chart is selected in edit mode its data
 * marks become directly manipulable:
 *
 *  - click a bar / dot / slice / series line to select that part (synced with
 *    the chart inspector via the `chart-part-selection` context),
 *  - drag a data point vertically to change its value (live local preview,
 *    committed ONCE on release through the normal element-update path; Escape
 *    cancels; a floating badge shows the value mid-drag),
 *  - double-click the title to edit it in place.
 *
 * The SVG projector always emits `data-chart-*` hit-testing attributes on
 * tagged marks; they are inert until this composable adds the
 * `pptx-chart-interactive` class, which activates pointer events via the
 * injected (singleton) stylesheet. Event delegation on the chart root does the
 * rest, so no per-mark listeners exist.
 */

export interface ChartCanvasInteractionInput {
	/** The chart element as committed (no preview applied). */
	element: () => PptxElement;
	/** True only on the primary editable canvas (thumbnails/export stay inert). */
	interactive: () => boolean;
	/** The chart root element; event delegation + highlight classes target it. */
	rootEl: Ref<HTMLElement | null>;
	/**
	 * Builds the shared view model from the COMMITTED element at drag start, so
	 * axis ranges do not rescale under the pointer mid-drag.
	 */
	buildViewModel: (element: PptxElement) => ChartViewModel;
}

export interface ChartCanvasInteraction {
	/** True when the chart is selected + editable: activates part hit targets. */
	canEdit: ComputedRef<boolean>;
	/**
	 * Root classes: `pptx-vue-chart-selectable` (opts the otherwise
	 * click-transparent chart root into pointer events so it can be click-
	 * selected on the editable canvas) and `pptx-chart-interactive` (activates
	 * part hit targets once the chart is selected).
	 */
	interactiveClass: ComputedRef<string[]>;
	/** The element to render: the committed element with any drag preview applied. */
	renderedElement: ComputedRef<PptxElement>;
	/** Formatted value for the floating mid-drag badge, or null when not dragging. */
	dragLabel: ComputedRef<string | null>;
	/** Inline title editor draft; null while the editor is closed. */
	titleDraft: Ref<string | null>;
	onPointerdown: (event: PointerEvent) => void;
	onPointermove: (event: PointerEvent) => void;
	onPointerup: () => void;
	onDblclick: (event: MouseEvent) => void;
	setTitleDraft: (value: string) => void;
	commitTitle: () => void;
	cancelTitle: () => void;
}

export function useChartCanvasInteraction(
	input: ChartCanvasInteractionInput,
): ChartCanvasInteraction {
	const ctx = injectChartCanvasEdit();
	const previewData = shallowRef<PptxChartData | null>(null);
	const dragValue = ref<number | null>(null);
	const titleDraft = ref<string | null>(null);
	let activeDrag: ActiveValueDrag | null = null;

	const canEdit = computed(
		() => input.interactive() && Boolean(ctx?.canEditChart(input.element().id)),
	);
	/** Click-selectable whenever the editable canvas allows chart editing at all. */
	const selectable = computed(() => input.interactive() && Boolean(ctx?.canSelectCharts()));
	const interactiveClass = computed(() => [
		...(selectable.value ? ['pptx-vue-chart-selectable'] : []),
		...(canEdit.value ? ['pptx-chart-interactive'] : []),
	]);

	const renderedElement = computed<PptxElement>(() =>
		previewData.value
			? ({ ...input.element(), chartData: previewData.value } as PptxElement)
			: input.element(),
	);

	const dragLabel = computed(() =>
		dragValue.value === null ? null : formatAxisValue(dragValue.value),
	);

	/** The selected part when it belongs to THIS chart, else null. */
	const selectedPart = computed<ChartPartRef | null>(() => {
		const selection = ctx?.selection.value;
		return selection && selection.elementId === input.element().id ? selection.part : null;
	});

	// -- Escape cancels an in-flight value drag ------------------------------

	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			endDrag(false);
		}
	}

	function endDrag(commit: boolean): void {
		const active = activeDrag;
		activeDrag = null;
		window.removeEventListener('keydown', onWindowKeydown);
		previewData.value = null;
		dragValue.value = null;
		if (commit && active?.moved && active.lastData && ctx) {
			ctx.updateElement(input.element().id, {
				chartData: active.lastData,
			} as Partial<PptxElement>);
		}
	}

	onUnmounted(() => {
		activeDrag = null;
		window.removeEventListener('keydown', onWindowKeydown);
	});

	// -- Pointer handlers (event delegation on the chart root) ---------------

	function onPointerdown(event: PointerEvent): void {
		if (!canEdit.value) {
			return;
		}
		const part = findChartPartTarget(event.target);
		if (!part) {
			return;
		}
		event.stopPropagation();
		const element = input.element() as ChartPptxElement;
		ctx?.setSelection({ elementId: element.id, part });
		if (!element.chartData) {
			return;
		}
		const vm = input.buildViewModel(element);
		const started = beginChartValueDrag({
			part,
			viewModel: vm,
			chartData: element.chartData,
			clientY: event.clientY,
		});
		if (!started) {
			return;
		}
		event.preventDefault();
		// Pointer capture keeps the drag alive when the pointer leaves the mark;
		// guarded because test DOMs (and older browsers) may not implement it.
		try {
			(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		activeDrag = started;
		window.addEventListener('keydown', onWindowKeydown);
	}

	function onPointermove(event: PointerEvent): void {
		const active = activeDrag;
		if (!active) {
			return;
		}
		const height = input.rootEl.value?.querySelector('svg')?.getBoundingClientRect().height ?? 0;
		const step = advanceChartValueDrag(active, event.clientY, height);
		if (!step) {
			return;
		}
		previewData.value = step.chartData;
		dragValue.value = step.value;
	}

	function onPointerup(): void {
		if (activeDrag) {
			endDrag(true);
		}
	}

	// -- Inline title editing -------------------------------------------------

	function onDblclick(event: MouseEvent): void {
		if (!canEdit.value) {
			return;
		}
		const target = event.target as Partial<Element>;
		if (typeof target.closest !== 'function') {
			return;
		}
		if ((target as Element).closest("[data-chart-part='title']")) {
			event.stopPropagation();
			titleDraft.value = (input.element() as ChartPptxElement).chartData?.title ?? '';
			return;
		}
		if (findChartPartTarget(event.target)) {
			// A mark double-click is already handled as two selects; keep it from
			// bubbling into the element-level inline-text-edit handler.
			event.stopPropagation();
		}
	}

	function setTitleDraft(value: string): void {
		titleDraft.value = value;
	}

	function commitTitle(): void {
		const element = input.element() as ChartPptxElement;
		if (titleDraft.value !== null && element.chartData && ctx) {
			ctx.updateElement(element.id, {
				chartData: withChartTitle(element.chartData, titleDraft.value),
			} as Partial<PptxElement>);
		}
		titleDraft.value = null;
	}

	function cancelTitle(): void {
		titleDraft.value = null;
	}

	// -- Selected-part highlight ------------------------------------------------
	// Re-applied after every render: the projector re-creates the SVG marks on
	// each chart change, dropping DOM-only classes (mirrors React's per-render
	// effect in ChartElementView).

	function applyPartHighlight(): void {
		applyChartPartHighlight(input.rootEl.value, canEdit.value ? selectedPart.value : null);
	}

	onMounted(() => {
		ensureInteractionStyles();
		applyPartHighlight();
	});
	onUpdated(applyPartHighlight);
	watch([selectedPart, canEdit], applyPartHighlight, { flush: 'post' });

	return {
		canEdit,
		interactiveClass,
		renderedElement,
		dragLabel,
		titleDraft,
		onPointerdown,
		onPointermove,
		onPointerup,
		onDblclick,
		setTitleDraft,
		commitTitle,
		cancelTitle,
	};
}
