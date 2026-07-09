/**
 * chart-element-view-helpers.ts: pure logic behind direct on-canvas chart
 * editing (no Angular imports), mirroring React's `ChartElementView.tsx`.
 *
 * The component (`chart-element-view.component.ts`) is a thin shell over
 * these helpers: the vertical value-drag session state machine, the
 * selected-part DOM highlight, and the singleton interaction stylesheet.
 * Keeping them Angular-free lets the colocated vitest suite exercise the
 * full interaction contract without TestBed.
 */
import type { PptxChartData, PptxElement, PptxSlide } from 'pptx-viewer-core';

import { dragAnchorViewY, dragValueForPart, withChartPointValue } from '../internal/shared';
import type { ChartPartRef, ChartValueDrag, ChartViewModel } from './chart-renderer-helpers';
import { findOwningSlideIndex } from './smart-art-inline-edit';

/** Minimum pointer travel (px) before a mark press becomes a value drag. */
export const CHART_DRAG_THRESHOLD_PX = 3;

/** Class toggled onto the SVG marks matching the selected chart part. */
export const CHART_PART_SELECTED_CLASS = 'pptx-chart-part-selected';

// ─────────────────────────────────────────────────────────────────────────────
// Value-drag session state machine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * State of an in-flight vertical value drag, captured at pointer-down against
 * the COMMITTED chart data so axis ranges do not rescale under the pointer
 * mid-drag. Mutated in place by {@link moveChartValueDrag}.
 */
export interface ChartValueDragSession {
	part: ChartPartRef;
	drag: ChartValueDrag;
	svgHeight: number;
	startClientY: number;
	/** View-box Y of the point's value at drag start; deltas apply from here. */
	anchorViewY: number;
	baseChartData: PptxChartData;
	moved: boolean;
	lastData: PptxChartData | null;
	lastValue: number | null;
}

/**
 * Begin a value drag for a pressed part, or return null when the part is not
 * a draggable data point (series lines, non-cartesian charts, missing drag
 * context).
 */
export function beginChartValueDrag(
	part: ChartPartRef,
	vm: Pick<ChartViewModel, 'valueDrag' | 'svgHeight'>,
	chartData: PptxChartData,
	startClientY: number,
): ChartValueDragSession | null {
	if (part.role !== 'dataPoint' || part.pointIndex === undefined || !vm.valueDrag) {
		return null;
	}
	const startValue = chartData.series[part.seriesIndex]?.values[part.pointIndex] ?? 0;
	return {
		part,
		drag: vm.valueDrag,
		svgHeight: vm.svgHeight,
		startClientY,
		anchorViewY: dragAnchorViewY(startValue, vm.valueDrag, part.seriesIndex),
		baseChartData: chartData,
		moved: false,
		lastData: null,
		lastValue: null,
	};
}

/**
 * Advance a drag session for a pointer move. Returns the preview chart data +
 * live value once the pointer has travelled past the threshold, or null while
 * the press still counts as a click (or geometry is unusable).
 */
export function moveChartValueDrag(
	session: ChartValueDragSession,
	clientY: number,
	renderedSvgHeight: number,
): { data: PptxChartData; value: number } | null {
	if (!session.moved && Math.abs(clientY - session.startClientY) < CHART_DRAG_THRESHOLD_PX) {
		return null;
	}
	if (session.part.pointIndex === undefined || renderedSvgHeight === 0) {
		return null;
	}
	session.moved = true;
	const deltaViewY = ((clientY - session.startClientY) / renderedSvgHeight) * session.svgHeight;
	const viewY = session.anchorViewY + deltaViewY;
	const value = dragValueForPart(viewY, session.drag, session.part.seriesIndex);
	const data = withChartPointValue(
		session.baseChartData,
		session.part.seriesIndex,
		session.part.pointIndex,
		value,
	);
	session.lastData = data;
	session.lastValue = value;
	return { data, value };
}

/**
 * The chart data a finished drag should commit, or null when nothing should
 * be committed (cancelled, or the press never became a drag).
 */
export function chartDragCommitData(
	session: ChartValueDragSession | null,
	commit: boolean,
): PptxChartData | null {
	if (!commit || !session?.moved) {
		return null;
	}
	return session.lastData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commit routing (normal element-update path: one history entry per commit)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal structural view of `EditorStateService` (signal accessor + element
 * update), kept Angular-free so this module stays plainly testable.
 */
export interface ChartCommitTarget {
	slides(): readonly PptxSlide[];
	updateElement(slideIndex: number, id: string, patch: Partial<PptxElement>): void;
}

/**
 * Commit an on-canvas chart edit through the editor's normal element-update
 * path (the exact channel the inspector uses: one history snapshot per call).
 * No-op without an editor or when the element is not on any slide.
 *
 * `templateSlideId` is the id of the slide the hosting canvas renders (from
 * `SLIDE_CONTEXT`); it resolves template (master/layout) chart elements, which
 * live in the per-slide template store rather than in `slides[].elements`.
 */
export function commitChartElementData(
	editor: ChartCommitTarget | null,
	elementId: string,
	chartData: PptxChartData,
	templateSlideId?: string | null,
): void {
	if (!editor) {
		return;
	}
	const slideIndex = findOwningSlideIndex(editor.slides(), elementId, templateSlideId);
	if (slideIndex < 0) {
		return;
	}
	editor.updateElement(slideIndex, elementId, { chartData } as Partial<PptxElement>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Selected-part highlight
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS selector matching the SVG marks tagged with `part`. A part without a
 * `pointIndex` must NOT match point-level marks of the same series (and vice
 * versa), so the point clause is always present in one form or the other.
 */
export function chartPartSelector(part: ChartPartRef): string {
	const pointSel =
		part.pointIndex !== undefined
			? `[data-chart-point='${part.pointIndex}']`
			: ':not([data-chart-point])';
	return `[data-chart-part='${part.role}'][data-chart-series='${part.seriesIndex}']${pointSel}`;
}

/**
 * Re-apply the selected-part highlight class inside `root`: clears every
 * existing highlight, then tags the marks matching `part` (no-op for null).
 * Runs after each render because re-created SVG marks drop DOM-only classes.
 */
export function applyChartPartHighlight(root: ParentNode, part: ChartPartRef | null): void {
	for (const node of root.querySelectorAll(`.${CHART_PART_SELECTED_CLASS}`)) {
		node.classList.remove(CHART_PART_SELECTED_CLASS);
	}
	if (!part) {
		return;
	}
	for (const node of root.querySelectorAll(chartPartSelector(part))) {
		node.classList.add(CHART_PART_SELECTED_CLASS);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton interaction stylesheet
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ELEMENT_ID = 'pptx-ng-chart-interaction-styles';

/**
 * Interaction CSS, injected once into `document.head` (component styles are
 * view-encapsulated in Angular, so they could not reach into the chart
 * renderer's SVG). The `[data-chart-part]` rules match React's stylesheet;
 * the `pptx-ng-*` rules style this binding's badge / inline title editor.
 */
const INTERACTION_CSS = `
.pptx-chart-interactive svg [data-chart-part] { pointer-events: auto; cursor: pointer; }
.pptx-chart-interactive svg [data-chart-part]:hover { filter: brightness(1.12); }
.pptx-chart-interactive svg [data-chart-part='title'] { cursor: text; }
.pptx-chart-interactive svg .${CHART_PART_SELECTED_CLASS} { filter: drop-shadow(0 0 2.5px #3b82f6); }
.pptx-chart-interactive svg .${CHART_PART_SELECTED_CLASS}:hover { filter: drop-shadow(0 0 2.5px #3b82f6) brightness(1.12); }
.pptx-ng-chart-view { position: relative; width: 100%; height: 100%; }
.pptx-ng-chart-drag-badge { position: absolute; top: 4px; right: 4px; z-index: 10; border-radius: 4px; background: rgba(37, 99, 235, 0.9); padding: 2px 6px; font-size: 10px; font-weight: 500; color: #fff; pointer-events: none; }
.pptx-ng-chart-title-input { position: absolute; left: 50%; top: 2px; z-index: 10; width: 60%; transform: translateX(-50%); border: 1px solid #94a3b8; border-radius: 4px; background: #fff; padding: 2px 4px; text-align: center; font-size: 11px; color: #0f172a; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }
`;

/** Inject the (singleton) interaction stylesheet for chart part hit targets. */
export function ensureChartInteractionStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = INTERACTION_CSS;
	document.head.appendChild(style);
}
