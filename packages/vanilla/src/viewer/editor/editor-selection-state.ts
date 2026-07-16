import type { ViewerState } from '../state';

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
> {
	return {
		selectedElementId: id,
		selectedElementIds: ids,
		selectedTableCell: null,
		selectedTableCells: [],
		selectedTextRange: null,
	};
}
