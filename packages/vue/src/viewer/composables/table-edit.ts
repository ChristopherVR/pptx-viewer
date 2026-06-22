import type { InjectionKey } from 'vue';
import { inject } from 'vue';

/**
 * Inline table-cell editing context, provided once at the viewer root and
 * injected by `TableRenderer` so the hot `SlideStage` -> `ElementRenderer`
 * prop chain does not have to thread an `editable` flag and a commit callback
 * through every element (mirrors the `TableThemeKey` pattern in `table-theme`).
 */
export interface TableCellEditContext {
	/** Whether inline cell editing is currently allowed (edit mode + not presenting). */
	canEdit: () => boolean;
	/**
	 * Commit a single cell's new text. The handler resolves the element by id,
	 * applies the immutable `setCellText` update, and records editor history.
	 */
	commit: (elementId: string, rowIndex: number, colIndex: number, text: string) => void;
}

/** Typed injection key for the table-cell editing context. */
export const TableCellEditKey: InjectionKey<TableCellEditContext> = Symbol(
	'pptx-vue-table-cell-edit',
);

/**
 * Resolve the injected {@link TableCellEditContext}, if any. Returns `undefined`
 * when no editing context is provided (read-only viewer), in which case the
 * table renders without inline cell editing.
 */
export function injectTableCellEdit(): TableCellEditContext | undefined {
	return inject(TableCellEditKey, undefined);
}
