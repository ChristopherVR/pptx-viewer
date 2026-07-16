import type { PptxElement } from 'pptx-viewer-core';

import type { ElementRendererProps } from './element-renderer-types';

type HandlerOptions = Pick<
	ElementRendererProps,
	| 'onTableCellSelect'
	| 'onCommitCellEdit'
	| 'onResizeTableColumns'
	| 'onResizeTableRow'
	| 'onUpdateSmartArtElement'
>;

export function getScopedElementHandlers(elementId: string, options: HandlerOptions) {
	const cellSelectHandler = options.onTableCellSelect
		? (cell: Parameters<NonNullable<HandlerOptions['onTableCellSelect']>>[0]) =>
				options.onTableCellSelect?.(cell, elementId)
		: undefined;
	const cellCommitHandler = options.onCommitCellEdit
		? (rowIndex: number, colIndex: number, text: string) =>
				options.onCommitCellEdit?.(elementId, rowIndex, colIndex, text)
		: undefined;
	const colResizeHandler = options.onResizeTableColumns
		? (newWidths: number[]) => options.onResizeTableColumns?.(elementId, newWidths)
		: undefined;
	const rowResizeHandler = options.onResizeTableRow
		? (rowIndex: number, newHeight: number) =>
				options.onResizeTableRow?.(elementId, rowIndex, newHeight)
		: undefined;
	const smartArtUpdateHandler = options.onUpdateSmartArtElement
		? (updates: Partial<PptxElement>) => options.onUpdateSmartArtElement?.(elementId, updates)
		: undefined;
	return {
		cellSelectHandler,
		cellCommitHandler,
		colResizeHandler,
		rowResizeHandler,
		smartArtUpdateHandler,
	};
}
