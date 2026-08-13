import { getContext, setContext } from 'svelte';

const TABLE_CELL_SELECTION = Symbol('pptx-svelte-table-cell-selection');

/**
 * Publishes the canvas table-cell range down to `TableView`, which is several
 * levels below the editor (canvas -> stage -> element dispatcher -> table) and
 * reachable only through props every one of those contracts would have to grow.
 *
 * A context instead of a prop chain, for the same reason the render context is
 * one: the range is ambient view state that exactly one leaf consumes.
 *
 * @module state/table-cell-selection-context
 */

/** Asks whether one rendered cell is inside the highlighted block. */
export type TableCellSelectionSource = (elementId: string, row: number, col: number) => boolean;

export function provideTableCellSelection(source: TableCellSelectionSource): void {
	setContext(TABLE_CELL_SELECTION, source);
}

/**
 * The predicate a table renderer highlights with. Falls back to "nothing is
 * selected" outside an editing host (the thumbnail rail, the export stage), so
 * a read-only surface never paints selection chrome.
 */
export function useTableCellSelection(): TableCellSelectionSource {
	return getContext<TableCellSelectionSource | undefined>(TABLE_CELL_SELECTION) ?? (() => false);
}
