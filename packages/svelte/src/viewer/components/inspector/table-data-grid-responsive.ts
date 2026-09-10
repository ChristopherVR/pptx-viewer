/**
 * table-data-grid-responsive.ts: pure derivation of TableDataGrid's
 * dense-panel responsive values from the browser viewport width.
 *
 * Split out of `TableDataGrid.svelte` to keep that component within the
 * file-size budget (CLAUDE.md): the component stays a thin binding that
 * calls this and spreads the result onto its markup, rather than computing
 * the style strings inline. This module owns no thresholds of its own; it
 * only shapes `pptx-viewer-shared`'s `getDenseGridLayoutPlan` /
 * `getDensePanelTouchTargetPx` decision-function output into the CSS the
 * component needs.
 */
import type { DenseGridLayoutPlan } from 'pptx-viewer-shared';
import { getDenseGridLayoutPlan, getDensePanelTouchTargetPx } from 'pptx-viewer-shared';

export interface TableDataGridResponsive {
	/** The raw shared decision, in case a caller needs a specific field. */
	gridPlan: DenseGridLayoutPlan;
	/** Inline style enforcing the plan's minimum column width on a cell/header. */
	cellMinWidthStyle: string;
	/** Inline min-width/min-height style sizing a control to the touch target. */
	touchStyle: string;
	/** Class name pinning the row/column-number gutter, or '' when not compact. */
	gutterClass: string;
	/** Inline width style for the gutter corner cell, wide enough for its remove button. */
	cornerStyle: string;
}

/** The row/column-number gutter's un-adjusted width (px) above the breakpoint. */
const DEFAULT_CORNER_WIDTH_PX = 40;

export function computeTableDataGridResponsive(viewportWidth: number): TableDataGridResponsive {
	const gridPlan = getDenseGridLayoutPlan(viewportWidth);
	const touchPx = getDensePanelTouchTargetPx(viewportWidth);
	return {
		gridPlan,
		cellMinWidthStyle: `min-width: ${gridPlan.minCellWidthPx}px`,
		touchStyle: `min-width: ${touchPx}px; min-height: ${touchPx}px;`,
		gutterClass: gridPlan.stickyFirstColumn ? 'pptx-svelte-table-grid-sticky' : '',
		// A 44px remove button below the breakpoint needs at least that much
		// room to sit inside the gutter, which is normally a fixed 40px.
		cornerStyle: `width: ${Math.max(DEFAULT_CORNER_WIDTH_PX, touchPx)}px`,
	};
}
