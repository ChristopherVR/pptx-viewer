import type { ViewerState } from '../state';

/**
 * The state patch applied on every element (re)selection: replaces the
 * selection ids and drops every selection-scoped sub-state (active table
 * cell, inline text range, on-canvas chart part) so a stale highlight from
 * the PREVIOUS selection cannot linger under the new one.
 */
export function selectionState(
	id: string | null,
	ids: string[],
): Pick<
	ViewerState,
	| 'selectedElementId'
	| 'selectedElementIds'
	| 'selectedTableCell'
	| 'selectedTableCells'
	| 'selectedTextRange'
	| 'chartPartSelection'
> {
	return {
		selectedElementId: id,
		selectedElementIds: ids,
		selectedTableCell: null,
		selectedTableCells: [],
		selectedTextRange: null,
		chartPartSelection: null,
	};
}
