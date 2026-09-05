/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
/**
 * chart-element-view-helpers.ts: the Angular-specific glue behind direct
 * on-canvas chart editing (no Angular imports, so the colocated vitest suite
 * can exercise it without TestBed).
 *
 * The value-drag state machine, the selected-part DOM highlight, and the base
 * interaction stylesheet are the framework-neutral engine in
 * `pptx-viewer-shared/render/chart-canvas-drag` (`beginChartValueDrag`,
 * `advanceChartValueDrag`, `applyChartPartHighlight`,
 * `ensureChartInteractionStyles`), consumed here via `../internal/shared` like
 * every other Angular chart module. This file keeps only what genuinely does
 * not belong there: routing a commit to the right slide (template vs. normal),
 * and the extra CSS for Angular's own drag badge / inline title editor
 * (component styles are view-encapsulated and cannot reach into the chart
 * renderer's SVG, so they are injected globally alongside the shared rules).
 */
import type { PptxChartData, PptxElement, PptxSlide } from 'pptx-viewer-core';

import {
	canDrillDown,
	ensureChartInteractionStyles as ensureSharedChartInteractionStyles,
} from '../internal/shared';
import type { ChartMarkDragState, ChartValueDragState } from '../internal/shared';
import { findOwningSlideIndex } from './smart-art-inline-edit';

// ─────────────────────────────────────────────────────────────────────────────
// Direct part-editing gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * May this chart's individual parts (title, series, data points) be entered
 * for direct on-canvas editing?
 *
 * Pure so it is unit-testable without a full Angular injection context:
 * `ChartElementViewComponent`'s constructor runs an `effect()` that needs a
 * `ChangeDetectionScheduler` this package's TestBed-free suite doesn't
 * provide. G8: `a:graphicFrameLocks/@noDrilldown` forbids the drill-down,
 * even when the chart is otherwise selected + editable.
 */
export function chartCanEditParts(
	editable: boolean,
	isSelected: boolean,
	hasEditor: boolean,
	element: PptxElement,
): boolean {
	return editable && isSelected && hasEditor && canDrillDown(element);
}

// ─────────────────────────────────────────────────────────────────────────────
// Value-drag commit gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The chart data a finished drag should commit, or null when nothing should
 * be committed (cancelled, or the press never became a drag).
 */
export function chartDragCommitData(
	session: ChartValueDragState | null,
	commit: boolean,
): PptxChartData | null {
	if (!commit || !session?.moved) {
		return null;
	}
	return session.lastData;
}

/**
 * Same gate as {@link chartDragCommitData}, for a pie/radar/stacked mark drag
 * ({@link ChartMarkDragState} carries the same `moved`/`lastData` shape as the
 * cartesian value-drag session, just resolved through a different geometry).
 */
export function chartMarkDragCommitData(
	session: ChartMarkDragState | null,
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
// Interaction stylesheet (shared base rules + Angular's own badge/editor CSS)
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ELEMENT_ID = 'pptx-ng-chart-interaction-styles';

/**
 * Angular-only interaction CSS, injected once into `document.head` alongside
 * the shared `[data-chart-part]` / selected-mark rules from
 * `ensureChartInteractionStyles` (`pptx-viewer-shared`). Component styles are
 * view-encapsulated in Angular, so they cannot reach into the chart
 * renderer's SVG or style the badge/title-input this component projects
 * next to it.
 */
const INTERACTION_CSS = `
.pptx-ng-chart-view { position: relative; width: 100%; height: 100%; }
.pptx-ng-chart-drag-badge { position: absolute; top: 4px; right: 4px; z-index: 10; border-radius: 4px; background: rgba(37, 99, 235, 0.9); padding: 2px 6px; font-size: 10px; font-weight: 500; color: #fff; pointer-events: none; }
.pptx-ng-chart-title-input { position: absolute; left: 50%; top: 2px; z-index: 10; width: 60%; transform: translateX(-50%); border: 1px solid #94a3b8; border-radius: 4px; background: #fff; padding: 2px 4px; text-align: center; font-size: 11px; color: #0f172a; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2); }
`;

/**
 * Inject the interaction stylesheets for chart part hit targets: the shared
 * base rules (singleton, shared across all five bindings) plus Angular's own
 * badge/title-input CSS (singleton, this binding only).
 */
export function ensureChartInteractionStyles(): void {
	ensureSharedChartInteractionStyles();
	if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}
	const style = document.createElement('style');
	style.id = STYLE_ELEMENT_ID;
	style.textContent = INTERACTION_CSS;
	document.head.appendChild(style);
}
