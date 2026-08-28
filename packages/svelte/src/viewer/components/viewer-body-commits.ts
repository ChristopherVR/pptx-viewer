import { setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';
import type { PptxChartData } from 'pptx-viewer-core';
import { reflowSmartArtData, setCellText, shouldCommitSmartArtNodeText } from 'pptx-viewer-shared';

import type { EditorState } from '../editor/editor-state.svelte';

/**
 * On-canvas edit commits (table cell text, SmartArt node text/fill) routed from
 * the stage into the editor.
 *
 * These used to sit in `ViewerBody.svelte`. They are plain functions over
 * `EditorState` with no template dependency, so they belong in a lintable
 * module rather than an SFC: the SFC only needs to know that editing is active,
 * not how a SmartArt fill patch is shaped. Each reads `editor.activeElements`
 * at call time, so the returned closures stay correct as the deck changes.
 *
 * Both SmartArt commits run the result through `reflowSmartArtData`, as React
 * does: a node-style change clears the cached `dsp` drawing, and without the
 * reflow the diagram silently dropped to the family approximation. The cached
 * drawing still wins whenever it survives the edit (a text edit patches it in
 * place), so the precedence between the two render paths is unchanged.
 */
export interface EditCommitHandlers {
	commitTableCell(id: string, rowIndex: number, cellIndex: number, text: string): void;
	commitSmartArtNode(id: string, nodeId: string, text: string): void;
	commitSmartArtFill(id: string, nodeId: string, fill: string): void;
	/**
	 * Commit a data point dragged on the canvas. Called ONCE on pointer release
	 * (the drag itself is a local preview), so one drag is one undo step.
	 */
	commitChartPoint(id: string, chartData: PptxChartData): void;
	/** Commit a table's whole column-width array after a column-boundary drag. */
	commitTableResizeColumns(id: string, widths: number[]): void;
	/** Commit one row's new pixel height after a row-boundary drag. */
	commitTableResizeRow(id: string, rowIndex: number, height: number): void;
}

export function createEditCommits(editor: EditorState): EditCommitHandlers {
	return {
		commitTableCell(id, rowIndex, cellIndex, rawText) {
			const table = editor.activeElements.find((element) => element.id === id);
			if (table?.type !== 'table') {
				return;
			}
			const text = editor.transformCommittedText(rawText);
			const updated = setCellText(table, rowIndex, cellIndex, text);
			editor.applyElementPatch(id, { tableData: updated.tableData });
		},

		commitSmartArtNode(id, nodeId, text) {
			const element = editor.activeElements.find((candidate) => candidate.id === id);
			if (
				element?.type !== 'smartArt' ||
				!element.smartArtData ||
				!shouldCommitSmartArtNodeText(element.smartArtData, nodeId, text)
			) {
				return;
			}
			const next = updateSmartArtNodeText(element.smartArtData, nodeId, text);
			const box = { width: element.width, height: element.height };
			editor.applyElementPatch(id, { smartArtData: reflowSmartArtData(next, id, box) });
		},

		commitChartPoint(id, chartData) {
			const element = editor.activeElements.find((candidate) => candidate.id === id);
			if (element?.type !== 'chart') {
				return;
			}
			editor.applyElementPatch(id, { chartData });
		},

		commitSmartArtFill(id, nodeId, fill) {
			const element = editor.activeElements.find((candidate) => candidate.id === id);
			if (element?.type !== 'smartArt' || !element.smartArtData) {
				return;
			}
			const next = setSmartArtNodeStyle(element.smartArtData, nodeId, { fillColor: fill });
			if (next !== element.smartArtData) {
				const box = { width: element.width, height: element.height };
				editor.applyElementPatch(id, { smartArtData: reflowSmartArtData(next, id, box) });
			}
		},

		commitTableResizeColumns(id, widths) {
			const table = editor.activeElements.find((element) => element.id === id);
			if (table?.type !== 'table' || !table.tableData) {
				return;
			}
			editor.applyElementPatch(id, { tableData: { ...table.tableData, columnWidths: widths } });
		},

		commitTableResizeRow(id, rowIndex, height) {
			const table = editor.activeElements.find((element) => element.id === id);
			if (table?.type !== 'table' || !table.tableData) {
				return;
			}
			const rows = table.tableData.rows.map((row, index) =>
				index === rowIndex ? { ...row, height } : row,
			);
			editor.applyElementPatch(id, { tableData: { ...table.tableData, rows } });
		},
	};
}
