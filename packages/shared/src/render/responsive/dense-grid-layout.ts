/**
 * dense-grid-layout.ts: how the chart data grid and table data grid scroll at
 * 360px.
 *
 * Both grids can have arbitrarily many columns (chart series, table columns),
 * so they can never all fit in 360px of width. The fix is not to hide
 * columns - every column is a real editable value the panel must keep - but
 * to scroll them horizontally INSIDE the grid's own container while the page
 * itself never scrolls sideways, and to keep the row-label column (category
 * names / row headers) pinned so a value cell scrolled into view still reads
 * against its row. `packages/shared/src/render/mobile-viewport.ts`'s
 * `MOBILE_BREAKPOINT` gates the sticky-column behaviour; the container's own
 * `overflow-x: auto` (already present in every binding's data grid) is
 * unconditional and unaffected by this module.
 *
 * @pure
 */
import { isDensePanelCompact } from './dense-panel-viewport';

export interface DenseGridLayoutPlan {
	/** Pin the first (row-label) column while the rest of the grid scrolls. */
	stickyFirstColumn: boolean;
	/** Minimum column width (px) below which a cell becomes unreadable/unusable. */
	minCellWidthPx: number;
}

const COMPACT_MIN_CELL_WIDTH_PX = 64;
const DEFAULT_MIN_CELL_WIDTH_PX = 72;

/** Decide the chart/table data grid's scroll behaviour at `width`. */
export function getDenseGridLayoutPlan(width: number): DenseGridLayoutPlan {
	const compact = isDensePanelCompact(width);
	return {
		stickyFirstColumn: compact,
		minCellWidthPx: compact ? COMPACT_MIN_CELL_WIDTH_PX : DEFAULT_MIN_CELL_WIDTH_PX,
	};
}
