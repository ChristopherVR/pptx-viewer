import { setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';
import { setCellText, shouldCommitSmartArtNodeText } from 'pptx-viewer-shared';

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
 */
export interface EditCommitHandlers {
	commitTableCell(id: string, rowIndex: number, cellIndex: number, text: string): void;
	commitSmartArtNode(id: string, nodeId: string, text: string): void;
	commitSmartArtFill(id: string, nodeId: string, fill: string): void;
}

export function createEditCommits(editor: EditorState): EditCommitHandlers {
	return {
		commitTableCell(id, rowIndex, cellIndex, text) {
			const table = editor.activeElements.find((element) => element.id === id);
			if (table?.type !== 'table') {
				return;
			}
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
			editor.applyElementPatch(id, { smartArtData: next });
		},

		commitSmartArtFill(id, nodeId, fill) {
			const element = editor.activeElements.find((candidate) => candidate.id === id);
			if (element?.type !== 'smartArt' || !element.smartArtData) {
				return;
			}
			const next = setSmartArtNodeStyle(element.smartArtData, nodeId, { fillColor: fill });
			if (next !== element.smartArtData) {
				editor.applyElementPatch(id, { smartArtData: next });
			}
		},
	};
}
