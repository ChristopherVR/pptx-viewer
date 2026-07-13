import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

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
}): StructuredEditorOperations {
	return {
		commitTableCell(id, row, column, text) {
			const state = deps.store.get();
			const target = findActiveElement(state, id);
			if (target?.type !== 'table' || !target.tableData?.rows[row]?.cells[column]) {
				return;
			}
			deps.pushHistory();
			const rows = target.tableData.rows.map((tableRow, rowIndex) => ({
				...tableRow,
				cells: tableRow.cells.map((cell, cellIndex) =>
					rowIndex === row && cellIndex === column ? { ...cell, text, textRuns: undefined } : cell,
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
