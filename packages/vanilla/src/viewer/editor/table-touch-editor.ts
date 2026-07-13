import type { ViewerState } from '../state';
import type { EditorOps } from './editor-operations';
import { handleStructuredDblClick } from './structured-dblclick';
import type { TableCellEditorSession } from './table-cell-editor';
import { createTableDoubleTapRecognizer, resolveTableTouchTarget } from './table-double-tap';

/** Bind touch table editing at document capture so selection overlays cannot hide the second tap. */
export function bindTableTouchEditor(options: {
	doc: Document;
	getState(): ViewerState;
	getStage(): Element | null;
	getOverlay(): HTMLElement | null;
	ops: EditorOps;
	onOpen(session: TableCellEditorSession | null): void;
	onEditEquation?(id: string, omml: Record<string, unknown>): void;
}): () => void {
	const recognize = createTableDoubleTapRecognizer();
	const pointerDown = (event: PointerEvent): void => {
		const state = options.getState();
		if (!state.editable || state.presenting || event.button !== 0) {
			return;
		}
		const { cell, id } = resolveTableTouchTarget(event, options.doc, options.getStage());
		if (!cell || !recognize(event, id, cell)) {
			return;
		}
		const result = handleStructuredDblClick({
			event,
			state,
			doc: options.doc,
			stage: options.getStage(),
			overlay: options.getOverlay(),
			ops: options.ops,
			elementId: id,
			cell,
			onEditEquation: options.onEditEquation,
		});
		if (!result.handled) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		options.onOpen(result.tableSession);
	};
	options.doc.addEventListener('pointerdown', pointerDown, true);
	return () => options.doc.removeEventListener('pointerdown', pointerDown, true);
}
