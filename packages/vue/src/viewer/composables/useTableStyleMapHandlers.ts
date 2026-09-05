import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { applyTableStyleDelete, applyTableStyleMapChange } from 'pptx-viewer-shared';
import type { ShallowRef } from 'vue';

/**
 * useTableStyleMapHandlers: wires the table style DEFINITION editor's
 * `tableStyleMapChange` / `deleteTableStyle` events (surfaced from
 * `TableStyleOptions.vue` through `TablePanel.vue` / `InspectorPane.vue`)
 * onto `useLoadContent`'s mutable `tableStyleMap` / `tableStylesToDelete`
 * refs, via the shared pure state-transition helpers in
 * `pptx-viewer-shared`'s `table-style-map-edits` module. Both edits are a
 * whole-map replacement or a deletion, never a per-element patch, so they
 * bypass the element-update path entirely.
 */
export interface UseTableStyleMapHandlersInput {
	tableStyleMap: ShallowRef<ParsedTableStyleMap | undefined>;
	tableStylesToDelete: ShallowRef<string[]>;
	markDirty: () => void;
}

export interface TableStyleMapHandlers {
	/** Commit a full replacement style map (section edit, create, or delete already applied). */
	onTableStyleMapChange: (nextMap: ParsedTableStyleMap) => void;
	/** Record a styleId for save-time removal from `ppt/tableStyles.xml`. */
	onDeleteTableStyle: (styleId: string) => void;
}

export function useTableStyleMapHandlers(
	input: UseTableStyleMapHandlersInput,
): TableStyleMapHandlers {
	const { tableStyleMap, tableStylesToDelete, markDirty } = input;

	function onTableStyleMapChange(nextMap: ParsedTableStyleMap): void {
		const result = applyTableStyleMapChange(
			{ tableStyleMap: tableStyleMap.value, tableStylesToDelete: tableStylesToDelete.value },
			nextMap,
		);
		tableStyleMap.value = result.tableStyleMap;
		tableStylesToDelete.value = result.tableStylesToDelete;
		markDirty();
	}

	function onDeleteTableStyle(styleId: string): void {
		const result = applyTableStyleDelete(
			{ tableStyleMap: tableStyleMap.value, tableStylesToDelete: tableStylesToDelete.value },
			styleId,
		);
		tableStyleMap.value = result.tableStyleMap;
		tableStylesToDelete.value = result.tableStylesToDelete;
		markDirty();
	}

	return { onTableStyleMapChange, onDeleteTableStyle };
}
