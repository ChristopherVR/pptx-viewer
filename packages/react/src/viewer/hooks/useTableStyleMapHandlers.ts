import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { applyTableStyleDelete, applyTableStyleMapChange } from 'pptx-viewer-shared';
import type React from 'react';

/**
 * useTableStyleMapHandlers: wires the table style DEFINITION editor's
 * `onStyleMapChange` / `onDeleteStyle` callbacks (see `TableStyleEditor`'s
 * docblock) onto mutable viewer state, via the shared pure state-transition
 * helpers in `pptx-viewer-shared`'s `table-style-map-edits` module. Both
 * edits are a whole-map replacement or a deletion, never a per-element
 * patch, so they bypass `ops.updateSelectedElement` entirely.
 */
export interface UseTableStyleMapHandlersInput {
	tableStyleMap: ParsedTableStyleMap | undefined;
	setTableStyleMap: React.Dispatch<React.SetStateAction<ParsedTableStyleMap | undefined>>;
	tableStylesToDelete: string[];
	setTableStylesToDelete: React.Dispatch<React.SetStateAction<string[]>>;
}

export interface TableStyleMapHandlers {
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	handleTableStyleMapChange: (nextMap: ParsedTableStyleMap) => void;
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	handleDeleteTableStyle: (styleId: string) => void;
}

export function useTableStyleMapHandlers(
	input: UseTableStyleMapHandlersInput,
): TableStyleMapHandlers {
	const { tableStyleMap, setTableStyleMap, tableStylesToDelete, setTableStylesToDelete } = input;

	const handleTableStyleMapChange = (nextMap: ParsedTableStyleMap): void => {
		const result = applyTableStyleMapChange({ tableStyleMap, tableStylesToDelete }, nextMap);
		setTableStyleMap(result.tableStyleMap);
		setTableStylesToDelete(result.tableStylesToDelete);
	};

	const handleDeleteTableStyle = (styleId: string): void => {
		const result = applyTableStyleDelete({ tableStyleMap, tableStylesToDelete }, styleId);
		setTableStyleMap(result.tableStyleMap);
		setTableStylesToDelete(result.tableStylesToDelete);
	};

	return { handleTableStyleMapChange, handleDeleteTableStyle };
}
