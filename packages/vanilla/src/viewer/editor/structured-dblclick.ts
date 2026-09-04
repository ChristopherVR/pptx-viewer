import { hasTextProperties } from 'pptx-viewer-core';
import { canDrillDown } from 'pptx-viewer-shared';

import type { ViewerState } from '../state';
import { findActiveElement } from './editor-active-elements';
import type { EditorOps } from './editor-operations';
import { resolveTopLevelElementId } from './element-hit';
import type { TableCellEditorSession } from './table-cell-editor';
import { openTableCellEditor } from './table-cell-editor';

export function handleStructuredDblClick(options: {
	event: Event;
	state: ViewerState;
	doc: Document;
	stage: Element | null;
	overlay: HTMLElement | null;
	ops: EditorOps;
	elementId?: string | null;
	cell?: HTMLTableCellElement | null;
	onEditEquation?(id: string, omml: Record<string, unknown>): void;
}): { handled: boolean; tableSession: TableCellEditorSession | null } {
	const id = options.elementId ?? resolveTopLevelElementId(options.event.target, options.stage);
	const element = id ? findActiveElement(options.state, id) : undefined;
	const equation =
		element && hasTextProperties(element)
			? element.textSegments?.find((segment) => segment.equationXml)?.equationXml
			: undefined;
	if (id && equation && options.onEditEquation) {
		options.onEditEquation(id, equation as Record<string, unknown>);
		return { handled: true, tableSession: null };
	}
	const cell =
		options.cell ??
		(options.event.target instanceof Element
			? options.event.target.closest<HTMLTableCellElement>('td')
			: null);
	// G8: `a:graphicFrameLocks/@noDrilldown` forbids selecting/editing this
	// table's individual cells, even on an otherwise-editable deck.
	if (!cell || element?.type !== 'table' || !options.overlay || !canDrillDown(element)) {
		return { handled: false, tableSession: null };
	}
	return {
		handled: true,
		tableSession: openTableCellEditor({
			doc: options.doc,
			cell,
			element,
			row: Number(cell.dataset.rowIndex),
			column: Number(cell.dataset.cellIndex),
			ops: options.ops,
		}),
	};
}
