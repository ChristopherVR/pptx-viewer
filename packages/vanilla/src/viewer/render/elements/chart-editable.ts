/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   an imperative DOM-builder with many independent `const`s, not one statement */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartValueDrag,
	buildChartViewModel,
	CHART_INTERACTIVE_CLASS,
	ensureChartInteractionStyles,
	findChartPartTarget,
	formatAxisValue,
	withChartTitle,
} from 'pptx-viewer-shared';
import type { ChartPartRef, ChartValueDragState } from 'pptx-viewer-shared';

import type { ElementRenderContext } from '../types';

/**
 * chart-editable: direct on-canvas chart editing for the vanilla binding, the
 * counterpart of `smartart-editable.ts` and the port of Vue's
 * `useChartCanvasInteraction`.
 *
 * The drag state machine, the hit-target stylesheet and the selected-mark
 * highlight all live in `pptx-viewer-shared/render/chart-canvas-drag`; this
 * module is only the DOM listener plumbing, so a change to the drag maths
 * reaches all five bindings at once.
 *
 * Press a bar / dot / slice to select it, drag it vertically to change its
 * value (live local preview, committed ONCE on release so one drag is one undo
 * step), Escape cancels. The projector always emits the `data-chart-*`
 * attributes but they stay pointer-transparent until the container carries
 * `pptx-chart-interactive`, which is what keeps thumbnails and the show stage
 * inert.
 */
export function attachChartEditing(
	container: HTMLElement,
	element: PptxElement,
	context: ElementRenderContext,
	/** Re-project the chart into `container` from the given (preview) data. */
	repaint: (chartData: PptxChartData) => void,
): void {
	if (element.type !== 'chart' || !context.interactive || !context.onChartPointChange) {
		return;
	}
	const chart = element as ChartPptxElement;
	if (!chart.chartData) {
		return;
	}
	ensureChartInteractionStyles();
	container.classList.add(CHART_INTERACTIVE_CLASS);

	let active: ChartValueDragState | null = null;
	let selected: ChartPartRef | null = null;
	let badge: HTMLElement | null = null;
	let titleInput: HTMLInputElement | null = null;

	const showBadge = (text: string): void => {
		if (!badge) {
			badge = container.ownerDocument.createElement('div');
			badge.className = 'pptxv-chart-drag-badge';
			container.appendChild(badge);
		}
		badge.textContent = text;
	};
	const clearBadge = (): void => {
		badge?.remove();
		badge = null;
	};

	const onKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			end(false);
		}
	};

	/**
	 * The move / release listeners live on the WINDOW, not the container.
	 *
	 * Each preview repaint replaces the `<svg>`, which detaches the very mark the
	 * pointer went down on, so container-level listeners would stop receiving the
	 * rest of the gesture the moment the first frame rendered. Pointer capture
	 * papers over that in a real browser and is still requested below, but the
	 * drag must not depend on it.
	 */
	const onMove = (event: PointerEvent): void => {
		if (!active) {
			return;
		}
		const height = container.querySelector('svg')?.getBoundingClientRect().height ?? 0;
		const step = advanceChartValueDrag(active, event.clientY, height);
		if (!step) {
			return;
		}
		repaint(step.chartData);
		applyChartPartHighlight(container, selected);
		showBadge(formatAxisValue(step.value));
	};

	const onUp = (): void => {
		if (active) {
			end(true);
		}
	};

	function end(commit: boolean): void {
		const finished = active;
		active = null;
		const view = container.ownerDocument.defaultView;
		view?.removeEventListener('keydown', onKeydown);
		view?.removeEventListener('pointermove', onMove);
		view?.removeEventListener('pointerup', onUp);
		clearBadge();
		if (commit && finished?.moved && finished.lastData) {
			// The commit re-renders the stage from the editor's own state, so no
			// local repaint is needed (and doing one would flash the preview).
			context.onChartPointChange?.(element, finished.lastData);
			return;
		}
		if (finished?.moved && chart.chartData) {
			// Cancelled: put the committed data back on screen.
			repaint(chart.chartData);
			applyChartPartHighlight(container, selected);
		}
	}

	const closeTitleEditor = (): void => {
		titleInput?.remove();
		titleInput = null;
	};

	/**
	 * Open an inline `<input>` over the chart title, the vanilla port of React's
	 * / Vue's title editor overlay. Committed on Enter/blur, cancelled on
	 * Escape; the commit routes through the SAME `onChartPointChange` path a
	 * dragged data point uses, since both are just a `chartData` patch.
	 */
	const openTitleEditor = (): void => {
		closeTitleEditor();
		if (!chart.chartData) {
			return;
		}
		const doc = container.ownerDocument;
		titleInput = doc.createElement('input');
		titleInput.type = 'text';
		titleInput.className = 'pptxv-chart-title-input';
		titleInput.value = chart.chartData.title ?? '';
		const commitTitle = (): void => {
			const value = titleInput?.value ?? '';
			closeTitleEditor();
			if (!chart.chartData) {
				return;
			}
			context.onChartPointChange?.(element, withChartTitle(chart.chartData, value));
		};
		titleInput.addEventListener('blur', commitTitle, { once: true });
		titleInput.addEventListener('keydown', (keyEvent) => {
			if (keyEvent.key === 'Enter') {
				keyEvent.preventDefault();
				commitTitle();
			} else if (keyEvent.key === 'Escape') {
				keyEvent.preventDefault();
				closeTitleEditor();
			}
			keyEvent.stopPropagation();
		});
		titleInput.addEventListener('pointerdown', (pointerEvent) => pointerEvent.stopPropagation());
		titleInput.addEventListener('dblclick', (dblEvent) => dblEvent.stopPropagation());
		container.appendChild(titleInput);
		titleInput.focus();
		titleInput.select();
	};

	container.addEventListener('dblclick', (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		if (target.closest("[data-chart-part='title']")) {
			event.stopPropagation();
			openTitleEditor();
			return;
		}
		if (findChartPartTarget(event.target)) {
			// A mark double-click is already handled as two selects; keep it from
			// bubbling into the element-level inline-text-edit handler.
			event.stopPropagation();
		}
	});

	container.addEventListener('pointerdown', (event: PointerEvent) => {
		const part = findChartPartTarget(event.target);
		if (!part || !chart.chartData) {
			return;
		}
		// Keep the press off the element-level move handler, or dragging a bar
		// would drag the whole chart frame with it.
		event.stopPropagation();
		selected = part;
		applyChartPartHighlight(container, selected);
		// Built from the COMMITTED data so the axis cannot rescale under the
		// pointer mid-drag and carry the mark away from the cursor.
		const started = beginChartValueDrag({
			part,
			viewModel: buildChartViewModel(chart),
			chartData: chart.chartData,
			clientY: event.clientY,
		});
		if (!started) {
			return;
		}
		event.preventDefault();
		try {
			container.setPointerCapture?.(event.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		active = started;
		const view = container.ownerDocument.defaultView;
		view?.addEventListener('keydown', onKeydown);
		view?.addEventListener('pointermove', onMove);
		view?.addEventListener('pointerup', onUp);
	});
}
