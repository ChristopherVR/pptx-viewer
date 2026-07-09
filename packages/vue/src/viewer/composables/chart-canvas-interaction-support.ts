import type { PptxChartData } from 'pptx-viewer-core';
import type { ChartPartRef, ChartValueDrag } from 'pptx-viewer-shared';

/**
 * chart-canvas-interaction-support: the non-reactive support pieces of direct
 * on-canvas chart editing (see `chart-canvas-interaction.ts`): the singleton
 * interaction stylesheet, the in-flight drag record, and the DOM highlight
 * applier for the selected part. Kept out of the composable so it stays within
 * the file-size budget and the DOM bits are unit-testable in isolation.
 */

/** Minimum pointer travel (px) before a mark press becomes a value drag. */
export const DRAG_THRESHOLD_PX = 3;

const STYLE_ELEMENT_ID = 'pptx-chart-interaction-styles';
const INTERACTION_CSS = `
.pptx-chart-interactive svg [data-chart-part] { pointer-events: auto; cursor: pointer; }
.pptx-chart-interactive svg [data-chart-part]:hover { filter: brightness(1.12); }
.pptx-chart-interactive svg [data-chart-part='title'] { cursor: text; }
.pptx-chart-interactive svg .pptx-chart-part-selected { filter: drop-shadow(0 0 2.5px #3b82f6); }
.pptx-chart-interactive svg .pptx-chart-part-selected:hover { filter: drop-shadow(0 0 2.5px #3b82f6) brightness(1.12); }
`;

/** Inject the (singleton) interaction stylesheet for chart part hit targets. */
export function ensureInteractionStyles(): void {
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = INTERACTION_CSS;
	document.head.appendChild(style);
}

/** State of an in-flight data-point value drag. */
export interface ActiveValueDrag {
	part: ChartPartRef;
	drag: ChartValueDrag;
	svgHeight: number;
	startClientY: number;
	/** View-box Y of the point's value at drag start; the drag tracks deltas from here. */
	anchorViewY: number;
	baseChartData: PptxChartData;
	moved: boolean;
	lastData: PptxChartData | null;
}

/**
 * Re-apply the selected-part highlight class inside `root`. Called after every
 * render because the projector re-creates the SVG marks on each chart change,
 * dropping DOM-only classes (mirrors React's per-render effect in
 * `ChartElementView`). A null `part` only clears.
 */
export function applyChartPartHighlight(root: HTMLElement | null, part: ChartPartRef | null): void {
	if (!root) {
		return;
	}
	for (const node of root.querySelectorAll('.pptx-chart-part-selected')) {
		node.classList.remove('pptx-chart-part-selected');
	}
	if (!part) {
		return;
	}
	const pointSel =
		part.pointIndex !== undefined
			? `[data-chart-point='${part.pointIndex}']`
			: ':not([data-chart-point])';
	const selector = `[data-chart-part='${part.role}'][data-chart-series='${part.seriesIndex}']${pointSel}`;
	for (const node of root.querySelectorAll(selector)) {
		node.classList.add('pptx-chart-part-selected');
	}
}
