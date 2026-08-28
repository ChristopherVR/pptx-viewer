import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { withCellText } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import {
	findActiveElement,
	getActiveElements,
	replaceActiveElements,
} from './editor-active-elements';

export interface StructuredEditorOperations {
	commitTableCell(id: string, row: number, column: number, text: string): void;
	updateEquation(id: string, omml: Record<string, unknown>): void;
}

export function createStructuredEditorOperations(deps: {
	store: Store<ViewerState>;
	pushHistory(): void;
	commitChange(): void;
	/** Options > Proofing > AutoCorrect, applied to committed table-cell text. */
	transformCommittedText?: (text: string) => string;
}): StructuredEditorOperations {
	return {
		commitTableCell(id, row, column, rawText) {
			const state = deps.store.get();
			const target = findActiveElement(state, id);
			if (target?.type !== 'table' || !target.tableData?.rows[row]?.cells[column]) {
				return;
			}
			const text = deps.transformCommittedText ? deps.transformCommittedText(rawText) : rawText;
			deps.pushHistory();
			const rows = target.tableData.rows.map((tableRow, rowIndex) => ({
				...tableRow,
				cells: tableRow.cells.map((cell, cellIndex) =>
					// Shared `withCellText`, not a local `textRuns: undefined`. Vanilla
					// was the ONLY binding clearing the stale run model here, so it was
					// the only one whose cell edits painted; that made a local defence
					// out of a decision all five bindings need.
					rowIndex === row && cellIndex === column ? withCellText(cell, text) : cell,
				),
			}));
			deps.store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id && element.type === 'table'
							? { ...element, tableData: { ...element.tableData!, rows } }
							: element,
					),
				),
			);
			deps.commitChange();
		},
		updateEquation(id, omml) {
			const state = deps.store.get();
			const target = findActiveElement(state, id);
			if (
				!target ||
				!hasTextProperties(target) ||
				!target.textSegments?.some((segment) => segment.equationXml)
			) {
				return;
			}
			deps.pushHistory();
			deps.store.set(
				replaceActiveElements(
					state,
					getActiveElements(state).map((element) =>
						element.id === id && hasTextProperties(element)
							? ({
									...element,
									textSegments: element.textSegments?.map((segment) =>
										segment.equationXml ? { ...segment, equationXml: omml } : segment,
									),
								} as PptxElement)
							: element,
					),
				),
			);
			deps.commitChange();
		},
	};
}
